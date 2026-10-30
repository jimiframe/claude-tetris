# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A classic Tetris implementation in vanilla JavaScript, HTML5 Canvas, and CSS. No dependencies, no build step, no `package.json`, no test suite.

## Running the game

There is no build/lint/test tooling. To run:

```bash
xdg-open index.html    # open directly, or:
python3 -m http.server 8000   # then visit http://localhost:8000
```

Verify changes by opening `index.html` in a browser and playing — there is no automated way to check correctness.

## Architecture

Three files, all at repo root:

- `index.html` — DOM structure: main `<canvas id="board">` (300×600, i.e. `COLS × BLOCK` by `ROWS × BLOCK`), a side panel (score/lines/level/next-piece preview canvas/controls), and a shared overlay div used for both PAUSE and GAME OVER states.
- `style.css` — dark/retro arcade visual theme.
- `game.js` — all game logic, in one file, structured as top-level state + functions (no classes/modules):
  - **State**: a handful of module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) rather than a state object or class.
  - **Board model**: `ROWS × COLS` matrix where each cell is `0` (empty) or a color index `1–8` identifying the piece type.
  - **Pieces**: the 7 standard tetrominoes plus the 3×3 "tuerca" (ring with an empty center, index 8) defined as square matrices in `PIECES`. `randomPiece()` spawns the tuerca with probability `NUT_CHANCE` (0.01 = 1 of every 100 pieces) and otherwise picks one of the 7 tetrominoes uniformly. Rotation is done via `rotateCW` (transpose + reverse), not by storing rotation states.
  - **Extra pieces**: pentominós `+`, `U`, `Y` (indices 11–13, chance `PENTOMINO_CHANCE`, +`PENTOMINO_BONUS` score on lock) and a 1×1 gift piece (index 14) granted via `singlesOwed` when `clearLines()` clears 4 rows at once; it spawns before pending power-ups. Indices 9–10 are reserved for power-ups (`null` placeholders in `COLORS`/`PIECES`).
  - **Hold**: `hold()` (keys `KeyC`/`ShiftLeft`/`ShiftRight`) stores the piece *type* in `held` and respawns it unrotated via `makePiece()`; one use per piece (`holdUsed`, reset in `spawn()`). Power-ups and the 1×1 gift can't be held. `drawHold()` renders onto `#hold-canvas` and toggles `.locked` (dimmed) while blocked.
  - **Collision**: `collide(shape, ox, oy)` checks bounds and overlap against `board`.
  - **Wall kicks**: `tryRotate()` attempts the rotated shape at offsets `[0, -1, 1, -2, 2]` columns, keeping the first that doesn't collide.
  - **Game loop**: `loop(ts)`, driven by `requestAnimationFrame`, accumulates elapsed time (`dropAccum`) and drops the piece one row once `dropInterval` is exceeded, otherwise calls `lockPiece()`.
  - **Locking a piece**: `lockPiece()` → `merge()` (write shape into `board`) → `clearLines()` → `spawn()` (promote `next` to `current`, generate a new `next`; if the new `current` immediately collides, `endGame()` fires).
  - **Line clearing**: `clearLines()` scans bottom-up, splices full rows out and unshifts empty rows in, awarding score via `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`.
  - **Combos y bonus**: `clearLines(tspin)` also handles combo (`combo`, -1 = no streak; bonus `COMBO_BONUS * combo * level`), T-spin (`isTSpin()` 3-corner rule, called in `lockPiece()` before `merge()`; needs `lastMoveRotation`, set by `tryRotate()` and cleared by any successful move/drop and in `spawn()`), Back-to-Back (`backToBack`, ×`B2B_MULT` for Tetris/T-spin clears) and Perfect Clear (`PERFECT_CLEAR_SCORE * level`). Power-up clears count for combo but never as T-spin. Feedback: floating canvas text (`floaters`, `announce()`), `sparkle()` particles (skipped under `prefers-reduced-motion`), and Web Audio synthesized sounds (`sfx()`; `AudioContext` created on first keydown/click; mute persisted in `localStorage` key `muted`, toggled by `#sound-toggle`). Combo colour is the CSS variable `--fx-combo`.
  - **Modo desafío**: `CHALLENGES` (top of `game.js`) defines the modes (`sprint` 40 lines/2:00, `garbage` survive 90s with a garbage row every 10s, `preset` pre-placed rows, `invisible` locked blocks hidden except `REVEAL_MS` after each lock, `reverse` counter-clockwise rotation from `reverseLevel`). Selected via `#mode-select` (persisted in `localStorage` key `mode`; changing it calls `init()`). `tickChallenge(dt)` runs in `loop()` only when not paused/frozen/in a power-up effect; wins go through `winGame()`, losses through `endGame(title)`. Level uses `levelFor()`/`dropFor()` (`levelBase` offsets the start level).
  - **Leveling**: level = `floor(lines / 10) + 1`; `dropInterval = max(100, 1000 - (level - 1) * 90)` ms.
  - **Ghost piece**: `ghostY()` projects `current` straight down until collision; drawn via `drawBlock(..., alpha=0.2)`.
  - **Rendering**: `draw()` clears and redraws grid + locked board + ghost + current piece every frame onto `#board`; `drawNext()` renders the next-piece preview onto `#next-canvas`.
  - **Input**: a single `keydown` listener switches on `e.code` (arrows, `KeyX` for rotate, `Space` for hard drop, `KeyP` for pause), guarded by `paused`/`gameOver`.

- **Theming**: colors live in CSS variables (`:root` = dark default, `[data-theme="light"]` overrides) in `style.css`. `applyTheme()` in `game.js` sets `data-theme` on `<html>`, caches canvas colors (`--grid`, `--highlight`, `--ghost-alpha`), picks `COLORS` or `COLORS_LIGHT`, and redraws. The choice persists in `localStorage` (`theme`); an inline script in `<head>` applies it before first paint. New colors should be CSS variables, not hex literals.

Tunable constants live at the top of `game.js`: `COLS`, `ROWS`, `BLOCK`, `COLORS`, `PIECES`, `LINE_SCORES`. If `COLS`, `ROWS`, or `BLOCK` change, update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS × BLOCK` by `ROWS × BLOCK`).
