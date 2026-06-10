/* ===========================================================================
 * sky.js — gradient skydome behind the garden (first cinematic layer).
 *
 * A large inward-facing sphere centred on the camera (so it reads as an
 * infinite backdrop from any angle — the debug page can orbit/WASD freely). A
 * ShaderMaterial paints a vertical gradient in THREE separated bands so each
 * colour gets clean air:
 *
 *   [0 .. horizonEnd]      horizon tone → zenith tone
 *   [horizonEnd .. pageStart]  pure zenith tone
 *   [pageStart .. pageEnd] zenith tone → PAGE_BG  (melts into the page top)
 *
 * vDir.y runs 0 at the horizon → 1 straight up. The dashboard camera looks
 * slightly DOWN, so the visible sky is a thin sliver (vDir.y ≈ 0..0.12) — hence
 * the bands sit low by default. On the debug page these are live-tunable.
 *
 * A soft radial glow sits around the sun/moon direction (ctx.state.lit.keyPos),
 * so glow and orb always agree. Clouds land in a follow-up pass.
 * ======================================================================== */

import * as THREE from "three";
import { PAGE_BG } from "../constants.js";

// Per-period sky palette. Colours are authored as sRGB hex; THREE.Color converts
// them to linear for the shader (colour management on), and the shader converts
// back to the output colour space.
function skyPaletteFor(period) {
  switch (period) {
    case "morning":
      return { horizon: 0xffd9b0, zenith: 0xcfe3f5, sun: 0xffb84d, glow: 0.45 };
    case "afternoon":
      return { horizon: 0xfde7cf, zenith: 0xbfe0f5, sun: 0xf6a826, glow: 0.4 };
    case "evening":
      return { horizon: 0xff9e6b, zenith: 0xc9b3d8, sun: 0xef6b3a, glow: 0.7 };
    default: // night
      return { horizon: 0x9fb0d6, zenith: 0xc3cde0, sun: 0x8e9bc4, glow: 0.3 };
  }
}

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    // Dome is centred on the camera and axis-aligned, so the normalized local
    // position is the world view direction — gradient stays world-vertical.
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uPage;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uSunGlow;
  uniform float uHorizonStart; // e where horizon→zenith begins (may be < 0)
  uniform float uHorizonEnd;   // e where horizon→zenith completes
  uniform float uPageStart;    // e where zenith→page begins
  uniform float uPageEnd;      // e where fully page
  varying vec3 vDir;

  void main() {
    float e = clamp(vDir.y, -1.0, 1.0);         // <0 below horizon → 1 straight up
    vec3 col = mix(uHorizon, uZenith, smoothstep(uHorizonStart, uHorizonEnd, e));
    col = mix(col, uPage, smoothstep(uPageStart, uPageEnd, e)); // fade top to page

    // Soft radial glow around the sun/moon direction.
    float d = max(dot(vDir, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(d, 48.0) * uSunGlow);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export default function createSky() {
  return {
    name: "sky",
    build(ctx) {
      const pal = skyPaletteFor(ctx.state.period);

      const uniforms = {
        uHorizon: { value: new THREE.Color(pal.horizon) },
        uZenith: { value: new THREE.Color(pal.zenith) },
        uPage: { value: new THREE.Color(PAGE_BG) },
        uSunColor: { value: new THREE.Color(pal.sun) },
        uSunDir: { value: ctx.state.lit.keyPos.clone().normalize() },
        uSunGlow: { value: pal.glow },
        // Bands sit low because the visible sky is a thin near-horizon sliver.
        // horizon start can go negative to push horizon tone below the horizon.
        uHorizonStart: { value: 0.0 },
        uHorizonEnd: { value: 0.06 },
        uPageStart: { value: 0.12 },
        uPageEnd: { value: 0.45 },
      };

      const material = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: THREE.BackSide, // seen from the inside
        depthWrite: false,
        uniforms,
      });

      // Radius < camera far (100) so the dome never clips; it follows the camera
      // each frame, so all of its vertices stay a constant 50 units away.
      const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), material);
      dome.renderOrder = -1; // draw first, as the backdrop
      ctx.scene.add(dome);

      ctx.registerUpdate(function () {
        dome.position.copy(ctx.camera.position);
      });

      // ── Live tuning on the debug page ──────────────────────────────────────
      if (ctx.debug) {
        const f = ctx.getGUI().addFolder("sky gradient");
        f.add(uniforms.uHorizonStart, "value", -1.0, 0.5, 0.005).name("horizon start");
        f.add(uniforms.uHorizonEnd, "value", -0.5, 0.5, 0.005).name("horizon end");
        f.add(uniforms.uPageStart, "value", -0.5, 0.6, 0.005).name("page start");
        f.add(uniforms.uPageEnd, "value", 0, 1.0, 0.005).name("page end");
        f.add(uniforms.uSunGlow, "value", 0, 2, 0.01).name("sun glow");
        f.addColor({ c: pal.horizon }, "c").name("horizon").onChange((v) => uniforms.uHorizon.value.set(v));
        f.addColor({ c: pal.zenith }, "c").name("zenith").onChange((v) => uniforms.uZenith.value.set(v));

        // Save: dump the current sky settings as paste-ready code (browsers
        // can't write files), with visible confirmation on the button.
        const SAVE_LABEL = "Save sky → console";
        let saveCtrl = null;
        function saveSky() {
          const cfg = {
            period: ctx.state.period,
            horizonStart: +uniforms.uHorizonStart.value.toFixed(3),
            horizonEnd: +uniforms.uHorizonEnd.value.toFixed(3),
            pageStart: +uniforms.uPageStart.value.toFixed(3),
            pageEnd: +uniforms.uPageEnd.value.toFixed(3),
            glow: +uniforms.uSunGlow.value.toFixed(3),
            horizon: "0x" + uniforms.uHorizon.value.getHexString(),
            zenith: "0x" + uniforms.uZenith.value.getHexString(),
          };
          const json = JSON.stringify(cfg, null, 2);
          console.log(`[garden] sky config (${cfg.period}):`, cfg);
          console.log(json);
          const flash = (m) => {
            if (!saveCtrl) return;
            saveCtrl.name(m);
            setTimeout(() => saveCtrl && saveCtrl.name(SAVE_LABEL), 1400);
          };
          const p = navigator.clipboard && navigator.clipboard.writeText(json);
          if (p && p.then) p.then(() => flash("copied ✓")).catch(() => flash("logged (copy blocked)"));
          else flash("logged ✓");
        }
        saveCtrl = f.add({ save: saveSky }, "save").name(SAVE_LABEL);
      }
    },
  };
}
