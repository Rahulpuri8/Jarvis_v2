import { describe, expect, it } from 'vitest';
import { resolveToolFromIntent } from '../electron/ipc';

describe('Email and Calendar Intent Resolver', () => {
  it('resolves unread emails query', () => {
    const res1 = resolveToolFromIntent('check my emails');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('email.list_unread');

    const res2 = resolveToolFromIntent('read unread emails');
    expect(res2?.tool).toBe('email.list_unread');

    const res3 = resolveToolFromIntent('check inbox');
    expect(res3?.tool).toBe('email.list_unread');
  });

  it('resolves email search query', () => {
    const result = resolveToolFromIntent('search emails for Architecture RFC');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('email.search');
    expect(result?.arguments).toEqual({
      query: 'Architecture RFC',
      limit: 10,
    });
  });

  it('resolves read email by ID', () => {
    const result = resolveToolFromIntent('read email msg_001');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('email.read');
    expect(result?.arguments).toEqual({
      email_id: 'msg_001',
    });
  });

  it('resolves email draft creation', () => {
    const result = resolveToolFromIntent('draft email to sarah@innovate.tech with subject "Project Review" and body Please review the Q3 RFC.');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('email.draft');
    expect(result?.arguments).toEqual({
      to: 'sarah@innovate.tech',
      subject: 'Project Review',
      body: 'Please review the Q3 RFC.',
    });
  });

  it('resolves calendar today briefing query', () => {
    const res1 = resolveToolFromIntent("what's on my calendar today");
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('calendar.today_briefing');

    const res2 = resolveToolFromIntent("today's schedule");
    expect(res2?.tool).toBe('calendar.today_briefing');

    const res3 = resolveToolFromIntent('daily briefing');
    expect(res3?.tool).toBe('calendar.today_briefing');
  });

  it('resolves calendar upcoming events listing', () => {
    const res1 = resolveToolFromIntent('list events');
    expect(res1?.tool).toBe('calendar.list_events');

    const res2 = resolveToolFromIntent('upcoming events');
    expect(res2?.tool).toBe('calendar.list_events');
  });

  it('resolves meeting creation', () => {
    const result = resolveToolFromIntent('schedule a meeting Team Standup at 2026-09-06T09:30:00');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('calendar.create_event');
    expect(result?.arguments.title).toBe('Team Standup');
    expect(result?.arguments.start_time).toBe('2026-09-06T09:30:00');
  });

  it('resolves event cancellation', () => {
    const result = resolveToolFromIntent('cancel event evt_001');
    expect(result).not.toBeNull();
    expect(result?.tool).toBe('calendar.delete_event');
    expect(result?.arguments).toEqual({
      event_id: 'evt_001',
    });
  });
});
