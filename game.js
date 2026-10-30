'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#bcaaa4', // N - tuerca (gris metálico)
  null,      // 9 y 10 reservados (POWER_TYPE, WILD_TYPE: colores por CSS)
  null,
  '#f06292', // + - pentominó cruz (rosa)
  '#4db6ac', // U - pentominó U (turquesa)
  '#aed581', // Y - pentominó Y (lima)
  '#fff176', // 1×1 - regalo tras Tetris
];

// Paleta más saturada para fondo claro (la oscura se pierde: amarillo, cian...)
const COLORS_LIGHT = [
  null,
  '#00acc1', // I
  '#f9a825', // O
  '#8e24aa', // T
  '#43a047', // S
  '#e53935', // Z
  '#1e88e5', // J
  '#fb8c00', // L
  '#6d4c41', // N
  null,
  null,
  '#d81b60', // +
  '#00897b', // U
  '#7cb342', // Y
  '#c0a000', // 1×1
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca
  null,                                        // 9: POWER_TYPE (reservado)
  null,                                        // 10: WILD_TYPE (reservado)
  [[0,11,0],[11,11,11],[0,11,0]],             // + pentominó
  [[12,0,12],[12,12,12],[0,0,0]],             // U pentominó
  [[0,13,0,0],[13,13,13,13],[0,0,0,0],[0,0,0,0]], // Y pentominó (cabe en la vista previa de 4×4)
  [[14]],                                      // 1×1 de regalo
];

// Probabilidad de que una pieza nueva sea la tuerca; el resto se reparte a partes iguales
const NUT_TYPE = 8;
const NUT_CHANCE = 0.01;

// Pentominós (+, U, Y): aparecen ocasionalmente; son más difíciles de colocar, así que dan puntos extra al fijarse.
// Un Tetris (4 líneas a la vez) regala una pieza 1×1 normal (se funde con el tablero) que va antes que los power-ups.
const PENTOMINO_TYPES = [11, 12, 13];
const PENTOMINO_CHANCE = 0.06;
const PENTOMINO_BONUS = 20;
const SINGLE_TYPE = 14;

const LINE_SCORES =[0, 100, 300, 500, 800];

// Combos y bonus (estilo Guideline); todo se multiplica por el nivel.
// Combo: cada limpieza en turnos consecutivos suma COMBO_BONUS × combo; colocar sin limpiar reinicia la racha.
// T-spin: la T debe terminar con una rotación como último movimiento y >=3 de las 4 esquinas de su caja 3×3 ocupadas.
// B2B: Tetris o T-spin con líneas seguidos (sin una limpieza normal en medio) puntúan ×B2B_MULT.
const COMBO_BONUS = 50;
const TSPIN_SCORES = [400, 800, 1200, 1600];   // indexado por líneas limpiadas (0 = T-spin sin líneas)
const B2B_MULT = 1.5;
const PERFECT_CLEAR_SCORE = 2000;
const T_TYPE = 3;
const FLOAT_MS = 1400;

// Power-ups: cada POWERUP_EVERY líneas la siguiente pieza es un bloque 1×1 especial.
// Al fijarse no se funde con el tablero: aplica su efecto en el punto de aterrizaje.
// Sus colores salen de variables CSS (--powerup, --wild), no de las paletas.
const POWERUP_EVERY = 5;
const POWER_TYPE = 9;   // celda de la pieza power-up (solo existe en la pieza, nunca en el tablero)
const WILD_TYPE = 10;   // comodín creado por Tinte: ocupa celda y cuenta para completar líneas
const FREEZE_MS = 5000;
const POWERUPS = {
  bomb:      { glyph: '💣', name: 'Bomba' },
  lightning: { glyph: '⚡', name: 'Rayo' },
  dye:       { glyph: '🎨', name: 'Tinte' },
  gravity:   { glyph: '⬇', name: 'Gravedad' },
  freeze:    { glyph: '❄', name: 'Congelar' },
};
const POWERUP_KINDS = Object.keys(POWERUPS);
// Feedback visual: al fijarse, el power-up espera EFFECT_MS animando las celdas afectadas antes de aplicarse
const EFFECT_MS = 450;
const SHAKE_MS = { bomb: 350, lightning: 180 };

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const powerupEl = document.getElementById('powerup-status');
const comboEl = document.getElementById('combo-status');
const soundBtn = document.getElementById('sound-toggle');

