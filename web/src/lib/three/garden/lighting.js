/* ===========================================================================
 * lighting.js — time-of-day light rig + the palette table other layers read.
 *
 * lightingFor(period) is a pure helper: context computes ctx.state.lit once
 * from it, then both this lights layer and the ground layer (sun/moon orb)
 * read ctx.state.lit so light and celestial object always agree.
 * ======================================================================== */

import * as THREE from "three";

// Warm key light + ambient tuned per time of day. keyPos doubles as the
// sun/moon position so light and object always agree.
export function lightingFor(period) {
  // keyPos sits in the sky behind the bed (negative z) at a modest height so
  // the sun/moon orb stays in frame; ambient is kept moderate so the bed and
  // pots keep their colour without washing out, while shadows stay readable.
  switch (period) {
    case "morning":
      return {
        ambientColor: 0xfff1e0, ambientIntensity: 0.55,
        keyColor: 0xffe8c2, keyIntensity: 0.9,
        keyPos: new THREE.Vector3(-6, 3.0, -9),
      };
    case "afternoon":
      return {
        ambientColor: 0xfff6ec, ambientIntensity: 0.6,
        keyColor: 0xfff3d6, keyIntensity: 1.0,
        keyPos: new THREE.Vector3(3, 3.4, -9),
      };
    case "evening":
      return {
        ambientColor: 0xffe4cf, ambientIntensity: 0.5,
        keyColor: 0xffb074, keyIntensity: 0.95, // warm sunset
        keyPos: new THREE.Vector3(7, 2.6, -9),
      };
    default: // night
      return {
        ambientColor: 0xdfe6f2, ambientIntensity: 0.4,
        keyColor: 0xbcc8e6, keyIntensity: 0.55, // cool moonlight
        keyPos: new THREE.Vector3(-5, 3.2, -9),
      };
  }
}

// Gentle warm ambient + one shadow-casting directional key, tuned per period.
export default function createLights() {
  return {
    name: "lights",
    build(ctx) {
      const lit = ctx.state.lit;

      const ambient = new THREE.AmbientLight(lit.ambientColor, lit.ambientIntensity);
      ctx.scene.add(ambient);

      const key = new THREE.DirectionalLight(lit.keyColor, lit.keyIntensity);
      key.position.copy(lit.keyPos);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 40;
      key.shadow.camera.left = -10;
      key.shadow.camera.right = 10;
      key.shadow.camera.top = 10;
      key.shadow.camera.bottom = -10;
      key.shadow.radius = 4; // soft edges
      ctx.scene.add(key);
    },
  };
}
