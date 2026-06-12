/* ===========================================================================
 * inspect.js — full inspection camera for the debug page (OrbitControls + WASD).
 *
 * The dashboard band uses the bespoke idle-sway orbit (interaction.js); the
 * debug page swaps in THIS layer instead for real inspection controls:
 *   left-drag rotate · right-drag pan · scroll zoom · WASD glide (shift = fast)
 * No idle sway — the camera stays put unless you move it.
 *
 * WASD moves the camera AND the orbit target together along the ground plane,
 * so the pivot stays in front of you and rotate/zoom keep working naturally.
 *
 * Exposes the controls as ctx.controls so the editor can disable them while a
 * TransformControls gizmo is being dragged (avoids rotate-fighting-gizmo).
 * ======================================================================== */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MOVE_KEYS = ["w", "a", "s", "d", "shift"];
const SPEED = 7; // units/sec
const SPEED_FAST = 16; // units/sec while shift held

// Don't capture WASD while the user is typing into a GUI field.
function isTyping(e) {
  const el = e.target;
  return (
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.isContentEditable)
  );
}

export default function createInspect() {
  let controls = null;

  return {
    name: "inspect",
    build(ctx) {
      controls = new OrbitControls(ctx.camera, ctx.renderer.domElement);
      controls.target.copy(ctx.state.target);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.minDistance = 3;
      controls.maxDistance = 50;
      controls.update();

      ctx.controls = controls; // editor toggles .enabled during gizmo drags

      // Default framing captured at build (context.js values), so "reset view"
      // always returns to the committed default regardless of how far we've flown.
      const home = {
        target: ctx.state.target.clone(),
        orbit: { ...ctx.state.orbit },
      };
      // Same spherical formula as context.js placeCamera().
      function placeFromOrbit(target, orbit) {
        ctx.camera.position.set(
          target.x + orbit.radius * Math.cos(orbit.el) * Math.sin(orbit.az),
          target.y + orbit.radius * Math.sin(orbit.el),
          target.z + orbit.radius * Math.cos(orbit.el) * Math.cos(orbit.az)
        );
      }

      // ── Copy-camera button ────────────────────────────────────────────────
      // Back-computes orbit params from wherever OrbitControls left the camera,
      // then copies a paste-ready snippet for context.js to the clipboard.
      const camFolder = ctx.getGUI().addFolder("camera");
      const copyBtn = {
        "copy position"() {
          const pos = ctx.camera.position;
          const tgt = controls.target;
          const dx = pos.x - tgt.x;
          const dy = pos.y - tgt.y;
          const dz = pos.z - tgt.z;
          const radius = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const el = Math.asin(dy / radius);
          const az = Math.atan2(dx, dz);
          const r = (n) => Math.round(n * 1000) / 1000;
          const snippet =
            `// paste into context.js → createContext()\n` +
            `const H_FOV = ${r(ctx.camera.userData.hFov)}; // horizontal fov; vertical is derived per aspect\n` +
            `const target = new THREE.Vector3(${r(tgt.x)}, ${r(tgt.y)}, ${r(tgt.z)});\n` +
            `const orbit = { az: ${r(az)}, el: ${r(el)}, radius: ${r(radius)}, dragging: false };`;
          navigator.clipboard.writeText(snippet).then(() => {
            console.log("[garden] camera snippet copied:\n" + snippet);
          });
        },
      };
      camFolder.add(copyBtn, "copy position");
      // Horizontal-fov slider — narrower = more telephoto/flatter, wider = more
      // dramatic. Vertical fov is derived per aspect, so this looks consistent on
      // the band, mobile, and here. The value rides along in "copy position".
      camFolder
        .add(ctx.camera.userData, "hFov", 25, 100, 1)
        .name("h-fov")
        .onChange(() => ctx.applyFov());
      camFolder.add(
        {
          "reset view"() {
            controls.target.copy(home.target);
            placeFromOrbit(home.target, home.orbit);
            controls.update();
          },
        },
        "reset view"
      );
      camFolder.open();

      // ── WASD glide ────────────────────────────────────────────────────────
      const pressed = new Set();
      function onKeyDown(e) {
        if (isTyping(e)) return;
        const k = e.key.toLowerCase();
        if (MOVE_KEYS.includes(k)) pressed.add(k);
      }
      function onKeyUp(e) {
        pressed.delete(e.key.toLowerCase());
      }
      ctx.addListener(window, "keydown", onKeyDown);
      ctx.addListener(window, "keyup", onKeyUp);

      const camera = ctx.camera;
      const fwd = new THREE.Vector3();
      const right = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      const move = new THREE.Vector3();
      let prevT = 0;

      ctx.registerUpdate(function (t) {
        const dt = prevT ? Math.min(0.05, t - prevT) : 0;
        prevT = t;

        // Glide unless a gizmo drag owns the input.
        if (pressed.size && !ctx.state.transformDragging && dt > 0) {
          camera.getWorldDirection(fwd);
          fwd.y = 0;
          fwd.normalize(); // forward, flattened to the ground plane
          right.crossVectors(fwd, up).normalize(); // camera-right

          move.set(0, 0, 0);
          if (pressed.has("w")) move.add(fwd);
          if (pressed.has("s")) move.addScaledVector(fwd, -1);
          if (pressed.has("d")) move.add(right);
          if (pressed.has("a")) move.addScaledVector(right, -1);

          if (move.lengthSq() > 0) {
            const speed = (pressed.has("shift") ? SPEED_FAST : SPEED) * dt;
            move.normalize().multiplyScalar(speed);
            camera.position.add(move);
            controls.target.add(move); // keep the orbit pivot in front of us
          }
        }

        controls.update(); // required every frame while damping is on
      });
    },

    dispose() {
      if (controls) controls.dispose();
    },
  };
}
