import { describe, expect, it } from 'vitest';
import { resolveToolFromIntent } from '../electron/ipc';

describe('Long-Term Memory and Knowledge Base Intent Resolver', () => {
  it('resolves remember fact / preference', () => {
    const res1 = resolveToolFromIntent('remember that my favorite editor is VS Code');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('memory.store_fact');
    expect(res1?.arguments).toEqual({
      key: 'favorite editor',
      value: 'VS Code',
      category: 'preference',
    });

    const res2 = resolveToolFromIntent('remember my manager is Sarah Connor');
    expect(res2?.tool).toBe('memory.store_fact');
    expect(res2?.arguments).toEqual({
      key: 'manager',
      value: 'Sarah Connor',
      category: 'contact',
    });
  });

  it('resolves memory recall', () => {
    const res1 = resolveToolFromIntent('what do you know about Sarah?');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('memory.recall');
    expect(res1?.arguments).toEqual({
      query: 'Sarah',
      limit: 5,
    });

    const res2 = resolveToolFromIntent('recall preferred_model');
    expect(res2?.tool).toBe('memory.recall');
    expect(res2?.arguments.query).toBe('preferred_model');
  });

  it('resolves list memories and preferences', () => {
    const res1 = resolveToolFromIntent('list memories');
    expect(res1?.tool).toBe('memory.list_memories');

    const res2 = resolveToolFromIntent('my preferences');
    expect(res2?.tool).toBe('memory.list_memories');
  });

  it('resolves forget memory fact', () => {
    const res = resolveToolFromIntent('forget my old_api_key');
    expect(res).not.toBeNull();
    expect(res?.tool).toBe('memory.delete_fact');
    expect(res?.arguments).toEqual({
      key_or_id: 'old_api_key',
    });
  });

  it('resolves index document / note', () => {
    const res1 = resolveToolFromIntent('index file docs/architecture.md');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('memory.index_document');
    expect(res1?.arguments).toEqual({
      file_path: 'docs/architecture.md',
    });

    const res2 = resolveToolFromIntent('index note Architecture RFC: All backend services must use WebSocket');
    expect(res2?.tool).toBe('memory.index_document');
    expect(res2?.arguments).toEqual({
      title: 'Architecture RFC',
      content: 'All backend services must use WebSocket',
    });
  });

  it('resolves search knowledge base (RAG)', () => {
    const res = resolveToolFromIntent('search knowledge for Docker deployment guidelines');
    expect(res).not.toBeNull();
    expect(res?.tool).toBe('memory.search_knowledge');
    expect(res?.arguments).toEqual({
      query: 'Docker deployment guidelines',
      limit: 5,
    });
  });
});
