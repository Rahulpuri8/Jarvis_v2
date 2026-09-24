import { describe, expect, it } from 'vitest';
import { resolveToolFromIntent } from '../electron/ipc';

describe('Voice Assistant Intent Resolver', () => {
  it('resolves speak / TTS commands', () => {
    const res1 = resolveToolFromIntent('speak Hello world, I am JARVIS');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('voice.speak');
    expect(res1?.arguments).toEqual({
      text: 'Hello world, I am JARVIS',
    });

    const res2 = resolveToolFromIntent('say Today you have 2 scheduled meetings');
    expect(res2?.tool).toBe('voice.speak');
    expect(res2?.arguments).toEqual({
      text: 'Today you have 2 scheduled meetings',
    });

    const res3 = resolveToolFromIntent('read aloud System diagnostics are normal');
    expect(res3?.tool).toBe('voice.speak');
    expect(res3?.arguments).toEqual({
      text: 'System diagnostics are normal',
    });
  });

  it('resolves voice listen command', () => {
    const res1 = resolveToolFromIntent('listen');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('voice.listen');

    const res2 = resolveToolFromIntent('start listening');
    expect(res2?.tool).toBe('voice.listen');
  });

  it('resolves voice status query', () => {
    const res1 = resolveToolFromIntent('voice status');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('voice.status');

    const res2 = resolveToolFromIntent('check audio');
    expect(res2?.tool).toBe('voice.status');
  });

  it('resolves voice speech rate configuration', () => {
    const res = resolveToolFromIntent('set speech rate to 200');
    expect(res).not.toBeNull();
    expect(res?.tool).toBe('voice.set_voice');
    expect(res?.arguments).toEqual({
      rate: 200,
    });
  });
});
