// World API (ARCHITECTURE §6). Memoised, deterministic; see gen.js for the rules.
import { WORLD_SCREENS, START_SCREEN } from '../core/defs.js';
import { generateWorld } from './gen.js';

const gen = generateWorld();
export const WORLD = Object.freeze({ screens: Object.freeze(gen.screens), treasures: Object.freeze(gen.treasures), start: START_SCREEN });

/** ScreenDef for any integer index (world is circular). */
export function screenAt(idx) { return WORLD.screens[((Math.trunc(idx) % WORLD_SCREENS) + WORLD_SCREENS) % WORLD_SCREENS]; }

/** Sorted screen indices that carry a treasure. */
export function treasureScreens() { return WORLD.treasures.map((t) => t.screen).sort((a, b) => a - b); }
