import { describe, expect, it } from 'vitest';

import {
  GENRE_KEYWORDS,
  IDLE_PALETTE,
  PALETTES,
  lerpPalette,
  paletteForGenre,
  ringColor,
  rgba,
  stepPalette,
} from '../src/core/palette';

describe('paletteForGenre', () => {
  it('returns the default palette without a genre', () => {
    expect(paletteForGenre(null)).toBe(PALETTES.default);
    expect(paletteForGenre(undefined)).toBe(PALETTES.default);
    expect(paletteForGenre('')).toBe(PALETTES.default);
  });

  it('matches an exact genre name', () => {
    expect(paletteForGenre('rock')).toBe(PALETTES.rock);
    expect(paletteForGenre('jazz')).toBe(PALETTES.jazz);
  });

  it('is case insensitive', () => {
    expect(paletteForGenre('ROCK')).toBe(PALETTES.rock);
    expect(paletteForGenre('RoCk')).toBe(PALETTES.rock);
  });

  it('matches a substring', () => {
    expect(paletteForGenre('Classic Rock')).toBe(PALETTES.rock);
    expect(paletteForGenre('hip-hop/rap')).toBe(PALETTES.hiphop);
  });

  it('falls back to the default for an unknown genre', () => {
    expect(paletteForGenre('klezmer')).toBe(PALETTES.default);
  });

  it('every keyword list maps to a palette that exists', () => {
    for (const name of Object.keys(GENRE_KEYWORDS)) {
      expect(PALETTES[name]).toBeDefined();
    }
  });

  it('every palette has three RGB stops', () => {
    for (const palette of Object.values(PALETTES)) {
      expect(palette).toHaveLength(3);
      for (const stop of palette) {
        expect(stop).toHaveLength(3);
        for (const channel of stop) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(255);
        }
      }
    }
  });
});

describe('lerpPalette', () => {
  it('returns the start at t=0', () => {
    const from: [number, number, number][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const to: [number, number, number][] = [
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ];
    expect(lerpPalette(from as never, to as never, 0)).toEqual(from);
  });

  it('returns the target at t=1', () => {
    const from: [number, number, number][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const to: [number, number, number][] = [
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ];
    expect(lerpPalette(from as never, to as never, 1)).toEqual(to);
  });

  it('interpolates each channel', () => {
    const from: [number, number, number][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const to: [number, number, number][] = [
      [100, 200, 40],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const mid = lerpPalette(from as never, to as never, 0.5);
    expect(mid[0][0]).toBeCloseTo(50, 5);
    expect(mid[0][1]).toBeCloseTo(100, 5);
    expect(mid[0][2]).toBeCloseTo(20, 5);
  });
});

describe('stepPalette', () => {
  it('moves towards the target without reaching it in one step', () => {
    const current: [number, number, number][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const target: [number, number, number][] = [
      [100, 100, 100],
      [100, 100, 100],
      [100, 100, 100],
    ];
    stepPalette(current as never, target as never, 0.5);
    expect(current[0][0]).toBeCloseTo(50, 5);
  });

  it('converges over many steps', () => {
    const current: [number, number, number][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    const target: [number, number, number][] = [
      [255, 255, 255],
      [255, 255, 255],
      [255, 255, 255],
    ];
    for (let i = 0; i < 200; i += 1) {
      stepPalette(current as never, target as never, 0.05);
    }
    expect(current[0][0]).toBeCloseTo(255, 0);
  });
});

describe('ringColor', () => {
  it('starts at the first stop', () => {
    const color = ringColor(IDLE_PALETTE, 0, 3);
    expect(color).toEqual(IDLE_PALETTE[0]);
  });

  it('ends at the last stop', () => {
    const color = ringColor(IDLE_PALETTE, 2, 3);
    expect(color).toEqual(IDLE_PALETTE[2]);
  });

  it('passes through the middle stop', () => {
    const color = ringColor(IDLE_PALETTE, 1, 3);
    expect(color).toEqual(IDLE_PALETTE[1]);
  });
});

describe('rgba', () => {
  it('formats an rgb triple with an alpha', () => {
    expect(rgba([255, 128, 0], 0.5)).toBe('rgba(255, 128, 0, 0.5)');
  });

  it('truncates to integer channels', () => {
    expect(rgba([255.9, 0.4, 12.6], 1)).toBe('rgba(255, 0, 12, 1)');
  });
});
