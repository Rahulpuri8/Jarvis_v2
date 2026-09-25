import { describe, expect, it, vi } from 'vitest';
import { BrowserAgentService } from '../electron/services/browser-agent.service';
import type { ToolResult } from '../../../packages/shared/types';

const call = (name: string, args: Record<string, unknown>) => ({
  message: { tool_calls: [{ function: { name, arguments: args } }] },
});

describe('BrowserAgentService', () => {
  it('feeds a browser observation back to the model before reporting success', async () => {
    const chat = vi.fn()
      .mockResolvedValueOnce(call('browser.open', { url: 'https://example.com' }))
      .mockResolvedValueOnce({ message: { content: 'The page title is Example Domain.' } });
    const execute = vi.fn().mockResolvedValue({
      success: true, status: 'completed', data: { title: 'Example Domain' },
      message: 'Opened', request_id: 'r1',
    } as ToolResult);
    const agent = new BrowserAgentService(execute, chat);

    const result = await agent.start('Open the browser at example.com and tell me the title');
    expect(result.status).toBe('completed');
    expect(result.steps).toBe(1);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(chat.mock.calls[1][0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'tool', content: expect.stringContaining('Example Domain') }),
    ]));
  });

  it('pauses before a click and resumes only the stored action after approval', async () => {
    const chat = vi.fn()
      .mockResolvedValueOnce(call('browser.click', { selector: 'text=Pricing' }))
      .mockResolvedValueOnce({ message: { content: 'Pricing page opened.' } });
    const execute = vi.fn().mockResolvedValue({
      success: true, status: 'completed', data: { url: 'https://example.com/pricing' },
      message: 'Clicked', request_id: 'r2',
    } as ToolResult);
    const agent = new BrowserAgentService(execute, chat);

    const pending = await agent.start('Click Pricing on this webpage');
    expect(pending.status).toBe('pending_approval');
    expect(execute).not.toHaveBeenCalled();
    const completed = await agent.resolveApproval(pending.approval!.id, true);
    expect(completed.status).toBe('completed');
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      tool: 'browser.click', arguments: { selector: 'text=Pricing' },
    }));
    expect((await agent.resolveApproval(pending.approval!.id, true)).status).toBe('failed');
  });

  it('does not execute a rejected form action', async () => {
    const execute = vi.fn();
    const agent = new BrowserAgentService(execute, vi.fn().mockResolvedValue(call('browser.type', {
      selector: 'input[name=email]', text: 'test@example.com',
    })));
    const pending = await agent.start('Fill the email field on this website');
    const result = await agent.resolveApproval(pending.approval!.id, false);
    expect(result.reply).toContain('Cancelled');
    expect(execute).not.toHaveBeenCalled();
  });
});
