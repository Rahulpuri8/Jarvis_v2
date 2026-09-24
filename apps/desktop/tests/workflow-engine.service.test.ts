import { describe, expect, it, vi } from 'vitest';
import { WorkflowEngineService } from '../electron/services/workflow-engine.service';
import type { PythonRuntimeService } from '../electron/services/python-runtime.service';
import type { WorkflowPlan } from '../../../packages/shared/types';

describe('WorkflowEngineService', () => {
  const mockPythonService: Partial<PythonRuntimeService> = {
    executeTool: vi.fn(),
  };

  const engine = new WorkflowEngineService(mockPythonService as PythonRuntimeService);

  it('interpolates simple and nested variables from context', () => {
    const context = {
      step_1: {
        url: 'https://example.com/item/1',
        title: 'Example Page',
        stats: { views: 42 },
      },
    };

    expect(engine.interpolate('{{step_1.url}}', context)).toBe('https://example.com/item/1');
    expect(engine.interpolate('Navigate to {{step_1.title}} now', context)).toBe('Navigate to Example Page now');
    expect(engine.interpolate('{{step_1.stats.views}}', context)).toBe(42);
  });

  it('interpolates nested objects and arrays in arguments', () => {
    const context = {
      step_search: {
        results: [{ url: 'https://python.org' }],
      },
    };

    const args = {
      url: '{{step_search.results[0].url}}',
      options: {
        target: '{{step_search.results[0].url}}',
      },
    };

    const result = engine.interpolate(args, context) as any;
    expect(result.url).toBe('https://python.org');
    expect(result.options.target).toBe('https://python.org');
  });

  it('executes a 2-step workflow passing data from step 1 into step 2', async () => {
    const mockExecute = vi.fn();
    mockExecute
      .mockResolvedValueOnce({
        success: true,
        status: 'completed',
        data: { title: 'First Page', url: 'https://test.com' },
        message: 'Opened',
        request_id: '1',
      })
      .mockResolvedValueOnce({
        success: true,
        status: 'completed',
        data: { written: true },
        message: 'Saved',
        request_id: '2',
      });

    const runtimeService = { executeTool: mockExecute } as unknown as PythonRuntimeService;
    const workflowEngine = new WorkflowEngineService(runtimeService);

    const plan: WorkflowPlan = {
      goal: 'Open page and save title',
      steps: [
        {
          id: 'step_1',
          tool: 'browser.open',
          description: 'Open website',
          arguments: { url: 'https://test.com' },
          outputKey: 'open_res',
        },
        {
          id: 'step_2',
          tool: 'files.write',
          description: 'Save title to file',
          arguments: { path: 'title.txt', content: 'Title is: {{step_1.title}}' },
          dependsOn: ['step_1'],
        },
      ],
      explanation: 'Test plan',
    };

    const execution = await workflowEngine.executeWorkflow(plan);

    expect(execution.status).toBe('completed');
    expect(execution.stepResults.length).toBe(2);
    expect(execution.stepResults[0].status).toBe('completed');
    expect(execution.stepResults[1].status).toBe('completed');
    expect(mockExecute).toHaveBeenCalledTimes(2);

    // Verify step 2 was called with interpolated arguments
    expect(mockExecute).toHaveBeenNthCalledWith(2, {
      tool: 'files.write',
      arguments: { path: 'title.txt', content: 'Title is: First Page' },
    });
  });

  it('skips dependent steps if a prerequisite fails', async () => {
    const mockExecute = vi.fn().mockResolvedValueOnce({
      success: false,
      status: 'failed',
      error: 'Network timeout',
      message: 'Failed to connect',
      request_id: '1',
    });

    const runtimeService = { executeTool: mockExecute } as unknown as PythonRuntimeService;
    const workflowEngine = new WorkflowEngineService(runtimeService);

    const plan: WorkflowPlan = {
      goal: 'Failed dependency test',
      steps: [
        {
          id: 'step_1',
          tool: 'browser.open',
          description: 'Open invalid site',
          arguments: { url: 'https://bad.url' },
        },
        {
          id: 'step_2',
          tool: 'browser.screenshot',
          description: 'Take screenshot',
          arguments: {},
          dependsOn: ['step_1'],
        },
      ],
      explanation: 'Test dependency skipping',
    };

    const execution = await workflowEngine.executeWorkflow(plan);

    expect(execution.status).toBe('failed');
    expect(execution.stepResults[0].status).toBe('failed');
    expect(execution.stepResults[1].status).toBe('skipped');
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});
