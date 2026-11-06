# canvas-audio-visualizer

[![CI](https://github.com/klimenkod406/canvas-audio-visualizer/actions/workflows/ci.yml/badge.svg)](https://github.com/klimenkod406/canvas-audio-visualizer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

The algorithmic core of a **Canvas 2D audio visualiser**, separated from any
framework or application: FFT band splitting, bass-spike beat detection with
tempo tracking, genre palettes and ring geometry.

TypeScript. Zero runtime dependencies.

```text
  AnalyserNode
       │  getByteFrequencyData()
       ▼
  ┌────────────┐   per-ring band + voice energies
  │   bands    │──────────────────────────┐
  └────────────┘                          │
  ┌────────────┐   bass spike ──► beat    ▼
  │    beat    │──────────────┐   ┌────────────┐
  └────────────┘              │   │  geometry  │──► bezier control points
  ┌────────────┐   palette    │   └────────────┘
  │   palette  │──────────────┼──────────┐
  └────────────┘              ▼          ▼
                          envelope    canvas 2D
```

Open-source reference implementation extracted from my own open-source project
MIYU — a music streaming platform with an AI service (MIT).

> **Note on rendering.** This is Canvas 2D, not WebGL. The original project
> planned a shader-based visualiser that was never built; what shipped was a
> Canvas 2D renderer, and that is what is extracted here.

## Install

```bash
npm install canvas-audio-visualizer
```

## Band analysis

A visualiser wants a handful of numbers per frame, not 1024 FFT bins.

```ts
import { computeRingBands, ringBandRange } from 'canvas-audio-visualizer';

const { bands, voiceBands } = computeRingBands(freqData, 18);
// bands[0] is the low end, bands[17] the high end

ringBandRange(0, 18);  // [startBin, endBin) owned by ring 0
```

Slices are **log-spaced**: linear spacing would hand the top half of the
spectrum to a couple of rings and starve the mid range.

Two bands per ring:

- the **band** - the ring's own slice of the spectrum;
- the **voice band** - the vocal range, with the speech fundamentals
  (bins 34-72) weighted higher than the surrounding formants.

Both are smoothed **asymmetrically** - fast attack, slow release:

```ts
import { smoothAsymmetric } from 'canvas-audio-visualizer';

smoothAsymmetric(previous, target, attack, release);
```

A visualiser that reacts instantly to every transient looks like static; one
that releases slowly looks like it is breathing.

## Beat detection

```ts
import { BeatDetector } from 'canvas-audio-visualizer';

const detector = new BeatDetector();

for (let frame = 0; frame < 600; frame += 1) {
  const bass = readBassEnergy();
  if (detector.update(bass, frame)) {
    flash();
  }
}

detector.interval; // smoothed beat interval, in frames
```

A beat fires when the bass **spikes relative to its own moving average**,
not when it crosses a fixed threshold. Two guards keep it honest:

1. the spike must exceed the average by a ratio - a constant loud signal has
   a high average and produces no beats;
2. the interval between accepted beats must fall in a plausible tempo range -
   a stray transient is discarded rather than averaged in, so it cannot drag
   the tempo estimate with it.

The tempo estimate is smoothed too, so the animation eases into a new tempo
instead of snapping to it.

The decaying envelope that drives the flash is separate:

```ts
import { BeatEnvelope } from 'canvas-audio-visualizer';

const envelope = new BeatEnvelope(0.9);
envelope.trigger(1);
envelope.decayStep();
```

## Palettes

```ts
import { paletteForGenre, ringColor, rgba } from 'canvas-audio-visualizer';

const palette = paletteForGenre('Hip-Hop/Rap');
const color = ringColor(palette, 3, 18);  // the colour of ring 3
rgba(color, 0.8);
```

Palettes are three RGB stops; the rings interpolate across them by index, so
the visualiser reads as one gradient rather than a set of unrelated colours.

Genre matching is by **substring**, case-insensitively, which is what lets
`"Hip-Hop/Rap"`, `"hip hop"` and `"rap"` all resolve to the same palette. The
keyword table is exported so a deployment can extend it.

When the track changes the palette does not snap - it is interpolated frame
by frame towards the new one:

```ts
import { stepPalette } from 'canvas-audio-visualizer';

stepPalette(current, target, 0.025);  // ~1.5 s transition
```

## Ring geometry

Each ring is a closed bezier path through four control points, whose
positions are driven by the band energies, the beat envelope and a slow
breathing oscillation.

```ts
import { computeRingShape, traceRingPath } from 'canvas-audio-visualizer';

const shape = computeRingShape({
  band, voiceBand, beat, activity, time, baseRadius, config, idle,
});

traceRingPath(ctx, shape);
ctx.stroke();
```

The shape is intentionally **not** a circle: the aspect ratio swings with the
music, the major axis breathes, and the ring drifts sideways with the vocal
band. A perfect circle would read as a loading spinner.

## Design notes

- **No framework.** The core is plain TypeScript with no React, no Vue, no
  build step. The original was a React component tangled with a player
  context; only the algorithm was worth keeping.
- **Pure functions for the maths.** `computeRingBands`, `ringBandRange`,
  `computeRingShape` and the palette helpers are all pure. The two stateful
  pieces - `BeatDetector` and `BeatEnvelope` - are small classes with
  explicit `update` / `decayStep` steps, so a caller controls the frame
  loop.
- **Normalised outputs.** Every band energy is in `0..1`, so the geometry
  code can multiply and clamp without defensive checks.
- **Deterministic.** Same inputs, same output - no `Math.random()`, no clock
  reads inside the core.

## Testing

```bash
npm test
npm run coverage
npm run typecheck
```

64 tests across four suites:

- **bands** - slice layout, log spacing, normalisation, the empty range, the
  emphasis weighting, and asymmetric smoothing.
- **beat** - silence, a constant signal, a clear spike, the minimum frame
  gap, tempo convergence, out-of-range intervals, and the reset path.
- **palette** - genre matching including case and substring, fallback
  behaviour, interpolation, the ring colour ramp, and CSS formatting.
- **geometry** - the control point layout, shape response to band energy,
  handle bounds, and the canvas call sequence.

Coverage is 98% of the core, with 100% on three of the four modules.

## License

MIT
