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

export const PLANT_SCALE = 0.13;
export const PLANT_SPACING = 2.6; // x-distance between plants in the row
