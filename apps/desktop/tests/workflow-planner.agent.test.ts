import { describe, expect, it } from 'vitest';
import { WorkflowPlannerAgent } from '../../../packages/agents/workflow-planner.agent';
import { OrchestratorAgent } from '../../../packages/agents/orchestrator.agent';

describe('WorkflowPlannerAgent & Workflow Routing', () => {
  const orchestrator = new OrchestratorAgent(null);
  const planner = new WorkflowPlannerAgent(null);

  it('routes compound multi-step queries to WORKFLOW_EXECUTION', async () => {
    const res1 = await orchestrator.run({
      message: 'search the web for typescript tutorials and save to notes.txt',
      projectHasRequirements: false,
    });
    expect(res1.data.commandType).toBe('WORKFLOW_EXECUTION');
    expect(res1.data.nextAgent).toBe('Workflow Planner Agent');

    const res2 = await orchestrator.run({
      message: 'take a screenshot and check my cpu usage',
      projectHasRequirements: false,
    });
    expect(res2.data.commandType).toBe('WORKFLOW_EXECUTION');

    const res3 = await orchestrator.run({
      message: 'close all except VS Code and then open Chrome',
      projectHasRequirements: false,
    });
    expect(res3.data.commandType).toBe('WORKFLOW_EXECUTION');
  });

  it('generates a valid multi-step plan for search & save requests', async () => {
    const plan = await planner.run({
      goal: 'search the web for fast api examples and save to results.txt',
    });

    expect(plan.data.steps.length).toBeGreaterThanOrEqual(2);
    expect(plan.data.steps[0].tool).toBe('browser.search');
    expect(plan.data.steps[1].tool).toBe('files.write');
    expect(plan.data.steps[1].dependsOn).toContain('step_1');
  });

  it('generates a valid multi-step plan for browse & screenshot requests', async () => {
    const plan = await planner.run({
      goal: 'browse to https://news.ycombinator.com, take a screenshot, and read webpage content',
    });

    expect(plan.data.steps.length).toBe(3);
    expect(plan.data.steps[0].tool).toBe('browser.open');
    expect(plan.data.steps[1].tool).toBe('browser.screenshot');
    expect(plan.data.steps[2].tool).toBe('browser.get_content');
  });
});
