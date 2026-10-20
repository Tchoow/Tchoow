#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  Bento README generator — Tchoow
//  Builds every tile of the profile README as an animated SVG.
//  Static tiles are pure design; dynamic tiles read the GitHub
//  GraphQL API (token in GH_TOKEN). Without a token → mock data.
//
//  node scripts/build.mjs           (uses GH_TOKEN if present)
//  node scripts/build.mjs --mock    (force fake data, for design)
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets");
const LOGIN = process.env.GH_LOGIN || "Tchoow";
const TOKEN = process.env.GH_TOKEN || "";
const MOCK = process.argv.includes("--mock") || !TOKEN;

// ── Design tokens ────────────────────────────────────────────
const C = {
  card0: "#111614",
  card1: "#090C0B",
  line: "#1E2624",
  lineHi: "#2A3532",
  text: "#ECF2EE",
  muted: "#8A9792",
  dim: "#56625E",
  accent: "#3EE07F",
  accentSoft: "#A6F4C5",
  rec: "#FF5A5A",
  code: { key: "#A6F4C5", str: "#F3D58A", kw: "#C79BFF", num: "#7FC8FF", punc: "#8A9792" },
};
const HEAT = ["#141A18", "#0F3D25", "#16683C", "#24A65A", "#3EE07F"];
const LANG_RAMP = ["#3EE07F", "#A6F4C5", "#1FA35A", "#73E9A5", "#146B3E", "#3A4A44"];

const SG = `'Space Grotesk','SG',ui-sans-serif,system-ui,sans-serif`;
const MONO = `'JetBrains Mono','JBM',ui-monospace,SFMono-Regular,Menlo,monospace`;

// ── Fonts (subset woff2, embedded so SVG <img> renders identically everywhere)
const font = (family, file, weight) => {
  const b64 = readFileSync(join(ROOT, "assets/fonts", file)).toString("base64");
  return `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
};
const FONTS = {
  sg500: font("Space Grotesk", "space-grotesk-500.woff2", 500),
  sg700: font("Space Grotesk", "space-grotesk-700.woff2", 700),
  m400: font("JetBrains Mono", "jetbrains-mono-400.woff2", 400),
  m600: font("JetBrains Mono", "jetbrains-mono-600.woff2", 600),
};

// ── Brand assets (white-on-transparent PNGs, used as masks so they can take any fill)
const FLOWCODE_LOGO = {
  href: `data:image/png;base64,${readFileSync(join(ROOT, "assets/brand/flowcode-wordmark.png")).toString("base64")}`,
  ratio: 574 / 78,
};

// ── Helpers ──────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => Number(n).toLocaleString("en-US");
const monoW = (text, size) => text.length * size * 0.6; // JetBrains Mono advance = 600/1000 em
let uid = 0;

const BASE_CSS = `
  .sg{font-family:${SG}}
  .mono{font-family:${MONO}}
  .lbl{font-family:${MONO};font-size:15px;font-weight:600;letter-spacing:.06em;fill:${C.muted}}
  .fade{animation:fade .7s cubic-bezier(.2,.7,.2,1) both}
  .up{animation:up .8s cubic-bezier(.2,.7,.2,1) both}
  @keyframes fade{from{opacity:0}}
  @keyframes up{from{opacity:0;transform:translateY(10px)}}
  @keyframes blink{50%{opacity:0}}
  @keyframes pulse{0%{opacity:.7;transform:scale(1)}100%{opacity:0;transform:scale(2.6)}}
  @media (prefers-reduced-motion:reduce){*{animation:none!important}}
`;

/** Wraps content in a tile: transparent gutter + rounded card with gradient, border and glow. */
function tile({ w, h, fonts = [], css = "", body, glow = "tr", defs = "", title }) {
  const id = `t${++uid}`;
  const gx = 8, gy = 4; // gutters baked into every tile (horizontal / vertical)
  const cw = w - gx * 2, ch = h - gy * 2;
  const glowPos = { tr: [cw * 0.95, 0], tl: [cw * 0.05, 0], br: [cw, ch], bl: [0, ch], c: [cw / 2, ch / 2] }[glow] || [cw, 0];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>${fonts.map((f) => FONTS[f]).join("")}${BASE_CSS}${css}</style>
<defs>
  <linearGradient id="${id}bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.card0}"/><stop offset="1" stop-color="${C.card1}"/>
  </linearGradient>
  <radialGradient id="${id}glow" cx="${glowPos[0]}" cy="${glowPos[1]}" r="${Math.max(cw, ch) * 0.7}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${C.accent}" stop-opacity=".13"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="${id}edge" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff" stop-opacity=".09"/><stop offset=".35" stop-color="#ffffff" stop-opacity="0"/>
  </linearGradient>
  <clipPath id="${id}clip"><rect width="${cw}" height="${ch}" rx="22"/></clipPath>
  ${defs}
</defs>
<g transform="translate(${gx} ${gy})">
  <rect width="${cw}" height="${ch}" rx="22" fill="url(#${id}bg)"/>
  <rect width="${cw}" height="${ch}" rx="22" fill="url(#${id}glow)"/>
  <g clip-path="url(#${id}clip)">${body({ cw, ch, id })}</g>
  <rect x=".5" y=".5" width="${cw - 1}" height="${ch - 1}" rx="21.5" stroke="${C.line}"/>
  <rect x=".5" y=".5" width="${cw - 1}" height="${ch - 1}" rx="21.5" stroke="url(#${id}edge)"/>
</g>
</svg>`;
}

