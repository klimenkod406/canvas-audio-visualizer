/**
 * Colour palettes.
 *
 * Each palette is three RGB stops. The rings interpolate across them by
 * index, so the visualiser reads as one gradient rather than a set of
 * unrelated colours.
 *
 * When the track changes, the palette does not snap - it is interpolated
 * frame by frame towards the new one, which is what makes the transition
 * feel deliberate instead of jarring.
 */

export type RGB = [number, number, number];
export type Palette = [RGB, RGB, RGB];

/** Shown when nothing is playing - clean whites. */
export const IDLE_PALETTE: Palette = [
  [255, 255, 255],
  [235, 240, 250],
  [205, 215, 235],
];

/** Mood-driven gradients, one per genre. */
export const PALETTES: Record<string, Palette> = {
  rock: [
    [255, 118, 92],
    [238, 92, 74],
    [255, 178, 92],
  ],
  metal: [
    [180, 72, 92],
    [92, 74, 110],
    [42, 48, 66],
  ],
  pop: [
    [255, 142, 202],
    [218, 132, 255],
    [124, 158, 255],
  ],
  electronic: [
    [92, 224, 238],
    [94, 154, 255],
    [176, 132, 255],
  ],
  hiphop: [
    [255, 196, 92],
    [238, 126, 88],
    [214, 82, 124],
  ],
  rnb: [
    [214, 124, 204],
    [158, 108, 214],
    [88, 88, 168],
  ],
  jazz: [
    [255, 204, 122],
    [198, 132, 92],
    [96, 88, 158],
  ],
  blues: [
    [92, 166, 232],
    [72, 112, 198],
    [42, 58, 128],
  ],
  classical: [
    [252, 250, 238],
    [178, 216, 244],
    [126, 154, 226],
  ],
  ambient: [
    [138, 232, 232],
    [152, 184, 242],
    [210, 164, 232],
  ],
  folk: [
    [246, 196, 126],
    [204, 148, 92],
    [126, 92, 62],
  ],
  reggae: [
    [244, 212, 92],
    [92, 196, 122],
    [232, 92, 92],
  ],
  country: [
    [244, 184, 102],
    [218, 128, 82],
    [150, 86, 66],
  ],
  punk: [
    [238, 92, 144],
    [204, 72, 116],
    [92, 72, 154],
  ],
  default: [
    [172, 132, 255],
    [238, 132, 214],
    [255, 188, 126],
  ],
};

/**
 * Genre keywords, matched case-insensitively against the genre string.
 *
 * Each entry lists the substrings that select a palette. Matching on
 * substrings rather than exact names is what lets "Hip-Hop/Rap" and
 * "hip hop" both resolve.
 */
export const GENRE_KEYWORDS: Record<string, string[]> = {
  punk: ['punk', 'панк'],
  rock: ['rock', 'рок'],
  metal: ['metal', 'метал'],
  pop: ['pop', 'поп'],
  electronic: [
    'elect',
    'dance',
    'edm',
    'house',
    'techno',
    'trance',
    'электр',
  ],
  hiphop: ['hip', 'rap', 'хип', 'рэп'],
  rnb: ['r&b', 'rnb', 'soul', 'соул'],
  ambient: ['ambient', 'chill', 'lo-fi', 'lofi', 'эмбиент', 'лоу'],
  jazz: ['jazz', 'джаз'],
  blues: ['blues', 'блюз'],
  classical: ['class', 'класс'],
  folk: ['folk', 'acoust', 'фолк', 'акуст'],
  reggae: ['reggae', 'регги'],
  country: ['country', 'кантри'],
};

/**
 * The palette for a genre string.
 *
 * @param genre The genre name; may be `null` or `undefined`.
 * @returns The matching palette, or the default one.
 */
export function paletteForGenre(genre?: string | null): Palette {
  if (!genre) return PALETTES.default;

  const key = genre.toLowerCase();
  for (const [name, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some((word) => key.includes(word))) {
      return PALETTES[name];
    }
  }
  return PALETTES.default;
}

/**
 * Interpolate between two palettes, component by component.
 *
 * @param from The palette to start from.
 * @param to The palette to move towards.
 * @param t How far to move, 0..1.
 * @returns A new palette.
 */
export function lerpPalette(
  from: Palette,
  to: Palette,
  t: number
): Palette {
  return [
    lerpRgb(from[0], to[0], t),
    lerpRgb(from[1], to[1], t),
    lerpRgb(from[2], to[2], t),
  ];
}

function lerpRgb(from: RGB, to: RGB, t: number): RGB {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}

/**
 * Move a palette one step towards a target, in place.
 *
 * @param current The palette to update.
 * @param target The palette to move towards.
 * @param t The step size, 0..1. Smaller means a slower transition.
 */
export function stepPalette(
  current: Palette,
  target: Palette,
  t: number
): void {
  for (let stop = 0; stop < 3; stop += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      current[stop][channel] +=
        (target[stop][channel] - current[stop][channel]) * t;
    }
  }
}

/**
 * The colour of one ring within a palette.
 *
 * Rings are spread across the three stops: the first half interpolates from
 * stop 0 to stop 1, the second half from stop 1 to stop 2.
 *
 * @param palette The palette to sample.
 * @param ringIndex Zero-based ring index.
 * @param ringCount Total number of rings.
 * @returns The RGB colour for that ring.
 */
export function ringColor(
  palette: Palette,
  ringIndex: number,
  ringCount: number
): RGB {
  const t = ringIndex / Math.max(1, ringCount - 1);

  if (t < 0.5) {
    return lerpRgb(palette[0], palette[1], t * 2);
  }
  return lerpRgb(palette[1], palette[2], (t - 0.5) * 2);
}

/**
 * Render an RGB triple as a CSS `rgba()` string.
 *
 * @param rgb The colour.
 * @param alpha Opacity, 0..1.
 */
export function rgba(rgb: RGB, alpha: number): string {
  return `rgba(${rgb[0] | 0}, ${rgb[1] | 0}, ${rgb[2] | 0}, ${alpha})`;
}
