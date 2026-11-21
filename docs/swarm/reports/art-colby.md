# art-colby report

## What I built
`src/art/colby.js`: all 14 ART rows of module `colby` (colby_idle/run/jump/climb/swing/hurt/sink/dead/win, colby_life, pete_idle/laugh/branch/head). Shared helpers (`bodyBase`, `leg`, `arm`, `tail`, `eyes`, `scarfTail`, `peteHead`) draw one consistent body and vary limbs per frame. Outline added last via `PixBuf.outline`.
`test/art-colby.test.mjs`: manifest conformance, determinism, build < 400 ms, feet/bbox checks.

## Verification evidence
`node tools/sheet.mjs colby --scale 6` prints OK (build ~10 ms). `node --test test/art-colby.test.mjs`: 4 pass. Viewed sheets at x8 three times (Colby once plus swing/win/sink recheck, Pete twice); Pete iterated twice (snout, gold tooth, hands, breathing frame).

## Deviations from the contract
None. colby_dead frame0 hat lies on floor, frame1 has a halo with no hat.

## Mistakes I made and how I fixed them
- Swing arms were hidden behind the hat: redrew as lines up the head sides with cream paws.
- 8x8 life icon filled the whole buffer so outline clipped: redrew in 6x6 interior.
- Pete's cheese stick covered his gold tooth: moved tooth left of the cheese start.

## Learnings for a future agent
`PixBuf.outline` adds pixels outside the art, so keep art inside a 1px margin (feet on row 22 of 24). Sheet `--out out/p1 --only <substr>` gives small, cheap-to-view previews.

## Requests for other modules
- Anchor/vine: colby_swing paws are at y=1 at x~2 and x~13 (not centred); renderer should draw the vine knot near the top of the sprite.
- colby_sink frames shift body down 1/4/8 px; the pit surface must cover the sprite bottom.
- Palette wishes: a dedicated light-grey/lilac for Pete's fur highlight (I used a literal '#9a96a8'), a pale hat highlight ('#e8d68a' used), and a lighter scarf red ('#ff6a58' used); these three are literals not in PAL, replace if strict.