const label = (x, y, text, delay = 0) =>
  `<g class="fade" style="animation-delay:${delay}s"><circle cx="${x + 4}" cy="${y - 5}" r="4" fill="${C.accent}"/><text x="${x + 18}" y="${y}" class="lbl">${esc(text.toUpperCase())}</text></g>`;

const arrow = (x, y, size = 18, color = C.muted) =>
  `<path d="M${x} ${y + size}L${x + size} ${y}M${x + size * 0.3} ${y}H${x + size}V${y + size * 0.7}" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;

// ═════════════════════════════════════════════════════════════
//  STATIC TILES
// ═════════════════════════════════════════════════════════════

function hero() {
  const w = 1200, h = 340;
  const code = [
    [["kw", "const "], ["", "theo"], ["punc", " = {"]],
    [["key", "  role"], ["punc", ": "], ["str", '"fullstack dev"'], ["punc", ","]],
    [["key", "  based"], ["punc", ": "], ["str", '"Normandy, FR"'], ["punc", ","]],
    [["key", "  studio"], ["punc", ": "], ["str", '"flowcode.fr"'], ["punc", ","]],
    [["key", "  loves"], ["punc", ": ["], ["str", '"FPV"'], ["punc", ", "], ["str", '"self-host"'], ["punc", ", "], ["str", '"AI"'], ["punc", "],"]],
    [["key", "  coffee"], ["punc", ": "], ["num", "Infinity"], ["punc", ","]],
    [["punc", "};"]],
  ];
  const fs = 16, lh = 26, cx0 = 56, wx = 704, wy = 40, ww = 440, wh = 264;
  const codeLines = code
    .map((tokens, i) => {
      const spans = tokens.map(([k, t]) => `<tspan fill="${k ? C.code[k] : C.text}">${esc(t)}</tspan>`).join("");
      return `<g class="ln" style="animation-delay:${0.5 + i * 0.16}s">
        <text x="${wx + 22}" y="${wy + 82 + i * lh}" class="mono" font-size="14" fill="${C.dim}">${i + 1}</text>
        <text x="${wx + cx0}" y="${wy + 82 + i * lh}" class="mono" font-size="${fs}" xml:space="preserve">${spans}</text></g>`;
    })
    .join("");
  const lastLen = 2;
  const pills = [
    { t: "Normandy, FR" },
    { t: "FPV pilot" },
  ];
  let px = 56;
  const pillSvg = pills
    .map((p, i) => {
      const tw = monoW(p.t, 15);
      const pw = tw + (p.dot ? 50 : 32);
      const g = `<g class="up" style="animation-delay:${0.55 + i * 0.1}s">
        <rect x="${px}" y="262" width="${pw}" height="38" rx="19" fill="${p.dot ? "#0F2A1C" : "#141A18"}" stroke="${p.dot ? "#1F5A38" : C.line}"/>
        ${p.dot ? `<circle cx="${px + 22}" cy="281" r="5" fill="${C.accent}"/><circle cx="${px + 22}" cy="281" r="5" fill="${C.accent}" class="ping"/>` : ""}
        <text x="${px + (p.dot ? 36 : 16)}" y="286" class="mono" font-size="15" fill="${p.dot ? C.accentSoft : C.muted}">${esc(p.t)}</text></g>`;
      px += pw + 10;
      return g;
    })
    .join("");

  return tile({
    w, h, title: "Théo Lavie — fullstack developer", fonts: ["sg700", "sg500", "m400", "m600"], glow: "tl",
    defs: `
      <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" fill="#ffffff" fill-opacity=".07"/></pattern>
      <radialGradient id="dotfade" cx=".72" cy=".5" r=".55"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <mask id="dotmask"><rect width="1200" height="340" fill="url(#dotfade)"/></mask>
      <linearGradient id="name" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.text}"/><stop offset=".55" stop-color="${C.text}"/><stop offset="1" stop-color="${C.accentSoft}"/></linearGradient>
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="50"/></filter>`,
    css: `
      .ln{animation:type .5s steps(8,end) both}
      @keyframes type{from{opacity:0;transform:translateX(-6px)}}
      .cur{animation:blink 1.05s steps(1) infinite}
      .ping{transform-box:fill-box;transform-origin:center;animation:pulse 1.8s ease-out infinite}
      .orb{animation:drift 14s ease-in-out infinite alternate}
      .orb2{animation:drift2 18s ease-in-out infinite alternate}
      @keyframes drift{to{transform:translate(-160px,40px)}}
      @keyframes drift2{to{transform:translate(120px,-30px)}}
      .win{animation:up 1s cubic-bezier(.2,.7,.2,1) .25s both}`,
    body: ({ cw, ch }) => `
      <rect width="${cw}" height="${ch}" fill="url(#dots)" mask="url(#dotmask)"/>
      <circle class="orb" cx="980" cy="60" r="130" fill="${C.accent}" fill-opacity=".16" filter="url(#blur)"/>
      <circle class="orb2" cx="760" cy="320" r="110" fill="#2BD9C8" fill-opacity=".08" filter="url(#blur)"/>

      ${label(48, 56, "hello, world")}
      <text x="46" y="150" class="sg up" font-size="86" font-weight="700" letter-spacing="-3" fill="url(#name)" style="animation-delay:.1s">Théo Lavie</text>
      <text x="48" y="194" class="sg up" font-size="25" font-weight="500" fill="${C.muted}" style="animation-delay:.25s">Fullstack developer &amp; IT engineer.</text>
      <g class="up" style="animation-delay:.4s">
        <text x="48" y="236" class="mono" font-size="19" fill="${C.accent}">&gt; No code, no fun.</text>
        <rect x="${48 + monoW("> No code, no fun.", 19) + 4}" y="220" width="10" height="20" rx="1" fill="${C.accent}" class="cur"/>
      </g>
      <g transform="translate(-8 -4)">${pillSvg}</g>

      <g class="win">
        <rect x="${wx - 8}" y="${wy - 4}" width="${ww}" height="${wh}" rx="16" fill="#0B0F0E" stroke="${C.lineHi}"/>
        <path d="M${wx - 8} ${wy + 36}H${wx - 8 + ww}" stroke="${C.line}"/>
        <circle cx="${wx + 14}" cy="${wy + 16}" r="6" fill="#FF5F57" fill-opacity=".85"/>
        <circle cx="${wx + 34}" cy="${wy + 16}" r="6" fill="#FEBC2E" fill-opacity=".85"/>
        <circle cx="${wx + 54}" cy="${wy + 16}" r="6" fill="#28C840" fill-opacity=".85"/>
        <text x="${wx - 8 + ww / 2}" y="${wy + 21}" text-anchor="middle" class="mono" font-size="13" fill="${C.muted}">theo.ts</text>
        <text x="${wx + ww - 26}" y="${wy + 21}" text-anchor="end" class="mono" font-size="12" fill="${C.dim}">TS</text>
        <g transform="translate(-8 -4)">${codeLines}
          <rect x="${wx + cx0 + monoW("};", fs) + 3}" y="${wy + 82 + 6 * lh - 14}" width="9" height="18" rx="1" fill="${C.accent}" class="cur" style="animation-delay:1.6s"/>
        </g>
      </g>`,
  });
}

function stack() {
  const w = 800, h = 360;
  const groups = [
    { name: "languages", items: ["TypeScript", "JavaScript", "Java", "C#", "PHP", "Lua", "SQL"] },
    { name: "web & data", items: ["SvelteKit", "Astro", "Directus", "PrestaShop", "SCSS", "n8n"] },
    { name: "infra & tooling", items: ["Docker", "Dokploy", "Traefik", "Cloudflare", "Tailscale", "Claude Code"] },
  ];
  const fs = 14, chipH = 36, gap = 8, x0 = 32, maxX = 784 - 32;
  let y = 92, k = 0;
  const parts = [];
  groups.forEach((g, gi) => {
    parts.push(`<text x="${x0}" y="${y}" class="mono fade" font-size="13" fill="${C.dim}" letter-spacing=".08em" style="animation-delay:${0.1 + gi * 0.12}s">${String(gi + 1).padStart(2, "0")} — ${esc(g.name.toUpperCase())}</text>`);
    let x = x0, cy = y + 14;
    g.items.forEach((t) => {
      const cwid = monoW(t, fs) + 40;
      if (x + cwid > maxX) { x = x0; cy += chipH + gap; }
      const hot = gi === 0 && k < 2 || t === "SvelteKit" || t === "Claude Code";
      parts.push(`<g class="up" style="animation-delay:${0.2 + k * 0.035}s">
        <rect x="${x}" y="${cy}" width="${cwid}" height="${chipH}" rx="11" fill="${hot ? "#0F2A1C" : "#121816"}" stroke="${hot ? "#1F5A38" : C.line}"/>
        <rect x="${x + 14}" y="${cy + chipH / 2 - 4}" width="8" height="8" rx="2" fill="${hot ? C.accent : C.dim}"/>
        <text x="${x + 28}" y="${cy + chipH / 2 + 5}" class="mono" font-size="${fs}" fill="${hot ? C.text : "#C5CFCA"}">${esc(t)}</text></g>`);
      x += cwid + gap; k++;
    });
    y = cy + chipH + 34;
  });
  return tile({
    w, h, title: "Tech stack", fonts: ["m400", "m600"], glow: "br",
    body: () => `${label(32, 50, "stack")}
      <text x="752" y="50" text-anchor="end" class="mono fade" font-size="13" fill="${C.dim}">daily drivers</text>
      <g transform="translate(-8 -4)">${parts.join("")}</g>`,
  });
}

