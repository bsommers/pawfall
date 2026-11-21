// PawFall canonical data. FROZEN (orchestrator) — except TUNING values, which `sim-core` may adjust.
// Node-safe: no DOM at import time. Every module imports constants from here; never duplicate numbers.

// ---------------------------------------------------------------- display & layout (logical pixels)
export const W = 320, H = 192;               // logical canvas; shown at integer scale, image-rendering: pixelated
export const FPS = 60, DT = 1 / 60;          // fixed sim step

export const LAYOUT = Object.freeze({
  hudH: 18,                                  // black HUD strip y 0..17
  canopyBottom: 52,                          // leafy canopy occupies roughly y 18..52 (art may overhang to 58)
  surfaceY: 104,                             // FEET y of anything standing on the jungle path (top of path strip)
  pathH: 10,                                 // path strip y 104..113 (surface ground tiles)
  ceilY: 114,                                // tunnel ceiling band y 114..123 (dirt+roots; brick tiles on wall)
  tunnelTop: 124,                            // tunnel interior y 124..167
  tunnelY: 168,                              // FEET y of anything standing on the tunnel floor
  floorBottom: 191,                          // tunnel floor/dirt band y 168..191
  // the hole in the path (pits, ladder hole). Pit spans x0..x0+w (screen centred unless the screen overrides)
  pitX0: 136, pitW: 48,
  ladderW: 12,                               // ladder sprite width; centred in hole
  // underground brick wall columns (blocks the tunnel): x range
  wallL: 8, wallR: 296, wallW: 16,
  // horizontal screen change happens when player centre x passes these
  edgeL: 4, edgeR: 316,
});

// ---------------------------------------------------------------- palette (all art uses ONLY these + shade()/mix() of them)
export const PAL = Object.freeze({
  peteHL: '#9a96a8', hatHL: '#e8d68a', scarfHL: '#ff6a58',
  outline: '#1a1420', black: '#0a0710', white: '#fff6e0',
  // colby (orange tabby explorer)
  furD: '#b8561a', fur: '#f08a24', furL: '#ffc26a', cream: '#fff0d0', stripe: '#a8430f', nose: '#ff8fa3', eye: '#7bd44a', eyeD: '#1f4a12',
  hat: '#c9b26a', hatD: '#8f7a3c', hatBand: '#8a2a1a', scarf: '#d63a2f', boot: '#5a3a1a',
  // pete (Perring Parkway Pete: fat grey rat in a pinstripe suit, shades, gold tooth)
  peteFur: '#7a7688', peteFurD: '#4f4b5e', peteSuit: '#2a2f55', peteSuitL: '#444c85', peteStripe: '#8d96d6', peteTie: '#ffd23a', peteTooth: '#ffd23a', peteShade: '#0a0710', peteEar: '#e8a0b0',
  // jungle
  leafD: '#0b3d1a', leaf: '#1d7a2c', leafM: '#2f9a34', leafL: '#3fae3f', leafHL: '#8ad65a', leafDark2: '#06240f',
  trunkD: '#3d2610', trunk: '#5a3a1a', trunkL: '#7b4f26', trunkHL: '#a06a34',
  path: '#d9a441', pathD: '#a87a2a', pathL: '#f0c868', grass: '#2f9a34', grassD: '#1d7a2c',
  dirt: '#5a3a22', dirtD: '#3a2416', dirtL: '#7a5232', brick: '#a0522d', brickD: '#6e3319', brickL: '#c4744a', mortar: '#2a1810', tunnelDark: '#120a12', tunnelMid: '#241420',
  water: '#2a6fd6', waterD: '#1b4a9a', waterL: '#7ec8ff', tar: '#1a1420', tarL: '#3a2f48', quick: '#e0c060', quickD: '#b8903a', slime: '#8ad65a',
  // critters
  log: '#8a5a2a', logD: '#5a3a1a', logRing: '#c48a4a', fire: '#ff7a1a', fireL: '#ffd23a', fireD: '#d63a2f',
  snake: '#3fae3f', snakeD: '#1d7a2c', snakeBelly: '#e8e0a0', croc: '#4f8a3a', crocD: '#2f5a28', crocMouth: '#e86a7a', tooth: '#fff6e0',
  scorp: '#c4c4d0', scorpD: '#7a7688', cheese: '#ffd23a', cheeseD: '#d9a41a', cheeseHole: '#a87a2a',
  // treasures
  gold: '#ffd23a', goldD: '#d9a41a', silver: '#d8e0f0', silverD: '#8d96b8', gem: '#7ee8ff', gemD: '#2a9ad6', tuna: '#ff7a8a', can: '#c8d0e0',
  // ui
  hudBg: '#0a0710', hudTxt: '#ffd23a', hudDim: '#8d7a3a', red: '#ff4a3a', green: '#6cf06c',
});

