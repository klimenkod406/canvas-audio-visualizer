/**
 * Beat detection.
 *
 * A beat is detected when the bass energy spikes clearly above its own
 * recent average. Two guards keep it from firing on noise:
 *
 * 1. The spike must exceed the moving average by a ratio, not just exceed
 *    it. A constant loud signal has a high average and produces no beats.
 * 2. The intervals between accepted beats must fall in a plausible tempo
 *    range. Irregular spikes are discarded rather than averaged in, so a
 *    single stray transient cannot drag the tempo estimate with it.
 *
 * The tempo estimate is itself smoothed, so the animation eases into a new
 * tempo instead of snapping to it.
 */

/** Bass must exceed this multiple of its moving average to count as a beat. */
export const BEAT_SPIKE_RATIO = 1.45;

/** Absolute bass level a beat must reach, regardless of the average. */
export const BEAT_ABSOLUTE_THRESHOLD = 0.22;

/** Minimum frames between two beats - a ceiling on the detectable tempo. */
export const MIN_FRAMES_BETWEEN_BEATS = 10;

/** Plausible beat interval range in frames, at 60 fps. */
export const MIN_BEAT_INTERVAL = 18;
export const MAX_BEAT_INTERVAL = 90;

/** How many recent intervals feed the tempo estimate. */
export const BEAT_HISTORY_LENGTH = 6;

/** Smoothing factor of the moving average. */
export const BASS_AVERAGE_SMOOTHING = 0.04;

/** Smoothing factor of the tempo estimate. */
export const TEMPO_SMOOTHING = 0.4;

/**
 * Detects beats from a stream of per-frame bass energy.
 *
 * Feed it the bass value of every frame; it reports which frames were beats
 * and keeps a smoothed estimate of the beat interval.
 */
export class BeatDetector {
  private bassAverage = 0;

  /** Whether the moving average has been seeded with a real sample. */
  private primed = false;

  private lastBeatFrame = -1;

  private intervals: number[] = [];

  private smoothedInterval = 0;

  /**
   * @param options Overrides for the detection thresholds.
   */
  constructor(
    private readonly options: {
      spikeRatio?: number;
      absoluteThreshold?: number;
      minFramesBetweenBeats?: number;
      minInterval?: number;
      maxInterval?: number;
      historyLength?: number;
    } = {}
  ) {}

  /**
   * The smoothed beat interval in frames, or 0 before the first beat pair.
   *
   * Divide by the frame rate to get seconds, or by 60 to get BPM.
   */
  get interval(): number {
    return this.smoothedInterval;
  }

  /**
   * The current moving average of the bass energy.
   */
  get average(): number {
    return this.bassAverage;
  }

  /**
   * Feed one frame of bass energy.
   *
   * @param bass The bass energy of this frame, 0..1.
   * @param frame The frame counter.
   * @param active Whether the visualiser is currently responding to audio.
   * @returns `true` when this frame is a beat.
   */
  update(bass: number, frame: number, active = true): boolean {
    const spikeRatio = this.options.spikeRatio ?? BEAT_SPIKE_RATIO;
    const absoluteThreshold =
      this.options.absoluteThreshold ?? BEAT_ABSOLUTE_THRESHOLD;
    const minFramesBetween =
      this.options.minFramesBetweenBeats ?? MIN_FRAMES_BETWEEN_BEATS;
    const minInterval = this.options.minInterval ?? MIN_BEAT_INTERVAL;
    const maxInterval = this.options.maxInterval ?? MAX_BEAT_INTERVAL;
    const historyLength = this.options.historyLength ?? BEAT_HISTORY_LENGTH;

    // Seed the average with the first sample. Starting it at zero would make
    // every signal look like a spike on the opening frames, so a steady
    // input would register phantom beats until the average caught up.
    if (!this.primed) {
      this.bassAverage = bass;
      this.primed = true;
    } else {
      this.bassAverage =
        this.bassAverage * (1 - BASS_AVERAGE_SMOOTHING) +
        bass * BASS_AVERAGE_SMOOTHING;
    }

    const isBeat =
      active &&
      bass > this.bassAverage * spikeRatio &&
      bass > absoluteThreshold &&
      frame - this.lastBeatFrame > minFramesBetween;

    if (!isBeat) {
      return false;
    }

    if (this.lastBeatFrame > 0) {
      const interval = frame - this.lastBeatFrame;
      // Only accept a plausible tempo; a stray transient is discarded rather
      // than averaged into the estimate.
      if (interval > minInterval && interval < maxInterval) {
        this.intervals.push(interval);
        if (this.intervals.length > historyLength) {
          this.intervals.shift();
        }
        const avg =
          this.intervals.reduce((a, b) => a + b, 0) / this.intervals.length;
        this.smoothedInterval =
          this.smoothedInterval * (1 - TEMPO_SMOOTHING) +
          avg * TEMPO_SMOOTHING;
      }
    }

    this.lastBeatFrame = frame;
    return true;
  }

  /** Forget everything - used when the audio source changes. */
  reset(): void {
    this.bassAverage = 0;
    this.primed = false;
    this.lastBeatFrame = -1;
    this.intervals = [];
    this.smoothedInterval = 0;
  }
}

/**
 * A decaying envelope that spikes on a beat and fades away.
 *
 * One instance per ring: all rings flash together on a beat, but each keeps
 * its own decay so that a ring which was already active fades differently.
 */
export class BeatEnvelope {
  private value = 0;

  /**
   * @param decay Per-frame decay factor, 0..1. Higher fades faster.
   */
  constructor(private readonly decay = 0.9) {}

  /** The current envelope value, 0..1. */
  get current(): number {
    return this.value;
  }

  /** Trigger a spike. */
  trigger(amount: number): void {
    this.value = amount;
  }

  /** Advance one frame, applying the decay. */
  decayStep(): void {
    this.value *= this.decay;
  }
}