function fpv() {
  const w = 400, h = 360;
  const sx = 24, sy = 70, sw = 336, sh = 258, cx = sx + sw / 2, cy = sy + sh / 2;
  const bracket = (x, y, dx, dy) => `<path d="M${x} ${y + dy * 18}V${y}H${x + dx * 18}" stroke="${C.accent}" stroke-width="2" stroke-linecap="round" opacity=".9"/>`;
  const ladder = [-2, -1, 1, 2]
    .map((i) => {
      const y = cy + i * 38, half = 30;
      return `<path d="M${cx - 70} ${y}h${half}M${cx + 40} ${y}h${half}" stroke="#ffffff" stroke-opacity=".45" stroke-width="1.5" ${i > 0 ? 'stroke-dasharray="5 4"' : ""}/>
      <text x="${cx - 76}" y="${y + 4}" text-anchor="end" class="mono" font-size="10" fill="#ffffff" fill-opacity=".45">${-i * 10}</text>`;
    })
    .join("");
  const osd = (x, y, t, anchor = "start", fill = C.text, size = 13) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" class="mono" font-size="${size}" font-weight="600" fill="${fill}">${t}</text>`;
  return tile({
    w, h, title: "FPV drone pilot", fonts: ["m400", "m600"], glow: "bl",
    defs: `
      <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#ffffff" fill-opacity=".035"/></pattern>
      <radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0E2A20"/><stop offset=".5" stop-color="#0B1814"/><stop offset=".5" stop-color="#0A0F0D"/><stop offset="1" stop-color="#070A09"/></linearGradient>
      <clipPath id="screen"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="14"/></clipPath>`,
    css: `
      .horizon{transform-origin:${cx}px ${cy}px;animation:roll 6s ease-in-out infinite}
      @keyframes roll{0%,100%{transform:rotate(-5deg) translateY(4px)}30%{transform:rotate(7deg) translateY(-10px)}65%{transform:rotate(-2deg) translateY(12px)}}
      .rec{animation:blink 1.2s steps(1) infinite}
      .flick{animation:flick 4s steps(1) infinite}
      @keyframes flick{0%,96%{opacity:1}97%{opacity:.4}98%{opacity:1}99%{opacity:.6}}
      .alt{animation:tick 3s steps(1) infinite}`,
    body: () => `
      ${label(24, 46, "fpv · live")}
      <g class="rec"><circle cx="${sx + sw - 50}" cy="41" r="5" fill="${C.rec}"/>${osd(sx + sw - 38, 46, "REC", "start", C.rec, 13)}</g>
      <g transform="translate(-8 -4)" class="flick">
        <g clip-path="url(#screen)">
          <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="#070A09"/>
          <g class="horizon">
            <rect x="${sx - 200}" y="${sy - 200}" width="${sw + 400}" height="${sh / 2 + 200}" fill="#0F2A20"/>
            <rect x="${sx - 200}" y="${cy}" width="${sw + 400}" height="${sh / 2 + 200}" fill="#080B0A"/>
            <path d="M${sx - 200} ${cy}H${cx - 44}M${cx + 44} ${cy}H${sx + sw + 200}" stroke="${C.accent}" stroke-width="2.5"/>
            ${ladder}
          </g>
          <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="url(#scan)"/>
          <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" fill="url(#vig)"/>
        </g>
        <rect x="${sx + .5}" y="${sy + .5}" width="${sw - 1}" height="${sh - 1}" rx="13.5" stroke="${C.lineHi}"/>
        ${bracket(sx + 14, sy + 14, 1, 1)}${bracket(sx + sw - 14, sy + 14, -1, 1)}${bracket(sx + 14, sy + sh - 14, 1, -1)}${bracket(sx + sw - 14, sy + sh - 14, -1, -1)}
        <!-- crosshair -->
        <path d="M${cx - 16} ${cy}h10M${cx + 6} ${cy}h10M${cx} ${cy - 16}v10M${cx} ${cy + 6}v10" stroke="${C.text}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="2.5" fill="${C.text}"/>
        <!-- OSD -->
        ${osd(sx + 38, sy + 38, "ACRO", "start", C.accent)}
        ${osd(cx, sy + 38, "00:42", "middle")}
        <g><rect x="${sx + sw - 120}" y="${sy + 27}" width="30" height="14" rx="3" stroke="${C.text}" stroke-width="1.5"/><rect x="${sx + sw - 90}" y="${sy + 31}" width="3" height="6" rx="1" fill="${C.text}"/><rect x="${sx + sw - 117}" y="${sy + 30}" width="18" height="8" rx="1.5" fill="${C.accent}"/>${osd(sx + sw - 38, sy + 39, "16.4V", "end")}</g>
        ${osd(sx + 38, cy - 24, "87", "start")}${osd(sx + 38, cy - 10, "km/h", "start", C.muted, 10)}
        ${osd(sx + sw - 38, cy - 24, "42m", "end")}${osd(sx + sw - 38, cy - 10, "ALT", "end", C.muted, 10)}
        ${osd(sx + 38, sy + sh - 30, "RSSI 99", "start")}
        ${osd(cx, sy + sh - 30, '5" · 6S', "middle", C.muted)}
        ${osd(sx + sw - 38, sy + sh - 30, "LQ 100", "end")}
      </g>`,
  });
}