// Sky is a 7-band Atari-style gradient that changes with the time left on the clock (see skyFor).
// day -> golden hour -> dusk -> night as timeLeft goes 1200 -> 0. Each key is [topBand .. horizonBand].
export const SKY_KEYS = Object.freeze([
  { t: 1.0, bands: ['#3a8ae6', '#4a98ee', '#5aa6f2', '#6ab4f4', '#7ec2f6', '#94d0f8', '#b0e0fa'], sun: '#fff6a0', star: 0 },
  { t: 0.6, bands: ['#3a78d6', '#5a8ee0', '#7aa0e0', '#a8b0d8', '#e0b8b0', '#f0c890', '#f8d878'], sun: '#ffe060', star: 0 },
  { t: 0.3, bands: ['#4a3a8a', '#7a4a9a', '#b0508a', '#d86a6a', '#f08a4a', '#f8aa3a', '#ffd04a'], sun: '#ff8a2a', star: 0.3 },
  { t: 0.0, bands: ['#080820', '#0c0c30', '#121440', '#1a1a52', '#24246a', '#303080', '#3c3c94'], sun: '#dfe8ff', star: 1 },
]);
/** @returns {{bands:string[], sun:string, star:number}} interpolated for t01 = timeLeft/TIME_LIMIT (callers may smooth). */
export function skyFor(t01) {
  const k = SKY_KEYS, t = Math.max(0, Math.min(1, t01));
  let i = 0; while (i < k.length - 2 && t < k[i + 1].t) i++;
  const a = k[i], b = k[i + 1], u = (a.t === b.t) ? 0 : (a.t - t) / (a.t - b.t);
  const hex = (c) => [1, 3, 5].map((o) => parseInt(c.slice(o, o + 2), 16));
  const mixc = (c1, c2) => '#' + hex(c1).map((v, n) => Math.round(v + (hex(c2)[n] - v) * u).toString(16).padStart(2, '0')).join('');
  return { bands: a.bands.map((c, n) => mixc(c, b.bands[n])), sun: mixc(a.sun, b.sun), star: a.star + (b.star - a.star) * u };
}

// ---------------------------------------------------------------- game rules / tuning (px, seconds)
export const TIME_LIMIT = 1200;              // 20:00, like Pitfall!
export const START_SCORE = 2000;
export const START_LIVES = 3;
export const WORLD_SCREENS = 120;            // circular world; screenAt(i) uses ((i % N) + N) % N
export const START_SCREEN = 0;
export const TREASURE_COUNT = 32;            // ids 0..31 spread over the world (see levels/world.js)
export const TUNNEL_STRIDE = 3;              // walking one screen underground moves 3 surface screens (like Pitfall)

