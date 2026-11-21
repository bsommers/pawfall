// Sky + parallax backdrop + night overlay (owner: render). Pure drawing functions of (ctx, art, state).
// `scroll` is the UNWRAPPED screen index (float during slides): layer offset = scroll * W * factor, and the
// layer tile widths divide W*factor*WORLD_SCREENS, so layers line up across screen flips AND across the world wrap.
import { W, H, LAYOUT, PAL, skyFor, WORLD_SCREENS } from '../core/defs.js';
import { hash2 } from '../art/pixbuf.js';

const SKY_TOP = LAYOUT.hudH, HORIZON = LAYOUT.surfaceY;
const mod = (a, n) => ((a % n) + n) % n;

/** 0 (day) .. 1 (deep night) darkness for t01 = timeLeft/TIME_LIMIT. */
export function nightAmount(t01) {
  const t = Math.max(0, Math.min(1, t01));
  if (t >= 0.6) return 0;
  if (t >= 0.3) return 0.14 * (0.6 - t) / 0.3;
  return 0.14 + 0.46 * (0.3 - t) / 0.3;
}

/** Draw a horizontally tiling sprite so that its left edge sits at world offset `off` (px). */
function tileX(ctx, img, w, y, off, x0 = 0, x1 = W) {
  let x = x0 - mod(off, w) ;
  for (; x < x1; x += w) ctx.drawImage(img, Math.round(x), y);
}

export function drawSkyBands(ctx, sky, y0 = SKY_TOP, y1 = HORIZON + 10) {
  const n = sky.bands.length, h = (y1 - y0) / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = sky.bands[i];
    const a = Math.floor(y0 + i * h), b = Math.floor(y0 + (i + 1) * h);
    ctx.fillRect(0, a, W, b - a + (i === n - 1 ? 0 : 0));
  }
}

function drawStars(ctx, art, sky, t) {
  if (sky.star <= 0.01) return;
  const n = Math.round(sky.star * 46);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash2(i, 1, 77) * W), y = SKY_TOP + 2 + Math.floor(hash2(i, 2, 77) * 56);
    const f = (Math.floor(t * 2 + hash2(i, 3, 77) * 4)) & 1;
    ctx.drawImage(art.get('star', f), x, y);
  }
}

function drawCelestial(ctx, art, sky, t01, t) {
  // sun descends from high-left to the horizon while t01 1 -> 0.25, then the moon rises and lingers.
  const dayU = Math.max(0, Math.min(1, (1 - t01) / 0.75));
  const sw = art.size('sun').w;
  if (t01 > 0.22) {
    const x = 36 + dayU * 250, y = 54 + 36 * dayU * dayU;
    ctx.drawImage(art.tint('sun', 0, sky.sun), Math.round(x - sw / 2), Math.round(y - sw / 2));
  }
  if (t01 < 0.34) {
    const v = Math.max(0, Math.min(1, (0.34 - t01) / 0.3));
    const x = 262 - 110 * v, y = 64 - 18 * v + Math.sin(t * 0.4) * 0.6;
    ctx.globalAlpha = Math.min(1, v * 1.6);
    ctx.drawImage(art.tint('sun', 0, '#dfe8ff'), Math.round(x - sw / 2), Math.round(y - sw / 2));
    ctx.globalAlpha = 1;
  }
}

/**
 * Sky bands, sun/moon, stars, clouds, mountains, far tree-line, far canopy.
 * @param {{t01:number, t:number, scroll:number}} s
 */
