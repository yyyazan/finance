/* ===========================================================================
 * ground.js — the garden bed + the sun/moon orb.
 *
 * Reads ctx.state.lit (from lighting.js) so the orb sits exactly at the
 * key-light position and tints to match the time of day.
 * ======================================================================== */

import * as THREE from "three";

// A glowing orb standing in for the sun or moon, placed at the key-light
// position. Colours are saturated (not pale) so it reads clearly against the
// off-white sky, with a soft larger halo for a gentle bloom.
function buildSunMoon(period, pos) {
  const isNight = period === "night";
  // Saturated enough to stand out on #f7f6f5 (pale yellow vanished).
  const color = isNight ? 0x8e9bc4 : period === "evening" ? 0xef6b3a : 0xf6a826;
  const group = new THREE.Group();

  // Unlit basic material so the disc shows its true saturated colour no matter
  // how the scene is lit — an emissive Standard mat was blowing out.
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(isNight ? 1.0 : 1.3, 28, 28),
    new THREE.MeshBasicMaterial({ color: color })
  );
  group.add(core);

  // Soft halo: a larger translucent shell for a faint aura. Normal blending
  // (not additive — additive washes out to white on a light background).
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(isNight ? 1.7 : 2.2, 28, 28),
    new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    })
  );
  group.add(halo);

  group.position.copy(pos);
  group.name = "sun-moon";
  return group;
}

export default function createGround() {
  return {
    name: "ground",
    build(ctx) {
      // ── Garden bed ──────────────────────────────────────────────────────
      // 80×32 — doubled from 40×16 so the green fills the wide (fov 90) frame and
      // the bed edge stays well outside view.
      const bed = new THREE.Mesh(
        new THREE.PlaneGeometry(80, 32),
        new THREE.MeshStandardMaterial({
          color: 0xb8c294, // soft sage soil — distinct from page bg, still gentle
          roughness: 0.95,
          metalness: 0.0,
        })
      );
      bed.rotation.x = -Math.PI / 2;
      bed.position.y = 0;
      bed.receiveShadow = true;
      ctx.scene.add(bed);

      // ── Sun / moon ──────────────────────────────────────────────────────
      ctx.scene.add(buildSunMoon(ctx.state.period, ctx.state.lit.keyPos));
    },
  };
}