export const TUNING = {                      // sim-core may tune these numbers (nothing else in this file)
  runSpeed: 72,                              // px/s on ground
  airSpeed: 72,                              // horizontal speed kept while airborne (set at takeoff, small air control)
  gravity: 620,                              // px/s^2
  jumpV: 205,                                // initial upward speed (peak ~34px, air time ~0.66s, range ~48px)
  climbSpeed: 44,                            // ladder px/s
  hitW: 8, hitH: 18,                         // player hitbox (feet-centred): x±4, y-18..y
  spriteW: 16, spriteH: 24,                  // Colby frame size (feet at bottom-centre)
  vine: { pivotY: 30, len: 58, amp: 0.85, period: 2.4 },   // pivot at pit centre x; amp radians; period seconds (see vineAngle)
  grabR: 10,                                 // grab radius around vine tip (hands)
  logHitPenalty: 100, logStun: 0.5,          // log / cheese-wheel touch: lose points, brief knock-back stun
  sinkTime: 1.6,                             // seconds to sink in tar/quicksand/water before life lost
  deathTime: 1.6,                            // dying animation before respawn
  respawnInvuln: 1.5,
  timeBonusPerSec: 5,                        // victory: remaining seconds * this
  crocPeriod: 2.8, crocOpenFrac: 0.45,       // croc mouth cycle (open fraction is deadly; closed = walkable head)
};

/** Vine angle (radians from vertical, + = swings toward +x) at time t seconds. Shared by sim and renderer. */
export function vineAngle(t, T = TUNING.vine) { return T.amp * Math.sin((t * 2 * Math.PI) / T.period); }
/** Vine tip (hands) position for a pivot at (px, T.pivotY). */
export function vineTip(px, t, T = TUNING.vine) { const a = vineAngle(t, T); return { x: px + Math.sin(a) * T.len, y: T.pivotY + Math.cos(a) * T.len, a }; }

export const TREASURES = Object.freeze({    // value like Pitfall! (2000-5000); sprite names in ART
  tuna:   { value: 2000, sprite: 'tr_tuna',   name: 'TUNA TIN' },
  sardine:{ value: 3000, sprite: 'tr_sardine',name: 'SILVER SARDINE' },
  gold:   { value: 4000, sprite: 'tr_gold',   name: 'GOLD BAR' },
  collar: { value: 5000, sprite: 'tr_collar', name: 'DIAMOND COLLAR' },
});
export const SCORES = Object.freeze({ lifeLostPenalty: 0, logHit: -100, treasureBonusAll: 10000 });

// ---------------------------------------------------------------- screen / world data model (levels/world.js produces these)
/**
 * ScreenDef (plain JSON-able object, deterministic per index):
 * { idx, trees: [x,...]            trunk x positions (1..3 trunks, each 14px wide, centre x)
 *   mood: 'bright'|'deep'|'swamp'|'ruins'|'pete'   scenery flavour (art picks variants; 'pete' = Pete's ambush screens with his sign)
 *   pit: null | { kind:'hole'|'tar'|'quick'|'water'|'croc', x0, w, vine:boolean, ladder:boolean }   // hole = ladder hole (safe drop), tar/quick/water/croc = deadly
 *   hazards: [ { kind:'log'|'logs2'|'logs3'|'stilllog'|'cheese'|'fire'|'snake', x?, dir?, speed? } ]   // surface, spawned on entry
 *   treasure: null | { id:0..31, type:'tuna'|'sardine'|'gold'|'collar', x }
 *   under: { wall: null|'L'|'R',  scorp: [ {x, dir} ],  ladderX: number|null }   // tunnel layer; ladderX null when no hole above
 *   pete: boolean                    Pete cameo on a branch (throws cheese wheels = 'cheese' hazards)
 * }
 * Fairness (tools/validate-level.mjs proves it): every screen can be crossed left->right and right->left on the surface or via the tunnel by a normal player.
 */

// ---------------------------------------------------------------- entities (sim -> render)
/**
 * Hazard entity (sim-hazards creates; sim-core iterates):
 * { id, kind, x, y (feet), w, h, vx, dir, t (age s), frame, layer:'surface'|'tunnel',
 *   solidTop:boolean (player may stand on top: closed-mouth croc heads),
 *   lethal: null|'life'|'points' (current contact effect; may change each tick, e.g. croc mouth),
 *   dead:boolean, st:{} (behaviour scratch) }
 * Render picks sprites from kind + frame (see ART names + frame semantics in ARCHITECTURE.md §7).
 */