// Colores del canvas leídos de las variables CSS del tema activo (cacheados al cambiar de tema)
let theme = 'dark', palette = COLORS, gridColor, highlightColor, ghostAlpha, powerColor, wildColor, comboColor, fxColors = {};

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
// Power-ups: pendientes de generar, hitos de líneas ya contabilizados y congelación restante (ms de juego)
let powerupsOwed, powerupsGranted, freezeLeft;
// Piezas 1×1 de regalo pendientes (una por Tetris)
let singlesOwed;
// Efectos visuales: power-up en animación (bloquea la partida), partículas y temblor restante (ms)
let effect, particles, shakeLeft;
// Combo: -1 = sin racha; backToBack = la última limpieza fue "difícil"; lastMoveRotation = el último movimiento fue una rotación;
// floaters = textos flotantes sobre el tablero
let combo, backToBack, lastMoveRotation, floaters;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  if (singlesOwed > 0) {
    singlesOwed--;
    return { type: SINGLE_TYPE, shape: [[SINGLE_TYPE]], x: Math.floor(COLS / 2), y: 0 };
  }
  if (powerupsOwed > 0) {
    powerupsOwed--;
    const power = POWERUP_KINDS[Math.floor(Math.random() * POWERUP_KINDS.length)];
    // axis: el Rayo elige fila o columna al generarse, para poder previsualizarlo
    const axis = Math.random() < 0.5 ? 'row' : 'col';
    return { type: POWER_TYPE, power, axis, shape: [[POWER_TYPE]], x: Math.floor(COLS / 2), y: 0 };
  }
  const roll = Math.random();
  const type = roll < NUT_CHANCE ? NUT_TYPE
    : roll < NUT_CHANCE + PENTOMINO_CHANCE
      ? PENTOMINO_TYPES[Math.floor(Math.random() * PENTOMINO_TYPES.length)]
      : Math.floor(Math.random() * (NUT_TYPE - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveRotation = true;
      sfx('rotate');
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// Celdas [fila, col] que afectará el power-up si aterriza en (x, y)
function powerTargets(kind, x, y, axis) {
  const cells = [];
  switch (kind) {
    case 'bomb':
      for (let r = y - 1; r <= y + 1; r++)
        for (let c = x - 1; c <= x + 1; c++)
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) cells.push([r, c]);
      break;
    case 'lightning':
      if (axis === 'row') for (let c = 0; c < COLS; c++) cells.push([y, c]);
      else for (let r = 0; r < ROWS; r++) cells.push([r, x]);
      break;
    case 'dye': {
      const top = dyeColor();
      if (top) for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) if (board[r][c] == top) cells.push([r, c]);
      break;
    }
    case 'gravity':
      // Bloques con algún hueco debajo en su columna
      for (let c = 0; c < COLS; c++) {
        let gap = false;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (!board[r][c]) gap = true;
          else if (gap) cells.push([r, c]);
        }
      }
      break;
  }
  return cells;
}

// Color más abundante del tablero (el que convierte Tinte en comodines)
function dyeColor() {
  const counts = {};
  for (const row of board)
    for (const v of row) if (v && v !== WILD_TYPE) counts[v] = (counts[v] || 0) + 1;
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
}

function applyPowerup(kind, x, y, axis) {
  switch (kind) {
    case 'bomb':
      for (let r = y - 1; r <= y + 1; r++)
        for (let c = x - 1; c <= x + 1; c++)
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = 0;
      break;
    case 'lightning':
      if (axis === 'row') board[y].fill(0);
      else for (let r = 0; r < ROWS; r++) board[r][x] = 0;
      break;
    case 'dye': {
      // Convierte en comodines el color más abundante del tablero
      const top = dyeColor();
      if (top)
        for (const row of board)
          for (let c = 0; c < COLS; c++) if (row[c] == top) row[c] = WILD_TYPE;
      break;
    }
    case 'gravity':
      for (let c = 0; c < COLS; c++) {
        const col = board.map(row => row[c]).filter(v => v);
        for (let r = ROWS - 1; r >= 0; r--) board[r][c] = col.pop() || 0;
      }
      break;
    case 'freeze':
      freezeLeft = FREEZE_MS;
      break;
  }
  score += 50;
}