function linkTile({ name, handle, glyph, file, title }) {
  const w = 240, h = 150;
  return [file, tile({
    w, h, title, fonts: ["sg700", "m400", "m600"], glow: "tr",
    css: `.arr{animation:nudge 2.6s ease-in-out infinite}@keyframes nudge{50%{transform:translate(3px,-3px)}}`,
    body: () => `
      <g class="up">
        <rect x="20" y="20" width="44" height="44" rx="12" fill="#0F2A1C" stroke="#1F5A38"/>
        <text x="42" y="${48}" text-anchor="middle" class="mono" font-size="${glyph.length > 2 ? 14 : 18}" font-weight="600" fill="${C.accent}">${esc(glyph)}</text>
      </g>
      <g class="arr">${arrow(186, 26, 16)}</g>
      <text x="20" y="106" class="sg up" font-size="22" font-weight="700" fill="${C.text}" style="animation-delay:.08s">${esc(name)}</text>
      <text x="20" y="128" class="mono up" font-size="13" fill="${C.muted}" style="animation-delay:.14s">${esc(handle)}</text>`,
  })];
}

function flowcode() {
  const w = 1200, h = 200, wx0 = w - 520; // waves fill the right side
  const lh = 40, lw = lh * FLOWCODE_LOGO.ratio, lx = 28, ly = 68; // wordmark box
  const waves = [0, 1, 2, 3, 4]
    .map((i) => {
      const y = 40 + i * 24, a = 14 + i * 3;
      let d = `M${wx0} ${y}`;
      for (let x = wx0; x <= w + 20; x += 40) d += ` Q${x + 20} ${y + (((x / 40) | 0) % 2 ? a : -a)} ${x + 40} ${y}`;
      return `<path d="${d}" stroke="${i === 2 ? C.accent : C.lineHi}" stroke-width="${i === 2 ? 2.5 : 1.5}" stroke-linecap="round" class="wave" style="animation-delay:${-i * 0.6}s" opacity="${i === 2 ? 1 : 0.9}"/>`;
    })
    .join("");
  return tile({
    w, h, title: "Flowcode — freelance studio", fonts: ["sg500", "m400", "m600"], glow: "tr",
    defs: `
      <mask id="fclogo" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><image href="${FLOWCODE_LOGO.href}" x="${lx}" y="${ly}" width="${lw}" height="${lh}"/></mask>
      <linearGradient id="fcfill" x1="${lx}" x2="${lx + lw}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.text}"/><stop offset=".55" stop-color="${C.text}"/><stop offset="1" stop-color="${C.accentSoft}"/></linearGradient>
      <linearGradient id="fcshine" x1="0" x2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity="0"/><stop offset=".5" stop-color="${C.accent}"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient>
      <filter id="fcglow" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>
      <linearGradient id="wfade" x1="${wx0}" x2="${w}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".8" stop-color="#fff"/></linearGradient><mask id="wm"><rect width="${w}" height="${h}" fill="url(#wfade)"/></mask>`,
    css: `.wave{stroke-dasharray:14 10;animation:flow 2.4s linear infinite}@keyframes flow{to{stroke-dashoffset:-48}}
      .shine{animation:shine 5s cubic-bezier(.5,0,.3,1) 1.2s infinite both}@keyframes shine{0%{transform:translateX(0)}35%,100%{transform:translateX(${lw + 220}px)}}
      .halo{animation:halo 5s ease-in-out infinite alternate}@keyframes halo{from{opacity:.22}to{opacity:.42}}`,
    body: () => `
      <g mask="url(#wm)">${waves}</g>
      ${label(28, 46, "freelance studio")}
      <g class="up" style="animation-delay:.08s">
        <g filter="url(#fcglow)" opacity=".3" class="halo"><rect width="${w}" height="${h}" fill="${C.accent}" mask="url(#fclogo)"/></g>
        <g mask="url(#fclogo)">
          <rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" fill="url(#fcfill)"/>
          <g class="shine"><rect x="${lx - 110}" y="${ly - 10}" width="70" height="${lh + 20}" fill="url(#fcshine)" transform="skewX(-18)"/></g>
        </g>
      </g>
      <text x="28" y="136" class="sg up" font-size="17" font-weight="500" fill="${C.muted}" style="animation-delay:.14s">Web apps, e-commerce &amp; automation.</text>
      <g class="up" style="animation-delay:.2s"><text x="28" y="170" class="mono" font-size="15" font-weight="600" fill="${C.accent}">flowcode.fr</text>${arrow(28 + monoW("flowcode.fr", 15) + 10, 158, 12, C.accent)}</g>`,
  });
}

