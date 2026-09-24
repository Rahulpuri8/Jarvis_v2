import { describe, expect, it } from 'vitest';
import { resolveToolFromIntent } from '../electron/ipc';

describe('Scheduler and Reminder Intent Resolver', () => {
  it('resolves timer in minutes with message', () => {
    const result = resolveToolFromIntent('remind me in 10 minutes to drink water');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('scheduler.create_timer');
    expect(result?.arguments).toEqual({
      delay_seconds: 600,
      message: 'drink water',
    });
  });

  it('resolves timer in seconds', () => {
    const result = resolveToolFromIntent('remind me in 30 seconds');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('scheduler.create_timer');
    expect(result?.arguments).toEqual({
      delay_seconds: 30,
      message: 'Reminder triggered!',
    });
  });

  it('resolves timer in hours with reminder text', () => {
    const result = resolveToolFromIntent('remind me in 2 hours to submit project report');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('scheduler.create_timer');
    expect(result?.arguments).toEqual({
      delay_seconds: 7200,
      message: 'submit project report',
    });
  });

  it('resolves "remind me to X in Y" syntax', () => {
    const result = resolveToolFromIntent('remind me to take medicine in 15 minutes');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('scheduler.create_timer');
    expect(result?.arguments).toEqual({
      delay_seconds: 900,
      message: 'take medicine',
    });
  });

  it('resolves "set a timer for" syntax', () => {
    const result = resolveToolFromIntent('set a timer for 5 minutes');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('scheduler.create_timer');
    expect(result?.arguments).toEqual({
      delay_seconds: 300,
      message: 'Timer for 5 minutes finished!',
    });
  });

  it('resolves "set timer for X to Y" syntax', () => {
    const result = resolveToolFromIntent('set timer for 45 seconds to stretch');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('scheduler.create_timer');
    expect(result?.arguments).toEqual({
      delay_seconds: 45,
      message: 'stretch',
    });
  });

  it('resolves cron job scheduling', () => {
    const result = resolveToolFromIntent('schedule cron 0 9 * * * with message morning standup');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('scheduler.create_cron');
    expect(result?.arguments).toEqual({
      cron: '0 9 * * *',
      message: 'morning standup',
    });
  });

  it('resolves daily schedule syntax', () => {
    const result = resolveToolFromIntent('schedule daily at 09:30 with message daily sync');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('scheduler.create_cron');
    expect(result?.arguments).toEqual({
      hour: 9,
      minute: 30,
      message: 'daily sync',
    });
  });

  it('resolves list reminders and list jobs', () => {
    const res1 = resolveToolFromIntent('list reminders');
    expect(res1?.tool).toBe('scheduler.list_jobs');

    const res2 = resolveToolFromIntent('list timers');
    expect(res2?.tool).toBe('scheduler.list_jobs');

    const res3 = resolveToolFromIntent('list scheduled jobs');
    expect(res3?.tool).toBe('scheduler.list_jobs');
  });

  it('resolves cancel reminder and job', () => {
    const result = resolveToolFromIntent('cancel reminder job_timer_12345');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('scheduler.cancel_job');
    expect(result?.arguments).toEqual({
      job_id: 'job_timer_12345',
    });
  });
});
