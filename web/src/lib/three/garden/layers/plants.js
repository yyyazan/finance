/* ===========================================================================
 * plants.js — one VOX potted plant per portfolio position, in a row.
 *
 * The Plants.vox parse is cached at MODULE scope (not on ctx), so SPA-navigation
 * remounts reuse it instead of re-fetching/re-parsing. Each plant is wrapped in
 * a holder Group (carries position data + a rest Y) so later phases can
 * raycast / hover / lift the whole plant cleanly.
 * ======================================================================== */

import * as THREE from "three";
import { VOXLoader, VOXMesh } from "three/addons/loaders/VOXLoader.js";
import { GOOD_PLANT_MODELS, PLANT_SCALE, PLANT_SPACING } from "../constants.js";

// Module-level cache: parse Plants.vox ONCE, reuse across scene rebuilds.
// Queued callbacks fire when ready. Never disposed — survives remounts.
let _voxChunks = null;
let _voxLoading = false;
let _voxWaiters = [];

function withVoxChunks(cb) {
  if (_voxChunks) {
    cb(_voxChunks);
    return;
  }
  _voxWaiters.push(cb);
  if (_voxLoading) return;
  _voxLoading = true;
  new VOXLoader().load(
    "/Plants.vox",
    function (result) {
      // Modern VOXLoader returns { chunks, scene } (r128 returned a bare array;
      // a deprecation Proxy still allows array access). Use .chunks.
      const chunks = (result && result.chunks) || result;

      // Defensive palette fix (was REQUIRED on r128): the r128 loader assigned
      // the file's single RGBA palette only to the LAST model, leaving the
      // others on DEFAULT_PALETTE (alien colours). Modern three (r155+) already
      // broadcasts the palette to every chunk, so this is now a no-op UNLESS
      // chunks disagree — only then do we rebroadcast the longest palette.
      const lens = chunks.map((c) => (c.palette ? c.palette.length : 0));
      const allSame = lens.every((l) => l === lens[0]);
      if (!allSame) {
        let real = null;
        for (let k = 0; k < chunks.length; k++) {
          if (chunks[k].palette && chunks[k].palette.length > 256) {
            real = chunks[k].palette;
            break;
          }
        }
        if (real) chunks.forEach((ch) => (ch.palette = real));
      }

      _voxChunks = chunks;
      _voxLoading = false;
      const ws = _voxWaiters;
      _voxWaiters = [];
      ws.forEach((w) => w(chunks));
    },
    undefined,
    function (err) {
      _voxLoading = false;
      console.error("[garden] VOXLoader failed:", err);
    }
  );
}

// Deterministic ticker → model index. Same ticker always grows the same plant
// (stable across reloads); the holdings look varied. Pure function of the
// ticker string — no randomness, no recompute.
function plantModelFor(ticker) {
  const s = String(ticker || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return GOOD_PLANT_MODELS[h % GOOD_PLANT_MODELS.length];
}

// Build ONE plant for a position. This is the single swap point for future
// per-model .glb files: replace the VOXMesh body with a gltfLoader.load(...)
// returning a Group seated the same way; nothing else changes.
function loadPlant(position, chunks) {
  const idx = Math.min(plantModelFor(position.ticker), chunks.length - 1);
  const mesh = new VOXMesh(chunks[idx]);
  mesh.scale.setScalar(PLANT_SCALE);
  mesh.updateMatrixWorld(true);
  // Seat base on the bed (y=0) and centre on its own origin.
  const box = new THREE.Box3().setFromObject(mesh);
  mesh.position.x -= (box.min.x + box.max.x) / 2;
  mesh.position.z -= (box.min.z + box.max.z) / 2;
  mesh.position.y -= box.min.y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export default function createPlants() {
  return {
    name: "plants",
    build(ctx) {
      const positions = ctx.state.positions;
      if (!positions || !positions.length) return;
      withVoxChunks(function (chunks) {
        if (!ctx.alive) return; // unmounted while the VOX parse was in flight
        if (!chunks || !chunks.length) return;
        const n = positions.length;
        const totalW = (n - 1) * PLANT_SPACING;
        for (let i = 0; i < n; i++) {
          const holder = new THREE.Group();
          holder.add(loadPlant(positions[i], chunks));
          holder.position.set(-totalW / 2 + i * PLANT_SPACING, 0, 0);
          holder.name = "plant";
          holder.userData.position = positions[i]; // for hover/click later
          holder.userData.baseY = 0;
          ctx.scene.add(holder);
          ctx.plants.push(holder);
        }
      });
    },
  };
}