// ═════════════════════════════════════════════════════════════
//  DATA
// ═════════════════════════════════════════════════════════════

async function fetchData() {
  const query = `query($login:String!){user(login:$login){
    avatarUrl(size:460) followers{totalCount}
    repositories(ownerAffiliations:OWNER,isFork:false,first:100,orderBy:{field:STARGAZERS,direction:DESC}){
      totalCount nodes{stargazerCount languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name}}}}}
    pullRequests{totalCount} issues{totalCount}
    contributionsCollection{totalCommitContributions totalPullRequestContributions restrictedContributionsCount
      contributionCalendar{totalContributions weeks{contributionDays{date contributionCount}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "bento-readme" },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors || json));
  const u = json.data.user;
  const langs = {};
  for (const r of u.repositories.nodes) for (const e of r.languages.edges) langs[e.node.name] = (langs[e.node.name] || 0) + e.size;
  const days = u.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })));
  return {
    avatarUrl: u.avatarUrl,
    stars: u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0),
    repos: u.repositories.totalCount,
    followers: u.followers.totalCount,
    prs: u.pullRequests.totalCount,
    issues: u.issues.totalCount,
    total: u.contributionsCollection.contributionCalendar.totalContributions,
    langs,
    days,
  };
}

function mockData() {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const days = [];
  const end = new Date(Date.UTC(2026, 9, 20));
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 364 - end.getUTCDay());
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay(), season = 0.55 + 0.45 * Math.sin(d.getTime() / 4.5e9);
    const p = (wd === 0 || wd === 6 ? 0.35 : 0.8) * season;
    days.push({ date: d.toISOString().slice(0, 10), count: rnd() < p ? Math.ceil(rnd() ** 2 * 14 * season) : 0 });
  }
  for (let i = 1; i <= 23; i++) days[days.length - i].count ||= 2 + (i % 4);
  return {
    stars: 22, repos: 41, followers: 37, prs: 18, issues: 9,
    total: days.reduce((a, d) => a + d.count, 0),
    langs: { Java: 2857, HTML: 1863, TypeScript: 1635, "C#": 1575, SCSS: 1319, JavaScript: 752, Lua: 300 },
    days,
  };
}

/** Downloads the avatar as a data URI — SVGs rendered via <img> can't load external URLs. */
async function loadAvatar(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const type = res.headers.get("content-type") || "image/jpeg";
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch (e) {
    console.warn("avatar skipped:", e.message);
    return "";
  }
}

function derive(data) {
  const days = data.days;
  const today = days.length - 1;
  let cur = 0, i = today;
  if (days[i]?.count === 0) i--; // today not counted yet
  for (; i >= 0 && days[i].count > 0; i--) cur++;
  let longest = 0, run = 0;
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; longest = Math.max(longest, run); }
  const best = days.reduce((m, d) => (d.count > m.count ? d : m), days[0]);
  const active = days.filter((d) => d.count > 0).length;
  const byWd = Array(7).fill(0);
  days.forEach((d) => (byWd[new Date(d.date + "T00:00:00Z").getUTCDay()] += d.count));
  const topWd = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][byWd.indexOf(Math.max(...byWd))];
  const weeks = [];
  for (let k = 0; k < days.length; k += 7) weeks.push(days.slice(k, k + 7).reduce((a, d) => a + d.count, 0));
  return { cur, longest, best, active, topWd, weeks };
}

// ═════════════════════════════════════════════════════════════
//  DYNAMIC TILES
// ═════════════════════════════════════════════════════════════

function statsTile(data, dv) {
  const w = 400, h = 270;
  const wk = dv.weeks.slice(-26), max = Math.max(1, ...wk);
  const sx0 = 222, sx1 = 352, sy0 = 76, sy1 = 132;
  const pts = wk.map((v, i) => [sx0 + (i / (wk.length - 1)) * (sx1 - sx0), sy1 - (v / max) * (sy1 - sy0)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  const mini = [["stars", data.stars], ["PRs", data.prs], ["issues", data.issues], ["repos", data.repos]];
  // shrink big numbers so they never run into the sparkline / their neighbour
  const totalFs = fmt(data.total).length > 5 ? 48 : 58;
  const miniFs = Math.max(...mini.map(([, v]) => fmt(v).length)) > 4 ? 23 : 28;
  return tile({
    w, h, title: `GitHub stats: ${data.total} contributions in the last year`, fonts: ["sg700", "m400", "m600"], glow: "tl",
    defs: `<linearGradient id="spark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity=".35"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient>`,
    css: `.draw{stroke-dasharray:600;animation:draw 1.6s cubic-bezier(.4,0,.2,1) .3s both}@keyframes draw{from{stroke-dashoffset:600}}`,
    body: () => `
      ${label(26, 46, "github · 12 mo")}
      <text x="24" y="122" class="sg up" font-size="${totalFs}" font-weight="700" letter-spacing="-2" fill="${C.text}" style="animation-delay:.08s">${fmt(data.total)}</text>
      <text x="26" y="148" class="mono up" font-size="14" fill="${C.muted}" style="animation-delay:.14s">contributions</text>
      <g transform="translate(-8 -4)">
        <path d="${line}L${sx1} ${sy1}L${sx0} ${sy1}Z" fill="url(#spark)" class="fade" style="animation-delay:.9s"/>
        <path d="${line}" stroke="${C.accent}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" class="draw"/>
        <circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="4" fill="${C.accent}" class="fade" style="animation-delay:1.7s"/>
        <text x="${sx1}" y="${sy1 + 20}" text-anchor="end" class="mono" font-size="11" fill="${C.dim}">last 26 weeks</text>
      </g>
      <path d="M24 178H360" stroke="${C.line}"/>
      ${mini.map(([k, v], i) => `<g class="up" style="animation-delay:${0.25 + i * 0.07}s">
        <text x="${24 + i * 86}" y="222" class="sg" font-size="${miniFs}" font-weight="700" fill="${C.text}">${fmt(v)}</text>
        <text x="${25 + i * 86}" y="244" class="mono" font-size="13" fill="${C.muted}">${k}</text></g>`).join("")}`,
  });
}

