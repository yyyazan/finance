/* ===========================================================================
 * constants.js — shared garden constants.
 * ======================================================================== */

// Must match --bg in app.css so the canvas has no visible edge — the plants
// look like they grow straight out of the page, not out of a framed box.
export const PAGE_BG = 0xf7f6f5;

// Curated subset of Plants.vox (audited): the 19 models that are complete
// potted plants. Excluded — 7–11 (empty pot holders/stands) and 24–28 (bare
// plants with no pot).
export const GOOD_PLANT_MODELS = [
  0, 1, 2, 3, 4, 5, 6, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
];

export const PLANT_SCALE = 0.13; // base mesh scale (before the per-plant allocation multiplier)

// Holder scale MULTIPLIER applied on top of PLANT_SCALE, driven by a holding's
// allocation: smallest weight → [0], largest weight → [1]. Keeps the base look
// while letting big positions tower over small ones.
export const ALLOC_SCALE = [0.7, 1.6];

// ── Plant slots ────────────────────────────────────────────────────────────
// Hand-tunable preset positions, one plant per slot. Holdings are sorted by
// allocation (desc) and dropped into slots IN ORDER, so the biggest positions
// always land in the prime front slots and nothing ever overlaps. Slot 0 is the
// prime spot. Author these live on /garden: drag plants (+ the empty-slot rings)
// with the gizmo, then hit "Copy PLANT_SLOTS" and paste the result here.
export const PLANT_SLOTS = [
  { x: 11.13, z: -0.75, rot: -0.035 },
  { x: 12.3, z: 1.65, rot: -0.436 },
  { x: 8.17, z: -4.2, rot: 0.367 },
  { x: -2.95, z: 5.77, rot: 0.209 },
  { x: -6.62, z: -2.81, rot: -0.279 },
  { x: 7.73, z: 0.37, rot: -0.192 },
  { x: -5.59, z: 2.34, rot: 0.122 },
  { x: 9, z: 1.79, rot: 0.454 },
  { x: -0.06, z: 5.5, rot: -0.524 },
  { x: -5.36, z: 0.16, rot: 0.052 },
  { x: -2.32, z: 3.38, rot: -0.035 },
  { x: 3.3, z: -8, rot: 0.367 },
  { x: -3.44, z: 0.58, rot: -0.436 },
  { x: 1.15, z: -7.32, rot: -0.279 },
  { x: 5.75, z: -6.2, rot: 0.209 },
  { x: 4.75, z: -2.82, rot: -0.192 },
  { x: -4.45, z: -2.6, rot: 0.122 },
  { x: -3.9, z: -5.41, rot: -0.524 },
  { x: -7.5, z: -6.2, rot: 0.454 },
  { x: 5.25, z: -8, rot: 2.339 },
];
