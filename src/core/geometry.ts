/**
 * Ring geometry.
 *
 * Each ring is a closed bezier path through four control points - top,
 * right, bottom, left - whose positions are driven by the band energies, the
 * beat envelope and a slow breathing oscillation.
 *
 * The shape is intentionally *not* a circle: the aspect ratio swings with
 * the music, the major axis breathes, and the whole ring drifts sideways
 * with the vocal band. A perfect circle would read as a loading spinner.
 */

/** Clamp a value into a range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * A point in the ring's local coordinate space.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * The shape of one ring at one moment.
 */
export interface RingShape {
  /** The four control points, in the order top, right, bottom, left. */
  top: Point;
  right: Point;
  bottom: Point;
  left: Point;
  /** The bezier handle length used by the top and bottom curves. */
  topHandle: number;
  /** The bezier handle length used by the left and right curves. */
  sideHandle: number;
  /** Horizontal asymmetry added to the handles. */
  asymX: number;
  /** Vertical asymmetry added to the handles. */
  asymY: number;
  /** The rotation of the ring, in radians. */
  rotation: number;
  /** Stroke opacity. */
  alpha: number;
  /** Glow stroke opacity. */
  glowAlpha: number;
  /** Glow stroke width. */
  glowWidth: number;
}

/**
 * The inputs that shape a ring.
 */
export interface RingInputs {
  /** Band energy of this ring, 0..1. */
  band: number;
  /** Voice band energy of this ring, 0..1. */
  voiceBand: number;
  /** Beat envelope of this ring, 0..1. */
  beat: number;
  /** Overall activity envelope, 0..1. */
  activity: number;
  /** Seconds since the visualiser started. */
  time: number;
  /** The ring's base radius in pixels. */
  baseRadius: number;
  /** Per-ring constants. */
  config: RingConfig;
  /** Whether the visualiser is idle. */
  idle: boolean;
}

/**
 * The per-ring constants that give each ring its own character.
 */
export interface RingConfig {
  /** Direction of rotation, -1 or 1. */
  dirSign: number;
  /** Multiplier on the rotation speed. */
  speedMul: number;
  /** Phase offset for the radial drift. */
  phaseOffset: number;
  /** Phase of the breathing oscillation. */
  breathPhase: number;
  /** Frequency of the breathing oscillation. */
  breathFreq: number;
  /** Phase of the high-frequency jitter. */
  jitterPhase: number;
}

/**
 * Compute the shape of one ring.
 *
 * @param inputs The ring's inputs for this frame.
 * @returns The computed shape.
 */
