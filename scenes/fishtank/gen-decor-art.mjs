// Draws the scenery SVGs in scenes/fishtank/art/ (rocks, corals, weeds) from a seed, so they have real detail
// (stone relief, branching coral, tapered blades) without drawing every shape by hand.
// Run: node scenes/fishtank/gen-decor-art.mjs   Then: npm run assets
// The generated .svg files are committed; they are the source for the spritesheet like any other art.
import fs from 'node:fs';
import path from 'node:path';
import { makeRng } from '../../shared/rng.js';

const outDir = path.join(import.meta.dirname, 'art');
const f = (n) => Math.round(n * 100) / 100;
const pt = (p) => `${f(p[0])} ${f(p[1])}`;

// ---------- path helpers ----------

/** Closed smooth path (Catmull-Rom converted to cubic curves). */
function smoothClosed(points) {
  const n = points.length;
  let d = `M${pt(points[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return d + 'Z';
}

function polygon(points) {
  return `M${points.map(pt).join('L')}Z`;
}

function polyline(points) {
  return `M${points.map(pt).join('L')}`;
}

function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

const svgOpen = (w, h, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n  <title>${title}</title>\n`;

// ---------- rocks ----------

const ROCK = { light: '#9aa7b8', mid: '#6f7e93', dark: '#4b5a70' };

function rockSilhouette(rng, cx, baseY, rw, rh) {
  const points = [];
  const steps = 11;
  for (let k = 0; k <= steps; k++) {
    const angle = Math.PI + (k / steps) * Math.PI;
    const jitter = 1 + rng.range(-0.09, 0.09);
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const x = cx + Math.sign(c) * Math.pow(Math.abs(c), 0.82) * rw * jitter;
    const y = baseY - Math.pow(Math.abs(s), 0.75) * rh * jitter;
    points.push([x, y]);
  }
  // The underside, slightly curved so the rock looks like it sits in the sand.
  points.push([cx + rw * 0.55, baseY + 0.5], [cx, baseY + 1.2], [cx - rw * 0.55, baseY + 0.5]);
  return points;
}

function bounds(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function rockBody(rng, id, points, { moss = true, barnacles = 6, cracks = 2 } = {}) {
  const d = smoothClosed(points);
  const b = bounds(points);
  const w = b.x1 - b.x0;
  const h = b.y1 - b.y0;
  const rx = (u) => b.x0 + u * w;
  const ry = (v) => b.y0 + v * h;
  const defs = `
    <linearGradient id="g${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(b.y0)}" x2="0" y2="${f(b.y1)}">
      <stop offset="0" stop-color="${ROCK.light}"/>
      <stop offset="0.5" stop-color="${ROCK.mid}"/>
      <stop offset="1" stop-color="${ROCK.dark}"/>
    </linearGradient>
    <linearGradient id="s${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(ry(0.55))}" x2="0" y2="${f(b.y1)}">
      <stop offset="0" stop-color="#1f2b3d" stop-opacity="0"/>
      <stop offset="1" stop-color="#1f2b3d" stop-opacity="0.5"/>
    </linearGradient>
    <clipPath id="c${id}"><path d="${d}"/></clipPath>`;

  const parts = [];
  // Base colour with stone relief (see the shared filters).
  parts.push(`<path d="${d}" fill="url(#g${id})" filter="url(#relief)"/>`);

  // Flat facets: lit planes on the upper left, shaded planes on the lower right.
  for (let i = 0; i < 3; i++) {
    const ox = rng.range(0.1, 0.5);
    const oy = rng.range(0.08, 0.4);
    const poly = [
      [rx(ox), ry(oy + rng.range(0.1, 0.2))],
      [rx(ox + rng.range(0.1, 0.25)), ry(oy)],
      [rx(ox + rng.range(0.3, 0.45)), ry(oy + rng.range(0.05, 0.15))],
      [rx(ox + rng.range(0.25, 0.4)), ry(oy + rng.range(0.25, 0.4))],
    ];
    parts.push(
      `<path d="${polygon(poly)}" fill="#ffffff" fill-opacity="${f(rng.range(0.07, 0.14))}"/>`,
    );
  }
  for (let i = 0; i < 3; i++) {
    const ox = rng.range(0.45, 0.8);
    const oy = rng.range(0.35, 0.7);
    const poly = [
      [rx(ox), ry(oy)],
      [rx(ox + rng.range(0.1, 0.2)), ry(oy - rng.range(0.05, 0.12))],
      [rx(ox + rng.range(0.2, 0.3)), ry(oy + rng.range(0.1, 0.2))],
      [rx(ox + rng.range(0.05, 0.15)), ry(oy + rng.range(0.2, 0.3))],
    ];
    parts.push(
      `<path d="${polygon(poly)}" fill="#1f2b3d" fill-opacity="${f(rng.range(0.1, 0.2))}"/>`,
    );
  }

  // Cracks: a dark line with a pale line under it, so they read as cuts into the stone.
  for (let i = 0; i < cracks; i++) {
    let x = rx(rng.range(0.25, 0.75));
    let y = ry(rng.range(0.2, 0.4));
    const line = [[x, y]];
    const steps = rng.int(4, 6);
    for (let s = 0; s < steps; s++) {
      x += rng.range(-0.06, 0.06) * w;
      y += rng.range(0.06, 0.12) * h;
      line.push([x, y]);
    }
    parts.push(
      `<path d="${polyline(line)}" fill="none" stroke="#c8d3e0" stroke-opacity="0.28" stroke-width="0.7" transform="translate(0.8 0.6)"/>`,
      `<path d="${polyline(line)}" fill="none" stroke="#243044" stroke-opacity="0.5" stroke-width="0.8" stroke-linejoin="round"/>`,
    );
  }

  // Fine speckle (grain), dark and light.
  parts.push(
    `<rect x="${f(b.x0)}" y="${f(b.y0)}" width="${f(w)}" height="${f(h)}" filter="url(#speckDark)" opacity="0.22"/>`,
    `<rect x="${f(b.x0)}" y="${f(b.y0)}" width="${f(w)}" height="${f(h)}" filter="url(#speckLight)" opacity="0.14"/>`,
  );

  // Soft light on the upper left and shade near the sand.
  parts.push(
    `<ellipse cx="${f(rx(0.38))}" cy="${f(ry(0.25))}" rx="${f(w * 0.26)}" ry="${f(h * 0.16)}" fill="#ffffff" fill-opacity="0.26" filter="url(#soften)" transform="rotate(-16 ${f(rx(0.38))} ${f(ry(0.25))})"/>`,
    `<rect x="${f(b.x0)}" y="${f(ry(0.5))}" width="${f(w)}" height="${f(h * 0.55)}" fill="url(#s${id})"/>`,
  );

  // Algae film low on the rock.
  if (moss) {
    for (let i = 0; i < 9; i++) {
      const mx = rx(rng.range(0.05, 0.95));
      const my = ry(rng.range(0.72, 1));
      parts.push(
        `<ellipse cx="${f(mx)}" cy="${f(my)}" rx="${f(rng.range(2, 6))}" ry="${f(rng.range(1, 2.4))}" fill="#46a97d" fill-opacity="${f(rng.range(0.25, 0.45))}"/>`,
      );
    }
  }

  // Barnacles: a pale dot over a small dark crescent.
  for (let i = 0; i < barnacles; i++) {
    const bx = rx(rng.range(0.15, 0.85));
    const by = ry(rng.range(0.3, 0.85));
    const r = rng.range(0.8, 1.6);
    parts.push(
      `<circle cx="${f(bx + 0.3)}" cy="${f(by + 0.45)}" r="${f(r)}" fill="#243044" fill-opacity="0.45"/>`,
      `<circle cx="${f(bx)}" cy="${f(by)}" r="${f(r)}" fill="#dfe6ee" fill-opacity="0.8"/>`,
    );
  }

  const tufts = [];
  if (moss) {
    // Little tufts of hair algae along the underside, outside the clip so they overlap the sand.
    for (let i = 0; i < 16; i++) {
      const tx = rx(rng.range(0.1, 0.9));
      const ty = b.y1 - rng.range(0.3, 1.6);
      const len = rng.range(2, 5);
      tufts.push(
        `<path d="M${f(tx)} ${f(ty)}q${f(rng.range(-1, 1))} ${f(-len / 2)} ${f(rng.range(-1.2, 1.2))} ${f(-len)}" fill="none" stroke="#5fbf8f" stroke-opacity="0.6" stroke-width="0.7" stroke-linecap="round"/>`,
      );
    }
  }

  return {
    defs,
    svg: `<g clip-path="url(#c${id})">\n${parts.join('\n')}\n</g>\n${tufts.join('\n')}`,
    shadowPath: d,
  };
}

const sharedFilters = (seed) => `
    <filter id="relief" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" seed="${seed}" result="n"/>
      <feDiffuseLighting in="n" surfaceScale="3.2" diffuseConstant="1" lighting-color="#ffffff" result="l">
        <feDistantLight azimuth="235" elevation="55"/>
      </feDiffuseLighting>
      <feComposite in="SourceGraphic" in2="l" operator="arithmetic" k1="1.3" k2="0" k3="0" k4="0" result="m"/>
      <feComposite in="m" in2="SourceAlpha" operator="in"/>
    </filter>
    <filter id="speckDark" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="2" seed="${seed + 3}"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.1  0 0 0 0 0.15  0 0 0 0 0.24  3.6 0 0 0 -2.05"/>
    </filter>
    <filter id="speckLight" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="2" seed="${seed + 9}"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.85  0 0 0 0 0.9  0 0 0 0 0.96  -3.6 0 0 0 1.55"/>
    </filter>
    <filter id="soften" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6"/></filter>
    <filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.4"/></filter>`;

function rockSvg({ name, w, h, seed, shapes, detail }) {
  const rng = makeRng(seed);
  const defs = [sharedFilters(seed)];
  const body = [];
  shapes.forEach((shape, i) => {
    const points = rockSilhouette(rng, shape.cx, shape.base, shape.rw, shape.rh);
    const part = rockBody(rng, i, points, detail);
    defs.push(part.defs);
    // A soft shadow of this stone on the one behind it.
    if (i > 0) {
      body.push(
        `<path d="${part.shadowPath}" fill="#101a2a" fill-opacity="0.35" filter="url(#blur)" transform="translate(-1.5 -0.5)" clip-path="url(#c0)"/>`,
      );
    }
    body.push(part.svg);
  });
  return `${svgOpen(w, h, `${name} (Rock family, generated by scripts/gen-decor-art.mjs)`)}  <defs>${defs.join('\n')}\n  </defs>\n${body.join('\n')}\n</svg>\n`;
}

// ---------- coral (branching) ----------

const CORAL = { light: '#ffb09f', mid: '#f27f73', dark: '#c75a58', tip: '#ffd2c4' };

function coralBranchSvg({ name, w, h, seed }) {
  const rng = makeRng(seed);
  const segs = [];
  const tips = [];
  function grow(x, y, angle, len, width, depth) {
    const bend = rng.range(-0.3, 0.3);
    const c = [x + Math.sin(angle) * len * 0.55, y - Math.cos(angle) * len * 0.55];
    const e = [x + Math.sin(angle + bend) * len, y - Math.cos(angle + bend) * len];
    const endWidth = width * 0.74;
    segs.push({ a: [x, y], c, e, w0: width, w1: endWidth });
    const exit = angle + bend;
    if (depth >= 3 || len < 10) {
      tips.push({ x: e[0], y: e[1], r: endWidth * 0.7, angle: exit });
      return;
    }
    const children = depth <= 1 && rng.next() < 0.4 ? 3 : 2;
    for (let i = 0; i < children; i++) {
      const spread = children === 3 ? (i - 1) * 0.55 : (i === 0 ? -1 : 1) * rng.range(0.3, 0.6);
      grow(
        e[0],
        e[1],
        exit + spread + rng.range(-0.12, 0.12),
        len * rng.range(0.7, 0.85),
        endWidth,
        depth + 1,
      );
    }
  }
  // Three stems from the base.
  grow(0, 0, -0.4, 32, 15, 1);
  grow(0, 0, 0.02, 40, 17, 1);
  grow(0, 0, 0.44, 30, 14, 1);

  // Fit all geometry into the canvas.
  const xs = [];
  const ys = [];
  for (const s of segs) {
    for (const p of [s.a, s.e]) {
      xs.push(p[0] - s.w0, p[0] + s.w0);
      ys.push(p[1] - s.w0, p[1] + s.w0);
    }
  }
  const margin = 3;
  const bx0 = Math.min(...xs);
  const bx1 = Math.max(...xs);
  const by0 = Math.min(...ys);
  const scale = Math.min((w - margin * 2) / (bx1 - bx0), (h - 2 - margin) / -by0);
  const xShift = margin + (w - margin * 2 - (bx1 - bx0) * scale) / 2 - bx0 * scale;
  const TT = (p) => [xShift + p[0] * scale, h - 2 + p[1] * scale];

  const SUB = 4;
  const layers = { shadow: [], base: [], light: [] };
  for (const s of segs) {
    const a = TT(s.a);
    const c = TT(s.c);
    const e = TT(s.e);
    for (let i = 0; i < SUB; i++) {
      const t0 = i / SUB;
      const t1 = (i + 1) / SUB;
      const q = (t) => {
        const u = 1 - t;
        return [
          u * u * a[0] + 2 * u * t * c[0] + t * t * e[0],
          u * u * a[1] + 2 * u * t * c[1] + t * t * e[1],
        ];
      };
      const p0 = q(t0);
      const p1 = q(t1);
      const width = (s.w0 + (s.w1 - s.w0) * ((t0 + t1) / 2)) * scale;
      const d = `M${pt(p0)}L${pt(p1)}`;
      layers.shadow.push(`<path d="${d}" stroke-width="${f(width + 1.8)}"/>`);
      layers.base.push(`<path d="${d}" stroke-width="${f(width)}"/>`);
      layers.light.push(
        `<path d="${d}" stroke-width="${f(width * 0.32)}" transform="translate(${f(-width * 0.17)} ${f(-width * 0.12)})"/>`,
      );
    }
  }

  const polyps = [];
  for (const tip of tips) {
    const p = TT([tip.x, tip.y]);
    const r = tip.r * scale * 0.95;
    polyps.push(
      `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(r + 0.8)}" fill="${CORAL.dark}" fill-opacity="0.55"/>`,
      `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(r)}" fill="url(#tip)"/>`,
      `<circle cx="${f(p[0])}" cy="${f(p[1] + r * 0.15)}" r="${f(r * 0.3)}" fill="${CORAL.dark}" fill-opacity="0.45"/>`,
      `<ellipse cx="${f(p[0] - r * 0.3)}" cy="${f(p[1] - r * 0.4)}" rx="${f(r * 0.35)}" ry="${f(r * 0.2)}" fill="#ffffff" fill-opacity="0.35"/>`,
    );
  }

  // Pores along the branches.
  const pores = [];
  for (const s of segs) {
    const a = TT(s.a);
    const e = TT(s.e);
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const t = rng.range(0.15, 0.9);
      const x = a[0] + (e[0] - a[0]) * t + rng.range(-1, 1) * s.w0 * scale * 0.25;
      const y = a[1] + (e[1] - a[1]) * t + rng.range(-1, 1) * s.w0 * scale * 0.25;
      pores.push(
        `<circle cx="${f(x)}" cy="${f(y)}" r="${f(rng.range(0.4, 0.8))}" fill="#8f3c47" fill-opacity="0.35"/>`,
      );
    }
  }

  return `${svgOpen(w, h, `${name} (Coral warm family, generated by scripts/gen-decor-art.mjs)`)}  <defs>
    <linearGradient id="coral" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${h}">
      <stop offset="0" stop-color="${CORAL.light}"/>
      <stop offset="0.5" stop-color="${CORAL.mid}"/>
      <stop offset="1" stop-color="${CORAL.dark}"/>
    </linearGradient>
    <radialGradient id="tip" cx="0.4" cy="0.35" r="0.75">
      <stop offset="0" stop-color="${CORAL.tip}"/>
      <stop offset="1" stop-color="${CORAL.light}"/>
    </radialGradient>
    <linearGradient id="fadeGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.9" stop-color="#fff"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <mask id="fade"><rect width="${w}" height="${h}" fill="url(#fadeGradient)"/></mask>
    <filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.45" numOctaves="3" seed="${seed}" result="n"/>
      <feDiffuseLighting in="n" surfaceScale="1.2" diffuseConstant="1" lighting-color="#ffffff" result="l">
        <feDistantLight azimuth="235" elevation="62"/>
      </feDiffuseLighting>
      <feComposite in="SourceGraphic" in2="l" operator="arithmetic" k1="1.2" k2="0" k3="0" k4="0" result="m"/>
      <feComposite in="m" in2="SourceAlpha" operator="in"/>
    </filter>
  </defs>
  <g mask="url(#fade)">
    <g filter="url(#grain)">
      <g fill="none" stroke="#a94a53" stroke-opacity="0.8" stroke-linecap="round">${layers.shadow.join('')}</g>
      <g fill="none" stroke="url(#coral)" stroke-linecap="round">${layers.base.join('')}</g>
      <g fill="none" stroke="#ffe0d6" stroke-opacity="0.55" stroke-linecap="round">${layers.light.join('')}</g>
      ${polyps.join('\n      ')}
    </g>
    ${pores.join('\n    ')}
  </g>
</svg>
`;
}

// ---------- sea fan (lacy) ----------

const FAN = { light: '#f6bfd0', mid: '#e293b0', dark: '#b96d8f' };

function coralFanSvg({ name, w, h, seed }) {
  const rng = makeRng(seed);
  const cx = w / 2;
  const base = h - 1;
  const stem = 12;
  const origin = [cx, base - stem];
  const reach = Math.min(h - stem - 6, w / 2 - 3) * 1.0;
  const spokes = 9;
  const spread = 1.05; // radians each side
  const lines = [];
  const cross = [];
  const rings = [0.3, 0.46, 0.62, 0.78, 0.92];
  const grid = []; // grid[spoke][ring] = point
  const tips = [];

  for (let i = 0; i < spokes; i++) {
    const t = i / (spokes - 1);
    const angle = (t - 0.5) * 2 * spread + rng.range(-0.04, 0.04);
    const len = reach * (0.8 + 0.2 * Math.cos((t - 0.5) * Math.PI)) * rng.range(0.94, 1.02);
    const wobble = rng.range(-0.05, 0.05);
    const row = [];
    for (const ring of rings) {
      const a = angle + wobble * Math.sin(ring * Math.PI * 2);
      row.push([origin[0] + Math.sin(a) * len * ring, origin[1] - Math.cos(a) * len * ring]);
    }
    grid.push(row);
    const full = [origin, ...row];
    lines.push(`<path d="${polyline(full)}" stroke-width="${f(2.3 - Math.abs(t - 0.5) * 0.8)}"/>`);
    // A short twig at each ring that turns the spoke into lace.
    for (let r = 1; r < rings.length - 1; r++) {
      if (rng.next() < 0.25) continue;
      const side = rng.next() < 0.5 ? -1 : 1;
      const p = row[r];
      const q = [p[0] + Math.sin(angle + side * 0.5) * 8, p[1] - Math.cos(angle + side * 0.5) * 8];
      lines.push(`<path d="${polyline([p, q])}" stroke-width="1.1"/>`);
    }
    tips.push(row[row.length - 1]);
  }
  for (let r = 0; r < rings.length; r++) {
    for (let i = 0; i < spokes - 1; i++) {
      // Skip some links so the net has holes of different sizes.
      if ((i + r * 3) % 4 === 0 && r > 0) continue;
      const a = grid[i][r];
      const b = grid[i + 1][r];
      const mid = [
        (a[0] + b[0]) / 2 + rng.range(-0.6, 0.6),
        (a[1] + b[1]) / 2 + rng.range(-1.2, 0.2),
      ];
      cross.push(`<path d="M${pt(a)}Q${pt(mid)} ${pt(b)}"/>`);
    }
  }

  const outline = [[origin[0], origin[1]], ...grid.map((row) => row[row.length - 1])];
  const membrane = polygon(outline);
  const dots = tips
    .map((p) => `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="1.5" fill="url(#fanTip)"/>`)
    .join('\n    ');

  return `${svgOpen(w, h, `${name} (Coral cool family, generated by scripts/gen-decor-art.mjs)`)}  <defs>
    <linearGradient id="fan" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${h}">
      <stop offset="0" stop-color="${FAN.light}"/>
      <stop offset="0.55" stop-color="${FAN.mid}"/>
      <stop offset="1" stop-color="${FAN.dark}"/>
    </linearGradient>
    <radialGradient id="fanTip" cx="0.4" cy="0.35" r="0.8">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="${FAN.light}"/>
    </radialGradient>
    <linearGradient id="fadeGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.9" stop-color="#fff"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <mask id="fade"><rect width="${w}" height="${h}" fill="url(#fadeGradient)"/></mask>
  </defs>
  <g mask="url(#fade)">
    <path d="${membrane}" fill="${FAN.mid}" fill-opacity="0.13"/>
    <g fill="none" stroke="${FAN.dark}" stroke-opacity="0.5" stroke-width="1.6" stroke-linecap="round" transform="translate(0.7 0.9)">${cross.join('')}</g>
    <g fill="none" stroke="url(#fan)" stroke-width="1" stroke-opacity="0.9" stroke-linecap="round">${cross.join('')}</g>
    <g fill="none" stroke="${FAN.dark}" stroke-opacity="0.5" stroke-linecap="round" stroke-linejoin="round" transform="translate(0.8 1)">${lines.join('')}</g>
    <g fill="none" stroke="url(#fan)" stroke-linecap="round" stroke-linejoin="round">${lines.join('')}</g>
    <path d="M${f(cx)} ${f(base)}L${f(origin[0])} ${f(origin[1])}" stroke="${FAN.dark}" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M${f(cx - 0.7)} ${f(base)}L${f(origin[0] - 0.7)} ${f(origin[1])}" stroke="url(#fan)" stroke-width="5" stroke-linecap="round" fill="none"/>
    ${dots}
  </g>
</svg>
`;
}

// ---------- weeds (tapered blades) ----------

const WEED_TONES = [
  { base: '#2b7a5e', mid: '#46a97d', tip: '#7fd1a0' },
  { base: '#2f7f55', mid: '#58b27a', tip: '#a4dc9a' },
  { base: '#27705f', mid: '#3d9a85', tip: '#74c8b4' },
];

function weedSvg({ name, w, h, seed, blades, heightRange, widthRange, sway }) {
  const rng = makeRng(seed);
  const defs = [];
  const out = [];
  const order = [];
  for (let i = 0; i < blades; i++) order.push(i);
  // Back blades first (narrower, darker), front blades last.
  const list = order.map((i) => ({
    bx: w * (0.2 + 0.6 * (blades === 1 ? 0.5 : i / (blades - 1))) + rng.range(-3, 3),
    height: h * rng.range(heightRange[0], heightRange[1]),
    width: rng.range(widthRange[0], widthRange[1]),
    lean: rng.range(-1, 1),
    tone: rng.pick(WEED_TONES),
    depth: rng.next(),
  }));
  list.sort((a, b) => b.depth - a.depth);

  list.forEach((blade, i) => {
    const base = [blade.bx, h];
    const lean = blade.lean * w * 0.2;
    const s1 = lean * 0.25 + rng.range(-5, 5);
    const s2 = lean * 0.7 + rng.range(-6, 6);
    const cl = (x) => Math.min(w - 5, Math.max(5, x));
    const p1 = [cl(base[0] + s1), h - blade.height * 0.33];
    const p2 = [cl(base[0] + s2), h - blade.height * 0.66];
    const p3 = [cl(base[0] + lean), h - blade.height];
    const left = [];
    const right = [];
    const centre = [];
    const N = 28;
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const c = bezier(base, p1, p2, p3, t);
      const e = bezier(base, p1, p2, p3, Math.min(1, t + 0.01));
      const d0 = bezier(base, p1, p2, p3, Math.max(0, t - 0.01));
      let nx = -(e[1] - d0[1]);
      let ny = e[0] - d0[0];
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      const half =
        (blade.width / 2) *
        (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.12) * 0.95 + 0.25)) *
        Math.pow(1 - t, 0.55);
      left.push([c[0] + nx * half, c[1] + ny * half]);
      right.push([c[0] - nx * half, c[1] - ny * half]);
      centre.push(c);
    }
    const outline = [...left, ...right.slice().reverse()];
    const id = `b${i}`;
    defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${f(h)}" x2="0" y2="${f(h - blade.height)}">
      <stop offset="0" stop-color="${blade.tone.base}"/>
      <stop offset="0.5" stop-color="${blade.tone.mid}"/>
      <stop offset="1" stop-color="${blade.tone.tip}"/>
    </linearGradient>`);
    // Shade the left half, light the right half, then a thin vein down the middle.
    const leftSide = polygon([...left, ...centre.slice().reverse()]);
    const rightSide = polygon([...right, ...centre.slice().reverse()]);
    const alpha = f(0.78 + 0.22 * (1 - blade.depth));
    out.push(`<g opacity="${alpha}">
    <path d="${polygon(outline)}" fill="url(#${id})"/>
    <path d="${leftSide}" fill="#12392f" fill-opacity="0.16"/>
    <path d="${rightSide}" fill="#ffffff" fill-opacity="0.08"/>
    <path d="${polyline(centre.slice(2, N - 3))}" fill="none" stroke="#d8f5dc" stroke-opacity="0.34" stroke-width="0.7" stroke-linecap="round"/>
    <path d="${polyline(centre.slice(2, N - 3))}" fill="none" stroke="#12392f" stroke-opacity="0.2" stroke-width="0.6" stroke-linecap="round" transform="translate(0.9 0)"/>
  </g>`);
  });

  return `${svgOpen(w, h, `${name} (Weed family, generated by scripts/gen-decor-art.mjs)`)}  <defs>
    ${defs.join('\n    ')}
    <linearGradient id="fadeGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.88" stop-color="#fff"/>
      <stop offset="1" stop-color="#000"/>
    </linearGradient>
    <mask id="fade"><rect width="${w}" height="${h}" fill="url(#fadeGradient)"/></mask>
  </defs>
  <g mask="url(#fade)">
  ${out.join('\n  ')}
  </g>${sway ? '' : ''}
</svg>
`;
}

// ---------- write everything ----------

const files = {
  'rock-large.svg': rockSvg({
    name: 'rock-large',
    w: 116,
    h: 78,
    seed: 11,
    shapes: [
      { cx: 52, base: 74, rw: 46, rh: 62 },
      { cx: 13, base: 75, rw: 13, rh: 20 },
      { cx: 94, base: 75, rw: 21, rh: 31 },
    ],
    detail: { moss: true, barnacles: 7, cracks: 2 },
  }),
  'rock-small.svg': rockSvg({
    name: 'rock-small',
    w: 62,
    h: 40,
    seed: 23,
    shapes: [
      { cx: 24, base: 37, rw: 21, rh: 29 },
      { cx: 46, base: 38, rw: 13, rh: 17 },
    ],
    detail: { moss: true, barnacles: 3, cracks: 1 },
  }),
  'coral-branch.svg': coralBranchSvg({ name: 'coral-branch', w: 84, h: 112, seed: 5 }),
  'coral-fan.svg': coralFanSvg({ name: 'coral-fan', w: 84, h: 96, seed: 8 }),
  'weed-tall.svg': weedSvg({
    name: 'weed-tall',
    w: 60,
    h: 140,
    seed: 4,
    blades: 6,
    heightRange: [0.6, 1],
    widthRange: [7, 11],
  }),
  'weed-short.svg': weedSvg({
    name: 'weed-short',
    w: 48,
    h: 70,
    seed: 9,
    blades: 9,
    heightRange: [0.5, 1],
    widthRange: [3.4, 5.4],
  }),
};

for (const [file, content] of Object.entries(files)) {
  fs.writeFileSync(path.join(outDir, file), content);
  console.log(`wrote scenes/fishtank/art/${file} (${content.length} bytes)`);
}
