# tracker-media report

## What I built
- server.mjs: `audio` list (out/sfx, out/music: duration, size), `media` totals (sprites/frames from defs.js ART rows whose module sheet exists in out/previews; sfx, music, shots, gifs), per-phase `total/done/running` agent counts, `/api/wav-peaks?f=&n=` (downsampled peak array, cached by mtime, out/dist only, .wav only), HTTP Range support on `/files/` (audio seeking), wav MIME.
- index.html: Media panel (totals strip, audio grid with canvas waveform + audio player, click-to-seek, one-at-a-time playback, gallery moved inside), phase bar now shows "done/total AGENTS" and a progress line. `?poll` untouched.
- Copied both files to ~/src/fun/game-factory/swarm/dashboard/ and added a line in docs/FACTORY-TOOLS.md.

## Verification evidence
Ran my own instance on :4851; /api/state showed media {sprites 66, frames 157, sfx 28, music 6}, phases with counts; wav-peaks returned peaks, `../etc/passwd` gave 403, Range gave 206; headless shot out/shots/tracker.png showed the Media panel correctly, no console errors.

## Deviations from the contract
None. The tracker on :4841 (not started by me) still runs the OLD server.mjs; it needs a restart to expose audio/media/wav-peaks (index.html is read per request).

## Mistakes I made and how I fixed them
Wav duration was computed from a 4 KB header read and clamped to the buffer (0.045s for music); fixed by using file size for the data length.

## Learnings for a future agent
Sprite/frame totals are regex-parsed from `A('module','name',w,h,frames,...)` rows in src/core/defs.js; falls back to sheet count for other games.

## Requests for other modules
Orchestrator: restart the :4841 tracker server to pick up server.mjs changes.
