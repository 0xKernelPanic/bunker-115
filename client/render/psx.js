// PS2-style pipeline: 256-line render target, vertex snapping, 15-bit color with ordered dither.
import * as THREE from 'three';

export let RH = 256;
export const snapU = { value: new THREE.Vector2(160, 128) };

export function psx(m) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uSnap = snapU;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uSnap;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 sp = gl_Position; sp.xy = floor(sp.xy / sp.w * uSnap + 0.5) / uSnap * sp.w; gl_Position = sp; }');
  };
  m.customProgramCacheKey = () => 'psx';
  return m;
}
export const lam = (map, opts = {}) => psx(new THREE.MeshLambertMaterial(Object.assign({ map: map || null }, opts)));
export const basic = (opts = {}) => psx(new THREE.MeshBasicMaterial(opts));

export function createPipeline(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  const rt = new THREE.WebGLRenderTarget(320, RH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const post = new THREE.ShaderMaterial({
    uniforms: {
      tDiff: { value: rt.texture }, uRes: { value: new THREE.Vector2(320, RH) },
      uHurt: { value: 0 }, uFlash: { value: 0 }, uSat: { value: 1 }, uGas: { value: 0 }, uFrost: { value: 0 },
      uBright: { value: 1 }, uFear: { value: 0 }, uTime: { value: 0 }, uHide: { value: 0 }
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `
      uniform sampler2D tDiff; uniform vec2 uRes; uniform float uHurt, uFlash, uSat, uGas, uFrost, uBright, uFear, uTime, uHide; varying vec2 vUv;
      float b2(vec2 a){ a = floor(a); return fract(a.x / 2. + a.y * a.y * .75); }
      float b4(vec2 a){ return b2(.5 * a) * .25 + b2(a); }
      void main(){
        vec2 px = 1. / uRes;
        // fear warps the picture and splits the colour channels
        vec2 uv = vUv + vec2(sin(vUv.y * 22. + uTime * 3.) * .004, cos(vUv.x * 18. + uTime * 2.3) * .003) * uFear;
        float ab = uFear * 2.5;
        vec3 c;
        c.r = texture2D(tDiff, uv + vec2(px.x * ab, 0.)).r;
        c.g = texture2D(tDiff, uv).g;
        c.b = texture2D(tDiff, uv - vec2(px.x * ab, 0.)).b;
        c = c * .72 + texture2D(tDiff, uv + vec2(px.x, 0.)).rgb * .28;
        float l = dot(c, vec3(.299, .587, .114));
        c = mix(vec3(l), c, uSat);
        c = c * 1.1 - .012;
        vec2 d = vUv - .5; float vig = dot(d, d);
        c *= 1. - vig * .85;
        c = mix(c, vec3(.5, 0., 0.), clamp(uHurt * (.2 + vig * 2.8), 0., .85));
        c = mix(c, vec3(.25, .45, .05), clamp(uGas * (.3 + vig * 2.), 0., .6));
        c = mix(c, vec3(.55, .75, 1.), clamp(uFrost * vig * 2.5, 0., .5));
        c += uFlash;
        // inside a locker you see out through the slats
        if (uHide > 0.) { float bar = step(.42, fract(gl_FragCoord.y / uRes.y * 13.)); c *= mix(1., mix(1., .06, bar), uHide); c *= 1. - vig * 2.2 * uHide; }
        c = pow(max(c, 0.), vec3(1. / uBright));
        c = floor(c * 31. + .5 + (b4(gl_FragCoord.xy) - .5)) / 31.;
        gl_FragColor = vec4(c, 1.);
      }`,
    depthTest: false, depthWrite: false
  });
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post);
  quad.frustumCulled = false; postScene.add(quad);
  const cams = [];
  const stats = { calls: 0, triangles: 0 };   // of the world pass, for tools/perf.mjs
  function setLines(n) { RH = n; resize(); }
  function resize() {
    const w = innerWidth || 800, h = innerHeight || 600, a = w / h;
    const RW = Math.max(160, Math.round(RH * a));
    renderer.setSize(RW, RH, false);
    rt.setSize(RW, RH);
    post.uniforms.uRes.value.set(RW, RH);
    snapU.value.set(RW / 2, RH / 2);
    for (const c of cams) { c.aspect = a; c.updateProjectionMatrix(); }
  }
  addEventListener('resize', resize);
  function render(scene, camera, vmScene, vmCam) {
    renderer.setRenderTarget(rt);
    renderer.autoClear = true;
    renderer.render(scene, camera);
    stats.calls = renderer.info.render.calls; stats.triangles = renderer.info.render.triangles;
    if (vmScene) {
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(vmScene, vmCam);
      renderer.autoClear = true;
    }
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }
  return { renderer, post, resize, render, cams, setLines, stats };
}