// Regla de 3 esquinas: la T bloqueada tras una rotación con >=3 esquinas ocupadas (paredes y suelo cuentan).
// Debe llamarse antes de merge(), con el tablero sin la pieza.
function isTSpin() {
  if (current.type !== T_TYPE || !lastMoveRotation) return false;
  let filled = 0;
  for (const [dy, dx] of [[0, 0], [0, 2], [2, 0], [2, 2]]) {
    const r = current.y + dy, c = current.x + dx;
    if (c < 0 || c >= COLS || r >= ROWS || (r >= 0 && board[r][c])) filled++;
  }
  return filled >= 3;
}

function clearLines(tspin = false) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (!cleared) {
    combo = -1; // sin limpieza se pierde la racha (el B2B se conserva)
    if (tspin) {
      score += TSPIN_SCORES[0] * level;
      announce(['T-SPIN']);
      sfx('tspin');
    }
    updateHUD();
    return;
  }

  const msgs = [];
  let base = (tspin ? TSPIN_SCORES[cleared] : LINE_SCORES[cleared]) || 0;
  const hard = tspin || cleared >= 4;
  if (tspin) msgs.push(`T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][cleared]}`);
  else if (cleared >= 4) msgs.push('TETRIS');
  if (hard && backToBack) {
    base = Math.floor(base * B2B_MULT);
    msgs.push('BACK-TO-BACK');
  }
  backToBack = hard;
  score += base * level;

  combo++;
  if (combo > 0) {
    score += COMBO_BONUS * combo * level;
    msgs.push(`COMBO x${combo + 1}`);
  }

  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  const due = Math.floor(lines / POWERUP_EVERY);
  powerupsOwed += due - powerupsGranted;
  powerupsGranted = due;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);

  const perfect = board.every(row => row.every(v => v === 0));
  if (perfect) {
    score += PERFECT_CLEAR_SCORE * level;
    msgs.push('PERFECT CLEAR!');
  }

  if (msgs.length) announce(msgs);
  sfx(perfect ? 'perfect' : tspin ? 'tspin' : hard ? 'tetris' : 'clear', combo);
  if (perfect || hard || combo > 0) sparkle(perfect ? 60 : 24 + combo * 6);
  updateHUD();
}

// Texto flotante apilado sobre el tablero
function announce(msgs) {
  floaters = floaters.filter(f => f.life > 0.5); // evita solapar con textos recientes
  msgs.forEach((text, i) => {
    floaters.push({ text, x: COLS * BLOCK / 2, y: 190 + i * 28, life: 1, delay: i * 120 });
  });
}

// Chispas por el tablero (se omiten si el usuario prefiere poco movimiento)
function sparkle(n) {
  if (reducedMotion.matches) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 0.1 + Math.random() * 0.25;
    particles.push({
      x: Math.random() * COLS * BLOCK, y: BLOCK * 4 + Math.random() * (ROWS - 4) * BLOCK,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.1,
      ttl: 500 + Math.random() * 500, life: 1, size: 2 + Math.random() * 3,
      color: i % 2 ? comboColor : fxColors.bomb_alt,
    });
  }
}