export const HAZARD_KINDS = Object.freeze(['log', 'stilllog', 'cheese', 'fire', 'snake', 'croc', 'scorpion']);
// ('logs2'/'logs3' in ScreenDef expand to 2/3 'log' entities spaced apart.)

// ---------------------------------------------------------------- events (bus.emit(type, payload); sim emits, render/audio/ui subscribe)
export const EVENTS = Object.freeze([
  'sfx',        // { name, x?, y? }
  'music',      // { name|null }
  'fx',         // { type, x, y, opts? }      types: 'splash','dust','sparkle','stars','bubble','poof','confetti'
  'shake',      // { mag, dur }
  'popup',      // { text, x, y, color? }     floating text e.g. '+4000'
  'screen',     // { idx, layer, from, dir }  entered a new screen
  'treasure',   // { id, type, value, x, y }
  'score',      // { score, delta }
  'life',       // { lives, reason }          reason: 'tar'|'quick'|'water'|'croc'|'fire'|'snake'|'scorpion'|'time'|'fall'
  'timer',      // { left }                   once per second
  'taunt',      // { text, dur }              Pete barks (HUD banner)
  'banner',     // { text, sub?, dur }
  'state',      // { state }                  'intro'|'play'|'dying'|'gameover'|'victory'
  'gameover',   // { score, treasures, screens }
  'victory',    // { score, timeBonus }
  'pause',      // { on }
]);

// ---------------------------------------------------------------- audio names (audio-sfx implements SFX; audio-music implements MUSIC)
export const SFX = Object.freeze([
  'step', 'jump', 'land', 'swing_grab', 'swing_release', 'ladder', 'treasure', 'treasure_big', 'log_hit', 'splash', 'tar_glug', 'quicksand',
  'croc_snap', 'snake_hiss', 'scorpion', 'fire_crackle', 'die', 'respawn', 'screen_flip', 'tunnel_drop', 'brick_bump', 'tick_low', 'pete_laugh',
  'menu_move', 'menu_select', 'gameover', 'victory', 'oneup',
]);
export const MUSIC = Object.freeze(['title', 'jungle', 'underground', 'dusk', 'gameover', 'victory']);   // loops except gameover/victory (stings)