export function drawBackdrop(ctx, art, s) {
  const sky = skyFor(s.t01), scroll = s.scroll ?? 0;
  drawSkyBands(ctx, sky);
  drawStars(ctx, art, sky, s.t);
  drawCelestial(ctx, art, sky, s.t01, s.t);
  // clouds: three slow rows, parallax 0.08 + gentle drift, alpha follows the sky (ghostly at night)
  const night = nightAmount(s.t01), cw = art.size('cloud').w;
  ctx.globalAlpha = 0.95 - night * 0.7;
  for (let i = 0; i < 6; i++) {
    const span = W + 80, base = hash2(i, 5, 31) * span, y = SKY_TOP + 4 + Math.floor(hash2(i, 6, 31) * 40);
    const x = mod(base - scroll * W * 0.08 - s.t * (2 + (i % 3)), span) - 40;
    ctx.drawImage(art.get('cloud', i % 3), Math.round(x), y);
  }
  ctx.globalAlpha = 1;
  const mw = art.size('bg_mountains').w, mh = art.size('bg_mountains').h;
  tileX(ctx, art.get('bg_mountains', 0), mw, HORIZON - 20 - mh, scroll * W * 0.15);
  // far tree-line (2 variants alternate so the tile edge isn't obvious), tinted hazy by sky tone via alpha mix
  const tw = art.size('bg_trees').w, th = art.size('bg_trees').h, toff = scroll * W * 0.3;
  for (let k = -1; k * tw - mod(toff, tw) < W; k++) {
    const gi = Math.floor(toff / tw) + k;
    ctx.drawImage(art.get('bg_trees', mod(gi, 2)), Math.round(k * tw - mod(toff, tw)), HORIZON - th + 4);
  }
  // far canopy strip behind the main canopy
  const fw = art.size('canopy_far').w, foff = scroll * W * 0.5;
  for (let k = -1; k * fw - mod(foff, fw) < W; k++) {
    const gi = Math.floor(foff / fw) + k;
    ctx.drawImage(art.get('canopy_far', mod(gi, 2)), Math.round(k * fw - mod(foff, fw)), SKY_TOP - 6);
  }
}

const MOOD_TINT = { deep: [6, 20, 30, 0.16], swamp: [60, 80, 10, 0.14], ruins: [90, 80, 90, 0.10], pete: [120, 30, 20, 0.10], bright: null };

/** Mood colour wash over sky+jungle (y SKY_TOP..tunnel ceiling). */
export function drawMood(ctx, mood) {
  const m = MOOD_TINT[mood];
  if (!m) return;
  ctx.fillStyle = `rgba(${m[0]},${m[1]},${m[2]},${m[3]})`;
  ctx.fillRect(0, SKY_TOP, W, LAYOUT.ceilY - SKY_TOP);
}

/** Night / dusk darkening + fireflies. Surface darkens more than the (already dark) tunnel. */
export function drawNight(ctx, art, s) {
  const d = nightAmount(s.t01);
  if (d <= 0.005) return;
  ctx.fillStyle = `rgba(6,8,40,${(d * 0.92).toFixed(3)})`;
  ctx.fillRect(0, SKY_TOP, W, LAYOUT.ceilY - SKY_TOP);
  ctx.fillStyle = `rgba(6,8,30,${(d * 0.55).toFixed(3)})`;
  ctx.fillRect(0, LAYOUT.ceilY, W, H - LAYOUT.ceilY);
  if (d > 0.2) {
    const n = Math.round((d - 0.2) / 0.4 * 14), idx = s.idx ?? 0;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const ph = hash2(i, idx, 9) * 6.28, sp = 0.35 + hash2(i, idx, 10) * 0.5;
      const x = (hash2(i, idx, 11) * W + Math.sin(s.t * sp + ph) * 14 + W) % W;
      const y = 60 + hash2(i, idx, 12) * 46 + Math.sin(s.t * sp * 1.3 + ph * 2) * 7;
      const on = 0.55 + 0.45 * Math.sin(s.t * 3 + ph);
      ctx.globalAlpha = Math.max(0, on);
      ctx.drawImage(art.get('firefly', (Math.floor(s.t * 4 + i)) & 1), Math.round(x), Math.round(y));
    }
    ctx.restore();
  }
}
export { WORLD_SCREENS };