// ---- Sonido: sintetizado con Web Audio (sin ficheros); el contexto se crea tras un gesto del usuario ----
let audioCtx = null, muted = false;
try { muted = localStorage.getItem('muted') === '1'; } catch (e) {}

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function tone(freq, start, dur, type = 'square', vol = 0.06) {
  const t0 = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function sfx(name, n = 0) {
  if (muted || !audioCtx) return;
  const note = k => 440 * Math.pow(2, k / 12);
  const up = Math.min(n, 12); // el combo sube el tono
  switch (name) {
    case 'rotate': tone(520, 0, 0.04, 'square', 0.025); break;
    case 'clear': [0, 4].forEach((k, i) => tone(note(k + up), i * 0.07, 0.12)); break;
    case 'tetris': [0, 4, 7, 12].forEach((k, i) => tone(note(k + up), i * 0.07, 0.15)); break;
    case 'tspin': [3, 7, 10, 15].forEach((k, i) => tone(note(k), i * 0.06, 0.14, 'sawtooth', 0.05)); break;
    case 'perfect': [0, 4, 7, 12, 16, 19, 24].forEach((k, i) => tone(note(k), i * 0.07, 0.25, 'triangle', 0.08)); break;
  }
}

function updateSoundBtn() {
  soundBtn.textContent = muted ? '🔇 Silencio' : '🔊 Sonido';
  soundBtn.setAttribute('aria-pressed', muted);
  soundBtn.setAttribute('aria-label', muted ? 'Activar sonido' : 'Silenciar sonido');
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  if (gy > current.y) lastMoveRotation = false;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveRotation = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  if (current.power) {
    // El efecto se aplica al terminar la animación (ver finishEffect)
    const { power: kind, x, y, axis } = current;
    effect = { kind, x, y, axis, t: 0, cells: powerTargets(kind, x, y, axis) };
    return;
  }
  const tspin = isTSpin();
  if (PENTOMINO_TYPES.includes(current.type)) score += PENTOMINO_BONUS;
  merge();
  clearLines(tspin);
  spawn();
}

function finishEffect() {
  const { kind, x, y, axis, cells } = effect;
  effect = null;
  burst(kind, x, y, cells);
  shakeLeft = SHAKE_MS[kind] || 0;
  applyPowerup(kind, x, y, axis);
  clearLines();
  spawn();
}

// Partículas en píxeles; vida en ms
function burst(kind, x, y, cells) {
  const colors = kind === 'bomb' ? [fxColors.bomb, fxColors.bomb_alt] : [fxColors[kind]];
  const spots = kind === 'freeze' ? [[y, x]] : cells;
  for (const [r, c] of spots) {
    const n = kind === 'bomb' ? 8 : 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (kind === 'bomb' ? 0.25 : 0.12) * (0.4 + Math.random());
      particles.push({
        x: (c + 0.5) * BLOCK, y: (r + 0.5) * BLOCK,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.05,
        ttl: 400 + Math.random() * 400, life: 1, size: 2 + Math.random() * 3,
        color: colors[i % colors.length],
      });
    }
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.0006 * dt;
    p.life -= dt / p.ttl;
  }
  particles = particles.filter(p => p.life > 0);
  for (const f of floaters) {
    if (f.delay > 0) { f.delay -= dt; continue; }
    f.life -= dt / FLOAT_MS;
    if (!reducedMotion.matches) f.y -= dt * 0.015;
  }
  floaters = floaters.filter(f => f.life > 0);
  shakeLeft = Math.max(0, shakeLeft - dt);
}

function spawn() {
  current = next;
  next = randomPiece();
  lastMoveRotation = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
  updatePowerupHUD();
}

function applyTheme(name) {
  theme = name === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  const css = getComputedStyle(document.documentElement);
  palette = theme === 'light' ? COLORS_LIGHT : COLORS;
  gridColor = css.getPropertyValue('--grid').trim();
  highlightColor = css.getPropertyValue('--highlight').trim();
  ghostAlpha = parseFloat(css.getPropertyValue('--ghost-alpha'));
  comboColor = css.getPropertyValue('--fx-combo').trim();
  powerColor = css.getPropertyValue('--powerup').trim();
  wildColor = css.getPropertyValue('--wild').trim();
  for (const k of ['bomb', 'bomb-alt', 'lightning', 'dye', 'gravity', 'freeze'])
    fxColors[k.replace('-', '_')] = css.getPropertyValue(`--fx-${k}`).trim();
  const isLight = theme === 'light';
  themeBtn.textContent = isLight ? '☾ Oscuro' : '☀ Claro';
  themeBtn.setAttribute('aria-pressed', isLight);
  themeBtn.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  // Repintar para que el cambio se vea también en pausa o game over
  if (current) { draw(); drawNext(); }
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  const parts = [];
  if (combo > 0) parts.push(`Combo x${combo + 1}`);
  if (backToBack) parts.push('B2B activo');
  const text = parts.join(' · ') || '—';
  if (comboEl.textContent !== text) comboEl.textContent = text;
}

function updatePowerupHUD() {
  let text;
  if (freezeLeft > 0) text = `❄ Congelado ${(freezeLeft / 1000).toFixed(1)}s`;
  else if (next && next.type === SINGLE_TYPE) text = 'Siguiente: 1×1 de regalo';
  else if (next && next.power) text = `Siguiente: ${POWERUPS[next.power].glyph} ${POWERUPS[next.power].name}`;
  else text = `Power-up en ${POWERUP_EVERY - (lines % POWERUP_EVERY)} líneas`;
  if (powerupEl.textContent !== text) powerupEl.textContent = text;
}

