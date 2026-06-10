/* ===========================================================================
 * context.js — the shared scene context every layer receives.
 *
 * createContext() builds the renderer / scene / camera / clock once per mount
 * and returns `ctx`, the single object passed into each layer's build(ctx).
 * Layers create objects on ctx.scene, register per-frame work with
 * ctx.registerUpdate(fn), and add DOM listeners with ctx.addListener(...).
 * disposeContext() reverses all of it on unmount.
 * ======================================================================== */

import * as THREE from "three";
import GUI from "lil-gui";
import { PAGE_BG } from "./constants.js";
import { lightingFor } from "./lighting.js";

// Place the camera on its spherical orbit around `target`.
function placeCamera(camera, target, orbit) {
  camera.position.set(
    target.x + orbit.radius * Math.cos(orbit.el) * Math.sin(orbit.az),
    target.y + orbit.radius * Math.sin(orbit.el),
    target.z + orbit.radius * Math.cos(orbit.el) * Math.cos(orbit.az)
  );
  camera.lookAt(target);
}

export function createContext(root, data) {
  const positions = (data && data.positions) || [];
  const period = (data && data.period) || "afternoon";

  const width = root.clientWidth || root.offsetWidth || 800;
  const height = root.clientHeight || 380;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAGE_BG);

  // Slightly elevated three-quarter view: tilted down at the bed like you're
  // tending it, but shallow enough that the horizon — and the sun/moon in the
  // sky above it — stay in frame. Drag to orbit (interaction layer), so you can
  // swing up to look at the sky.
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  const target = new THREE.Vector3(0, 1.2, 0);
  // Spherical orbit around `target` (azimuth, elevation, radius). Pulled back
  // far enough to frame a full row of plants across the bed.
  const orbit = { az: 0, el: 0.24, radius: 16, dragging: false };
  placeCamera(camera, target, orbit);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(PAGE_BG, 1); // belt-and-suspenders with scene.background
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Modern three colour pipeline. sRGB output is the default since r152 but we
  // set it explicitly. NoToneMapping (also the default) keeps the off-white
  // PAGE_BG landing on its exact hex so the canvas blends into the page; once
  // post-processing lands (Phase C) we can revisit ACESFilmic + an OutputPass.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const canvas = renderer.domElement;
  canvas.className = "garden-canvas";
  root.appendChild(canvas);

  const ctx = {
    root,
    canvas,
    renderer,
    scene,
    camera,
    clock: new THREE.Clock(),
    size: { w: width, h: height },
    // Mutable shared state any layer may read/write.
    state: {
      period,
      positions,
      orbit,
      target,
      lit: lightingFor(period), // light + sun/moon palette, computed once
      transformDragging: false, // editor sets this; interaction reads it
    },
    plants: [], // populated by the plants layer; interaction/editor read it
    layers: [],
    controls: null, // set by the inspect layer (OrbitControls); editor reads it
    composer: null, // set in Phase C (post-processing)
    gui: null, // single shared lil-gui panel; layers add folders via getGUI()
    alive: true, // flipped false in disposeContext; async layer work checks it
    _updates: [], // per-frame callbacks (t, ctx)
    _listeners: [], // [target, type, fn] for removal on teardown

    registerUpdate(fn) {
      this._updates.push(fn);
    },
    addListener(target, type, fn) {
      target.addEventListener(type, fn);
      this._listeners.push([target, type, fn]);
    },
    // Lazily create ONE shared debug panel; every debug layer adds a folder to
    // it (avoids stacked, overlapping lil-gui instances). Destroyed in teardown.
    getGUI() {
      if (!this.gui) this.gui = new GUI({ title: "garden · debug" });
      return this.gui;
    },
  };

  // Central resize: keep the camera aspect, renderer, and (later) composer in
  // sync with the #garden-root band as the dashboard reflows.
  function onResize() {
    const w = root.clientWidth || width;
    const h = root.clientHeight || height;
    ctx.size.w = w;
    ctx.size.h = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (ctx.composer) ctx.composer.setSize(w, h);
  }
  ctx.addListener(window, "resize", onResize);

  return ctx;
}

export function disposeContext(ctx) {
  ctx.alive = false;

  // Drop the shared debug panel (if any layer created one).
  if (ctx.gui) {
    try {
      ctx.gui.destroy();
    } catch (e) {
      /* already gone */
    }
    ctx.gui = null;
  }

  // Drop every DOM listener (central + layer-registered).
  for (const [target, type, fn] of ctx._listeners) {
    target.removeEventListener(type, fn);
  }

  // Dispose all geometry/materials still in the scene.
  ctx.scene.traverse(function (obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(
        function (m) {
          m.dispose();
        }
      );
    }
  });

  if (ctx.composer && ctx.composer.dispose) ctx.composer.dispose();

  ctx.renderer.dispose();
  if (ctx.canvas && ctx.canvas.parentNode) {
    ctx.canvas.parentNode.removeChild(ctx.canvas);
  }
}
