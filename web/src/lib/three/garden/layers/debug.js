/* ===========================================================================
 * debug.js — visual helpers for the debug page only (grid + axes).
 *
 * Added only in debug mode. A ground grid for spatial reference and an axes
 * helper at the origin (red = +X, green = +Y, blue = +Z) so positions logged
 * from the editor are easy to reason about.
 * ======================================================================== */

import * as THREE from "three";

export default function createDebug() {
  return {
    name: "debug",
    build(ctx) {
      // Ground grid, sitting just above the bed (y≈0) to avoid z-fighting.
      const grid = new THREE.GridHelper(80, 80, 0x888888, 0xcccccc);
      grid.position.y = 0.01;
      grid.material.opacity = 0.4;
      grid.material.transparent = true;
      ctx.scene.add(grid);

      // Axes at the origin so X/Y/Z directions are unambiguous while editing.
      const axes = new THREE.AxesHelper(3);
      ctx.scene.add(axes);
    },
  };
}
