// A very small stand-in for the Web Audio API that records what is made and how it is wired and shaped.
// `made` holds the nodes by kind; `log` is every call in order (create, connect, disconnect, start, stop, parameter
// events), so a test can pin exactly what a sound does: the same log means the same sound.
export function fakeContext() {
  const made = { oscillators: [], sources: [], buffers: 0, resumed: 0, gains: [], nodes: [] };
  const log = [];
  let nextId = 0;
  const param = (id, name, events = []) => ({
    events,
    value: 0,
    setValueAtTime(value, time) {
      events.push(['set', value, time]);
      log.push([id, name, 'set', value, time]);
    },
    linearRampToValueAtTime(value, time) {
      events.push(['linear', value, time]);
      log.push([id, name, 'linear', value, time]);
    },
    exponentialRampToValueAtTime(value, time) {
      events.push(['exp', value, time]);
      log.push([id, name, 'exp', value, time]);
    },
    setTargetAtTime(value, time, constant) {
      events.push(['target', value, time, constant]);
      log.push([id, name, 'target', value, time, constant]);
    },
  });
  const node = (kind, extra = {}) => {
    const id = nextId++;
    log.push([id, 'create', kind]);
    const n = {
      id,
      connected: [],
      disconnected: false,
      connect(to) {
        n.connected.push(to);
        log.push([id, 'connect', to?.id ?? 'destination']);
      },
      disconnect() {
        n.disconnected = true;
        log.push([id, 'disconnect']);
      },
      start(at, offset, duration) {
        n.startedAt = at;
        n.offset = offset;
        n.duration = duration;
        log.push([id, 'start', at, offset ?? null, duration ?? null]);
      },
      stop(at) {
        n.stoppedAt = at;
        log.push([id, 'stop', at]);
      },
      frequency: param(id, 'frequency'),
      gain: param(id, 'gain'),
      threshold: param(id, 'threshold'),
      knee: param(id, 'knee'),
      ratio: param(id, 'ratio'),
      attack: param(id, 'attack'),
      release: param(id, 'release'),
      Q: param(id, 'Q'),
      ...extra,
    };
    made.nodes.push(n);
    return n;
  };
  const ctx = {
    state: 'suspended',
    currentTime: 0,
    sampleRate: 8000,
    destination: {},
    resume() {
      made.resumed++;
      return Promise.resolve();
    },
    createGain() {
      const n = node('gain');
      made.gains.push(n);
      return n;
    },
    createBiquadFilter: () => node('biquad'),
    createDynamicsCompressor: () => node('compressor'),
    createConvolver: () => node('convolver', { buffer: null }),
    createOscillator() {
      const n = node('oscillator');
      made.oscillators.push(n);
      return n;
    },
    createBuffer(channels, length) {
      made.buffers++;
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, getChannelData: (i) => data[i] };
    },
    createBufferSource() {
      const n = node('source', { buffer: null });
      made.sources.push(n);
      return n;
    },
  };
  return { ctx, made, log };
}