function langsTile(data) {
  const w = 400, h = 270;
  const entries = Object.entries(data.langs).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((a, [, v]) => a + v, 0) || 1;
  let top = entries.slice(0, 6);
  if (entries.length > 6) { top = entries.slice(0, 5); top.push(["Other", entries.slice(5).reduce((a, [, v]) => a + v, 0)]); }
  const bx = 24, bw = 336, by = 74;
  let acc = 0;
  const segs = top.map(([n, v], i) => {
    const sw = (v / total) * bw;
    const s = `<rect x="${(bx + acc).toFixed(1)}" y="${by}" width="${Math.max(0, sw - 3).toFixed(1)}" height="14" rx="4" fill="${LANG_RAMP[i]}" class="seg" style="animation-delay:${0.2 + i * 0.08}s"/>`;
    acc += sw;
    return s;
  }).join("");
  const rows = top.map(([n, v], i) => {
    const col = i % 2, row = (i / 2) | 0;
    const x = 24 + col * 172, y = 136 + row * 40;
    return `<g class="up" style="animation-delay:${0.35 + i * 0.06}s">
      <rect x="${x}" y="${y - 11}" width="12" height="12" rx="3.5" fill="${LANG_RAMP[i]}"/>
      <text x="${x + 22}" y="${y}" class="sg" font-size="16" font-weight="700" fill="${C.text}">${esc(n)}</text>
      <text x="${x + 156}" y="${y}" text-anchor="end" class="mono" font-size="13" fill="${C.muted}">${((v / total) * 100).toFixed(1)}%</text></g>`;
  }).join("");
  return tile({
    w, h, title: "Most used languages", fonts: ["sg700", "m400", "m600"], glow: "tr",
    css: `.seg{transform-box:fill-box;transform-origin:left;animation:grow .9s cubic-bezier(.2,.7,.2,1) both}@keyframes grow{from{transform:scaleX(0)}}`,
    body: () => `${label(26, 46, "languages")}
      <g transform="translate(-8 -4)"><rect x="${bx}" y="${by}" width="${bw}" height="14" rx="4" fill="#141A18"/>${segs}${rows}</g>`,
  });
}

