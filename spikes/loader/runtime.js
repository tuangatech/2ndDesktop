// The host's runtime in the spike page, served from scene://spike/_host/runtime.js. It imports PixiJS by name (the
// import map points at the host's single copy), loads the throwaway pack, and reports checks to the harness.
import * as host from 'pixi.js';

const params = new URLSearchParams(location.search);
const violations = [];
document.addEventListener('securitypolicyviolation', (event) =>
  violations.push(`${event.violatedDirective}: ${event.blockedURI || 'inline'}`.slice(0, 100)),
);

async function structural() {
  const checks = [];
  const add = (name, ok, detail = '', required = true) =>
    checks.push({ name, ok: Boolean(ok), detail: String(detail), required });

  try {
    new Function('return 1')();
    add('eval_is_blocked', false, 'new Function ran');
  } catch (error) {
    add('eval_is_blocked', true, error.name);
  }
  add('page_origin_is_scene', location.origin === 'scene://spike', location.origin);

  const scene = await import('/index.js');
  add('scene_module_loaded', typeof scene.makeScene === 'function');
  add(
    'one_copy_of_pixi',
    scene.Container === host.Container && new scene.Container() instanceof host.Container,
    'the pack and the host share Container',
  );

  const app = new host.Application();
  await app.init({ preference: 'webgl', width: 64, height: 64, antialias: false });
  document.getElementById('stage').appendChild(app.canvas);
  app.stage.addChild(scene.makeScene());
  app.render();
  const { pixels } = app.renderer.extract.pixels({
    target: app.stage,
    frame: new host.Rectangle(8, 8, 1, 1),
  });
  add(
    'scene_draws_with_host_pixi',
    pixels[0] > 200 && pixels[1] < 50 && pixels[2] < 50,
    `renderer ${app.renderer.name}, pixel ${[...pixels.slice(0, 4)].join(',')}`,
  );

  const refused = (promise) =>
    promise.then(
      () => false,
      () => true,
    );
  add('fetch_to_other_origin_refused', await refused(fetch('https://example.com/')));
  add('import_from_url_refused', await refused(import('https://example.com/x.js')));
  // Information, not a pass or a fail: does `connect-src 'none'` also stop the page loading its own files?
  const sameOrigin = await fetch('/asset.json').then(
    (r) => `allowed (${r.status})`,
    () => 'refused',
  );
  add('info_fetch_of_own_file', true, sameOrigin, false);
  const storage = (() => {
    try {
      localStorage.setItem('spike', '1');
      return localStorage.getItem('spike') === '1' ? 'works' : 'no';
    } catch {
      return 'throws';
    }
  })();
  add('info_local_storage', true, storage, false);

  const styleViolations = violations.filter((text) => text.startsWith('style-src'));
  add('no_style_src_violation', styleViolations.length === 0, styleViolations.join(' | '));
  add('info_violations_seen', true, violations.join(' | ') || 'none', false);
  return { checks };
}

async function webrtc() {
  const out = { exists: typeof RTCPeerConnection !== 'undefined' };
  if (!out.exists) return out;
  const stun = (params.get('stun') ?? '').split(',').filter(Boolean);
  out.candidates = [];
  try {
    const peer = new RTCPeerConnection({
      iceServers: stun.map((host) => ({ urls: `stun:${host}` })),
    });
    peer.onicecandidate = (event) => {
      if (event.candidate) out.candidates.push(event.candidate.type);
    };
    peer.createDataChannel('spike');
    await peer.setLocalDescription(await peer.createOffer());
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 4000);
      peer.onicegatheringstatechange = () => {
        if (peer.iceGatheringState === 'complete') {
          clearTimeout(timer);
          resolve();
        }
      };
    });
    out.gathering = peer.iceGatheringState;
    peer.close();
  } catch (error) {
    out.error = String(error).slice(0, 100);
  }
  return out;
}

try {
  window.spike.report(params.get('stun') === null ? await structural() : await webrtc());
} catch (error) {
  window.spike.report({ failed: String(error?.stack ?? error).slice(0, 500) });
}
