/**
 * Frequency band analysis.
 *
 * A visualiser wants a handful of numbers per frame, not 1024 FFT bins.
 * This module splits the spectrum into the bands a visualiser actually
 * reacts to:
 *
 * - **low band** - the energy of each ring's own slice of the spectrum.
 *   Slices are log-spaced, because linear spacing gives the top half of the
 *   spectrum to a handful of rings and starves the mid range.
 * - **voice band** - a separate slice covering the vocal range, with the
 *   speech fundamentals weighted higher than the surrounding formants.
 *
 * Both are smoothed asymmetrically: fast attack, slow release. A visualiser
 * that reacts instantly to every transient looks like static; one that
 * releases slowly looks like it is breathing.
 */

/** Number of bins at the top of the spectrum that are skipped as noise. */
export const MAX_USED_BIN = 200;

/** Multiplier applied to the speech fundamentals (bins 34..72). */
export const VOICE_FUNDAMENTAL_EMPHASIS = 1.25;

/** Multiplier applied to the rest of the voice range. */
export const VOICE_OTHER_EMPHASIS = 0.85;

/**
 * The spectrum slice owned by one ring.
 *
 * @param ringIndex Zero-based ring index.
 * @param ringCount Total number of rings.
 * @returns `[startBin, endBin)` - the half-open range of bins the ring owns.
 */
export function ringBandRange(
  ringIndex: number,
  ringCount: number,
  maxUsedBin: number = MAX_USED_BIN
): [number, number] {
  const start = 2 + Math.floor(Math.pow(ringIndex / ringCount, 1.5) * maxUsedBin);
  const end =
    2 + Math.floor(Math.pow((ringIndex + 1) / ringCount, 1.5) * maxUsedBin);
  return [start, end];
}

/**
 * The voice-frequency slice that overlaps a ring.
 *
 * @param ringIndex Zero-based ring index.
 * @param ringCount Total number of rings.
 * @returns `[startBin, endBin)` - the half-open range of bins.
 */
export function voiceBandRange(
  ringIndex: number,
  ringCount: number
): [number, number] {
  const start = 18 + Math.floor((ringIndex / ringCount) * 78);
  const end = 24 + Math.floor(((ringIndex + 1) / ringCount) * 92);
  return [start, end];
}

/**
 * Mean energy of one band, normalised to 0..1.
 *
 * @param freqData The FFT byte array from an `AnalyserNode`.
 * @param start First bin, inclusive.
 * @param end Last bin, exclusive.
 * @returns The mean bin value divided by 255.
 */
export function bandEnergy(
  freqData: Uint8Array,
  start: number,
  end: number
): number {
  const count = Math.max(1, end - start);
  let sum = 0;
  for (let b = start; b < end && b < freqData.length; b += 1) {
    sum += freqData[b];
  }
  return sum / (count * 255);
}

/**
 * Mean energy of a band with the speech fundamentals weighted higher.
 *
 * The emphasis can push the weighted mean above the raw mean, so the result
 * is clamped: this function returns a normalised 0..1 value, and a caller
 * that wants the raw ratio can divide by the emphasis itself.
 *
 * @param freqData The FFT byte array from an `AnalyserNode`.
 * @param start First bin, inclusive.
 * @param end Last bin, exclusive.
 * @returns The weighted mean, normalised to 0..1.
 */
export function voiceBandEnergy(
  freqData: Uint8Array,
  start: number,
  end: number
): number {
  const count = Math.max(1, end - start);
  let sum = 0;
  for (let b = start; b < end && b < freqData.length; b += 1) {
    const emphasis =
      b >= 34 && b <= 72 ? VOICE_FUNDAMENTAL_EMPHASIS : VOICE_OTHER_EMPHASIS;
    sum += freqData[b] * emphasis;
  }
  return Math.min(1, sum / (count * 255));
}

/**
 * Linear interpolation.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smooth a value with an asymmetric attack and release.
 *
 * When the target rises, `attack` is used; when it falls, `release` is used.
 * A low release keeps the visualiser from flickering back to zero between
 * transients.
 *
 * @param previous The previous smoothed value.
 * @param target The new raw value.
 * @param attack Smoothing factor used when rising, 0..1.
 * @param release Smoothing factor used when falling, 0..1.
 */
export function smoothAsymmetric(
  previous: number,
  target: number,
  attack: number,
  release: number
): number {
  return lerp(previous, target, target > previous ? attack : release);
}

/**
 * The per-ring band energies for one frame.
 *
 * @param freqData The FFT byte array from an `AnalyserNode`.
 * @param ringCount How many rings to compute.
 * @returns Two arrays: the band energy per ring, and the voice energy per ring.
 */
export function computeRingBands(
  freqData: Uint8Array,
  ringCount: number
): { bands: number[]; voiceBands: number[] } {
  const bands: number[] = [];
  const voiceBands: number[] = [];

  for (let i = 0; i < ringCount; i += 1) {
    const [binStart, binEnd] = ringBandRange(i, ringCount);
    bands.push(bandEnergy(freqData, binStart, binEnd));

    const [voiceStart, voiceEnd] = voiceBandRange(i, ringCount);
    voiceBands.push(voiceBandEnergy(freqData, voiceStart, voiceEnd));
  }

  return { bands, voiceBands };
}