function streakTile(data, dv) {
  const w = 400, h = 270;
  const cx = 104, cy = 150, r = 62, circ = 2 * Math.PI * r;
  const ratio = dv.longest ? Math.min(1, dv.cur / dv.longest) : 0;
  const bestDate = new Date(dv.best.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const facts = [["longest", `${dv.longest} days`], ["active days", `${dv.active}`], ["best day", `${dv.best.count} · ${bestDate}`]];
  return tile({
    w, h, title: `Current streak: ${dv.cur} day${dv.cur === 1 ? "" : "s"}`, fonts: ["sg700", "m400", "m600"], glow: "bl",
    css: `.arc{stroke-dasharray:${circ.toFixed(1)};animation:arc 1.4s cubic-bezier(.4,0,.2,1) .3s both}@keyframes arc{from{stroke-dashoffset:${circ.toFixed(1)}}}
      .spin{transform-origin:${cx}px ${cy}px;animation:spin 18s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`,
    body: () => `${label(26, 46, "streak")}
      <g transform="translate(-8 -4)">
        <circle cx="${cx}" cy="${cy}" r="${r + 14}" stroke="${C.line}" stroke-dasharray="2 6" class="spin"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" stroke="#16201C" stroke-width="10"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${C.accent}" stroke-width="10" stroke-linecap="round"
          stroke-dashoffset="${(circ * (1 - ratio)).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" class="arc"/>
        <text x="${cx}" y="${cy + 10}" text-anchor="middle" class="sg up" font-size="42" font-weight="700" fill="${C.text}">${dv.cur}</text>
        <text x="${cx}" y="${cy + 32}" text-anchor="middle" class="mono" font-size="12" fill="${C.muted}">day${dv.cur === 1 ? "" : "s"}</text>
        ${facts.map(([k, v], i) => `<g class="up" style="animation-delay:${0.3 + i * 0.08}s">
          <text x="212" y="${104 + i * 50}" class="mono" font-size="13" fill="${C.muted}">${esc(k)}</text>
          <text x="212" y="${127 + i * 50}" class="sg" font-size="20" font-weight="700" fill="${C.text}">${esc(v)}</text></g>`).join("")}
      </g>`,
  });
}

function activityTile(data, dv) {
  const w = 1200, h = 300;
  const days = data.days;
  const nz = days.map((d) => d.count).filter(Boolean).sort((a, b) => a - b);
  const q = (p) => nz[Math.floor(p * (nz.length - 1))] || 1;
  const t1 = q(0.25), t2 = q(0.5), t3 = q(0.8);
  const lvl = (c) => (c === 0 ? 0 : c <= t1 ? 1 : c <= t2 ? 2 : c <= t3 ? 3 : 4);
  const x0 = 82, y0 = 96, step = 20.4, size = 16;
  const firstWd = new Date(days[0].date + "T00:00:00Z").getUTCDay();
  const cells = [], months = [];
  let lastMonth = -1;
  days.forEach((d, i) => {
    const idx = i + firstWd, col = (idx / 7) | 0, row = idx % 7;
    const dt = new Date(d.date + "T00:00:00Z");
    if (row === 0 || i === 0) {
      const m = dt.getUTCMonth();
      if (m !== lastMonth && dt.getUTCDate() <= 7 && col < 52) { months.push(`<text x="${x0 + col * step}" y="${y0 - 12}" class="mono" font-size="12" fill="${C.dim}">${dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}</text>`); lastMonth = m; }
    }
    const l = lvl(d.count);
    cells.push(`<rect x="${(x0 + col * step).toFixed(1)}" y="${(y0 + row * step).toFixed(1)}" width="${size}" height="${size}" rx="4" fill="${HEAT[l]}"${l === 0 ? ` stroke="#1A2220"` : ""} class="c c${col}"><title>${d.date}: ${d.count}</title></rect>`);
  });
  const cols = Math.ceil((days.length + firstWd) / 7);
  const colCss = Array.from({ length: cols }, (_, c) => `.c${c}{animation-delay:${(c * 0.018).toFixed(3)}s}`).join("");
  const gridW = cols * step;
  const legendX = 1160 - 5 * step - 44;
  // avatar as a faint backdrop, fading in from the left and out at the edges
  const avatarDefs = data.avatar ? `
      <linearGradient id="avfadeX" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff"/></linearGradient>
      <linearGradient id="avfadeY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient>
      <mask id="avmask" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#avfadeX)"/><rect width="1" height="1" fill="url(#avfadeY)"/></mask>
      <filter id="avtone"><feColorMatrix type="saturate" values=".35"/></filter>` : "";
  const avatarImg = ({ cw, ch }) => data.avatar
    ? `<image href="${data.avatar}" width="${cw}" height="${ch}" preserveAspectRatio="xMidYMid slice" opacity=".16" mask="url(#avmask)" filter="url(#avtone)" class="fade"/>`
    : "";
  return tile({
    w, h, title: `${data.total} contributions in the last year`, fonts: ["sg700", "m400", "m600"], glow: "tr",
    defs: `${avatarDefs}<linearGradient id="sweep" x1="0" x2="1"><stop offset="0" stop-color="${C.accent}" stop-opacity="0"/><stop offset=".5" stop-color="${C.accent}" stop-opacity=".16"/><stop offset="1" stop-color="${C.accent}" stop-opacity="0"/></linearGradient>`,
    css: `.c{transform-box:fill-box;transform-origin:center;animation:pop .45s cubic-bezier(.2,.7,.2,1.3) both}
      @keyframes pop{from{opacity:0;transform:scale(.4)}}${colCss}
      .sw{animation:sweep 7s cubic-bezier(.5,0,.5,1) 1.4s infinite both}@keyframes sweep{0%{transform:translateX(0)}60%,100%{transform:translateX(${gridW + 480}px)}}`,
    body: (box) => `${avatarImg(box)}${label(26, 46, "contributions")}
      <text x="1160" y="46" text-anchor="end" class="mono fade" font-size="14" fill="${C.muted}"><tspan fill="${C.text}" font-weight="600">${fmt(data.total)}</tspan> in the last year · most active on <tspan fill="${C.accentSoft}">${dv.topWd}s</tspan></text>
      <g transform="translate(-8 -4)">
        ${months.join("")}
        ${["Mon", "Wed", "Fri"].map((t, i) => `<text x="${x0 - 12}" y="${y0 + (1 + i * 2) * step + 12}" text-anchor="end" class="mono" font-size="12" fill="${C.dim}">${t}</text>`).join("")}
        ${cells.join("")}
        <rect x="${x0 - 320}" y="${y0 - 4}" width="140" height="${7 * step + 4}" fill="url(#sweep)" class="sw" style="mix-blend-mode:screen"/>
        <text x="${x0}" y="${y0 + 7 * step + 30}" class="mono" font-size="12" fill="${C.dim}">synced daily via GitHub Actions</text>
        <text x="${legendX - 8}" y="${y0 + 7 * step + 30}" text-anchor="end" class="mono" font-size="12" fill="${C.dim}">less</text>
        ${HEAT.map((c, i) => `<rect x="${legendX + i * step}" y="${y0 + 7 * step + 17}" width="${size}" height="${size}" rx="4" fill="${c}"${i === 0 ? ` stroke="#1A2220"` : ""}/>`).join("")}
        <text x="${legendX + 5 * step + 4}" y="${y0 + 7 * step + 30}" class="mono" font-size="12" fill="${C.dim}">more</text>
      </g>`,
  });
}

function footer() {
  const w = 1200, h = 90;
  return tile({
    w, h, title: "No code, no fun.", fonts: ["sg700", "m400"], glow: "c",
    body: () => `
      <text x="28" y="53" class="sg" font-size="22" font-weight="700" fill="${C.text}">No code, <tspan fill="${C.accent}">no fun.</tspan></text>`,
  });
}

// ═════════════════════════════════════════════════════════════
//  BUILD
// ═════════════════════════════════════════════════════════════
let data;
if (MOCK) { data = mockData(); console.log("› mock data"); }
else {
  try { data = await fetchData(); console.log(`› live data for ${LOGIN}`); }
  catch (e) { console.error("GitHub API failed:", e.message); process.exit(1); }
}
data.avatar = await loadAvatar(data.avatarUrl || `https://github.com/${LOGIN}.png?size=460`);
const dv = derive(data);
const files = {
  "hero.svg": hero(),
  "stack.svg": stack(),
  "fpv.svg": fpv(),
  "stats.svg": statsTile(data, dv),
  "languages.svg": langsTile(data),
  "streak.svg": streakTile(data, dv),
  "activity.svg": activityTile(data, dv),
  "flowcode.svg": flowcode(),
  "footer.svg": footer(),
};
const links = [
  { file: "link-codingame.svg", name: "Codingame", handle: "puzzles & bots", glyph: "</>", title: "Codingame profile" },
  { file: "link-cssbattle.svg", name: "CSSBattle", handle: "@tchoow", glyph: "{ }", title: "CSSBattle profile" },
  { file: "link-codepen.svg", name: "CodePen", handle: "collection", glyph: "#", title: "CodePen collection" },
  { file: "link-rootme.svg", name: "Root-me", handle: "@Tcoow", glyph: ">_", title: "Root-me profile" },
  { file: "link-dailydev.svg", name: "daily.dev", handle: "@tchoow", glyph: "//", title: "daily.dev profile" },
];
for (const l of links) { const [f, svg] = linkTile(l); files[f] = svg; }

mkdirSync(OUT, { recursive: true });
for (const [f, svg] of Object.entries(files)) {
  writeFileSync(join(OUT, f), svg.replace(/\n\s+/g, "\n"));
  console.log(`  ✓ ${f.padEnd(22)} ${(svg.length / 1024).toFixed(1)} kB`);
}