function glyphOf(piece) {
  return piece.power ? POWERUPS[piece.power].glyph : undefined;
}

function drawBlock(context, x, y, colorIndex, size, alpha, glyph) {
  if (!colorIndex) return;
  const color = colorIndex === POWER_TYPE ? powerColor
    : colorIndex === WILD_TYPE ? wildColor
    : palette[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = highlightColor;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (glyph) {
    context.fillStyle = '#000';
    context.font = `${size * 0.6}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

// Tiñe las celdas que el power-up va a destruir/transformar; más intenso y parpadeante al aplicarse
function drawTargets(kind, cells, progress) {
  const now = performance.now();
  let color = fxColors[kind];
  let alpha = 0.3 + 0.2 * Math.sin(now / 120);
  if (progress !== undefined) alpha = 0.5 + 0.5 * progress;
  if (kind === 'bomb' && Math.floor(now / 80) % 2) color = fxColors.bomb_alt; // llamas
  if (kind === 'lightning' && progress !== undefined && Math.floor(now / 50) % 2) {
    color = '#fff'; // destello eléctrico
  }
  ctx.fillStyle = color;
  ctx.globalAlpha = Math.min(1, alpha);
  for (const [r, c] of cells)
    ctx.fillRect(c * BLOCK + 1, r * BLOCK + 1, BLOCK - 2, BLOCK - 2);
  ctx.globalAlpha = 1;
}

function drawFloaters() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 22px sans-serif';
  ctx.lineWidth = 4;
  for (const f of floaters) {
    if (f.delay > 0) continue;
    ctx.globalAlpha = Math.min(1, f.life * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = comboColor;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// Escarcha sobre el tablero y barra de cuenta atrás mientras dura Congelar
function drawFrost() {
  ctx.fillStyle = fxColors.freeze;
  ctx.globalAlpha = 0.12 + 0.04 * Math.sin(performance.now() / 300);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalAlpha = 0.9;
  ctx.fillRect(0, 0, canvas.width * (freezeLeft / FREEZE_MS), 4);
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  if (shakeLeft > 0) {
    const m = 4 * Math.min(1, shakeLeft / 150);
    ctx.translate((Math.random() - 0.5) * 2 * m, (Math.random() - 0.5) * 2 * m);
  }
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // vista previa del efecto (en el punto de aterrizaje) o animación al aplicarse
  if (effect) {
    drawTargets(effect.kind, effect.cells, effect.t / EFFECT_MS);
  } else if (current.power && current.power !== 'freeze') {
    const py = ghostY();
    drawTargets(current.power, powerTargets(current.power, current.x, py, current.axis));
  }

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, ghostAlpha, glyphOf(current));

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK, 1, glyphOf(current));

  drawParticles();
  if (freezeLeft > 0) drawFrost();
  ctx.restore();
  drawFloaters();
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB, 1, glyphOf(next));
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  updateParticles(dt);
  if (effect) {
    effect.t += dt;
    if (effect.t >= EFFECT_MS) finishEffect();
    dropAccum = 0;
  } else if (freezeLeft > 0) {
    // Tiempo de juego: en pausa no corre porque el bucle está detenido
    freezeLeft = Math.max(0, freezeLeft - dt);
    dropAccum = 0;
    updatePowerupHUD();
  } else {
    dropAccum += dt;
  }
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveRotation = false;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  powerupsOwed = 0;
  singlesOwed = 0;
  powerupsGranted = 0;
  freezeLeft = 0;
  effect = null;
  particles = [];
  shakeLeft = 0;
  combo = -1;
  backToBack = false;
  lastMoveRotation = false;
  floaters = [];
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  ensureAudio(); // los navegadores exigen un gesto del usuario para iniciar el audio
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver || effect) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastMoveRotation = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastMoveRotation = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => { ensureAudio(); init(); });

soundBtn.addEventListener('click', () => {
  ensureAudio();
  muted = !muted;
  try { localStorage.setItem('muted', muted ? '1' : '0'); } catch (e) {}
  updateSoundBtn();
  soundBtn.blur(); // evita que Space (caída) reactive el botón
});
updateSoundBtn();

themeBtn.addEventListener('click', () => {
  const name = theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('theme', name); } catch (e) {}
  applyTheme(name);
  themeBtn.blur(); // evita que Space (caída) reactive el botón
});

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
applyTheme(savedTheme);

init();
