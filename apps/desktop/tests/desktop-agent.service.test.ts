import { describe, expect, it, vi } from 'vitest';
import { DesktopAgentService } from '../electron/services/desktop-agent.service';
import type { ToolResult } from '../../../packages/shared/types';

const call = (name: string, args: Record<string, unknown>) => ({
  message: { tool_calls: [{ function: { name, arguments: args } }] },
});

describe('DesktopAgentService', () => {
  it('feeds desktop observation back to the model before concluding success', async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce(call('system.info', {}))
      .mockResolvedValueOnce({
        message: { content: 'Host has 16GB total RAM and CPU usage is 12%.' },
      });

    const execute = vi.fn().mockResolvedValue({
      success: true,
      status: 'completed',
      data: {
        cpu: { usage_percent: 12 },
        memory: { total_gb: 16, used_gb: 6, percent: 37.5 },
      },
      message: 'Telemetry retrieved',
      request_id: 'r-sys-1',
    } as ToolResult);

    const agent = new DesktopAgentService(execute, chat);

    const result = await agent.start('Check my system RAM and CPU status');
    expect(result.status).toBe('completed');
    expect(result.steps).toBe(1);
    expect(chat).toHaveBeenCalledTimes(2);
    expect(chat.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'tool',
          content: expect.stringContaining('16'),
        }),
      ]),
    );
  });

  it('pauses before terminating an app and executes only upon user approval', async () => {
    const chat = vi
      .fn()
      .mockResolvedValueOnce(call('desktop.close_app', { app_name: 'spotify.exe' }))
      .mockResolvedValueOnce({
        message: { content: 'Spotify process terminated successfully.' },
      });

    const execute = vi.fn().mockResolvedValue({
      success: true,
      status: 'completed',
      data: { closed: true, app_name: 'spotify.exe' },
      message: 'Process terminated',
      request_id: 'r-proc-1',
    } as ToolResult);

    const agent = new DesktopAgentService(execute, chat);

    const pending = await agent.start('Terminate spotify because it is using too much memory');
    expect(pending.status).toBe('pending_approval');
    expect(pending.approval).toBeDefined();
    expect(execute).not.toHaveBeenCalled();

    const completed = await agent.resolveApproval(pending.approval!.id, true);
    expect(completed.status).toBe('completed');
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'desktop.close_app',
        arguments: { app_name: 'spotify.exe' },
      }),
    );
  });

  it('does not execute a rejected destructive action', async () => {
    const execute = vi.fn();
    const chat = vi.fn().mockResolvedValue(
      call('files.delete', { path: 'C:/temp/important-log.txt' }),
    );

    const agent = new DesktopAgentService(execute, chat);
    const pending = await agent.start('Delete the log file C:/temp/important-log.txt');
    expect(pending.status).toBe('pending_approval');

    const result = await agent.resolveApproval(pending.approval!.id, false);
    expect(result.reply).toContain('cancelled');
    expect(execute).not.toHaveBeenCalled();
  });
});
