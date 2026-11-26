// Audition the game sounds in a browser: `npm run sounds`.
// A tiny local server (127.0.0.1 only, random port) serves one page, the real `SoundPlayer.js` (the engine) and the
// tank's `sounds.js` (its recipes), so what you hear is what the game plays. The page also renders each sound offline and shows its length, peak and loudness,
// and the largest jump between two samples (a click shows up there). Press Ctrl+C to stop. Development only; the
// app never runs this.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const player = fileURLToPath(new URL('../app/page/SoundPlayer.js', import.meta.url));
const tankSounds = fileURLToPath(new URL('../scenes/fishtank/sounds.js', import.meta.url));

const page = `<!doctype html>
<meta charset="utf-8">
<title>Fish Tank sounds</title>
<style>
  body { font: 16px/1.5 system-ui, sans-serif; max-width: 40rem; margin: 2rem auto; padding: 0 1rem; color: #123; background: #eef6f8; }
  button { font: inherit; padding: .6rem 1.2rem; margin: .25rem .25rem .25rem 0; border: 0; border-radius: .5rem; background: #2b7a8c; color: #fff; cursor: pointer; }
  button:hover { background: #1f6070; }
  table { border-collapse: collapse; margin-top: 1rem; }
  td, th { padding: .25rem .8rem .25rem 0; text-align: left; font-variant-numeric: tabular-nums; }
  small { color: #567; }
</style>
<h1>Fish Tank sounds</h1>
<p>Click a button or press 1, 2, 3 (4 plays all three). Set your system volume to where you would keep it while working.</p>
<div id="buttons"></div>
<p><label><input type="checkbox" id="rapid"> also play 4 quick pops after "all in a row" (like collecting several pellets)</label></p>
<table id="stats"><tr><th>sound</th><th>length</th><th>peak</th><th>RMS</th><th>biggest step</th></tr></table>
<p><small>"Biggest step" is the largest change between two neighbouring samples; a click makes it large (over 0.1).
The peak is shown before your system volume.</small></p>
<script type="module">
  import { SoundPlayer } from './SoundPlayer.js';
  import { SOUND_NAMES, defineSounds } from './sounds.js';
  const live = new SoundPlayer();
  defineSounds(live.forScene());
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const buttons = document.getElementById('buttons');
  const play = (name) => live.play(name);
  SOUND_NAMES.forEach((name, i) => {
    const b = document.createElement('button');
    b.textContent = (i + 1) + '  ' + name;
    b.onclick = () => play(name);
    buttons.append(b);
  });
  const all = document.createElement('button');
  all.textContent = '4  all in a row';
  all.onclick = async () => {
    for (const name of SOUND_NAMES) { play(name); await wait(1800); }
    if (document.getElementById('rapid').checked) for (let i = 0; i < 4; i++) { play('pop'); await wait(130); }
  };
  buttons.append(all);
  addEventListener('keydown', (e) => {
    const i = Number(e.key) - 1;
    if (SOUND_NAMES[i]) play(SOUND_NAMES[i]);
    else if (e.key === '4') all.onclick();
  });

  // Offline analysis of each sound, rendered by the same code into a buffer.
  const rate = 48000;
  const db = (x) => (x > 0 ? (20 * Math.log10(x)).toFixed(1) + ' dBFS' : '-inf');
  for (const name of SOUND_NAMES) {
    const offline = new OfflineAudioContext(2, rate * 3, rate);
    const offlinePlayer = new SoundPlayer({ createContext: () => offline });
    defineSounds(offlinePlayer.forScene());
    offlinePlayer.play(name);
    const rendered = await offline.startRendering();
    const data = rendered.getChannelData(0);
    let peak = 0, sum = 0, step = 0, last = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
      step = Math.max(step, Math.abs(v - (i ? data[i - 1] : 0)));
      if (Math.abs(v) > 0.0005) last = i;
    }
    const row = document.createElement('tr');
    row.innerHTML = '<td>' + name + '</td><td>' + (last / rate).toFixed(2) + ' s</td><td>' + db(peak) + '</td><td>' + db(Math.sqrt(sum / data.length)) + '</td><td>' + step.toFixed(3) + '</td>';
    document.getElementById('stats').append(row);
  }
  window.labDone = true;
</script>
`;

const server = createServer(async (request, response) => {
  if (request.url === '/' || request.url === '/index.html') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page);
  } else if (request.url === '/SoundPlayer.js') {
    response.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(await readFile(player));
  } else if (request.url === '/sounds.js') {
    response.writeHead(200, {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(await readFile(tankSounds));
  } else response.writeHead(404).end();
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/`;
  console.log(`Sound lab: ${url}  (Ctrl+C to stop)`);
  if (process.argv.includes('--no-open')) return;
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '""', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  spawn(command, args, { stdio: 'ignore', detached: true })
    .on('error', () => {})
    .unref();
});
