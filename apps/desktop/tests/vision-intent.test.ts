import { describe, expect, it } from 'vitest';
import { resolveToolFromIntent } from '../electron/ipc';

describe('Computer Vision & Screen Grounding Intent Resolver', () => {
  it('resolves analyze screen and visual QA queries', () => {
    const res1 = resolveToolFromIntent("what's on my screen");
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('vision.analyze_screen');
    expect(res1?.arguments).toEqual({});

    const res2 = resolveToolFromIntent('analyze screen');
    expect(res2?.tool).toBe('vision.analyze_screen');

    const res3 = resolveToolFromIntent('is there an error showing on my screen?');
    expect(res3?.tool).toBe('vision.analyze_screen');
    expect(res3?.arguments.query).toBe('is there an error showing on my screen?');
  });

  it('resolves visual element search / localization', () => {
    const res1 = resolveToolFromIntent('find the blue Submit button');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('vision.find_element');
    expect(res1?.arguments).toEqual({
      description: 'blue Submit button',
    });

    const res2 = resolveToolFromIntent('where is the Settings gear icon?');
    expect(res2?.tool).toBe('vision.find_element');
    expect(res2?.arguments).toEqual({
      description: 'Settings gear icon',
    });
  });

  it('resolves visual click grounding', () => {
    const res1 = resolveToolFromIntent('click the Save button');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('vision.click_element');
    expect(res1?.arguments).toEqual({
      description: 'Save button',
      click_type: 'single',
    });

    const res2 = resolveToolFromIntent('double click the folder icon');
    expect(res2?.tool).toBe('vision.click_element');
    expect(res2?.arguments).toEqual({
      description: 'folder icon',
      click_type: 'double',
    });

    const res3 = resolveToolFromIntent('right click the active document');
    expect(res3?.tool).toBe('vision.click_element');
    expect(res3?.arguments).toEqual({
      description: 'active document',
      click_type: 'right',
    });
  });

  it('resolves OCR text reading from screen', () => {
    const res1 = resolveToolFromIntent('read text on screen');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('vision.read_text');
    expect(res1?.arguments).toEqual({});

    const res2 = resolveToolFromIntent('ocr screen');
    expect(res2?.tool).toBe('vision.read_text');
  });

  it('resolves describe region and compare screens', () => {
    const res1 = resolveToolFromIntent('describe region 100 200 400 300');
    expect(res1).not.toBeNull();
    expect(res1?.tool).toBe('vision.describe_region');
    expect(res1?.arguments).toEqual({
      x: 100,
      y: 200,
      width: 400,
      height: 300,
    });

    const res2 = resolveToolFromIntent('compare screens');
    expect(res2).not.toBeNull();
    expect(res2?.tool).toBe('vision.compare_screens');
  });
});
