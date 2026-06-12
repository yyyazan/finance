/* ===========================================================================
 * editor.js — dev-only layout editor (gated behind ?edit or window.GARDEN_EDIT).
 *
 * Two complementary tools for placing plants by hand instead of editing numbers
 * and reloading:
 *   1. TransformControls — a drag-gizmo in the viewport (click a plant, then
 *      G/E/R to translate/rotate/scale).
 *   2. lil-gui — a side panel with x/y/z + rotation + scale sliders per plant,
 *      and a "Log positions" button to dump the values to the console (+ clipboard).
 *
 * While the gizmo is dragging it sets ctx.state.transformDragging so the
 * interaction layer's camera orbit yields the mouse.
 * ======================================================================== */

import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { PLANT_SLOTS } from "../constants.js";

export function editorEnabled() {
  try {
    return (
      window.GARDEN_EDIT === true ||
      /[?&]edit(=|&|$)/.test(window.location.search)
    );
  } catch (e) {
    return false;
  }
}

export default function createEditor() {
  let control = null;
  let controlHelper = null;
  let gui = null;

  return {
    name: "editor",
    build(ctx) {
      const syncs = []; // per-plant closures that pull holder state into the GUI
      const markers = []; // draggable rings for slots with no holding yet

      // Refresh every GUI control from the live object state. Called when the
      // gizmo moves a plant so the sliders track the drag (and vice-versa).
      function refreshGui() {
        if (!gui) return;
        for (let i = 0; i < syncs.length; i++) syncs[i]();
        gui.controllersRecursive().forEach((c) => c.updateDisplay());
      }

      // ── 1. TransformControls gizmo ───────────────────────────────────────
      control = new TransformControls(ctx.camera, ctx.renderer.domElement);
      control.setSize(0.8);
      control.addEventListener("objectChange", refreshGui);
      // Signal the camera layer to yield the mouse during a gizmo drag. The
      // dashboard's idle-sway orbit reads transformDragging; the debug page's
      // OrbitControls (ctx.controls) must be hard-disabled synchronously here,
      // or it would start rotating on the same pointerdown that grabs a handle.
      control.addEventListener("dragging-changed", (e) => {
        ctx.state.transformDragging = e.value;
        if (ctx.controls) ctx.controls.enabled = !e.value;
      });
      // Modern three (r169+) exposes the gizmo via getHelper(); older builds were
      // an Object3D you add directly. Feature-detect so both work.
      controlHelper = control.getHelper ? control.getHelper() : control;
      ctx.scene.add(controlHelper);

      function selectPlant(holder) {
        if (holder) control.attach(holder);
        else control.detach();
      }

      // A click (negligible mouse travel) picks the plant under the cursor and
      // attaches the gizmo; a real drag is left to the camera orbit.
      const ray = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const down = { x: 0, y: 0 };
      function onDown(e) {
        down.x = e.clientX;
        down.y = e.clientY;
      }
      function onUp(e) {
        if (control.dragging) return; // finished a gizmo drag
        if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 4) return;
        const rect = ctx.canvas.getBoundingClientRect();
        ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        ray.setFromCamera(ndc, ctx.camera);
        const hits = ray.intersectObjects(ctx.plants.concat(markers), true);
        if (!hits.length) {
          selectPlant(null);
          return;
        }
        let holder = hits[0].object;
        while (
          holder.parent &&
          holder.name !== "plant" &&
          holder.name !== "slotMarker"
        )
          holder = holder.parent;
        selectPlant(holder);
      }
      ctx.addListener(ctx.canvas, "mousedown", onDown);
      ctx.addListener(ctx.canvas, "mouseup", onUp);

      // Keyboard: G/E/R switch gizmo mode, Esc deselects. (Translate is G, not
      // W, so it doesn't collide with the debug page's WASD camera movement.)
      function onKey(e) {
        if (e.key === "g") control.setMode("translate");
        else if (e.key === "e") control.setMode("rotate");
        else if (e.key === "r") control.setMode("scale");
        else if (e.key === "Escape") selectPlant(null);
      }
      ctx.addListener(window, "keydown", onKey);

      // ── 2. lil-gui slider panel ──────────────────────────────────────────
      let logCtrl = null;
      const LOG_LABEL = "Log positions → console";
      function flash(msg) {
        if (!logCtrl) return;
        logCtrl.name(msg);
        setTimeout(() => logCtrl && logCtrl.name(LOG_LABEL), 1400);
      }

      function logPositions() {
        const out = ctx.plants.map((h) => {
          const p = h.userData.position || {};
          return {
            ticker: p.ticker || null,
            x: +h.position.x.toFixed(2),
            y: +h.position.y.toFixed(2),
            z: +h.position.z.toFixed(2),
            rotYdeg: +THREE.MathUtils.radToDeg(h.rotation.y).toFixed(1),
            scale: +h.scale.x.toFixed(2),
          };
        });
        if (!out.length) {
          console.warn("[garden] no plants yet — nothing to log");
          flash("no plants yet");
          return out;
        }
        const json = JSON.stringify(out, null, 2);
        // Inspectable object first, then the copy-paste-ready JSON string.
        console.log(`[garden] plant layout (${out.length} plants):`, out);
        console.log(json);
        // Clipboard write is async and can reject (focus/permissions); reflect
        // the real outcome on the button instead of swallowing it.
        const p = navigator.clipboard && navigator.clipboard.writeText(json);
        if (p && p.then) {
          p.then(() => flash(`copied ${out.length} ✓`)).catch(() =>
            flash(`logged ${out.length} (copy blocked)`)
          );
        } else {
          flash(`logged ${out.length} ✓`);
        }
        return out;
      }

      // ── Copy PLANT_SLOTS ─────────────────────────────────────────────────
      // Every editable object (a placed plant or an empty-slot ring) carries its
      // slotIndex. Gather them, sort by slot, and emit a paste-ready array for
      // constants.js — so you drag the whole garden into shape, then capture all
      // slots in one click instead of copying positions one at a time.
      let slotsCtrl = null;
      const SLOTS_LABEL = "Copy PLANT_SLOTS";
      function flashSlots(msg) {
        if (!slotsCtrl) return;
        slotsCtrl.name(msg);
        setTimeout(() => slotsCtrl && slotsCtrl.name(SLOTS_LABEL), 1400);
      }
      function editableObjects() {
        // plants first, then empty markers; each has userData.slotIndex.
        return ctx.plants.concat(markers);
      }
      function copySlots() {
        const rows = editableObjects()
          .map((o) => ({
            i: o.userData.slotIndex,
            x: +o.position.x.toFixed(2),
            z: +o.position.z.toFixed(2),
            rot: +o.rotation.y.toFixed(3),
          }))
          .sort((a, b) => a.i - b.i);
        if (!rows.length) {
          flashSlots("no slots yet");
          return;
        }
        const body = rows
          .map((s) => `  { x: ${s.x}, z: ${s.z}, rot: ${s.rot} },`)
          .join("\n");
        const text = `export const PLANT_SLOTS = [\n${body}\n];`;
        console.log(`[garden] ${rows.length} slots:\n` + text);
        const p = navigator.clipboard && navigator.clipboard.writeText(text);
        if (p && p.then) {
          p.then(() => flashSlots(`copied ${rows.length} ✓`)).catch(() =>
            flashSlots(`logged ${rows.length} (copy blocked)`)
          );
        } else {
          flashSlots(`logged ${rows.length} ✓`);
        }
      }

      // A flat ring marking an empty slot — draggable like a plant so the full
      // 20-slot layout can be arranged even when fewer holdings are loaded.
      function spawnMarkers() {
        const occupied = new Set(
          ctx.plants.map((h) => h.userData.slotIndex)
        );
        for (let i = 0; i < PLANT_SLOTS.length; i++) {
          if (occupied.has(i)) continue;
          const slot = PLANT_SLOTS[i];
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.5, 0.05, 8, 24),
            new THREE.MeshBasicMaterial({
              color: 0x4a7c59,
              transparent: true,
              opacity: 0.55,
            })
          );
          ring.rotation.x = Math.PI / 2; // lay flat on the bed
          const m = new THREE.Group();
          m.add(ring);
          m.position.set(slot.x, 0.02, slot.z);
          m.rotation.y = slot.rot || 0;
          m.name = "slotMarker";
          m.userData.slotIndex = i;
          ctx.scene.add(m);
          markers.push(m);
        }
      }

      function buildFolders() {
        editableObjects().forEach((holder) => {
          const pos = holder.userData.position || {};
          const isMarker = holder.name === "slotMarker";
          const label = isMarker
            ? `slot ${holder.userData.slotIndex} (empty)`
            : pos.ticker || `slot ${holder.userData.slotIndex}`;
          const f = gui.addFolder(label);
          f.add(holder.position, "x", -20, 20, 0.05);
          f.add(holder.position, "y", -2, 6, 0.05);
          f.add(holder.position, "z", -8, 8, 0.05);

          const rot = { deg: THREE.MathUtils.radToDeg(holder.rotation.y) };
          f.add(rot, "deg", -180, 180, 1)
            .name("rot Y°")
            .onChange((v) => {
              holder.rotation.y = THREE.MathUtils.degToRad(v);
            });

          // Markers don't carry an allocation scale — only plants get the slider.
          const scl = { s: holder.scale.x || 1 };
          if (!isMarker) {
            f.add(scl, "s", 0.2, 3, 0.01)
              .name("scale")
              .onChange((v) => {
                holder.scale.setScalar(v);
              });
          }

          f.close();
          // Keep this folder's rot/scale proxies in step with gizmo drags.
          syncs.push(() => {
            rot.deg = THREE.MathUtils.radToDeg(holder.rotation.y);
            scl.s = holder.scale.x;
          });
        });
      }

      gui = ctx.getGUI(); // shared debug panel (sky controls etc. live here too)
      logCtrl = gui.add({ log: logPositions }, "log").name(LOG_LABEL);
      slotsCtrl = gui.add({ copy: copySlots }, "copy").name(SLOTS_LABEL);

      // Plants load async (VOX parse), so ctx.plants is usually still empty here.
      // Poll briefly until they appear, then spawn empty-slot markers + folders.
      let tries = 0;
      (function waitForPlants() {
        if (!ctx.alive) return; // scene torn down while we waited
        if (ctx.plants.length) {
          spawnMarkers();
          buildFolders();
          return;
        }
        if (tries++ < 40) setTimeout(waitForPlants, 120);
      })();
    },

    dispose() {
      // The shared GUI is owned/destroyed by the context, not the editor.
      if (control) {
        try {
          control.detach();
        } catch (e) {
          /* not attached */
        }
        // In r169+ the helper (not the control) is what was added to the scene.
        const helper = controlHelper || control;
        if (helper.parent) helper.parent.remove(helper);
        try {
          control.dispose();
        } catch (e) {
          /* no dispose in build */
        }
      }
    },
  };
}
