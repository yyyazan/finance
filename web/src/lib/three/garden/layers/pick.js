/* ===========================================================================
 * pick.js — interactivity & idle life for the dashboard / mobile garden.
 *
 * Added ONLY on the interactive mounts (the dashboard hero + mobile hero) — i.e.
 * whenever the editor is absent. The /garden debug page keeps its own click-to-
 * select gizmo (editor.js), so this layer never runs there and the two never
 * fight over the pointer.
 *
 * Everything that makes the bed feel alive lives here:
 *   - wind sway   — every plant leans gently, out of phase, every frame.
 *   - hover/tap   — the plant under the cursor glows (emissive) + lifts, and a
 *                   tooltip (via the onHover callback) tracks it as it sways.
 *   - click/tap   — opens the holding's detail overlay (via the onPick callback).
 *
 * Desktop uses hover (pointermove); touch uses a two-stage tap (tap = select +
 * sticky tooltip, tap again = open). Drag-to-orbit is distinguished from a click
 * with the same 4px travel threshold the editor uses, so orbiting never navigates.
 * ======================================================================== */

import * as THREE from "three";

const LIFT = 0.3; // world units a hovered plant rises
const GLOW_COLOR = 0x6fffe0; // emissive tint on hover (bright jade)
const GLOW_MAX = 0.7; // peak emissiveIntensity
const SWAY_AMP = 0.035; // ~2° lean
const SWAY_SPEED = 0.6;
const TOP_GAP = 0.4; // extra height above the plant's bbox for the tooltip anchor

// First descendant mesh that carries a material (the VOXMesh body).
function meshOf(holder) {
  let found = null;
  holder.traverse((o) => {
    if (!found && o.isMesh && o.material) found = o;
  });
  return found;
}

// Lazily stamp the per-holder animation baseline once the plant has loaded.
function ensureInit(holder) {
  if (holder.userData._swayInit) return;
  holder.userData._swayInit = true;
  holder.userData._swayPhase = (holder.userData.slotIndex || 0) * 1.7;
  holder.userData._baseRotZ = holder.rotation.z;
  holder.userData._baseY = holder.userData.baseY || 0;
  holder.userData._glow = 0;
  // Cache the plant's local top so the tooltip can anchor above the foliage.
  const box = new THREE.Box3().setFromObject(holder);
  holder.userData._topLocalY = box.max.y - holder.position.y + TOP_GAP;
}

export default function createPick(options = {}) {
  const onHover = options.onHover || function () {};
  const onPick = options.onPick || function () {};

  const touch =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(hover: none), (pointer: coarse)").matches;

  let hoveredHolder = null; // desktop pointermove target
  let selectedHolder = null; // touch tap target (sticky)

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  const down = { x: 0, y: 0 };

  return {
    name: "pick",
    build(ctx) {
      const canvas = ctx.canvas;

      function active() {
        return touch ? selectedHolder : hoveredHolder;
      }

      // Raycast at viewport pixel coords → the plant holder under them, or null.
      function pickAt(clientX, clientY) {
        if (!ctx.plants.length) return null;
        const rect = canvas.getBoundingClientRect();
        ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        ray.setFromCamera(ndc, ctx.camera);
        const hits = ray.intersectObjects(ctx.plants, true);
        if (!hits.length) return null;
        let holder = hits[0].object;
        while (holder.parent && holder.name !== "plant") holder = holder.parent;
        return holder.name === "plant" ? holder : null;
      }

      // ── Desktop hover ────────────────────────────────────────────────────
      if (!touch) {
        function onMove(e) {
          // Yield to drag-to-orbit so the tooltip doesn't flicker mid-swing.
          if (ctx.state.orbit && ctx.state.orbit.dragging) return;
          const holder = pickAt(e.clientX, e.clientY);
          if (holder !== hoveredHolder) {
            hoveredHolder = holder;
            if (!holder) onHover(null); // per-frame loop emits the payload when set
          }
          // Desktop camera is locked (no drag), so idle cursor is default.
          canvas.style.cursor = holder ? "pointer" : "default";
        }
        function onLeave() {
          hoveredHolder = null;
          onHover(null);
          canvas.style.cursor = "default";
        }
        ctx.addListener(canvas, "pointermove", onMove);
        ctx.addListener(canvas, "pointerleave", onLeave);
      }

      // ── Click / tap (shared) ─────────────────────────────────────────────
      function onDown(e) {
        down.x = e.clientX;
        down.y = e.clientY;
      }
      function onUp(e) {
        // A drag (orbit) — not a click. Reuse the editor's 4px travel threshold.
        if (ctx.state.orbit && ctx.state.orbit.dragging) return;
        if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 4) return;

        const holder = pickAt(e.clientX, e.clientY);
        if (!touch) {
          if (holder) onPick(holder.userData.position);
          return;
        }
        // Touch: first tap selects (sticky tooltip), second tap opens.
        if (holder && holder === selectedHolder) {
          onPick(holder.userData.position);
        } else if (holder) {
          selectedHolder = holder; // per-frame loop emits the payload
        } else {
          selectedHolder = null;
          onHover(null);
        }
      }
      ctx.addListener(canvas, "pointerdown", onDown);
      ctx.addListener(canvas, "pointerup", onUp);

      // ── Per-frame: sway (all) + lift/glow/tooltip (active) ───────────────
      ctx.registerUpdate(function (t) {
        const act = active();
        for (const holder of ctx.plants) {
          ensureInit(holder);
          const isActive = holder === act;

          // wind sway — independent of rotation.y (the slot orientation)
          holder.rotation.z =
            holder.userData._baseRotZ +
            Math.sin(t * SWAY_SPEED + holder.userData._swayPhase) * SWAY_AMP;

          // lift
          const targetY = holder.userData._baseY + (isActive ? LIFT : 0);
          holder.position.y += (targetY - holder.position.y) * 0.18;

          // glow (emissive intensity lerp; safe — materials are per-plant)
          const g = holder.userData._glow;
          const ng = g + ((isActive ? GLOW_MAX : 0) - g) * 0.2;
          holder.userData._glow = ng;
          applyGlow(holder, ng);
        }

        // tooltip follows the active plant as it sways
        if (act) {
          tmp.set(
            act.position.x,
            act.position.y + (act.userData._topLocalY || 2),
            act.position.z
          );
          tmp.project(ctx.camera);
          const x = (tmp.x * 0.5 + 0.5) * ctx.size.w;
          const y = (-tmp.y * 0.5 + 0.5) * ctx.size.h;
          onHover({ card: act.userData.position, x, y, above: y > 56 });
        }
      });
    },

    dispose() {
      // Restore everything so fast SPA nav never leaves a plant lit / lifted /
      // tilted. (Listeners + the update fn are torn down by disposeContext.)
      // ctx isn't held here, but each holder carries its own baseline.
      onHover(null);
    },
  };
}

// Drive the emissive glow on a holder's mesh, caching+restoring the original.
function applyGlow(holder, intensity) {
  const mesh = meshOf(holder);
  if (!mesh) return;
  const mat = mesh.material;
  if (intensity > 0.001) {
    if (!holder.userData._glowCache) {
      holder.userData._glowCache = {
        emissive: mat.emissive.clone(),
        intensity: mat.emissiveIntensity,
      };
    }
    mat.emissive.setHex(GLOW_COLOR);
    mat.emissiveIntensity = intensity;
  } else if (holder.userData._glowCache) {
    mat.emissive.copy(holder.userData._glowCache.emissive);
    mat.emissiveIntensity = holder.userData._glowCache.intensity;
    holder.userData._glowCache = null;
  }
}
