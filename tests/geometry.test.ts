import { describe, expect, it } from 'vitest';

import {
  clamp,
  computeRingShape,
  type RingConfig,
  traceRingPath,
} from '../src/core/geometry';

const CONFIG: RingConfig = {
  dirSign: 1,
  speedMul: 1,
  phaseOffset: 0.3,
  breathPhase: 1.1,
  breathFreq: 0.7,
  jitterPhase: 2.2,
};

describe('clamp', () => {
  it('keeps a value inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps below the range', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps above the range', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe('computeRingShape', () => {
  const base = {
    band: 0.5,
    voiceBand: 0.5,
    beat: 0,
    activity: 1,
    time: 0,
    baseRadius: 100,
    config: CONFIG,
    idle: false,
  };

  it('produces the four control points', () => {
    const shape = computeRingShape(base);
    expect(shape.top).toBeDefined();
    expect(shape.right).toBeDefined();
    expect(shape.bottom).toBeDefined();
    expect(shape.left).toBeDefined();
  });

  it('places the top point above the bottom point', () => {
    const shape = computeRingShape(base);
    expect(shape.top.y).toBeLessThan(shape.bottom.y);
  });

  it('places the left point left of the right point', () => {
    const shape = computeRingShape(base);
    expect(shape.left.x).toBeLessThan(shape.right.x);
  });

  it('widens the shape when the band energy rises', () => {
    const quiet = computeRingShape({ ...base, band: 0, voiceBand: 0 });
    const loud = computeRingShape({ ...base, band: 1, voiceBand: 1 });

    const quietWidth = quiet.right.x - quiet.left.x;
    const loudWidth = loud.right.x - loud.left.x;

    expect(loudWidth).toBeGreaterThan(quietWidth);
  });

  it('keeps the handle lengths within their bounds', () => {
    const shape = computeRingShape({ ...base, voiceBand: 1, beat: 1 });
    expect(shape.topHandle).toBeGreaterThanOrEqual(base.baseRadius * 0.35);
    expect(shape.topHandle).toBeLessThanOrEqual(base.baseRadius * 0.92);
    expect(shape.sideHandle).toBeGreaterThanOrEqual(base.baseRadius * 0.35);
    expect(shape.sideHandle).toBeLessThanOrEqual(base.baseRadius * 0.95);
  });

  it('increases the glow width with the voice band', () => {
    const quiet = computeRingShape({ ...base, voiceBand: 0 });
    const loud = computeRingShape({ ...base, voiceBand: 1 });
    expect(loud.glowWidth).toBeGreaterThan(quiet.glowWidth);
  });

  it('keeps the glow alpha positive', () => {
    const shape = computeRingShape({ ...base, voiceBand: 0, band: 0 });
    expect(shape.glowAlpha).toBeGreaterThan(0);
  });

  it('is deterministic for identical inputs', () => {
    expect(computeRingShape(base)).toEqual(computeRingShape(base));
  });

  it('moves over time', () => {
    const first = computeRingShape({ ...base, time: 0 });
    const later = computeRingShape({ ...base, time: 1.5 });
    expect(first.top.x).not.toBeCloseTo(later.top.x, 6);
  });
});

describe('traceRingPath', () => {
  it('issues the expected canvas calls', () => {
    const calls: string[] = [];
    const ctx = {
      beginPath: () => calls.push('beginPath'),
      moveTo: () => calls.push('moveTo'),
      bezierCurveTo: () => calls.push('bezierCurveTo'),
      closePath: () => calls.push('closePath'),
    } as unknown as CanvasRenderingContext2D;

    const shape = computeRingShape({
      band: 0.5,
      voiceBand: 0.5,
      beat: 0,
      activity: 1,
      time: 0,
      baseRadius: 100,
      config: CONFIG,
      idle: false,
    });

    traceRingPath(ctx, shape);

    expect(calls[0]).toBe('beginPath');
    expect(calls[1]).toBe('moveTo');
    // Four bezier segments close the shape.
    expect(calls.filter((c) => c === 'bezierCurveTo')).toHaveLength(4);
    expect(calls[calls.length - 1]).toBe('closePath');
  });
});
