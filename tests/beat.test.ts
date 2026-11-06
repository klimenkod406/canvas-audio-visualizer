import { describe, expect, it } from 'vitest';

import {
  BeatDetector,
  BeatEnvelope,
  MAX_BEAT_INTERVAL,
  MIN_BEAT_INTERVAL,
} from '../src/core/beat';

describe('BeatDetector', () => {
  it('does not fire on silence', () => {
    const detector = new BeatDetector();
    for (let frame = 0; frame < 120; frame += 1) {
      expect(detector.update(0, frame)).toBe(false);
    }
  });

  it('does not fire on a constant signal', () => {
    // A constant loud signal has a high moving average, so no spike.
    const detector = new BeatDetector();
    let beats = 0;
    for (let frame = 0; frame < 200; frame += 1) {
      if (detector.update(0.5, frame)) beats += 1;
    }
    expect(beats).toBe(0);
  });

  it('fires on a clear bass spike', () => {
    const detector = new BeatDetector();
    // Warm the average up with quiet frames, then spike.
    for (let frame = 0; frame < 60; frame += 1) {
      detector.update(0.1, frame);
    }
    expect(detector.update(0.9, 60)).toBe(true);
  });

  it('ignores spikes while inactive', () => {
    const detector = new BeatDetector();
    for (let frame = 0; frame < 60; frame += 1) {
      detector.update(0.1, frame);
    }
    expect(detector.update(0.9, 60, false)).toBe(false);
  });

  it('does not fire twice within the minimum frame gap', () => {
    const detector = new BeatDetector();
    for (let frame = 0; frame < 60; frame += 1) {
      detector.update(0.1, frame);
    }
    expect(detector.update(0.9, 60)).toBe(true);
    expect(detector.update(0.9, 61)).toBe(false);
  });

  it('estimates the beat interval from regular beats', () => {
    const detector = new BeatDetector();
    const gap = 30; // 2 beats per second at 60 fps

    for (let frame = 0; frame < 300; frame += 1) {
      const isBeatPoint = frame % gap === 0;
      detector.update(isBeatPoint ? 0.9 : 0.1, frame);
    }

    expect(detector.interval).toBeGreaterThan(0);
    // The smoothed estimate converges on the real interval.
    expect(detector.interval).toBeGreaterThan(gap * 0.5);
    expect(detector.interval).toBeLessThan(gap * 1.5);
  });

  it('discards intervals outside the plausible tempo range', () => {
    const detector = new BeatDetector();
    for (let frame = 0; frame < 60; frame += 1) {
      detector.update(0.1, frame);
    }
    // Two beats far apart - outside the plausible range.
    detector.update(0.9, 60);
    detector.update(0.9, 60 + MAX_BEAT_INTERVAL + 50);
    expect(detector.interval).toBe(0);
  });

  it('accepts an interval at the lower bound', () => {
    const detector = new BeatDetector();
    for (let frame = 0; frame < 60; frame += 1) {
      detector.update(0.1, frame);
    }
    detector.update(0.9, 60);
    detector.update(0.9, 60 + MIN_BEAT_INTERVAL + 1);
    expect(detector.interval).toBeGreaterThan(0);
  });

  it('reset clears the state', () => {
    const detector = new BeatDetector();
    for (let frame = 0; frame < 60; frame += 1) {
      detector.update(0.1, frame);
    }
    detector.update(0.9, 60);
    detector.reset();

    expect(detector.interval).toBe(0);
    expect(detector.average).toBe(0);
  });
});

describe('BeatEnvelope', () => {
  it('starts at zero', () => {
    expect(new BeatEnvelope().current).toBe(0);
  });

  it('spikes on trigger', () => {
    const envelope = new BeatEnvelope();
    envelope.trigger(1);
    expect(envelope.current).toBe(1);
  });

  it('decays each frame', () => {
    const envelope = new BeatEnvelope(0.5);
    envelope.trigger(1);
    envelope.decayStep();
    expect(envelope.current).toBeCloseTo(0.5, 5);
  });

  it('decays towards zero', () => {
    const envelope = new BeatEnvelope(0.9);
    envelope.trigger(1);
    for (let i = 0; i < 50; i += 1) {
      envelope.decayStep();
    }
    expect(envelope.current).toBeLessThan(0.01);
  });

  it('a faster decay fades quicker', () => {
    const slow = new BeatEnvelope(0.95);
    const fast = new BeatEnvelope(0.5);
    slow.trigger(1);
    fast.trigger(1);
    slow.decayStep();
    fast.decayStep();
    expect(fast.current).toBeLessThan(slow.current);
  });
});