export function computeRingShape(inputs: RingInputs): RingShape {
  const {
    band,
    voiceBand,
    beat,
    activity,
    time,
    baseRadius,
    config,
    idle,
  } = inputs;

  const boostedBand = Math.min(1, band * 1.25) * activity;
  const boostedVoice = Math.min(1, voiceBand * 1.55) * activity;
  const vocalBias = clamp(boostedVoice * 0.72 + boostedBand * 0.28, 0, 1);

  // The stretch axis rotates slowly, faster while music plays.
  const axisSpeed = (0.004 + config.breathFreq * 0.5) * (idle ? 0.35 : 1.0);
  const axisAngle = config.breathPhase + time * axisSpeed * config.dirSign;

  // The shape oscillates; the band energy controls the swing amplitude.
  const wobbleFreq = config.breathFreq * (idle ? 1.0 : 2.0);
  const wobble = Math.sin(time * wobbleFreq + config.breathPhase);
  const swingBase = idle ? 0.04 : 0.092;
  const swing = swingBase + boostedBand * 0.08 + boostedVoice * 0.24 + beat * 0.1;

  const aspect = clamp(0.82 + wobble * swing * 0.52, 0.44, 0.98);

  // The major axis breathes.
  const growWobble = Math.sin(time * wobbleFreq + config.breathPhase + 1.7);
  const growSwingBase = idle ? 0.035 : 0.092;
  const growSwing =
    growSwingBase + boostedBand * 0.1 + boostedVoice * 0.16 + beat * 0.14;
  const grow = 1 + growSwing * (0.5 + 0.5 * growWobble);

  const scale = grow;
  const rx = baseRadius * scale;
  const ry = baseRadius * scale * aspect;

  const radialDrift = !idle
    ? Math.sin(time * (0.018 + config.speedMul * 0.008) + config.phaseOffset) *
      (6 + boostedVoice * 18)
    : Math.sin(time * 0.012 + config.phaseOffset) * 4;

  const centerShiftX = Math.cos(config.phaseOffset + time * 0.01) * vocalBias * 16;
  const centerShiftY =
    Math.sin(config.breathPhase + time * 0.012) * vocalBias * 10;

  const strokePulse = 0.55 + boostedVoice * 0.65 + beat * 0.18;

  const vocalPulseA = Math.sin(time * 0.028 + config.phaseOffset);
  const vocalPulseB = Math.cos(time * 0.024 + config.breathPhase);
  const vocalPulseC = Math.sin(time * 0.032 + config.jitterPhase);
  const vocalPulseD = Math.cos(time * 0.026 + config.phaseOffset + config.breathPhase);

  const topRadius =
    ry * (1 + boostedVoice * 0.32 + beat * 0.08 + vocalPulseA * (idle ? 0.04 : 0.12));
  const rightRadius =
    rx * (1 + boostedBand * 0.1 + boostedVoice * 0.12 + vocalPulseB * (idle ? 0.03 : 0.1));
  const bottomRadius =
    ry * (1 - boostedVoice * 0.08 + boostedBand * 0.14 + vocalPulseC * (idle ? 0.03 : 0.09));
  const leftRadius =
    rx * (1 + boostedVoice * 0.24 + beat * 0.04 + vocalPulseD * (idle ? 0.035 : 0.11));

  const top: Point = {
    x: centerShiftX * 0.45 + Math.sin(time * 0.021 + config.phaseOffset) * vocalBias * 12,
    y: centerShiftY - topRadius - radialDrift * 0.28,
  };
  const right: Point = {
    x: centerShiftX + rightRadius + radialDrift,
    y:
      centerShiftY * 0.4 +
      Math.cos(time * 0.018 + config.jitterPhase) * boostedVoice * 10,
  };
  const bottom: Point = {
    x: centerShiftX * 0.35 + Math.sin(time * 0.019 + config.breathPhase) * boostedBand * 10,
    y: centerShiftY + bottomRadius + radialDrift * 0.2,
  };
  const left: Point = {
    x: centerShiftX - leftRadius - radialDrift * 0.86,
    y: centerShiftY * 0.55 + Math.cos(time * 0.02 + config.phaseOffset) * vocalBias * 14,
  };

  const topHandle = clamp(
    baseRadius * (0.52 + boostedVoice * 0.24 + beat * 0.08),
    baseRadius * 0.35,
    baseRadius * 0.92
  );
  const sideHandle = clamp(
    baseRadius * (0.5 + boostedBand * 0.14 + boostedVoice * 0.18),
    baseRadius * 0.35,
    baseRadius * 0.95
  );

  const alpha = 0.8 + boostedVoice * 0.14 + beat * 0.08;
  const glowAlpha = Math.max(
    0.08,
    0.12 + boostedVoice * 0.18 - 0.004
  );

  return {
    top,
    right,
    bottom,
    left,
    topHandle,
    sideHandle,
    asymX: vocalBias * 22,
    asymY: boostedVoice * 18,
    rotation: axisAngle,
    alpha,
    glowAlpha,
    glowWidth: 5 + strokePulse * 4.2 + boostedVoice * 3.5,
  };
}

/**
 * Trace a ring shape onto a 2D canvas context.
 *
 * @param ctx The canvas 2D context.
 * @param shape The ring shape to draw.
 */
export function traceRingPath(
  ctx: CanvasRenderingContext2D,
  shape: RingShape
): void {
  const { top, right, bottom, left, topHandle, sideHandle, asymX, asymY } = shape;

  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.bezierCurveTo(
    top.x + topHandle + asymX * 0.15,
    top.y - asymY * 0.35,
    right.x + asymX * 0.3,
    right.y - sideHandle * 0.8,
    right.x,
    right.y
  );
  ctx.bezierCurveTo(
    right.x + asymX * 0.28,
    right.y + sideHandle * 0.55,
    bottom.x + topHandle * 0.35,
    bottom.y + asymY * 0.45,
    bottom.x,
    bottom.y
  );
  ctx.bezierCurveTo(
    bottom.x - topHandle * 0.9,
    bottom.y + asymY * 0.18,
    left.x - asymX * 0.36,
    left.y + sideHandle * 0.7,
    left.x,
    left.y
  );
  ctx.bezierCurveTo(
    left.x - asymX * 0.1,
    left.y - sideHandle * 0.86,
    top.x - topHandle * 0.78,
    top.y - asymY * 0.08,
    top.x,
    top.y
  );
  ctx.closePath();
}
