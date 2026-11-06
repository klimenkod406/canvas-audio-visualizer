/**
 * canvas-audio-visualizer
 *
 * The algorithmic core of a Canvas 2D audio visualiser, separated from any
 * framework or application:
 *
 * - :mod:`~core/bands` - spectrum to per-ring band energies.
 * - :mod:`~core/beat` - bass-spike beat detection and tempo tracking.
 * - :mod:`~core/palette` - genre palettes and colour interpolation.
 * - :mod:`~core/geometry` - ring shape computation and path tracing.
 */

export * from './core/bands';
export * from './core/beat';
export * from './core/geometry';
export * from './core/palette';