// ---------------------------------------------------------------- art manifest (art agents implement; tools/sheet.mjs <module> validates)
// kind 'sprite' = transparent bg; 'tile' = fully opaque, tileable. Sizes are exact. frames = animation frames (PixBuf[] when >1).
// Colby/critters face RIGHT; the renderer mirrors for left. Feet = bottom-centre of the frame unless desc says otherwise.
const A = (module, name, w, h, frames, kind, desc) => ({ module, name, w, h, frames, kind, desc });
export const ART = Object.freeze([
  // --- module 'colby' : the hero and the villain
  A('colby', 'colby_idle', 16, 24, 2, 'sprite', 'Colby standing (tail sway / blink), pith helmet, red scarf'),
  A('colby', 'colby_run', 16, 24, 6, 'sprite', 'run cycle, 6 frames, tail streaming'),
  A('colby', 'colby_jump', 16, 24, 3, 'sprite', 'rise / peak (tucked) / fall (paws out)'),
  A('colby', 'colby_climb', 16, 24, 2, 'sprite', 'ladder climb, seen from behind/side, alternate paws'),
  A('colby', 'colby_swing', 16, 24, 2, 'sprite', 'hanging on a vine: both paws up top (frame0 straight, frame1 legs kicked)'),
  A('colby', 'colby_hurt', 16, 24, 2, 'sprite', 'stunned/knocked back, dizzy eyes'),
  A('colby', 'colby_sink', 16, 24, 3, 'sprite', 'sinking: arms up, wide eyes; frames get progressively lower (cut at bottom by a pit surface drawn over)'),
  A('colby', 'colby_dead', 16, 24, 2, 'sprite', 'ghost/flat KO pose: X eyes, hat flopped off; frame1 = halo'),
  A('colby', 'colby_win', 16, 24, 3, 'sprite', 'cheering, paws up, helmet tossed (loop)'),
  A('colby', 'colby_life', 8, 8, 1, 'sprite', 'tiny Colby head icon for the HUD lives counter'),
  A('colby', 'pete_idle', 40, 48, 2, 'sprite', 'Perring Parkway Pete: fat grey rat, pinstripe suit, black shades, gold tooth, cigar-free (cheese-stick in mouth); smug stance'),
  A('colby', 'pete_laugh', 40, 48, 2, 'sprite', 'Pete laughing, belly shaking'),
  A('colby', 'pete_branch', 24, 24, 2, 'sprite', 'small Pete peeking from the canopy / hanging from a branch (throwing pose frame1); anchor bottom-centre'),
  A('colby', 'pete_head', 16, 16, 2, 'sprite', 'Pete head icon for taunt banners (frame1 = grin)'),
  // --- module 'critters' : hazards + treasures
  A('critters', 'log', 16, 10, 4, 'sprite', 'rolling log, 4 rotation frames (end-grain rings visible), feet-anchored'),
  A('critters', 'stilllog', 18, 10, 1, 'sprite', 'stationary log lying across the path'),
  A('critters', 'cheese', 14, 14, 4, 'sprite', "Pete's rolling cheese wheel (round, holes, rotates 4 frames)"),
  A('critters', 'fire', 12, 16, 3, 'sprite', 'campfire/flame flicker, 3 frames, over a few logs'),
  A('critters', 'snake', 16, 16, 3, 'sprite', 'coiled cobra swaying, hood out, tongue flick (frames 0,1,2)'),
  A('critters', 'scorpion', 16, 10, 2, 'sprite', 'scorpion scuttle, 2 frames, tail curled'),
  A('critters', 'croc', 24, 12, 2, 'sprite', 'crocodile head+snout above water: frame0 mouth CLOSED (flat top, safe to stand), frame1 mouth OPEN (teeth, deadly). Anchor bottom-centre at water line'),
  A('critters', 'tr_tuna', 12, 12, 3, 'sprite', 'tuna tin treasure + shimmer (3 frames)'),
  A('critters', 'tr_sardine', 12, 12, 3, 'sprite', 'silver sardine tin/bar + shimmer'),
  A('critters', 'tr_gold', 12, 12, 3, 'sprite', 'gold bar stack + shimmer'),
  A('critters', 'tr_collar', 12, 12, 3, 'sprite', 'diamond collar (ring-like) + sparkle'),
  A('critters', 'cheese_thrown', 10, 10, 2, 'sprite', 'cheese chunk Pete tosses (tumbling 2 frames)'),
  // --- module 'world' : scenery
  A('world', 'tile_path', 16, 10, 2, 'tile', 'jungle path surface strip tile (2 variants), top edge grassy'),
  A('world', 'tile_dirt', 16, 16, 2, 'tile', 'dark earth under the path / tunnel floor (2 variants)'),
  A('world', 'tile_ceil', 16, 10, 2, 'tile', 'tunnel ceiling band with roots (2 variants) — seamless with tile_dirt'),
  A('world', 'tile_brick', 16, 8, 1, 'tile', 'tunnel brick wall tile'),
  A('world', 'tile_tunnel', 16, 16, 1, 'tile', 'dark tunnel interior with subtle speckle'),
  A('world', 'tile_water', 16, 10, 3, 'tile', 'pit water surface, 3 animation frames (scroll ripples)'),
  A('world', 'tile_tar', 16, 10, 3, 'tile', 'tar pit surface, 3 frames, bubbles'),
  A('world', 'tile_quick', 16, 10, 3, 'tile', 'quicksand surface, 3 frames, swirling'),
  A('world', 'pit_depth', 16, 16, 1, 'tile', 'the pit interior below the surface strip (dark dirt walls for tar/quick; water gets blue via renderer)'),
  A('world', 'ladder', 12, 8, 1, 'sprite', 'one 8px ladder segment (rails + rung), tiled vertically by the renderer'),
  A('world', 'ladder_top', 12, 8, 1, 'sprite', 'ladder top segment poking above the path (with hole rim)'),
  A('world', 'trunk', 14, 64, 3, 'sprite', 'jungle tree trunk, 3 variants, bark texture, root flare at bottom; anchor bottom-centre'),
  A('world', 'canopy', 64, 36, 3, 'sprite', 'leaf canopy chunk, 3 variants, tileable horizontally at the left/right edges; overhanging blobs underneath; anchor top-left'),
  A('world', 'canopy_far', 64, 28, 2, 'sprite', 'darker, smaller far canopy for parallax behind (tileable x)'),
  A('world', 'bg_mountains', 160, 48, 1, 'sprite', 'distant blue-purple jungle mountains silhouette, tileable x'),
  A('world', 'bg_trees', 160, 56, 2, 'sprite', 'far jungle tree-line silhouettes (hazy green), tileable x, 2 variants'),
  A('world', 'cloud', 40, 14, 3, 'sprite', 'blocky cloud, 3 variants'),
  A('world', 'fg_leaf', 40, 72, 3, 'sprite', 'foreground jungle leaf/fern silhouettes drawn IN FRONT of the player at screen edges for 2.xD depth (dark green, 3 variants)'),
  A('world', 'bush', 24, 14, 3, 'sprite', 'ground bush/fern decor behind the player, 3 variants'),
  A('world', 'rock', 14, 10, 2, 'sprite', 'mossy rock decor'),
  A('world', 'mushroom', 10, 10, 2, 'sprite', 'spotty mushroom decor'),
  A('world', 'vine_knot', 6, 6, 1, 'sprite', 'the vine grab point (hanging knot with leaf)'),
  A('world', 'vine_pivot', 12, 10, 1, 'sprite', 'branch stub the vine hangs from, drawn at the pivot'),
  A('world', 'sign_pete', 40, 32, 2, 'sprite', "Pete's billboard staked in the ground: 'PETE'S PARKWAY PICKLES' joke art (frame1 = flap); anchor bottom-centre"),
  A('world', 'bat', 12, 8, 2, 'sprite', 'tunnel ambience bat flapping (harmless decor)'),
  A('world', 'firefly', 3, 3, 2, 'sprite', 'night firefly glow dot (2 frames)'),
  A('world', 'star', 3, 3, 2, 'sprite', 'night sky star twinkle (2 frames)'),
  A('world', 'sun', 20, 20, 1, 'sprite', 'blocky sun/moon disc; renderer tints it via skyFor().sun'),
  // --- module 'fx' : effects + UI art
  A('fx', 'fx_splash', 16, 12, 4, 'sprite', 'water splash burst'),
  A('fx', 'fx_tarsplat', 16, 12, 4, 'sprite', 'black tar blob splat'),
  A('fx', 'fx_dust', 8, 6, 4, 'sprite', 'running/landing dust puff'),
  A('fx', 'fx_sparkle', 8, 8, 4, 'sprite', 'treasure sparkle burst'),
  A('fx', 'fx_stars', 14, 6, 3, 'sprite', 'dizzy stars orbiting'),
  A('fx', 'fx_bubble', 4, 4, 2, 'sprite', 'rising bubble'),
  A('fx', 'fx_poof', 16, 16, 4, 'sprite', 'poof cloud'),
  A('fx', 'fx_leaf', 6, 6, 4, 'sprite', 'falling leaf particle (4 rotation frames)'),
  A('fx', 'logo', 224, 56, 1, 'sprite', 'PAWFALL title logo: chunky 3D blocky letters, orange/yellow with dark outline, a paw print for the A, vine + leaf trim'),
  A('fx', 'title_scene', 320, 110, 1, 'sprite', 'title backdrop strip: jungle silhouette with Colby on a vine and a mountain, no text (drawn above the logo)'),
  A('fx', 'cursor_paw', 10, 10, 2, 'sprite', 'menu cursor paw (2 frames bob)'),
  A('fx', 'touch_btn', 32, 32, 2, 'sprite', 'round touch-control button base (frame1 = pressed), no glyph'),
]);
export function artManifest() { return ART; }
