import type { PythonRuntimeService } from './python-runtime.service';
import { resourceMonitor } from './resource-monitor';
import type {
  WorkflowPlan,
  WorkflowStep,
  WorkflowStepResult,
  WorkflowExecutionResult,
  ToolRequest,
  ToolResult,
} from '../../../../packages/shared/types';

export class WorkflowEngineService {
  constructor(private readonly pythonRuntimeService: PythonRuntimeService) {}

  /**
   * Resolve nested object path e.g. "step_1.data.url" from context.
   */
  private resolveValue(path: string, context: Record<string, unknown>): unknown {
    const parts = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '').split('.');
    let current: any = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Interpolate template placeholders like {{step_1.url}} in argument strings and objects.
   */
  interpolate(value: unknown, context: Record<string, unknown>): unknown {
    if (typeof value === 'string') {
      // Direct whole-value replacement (preserves object/array types)
      const directMatch = value.match(/^\{\{([^{}]+)\}\}$/);
      if (directMatch) {
        const resolved = this.resolveValue(directMatch[1].trim(), context);
        if (resolved !== undefined) {
          return resolved;
        }
      }

      // Embedded string interpolation
      return value.replace(/\{\{([^{}]+)\}\}/g, (_, path) => {
        const resolved = this.resolveValue(path.trim(), context);
        if (resolved === undefined || resolved === null) {
          return '';
        }
        if (typeof resolved === 'object') {
          return JSON.stringify(resolved, null, 2);
        }
        return String(resolved);
      });
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.interpolate(item, context));
    }

    if (value !== null && typeof value === 'object') {
      const res: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        res[k] = this.interpolate(v, context);
      }
      return res;
    }

    return value;
  }

  /**
   * Execute an ordered WorkflowPlan step by step with variable resolution and error recovery.
   */
  async executeWorkflow(
    plan: WorkflowPlan,
    onStepUpdate?: (stepResult: WorkflowStepResult, index: number, total: number) => void,
  ): Promise<WorkflowExecutionResult> {
    const stepResults: WorkflowStepResult[] = [];
    const context: Record<string, unknown> = {};
    const failedStepIds = new Set<string>();

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const startMs = Date.now();

      // Check prerequisites
      const hasFailedPrereq = step.dependsOn?.some((depId: string) => failedStepIds.has(depId));
      if (hasFailedPrereq) {
        const skippedResult: WorkflowStepResult = {
          stepId: step.id,
          tool: step.tool,
          description: step.description,
          status: 'skipped',
          durationMs: 0,
          error: 'Skipped due to failed prerequisite step.',
        };
        stepResults.push(skippedResult);
        failedStepIds.add(step.id);
        onStepUpdate?.(skippedResult, i + 1, plan.steps.length);
        continue;
      }

      // Interpolate arguments with available context
      const interpolatedArgs = this.interpolate(step.arguments, context) as Record<string, unknown>;

      const toolReq: ToolRequest = {
        tool: step.tool,
        arguments: interpolatedArgs,
      };

      try {
        // Resource Guard: centralized RAM monitor with hysteresis
        await resourceMonitor.applyThrottle();

        const result: ToolResult = await this.pythonRuntimeService.executeTool(toolReq);
        const durationMs = Date.now() - startMs;

        const isSuccess = result.status === 'completed' && result.success;
        const stepRes: WorkflowStepResult = {
          stepId: step.id,
          tool: step.tool,
          description: step.description,
          status: isSuccess ? 'completed' : 'failed',
          durationMs,
          result,
          error: isSuccess ? undefined : result.error || result.message,
        };

        stepResults.push(stepRes);

        if (isSuccess) {
          // Store result in context under step id and outputKey
          const resultData = result.data || {};
          context[step.id] = resultData;
          if (step.outputKey) {
            context[step.outputKey] = resultData;
          }
        } else {
          failedStepIds.add(step.id);
        }

        onStepUpdate?.(stepRes, i + 1, plan.steps.length);
      } catch (err: any) {
        const durationMs = Date.now() - startMs;
        const stepRes: WorkflowStepResult = {
          stepId: step.id,
          tool: step.tool,
          description: step.description,
          status: 'failed',
          durationMs,
          error: err.message,
        };
        stepResults.push(stepRes);
        failedStepIds.add(step.id);
        onStepUpdate?.(stepRes, i + 1, plan.steps.length);
      }
    }

    const allPassed = stepResults.every((s) => s.status === 'completed');
    const anyPassed = stepResults.some((s) => s.status === 'completed');
    const overallStatus: WorkflowExecutionResult['status'] = allPassed
      ? 'completed'
      : anyPassed
      ? 'partial'
      : 'failed';

    const summary = this.formatWorkflowSummary(plan, stepResults, overallStatus);

    return {
      plan,
      status: overallStatus,
      stepResults,
      context,
      summary,
    };
  }

  /**
   * Format a user-facing Markdown summary of the multi-step execution.
   */
  private formatWorkflowSummary(
    plan: WorkflowPlan,
    stepResults: WorkflowStepResult[],
    status: WorkflowExecutionResult['status'],
  ): string {
    const statusIcon = status === 'completed' ? '✅' : status === 'partial' ? '⚠️' : '❌';
    let md = `### ${statusIcon} Workflow: ${plan.goal}\n\n`;
    md += `**Overall Status**: \`${status.toUpperCase()}\` | **Steps**: ${
      stepResults.filter((s) => s.status === 'completed').length
    }/${stepResults.length} Completed\n\n`;

    md += `| Step | Action | Status | Duration |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;

    for (let i = 0; i < stepResults.length; i++) {
      const s = stepResults[i];
      const icon = s.status === 'completed' ? '🟢' : s.status === 'skipped' ? '⚪' : '🔴';
      md += `| ${i + 1} | \`${s.tool}\` (${s.description}) | ${icon} ${s.status} | ${(s.durationMs / 1000).toFixed(1)}s |\n`;
    }

    // Append notable outputs
    const completedResultsWithData = stepResults.filter(
      (s) => s.result?.data && Object.keys(s.result.data).length > 0,
    );

    if (completedResultsWithData.length > 0) {
      md += `\n#### 📋 Step Outputs\n`;
      for (const s of completedResultsWithData) {
        md += `\n**${s.description}** (\`${s.tool}\`):\n`;
        md += `\`\`\`json\n${JSON.stringify(s.result?.data, null, 2)}\n\`\`\`\n`;
      }
    }

    return md;
  }
}
