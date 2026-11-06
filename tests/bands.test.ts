import { describe, expect, it } from 'vitest';

import {
  bandEnergy,
  computeRingBands,
  lerp,
  ringBandRange,
  smoothAsymmetric,
  voiceBandEnergy,
  voiceBandRange,
} from '../src/core/bands';

const FFT_SIZE = 1024;

/** A spectrum with a single loud bin. */
function spectrumWithPeak(bin: number, value = 255, size = FFT_SIZE): Uint8Array {
  const data = new Uint8Array(size);
  data[bin] = value;
  return data;
}

describe('ringBandRange', () => {
  it('gives each ring a non-overlapping slice', () => {
    const ringCount = 18;
    for (let i = 0; i < ringCount - 1; i += 1) {
      const [, end] = ringBandRange(i, ringCount);
      const [nextStart] = ringBandRange(i + 1, ringCount);
      expect(end).toBeLessThanOrEqual(nextStart);
    }
  });

  it('is log-spaced, so early rings get fewer bins', () => {
    const ringCount = 18;
    const [firstStart, firstEnd] = ringBandRange(0, ringCount);
    const [lastStart, lastEnd] = ringBandRange(ringCount - 1, ringCount);

    const firstWidth = firstEnd - firstStart;
    const lastWidth = lastEnd - lastStart;

    expect(lastWidth).toBeGreaterThan(firstWidth);
  });

  it('skips the lowest bins', () => {
    const [start] = ringBandRange(0, 18);
    expect(start).toBeGreaterThanOrEqual(2);
  });
});

describe('voiceBandRange', () => {
  it('covers the vocal range for every ring', () => {
    const ringCount = 18;
    for (let i = 0; i < ringCount; i += 1) {
      const [start, end] = voiceBandRange(i, ringCount);
      expect(start).toBeGreaterThan(0);
      expect(end).toBeGreaterThan(start);
    }
  });
});

describe('bandEnergy', () => {
  it('is zero for silence', () => {
    expect(bandEnergy(new Uint8Array(FFT_SIZE), 0, 100)).toBe(0);
  });

  it('is one for a full-scale band', () => {
    const data = new Uint8Array(FFT_SIZE).fill(255);
    expect(bandEnergy(data, 0, 100)).toBeCloseTo(1, 5);
  });

  it('normalises by the bin count', () => {
    const data = new Uint8Array(FFT_SIZE);
    data[10] = 255;
    // One loud bin out of ten.
    expect(bandEnergy(data, 10, 20)).toBeCloseTo(0.1, 5);
  });

  it('handles an empty range without dividing by zero', () => {
    expect(bandEnergy(new Uint8Array(FFT_SIZE), 10, 10)).toBe(0);
  });

  it('ignores bins past the end of the array', () => {
    const data = new Uint8Array(16);
    data[0] = 255;
    expect(bandEnergy(data, 0, 1000)).toBeGreaterThan(0);
  });
});

describe('voiceBandEnergy', () => {
  it('weights the speech fundamentals higher', () => {
    const fundamental = spectrumWithPeak(40);
    const other = spectrumWithPeak(90);

    const inFundamental = voiceBandEnergy(fundamental, 30, 100);
    const inOther = voiceBandEnergy(other, 30, 100);

    expect(inFundamental).toBeGreaterThan(inOther);
  });
});

describe('lerp', () => {
  it('returns the start at t=0', () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });

  it('returns the end at t=1', () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });

  it('interpolates in between', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });
});

describe('smoothAsymmetric', () => {
  it('uses the attack factor when rising', () => {
    // 0 + (1 - 0) * 0.5 = 0.5
    expect(smoothAsymmetric(0, 1, 0.5, 0.1)).toBeCloseTo(0.5, 5);
  });

  it('uses the release factor when falling', () => {
    // 1 + (0 - 1) * 0.1 = 0.9
    expect(smoothAsymmetric(1, 0, 0.5, 0.1)).toBeCloseTo(0.9, 5);
  });

  it('releases more slowly than it attacks', () => {
    const rise = smoothAsymmetric(0, 1, 0.5, 0.1);
    const fall = smoothAsymmetric(1, 0, 0.5, 0.1);
    expect(fall).toBeGreaterThan(rise);
  });
});

describe('computeRingBands', () => {
  it('returns one value per ring', () => {
    const { bands, voiceBands } = computeRingBands(new Uint8Array(FFT_SIZE), 18);
    expect(bands).toHaveLength(18);
    expect(voiceBands).toHaveLength(18);
  });

  it('keeps every value within 0..1', () => {
    const data = new Uint8Array(FFT_SIZE).fill(255);
    const { bands, voiceBands } = computeRingBands(data, 18);
    for (const value of [...bands, ...voiceBands]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('gives the ring owning a peak a higher band value', () => {
    // Bin 30 sits in a later ring, because the slices are log-spaced.
    const data = spectrumWithPeak(30);
    const { bands } = computeRingBands(data, 18);

    const owner = bands.indexOf(Math.max(...bands));
    expect(owner).toBeGreaterThan(0);
    expect(bands[owner]).toBeGreaterThan(0);
  });

  it('assigns each peak to exactly one ring', () => {
    const data = spectrumWithPeak(30);
    const { bands } = computeRingBands(data, 18);
    expect(bands.filter((v) => v > 0)).toHaveLength(1);
  });
});
