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

// Modo desafío: cada reto añade un objetivo (líneas y/o tiempo) y una regla especial.
// timeLimit (ms): cuenta atrás; si `survive`, llegar a 0 es victoria, si no es derrota.
// garbageEvery (ms): sube una fila de basura con un hueco. presetRows: filas iniciales pre-colocadas.
// invisible: los bloques fijados se ocultan salvo un instante tras fijar. levelBase: niveles extra de partida.
// reverseLevel: a partir de ese nivel la rotación es antihoraria.
const CHALLENGES = {
  classic:   { name: 'Clásico' },
  sprint:    { name: '40 líneas en 2:00', goalLines: 40, timeLimit: 120000 },
  garbage:   { name: 'Basura cada 10 s', timeLimit: 90000, survive: true, garbageEvery: 10000 },
  preset:    { name: 'Tablero pre-colocado', goalLines: 15, presetRows: 6 },
  invisible: { name: 'Piezas invisibles', goalLines: 10, invisible: true },
  reverse:   { name: 'Rotación inversa', goalLines: 20, levelBase: 5, reverseLevel: 7 },
};
const GARBAGE_TYPE = 8;     // las filas de basura reutilizan el color de la tuerca
const PRESET_FILL = 0.7;    // probabilidad de celda ocupada en el tablero pre-colocado
const REVEAL_MS = 600;      // cuánto se ven los bloques tras fijar una pieza en el modo invisible

// Habilidades cargables: limpiar líneas llena la barra de energía; con la barra llena, `E` abre el menú y se elige UNA habilidad.
// Todas vacían la barra salvo "Ver siguientes", que la usa como reserva: baja ENERGY_PEEK_DRAIN por pieza hasta agotarse.
const ENERGY_MAX = 100;
const ENERGY_GAIN = [0, 10, 25, 40, 60];   // por líneas limpiadas a la vez
const ENERGY_TSPIN = 15;
const ENERGY_PERFECT = 50;
const ENERGY_PEEK_DRAIN = 10;
const PEEK_COUNT = 5;       // next + 4 piezas más en la vista previa
const SLOW_MS = 10000;
const SLOW_FACTOR = 2;      // multiplica el intervalo de caída mientras dura Ralentizar
const ABILITIES = [
  { id: 'peek', name: 'Ver siguientes 5 piezas' },
  { id: 'swap', name: 'Cambiar pieza actual por otra al azar' },
  { id: 'slow', name: 'Ralentizar tiempo 10 s' },
  { id: 'undo', name: 'Deshacer última colocación' },
  { id: 'hold', name: 'Reservar pieza (extra)' },
];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const queueCanvas = document.getElementById('queue-canvas');
const queueCtx = queueCanvas.getContext('2d');
const queueSection = document.getElementById('queue-section');
const energyBar = document.getElementById('energy-bar');
const energyFill = document.getElementById('energy-fill');
const abilityStatusEl = document.getElementById('ability-status');
const abilityMenu = document.getElementById('ability-menu');
const abilityList = document.getElementById('ability-list');
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
const modeSelect = document.getElementById('mode-select');
const goalEl = document.getElementById('challenge-goal');
const timerEl = document.getElementById('challenge-timer');

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
// Hold: tipo de pieza reservada (null = vacío) y si ya se usó con la pieza actual
let held, holdUsed;
// Habilidades: energía, vista previa activa (queue = piezas tras `next`), ralentización restante (ms),
// instantánea previa a la última colocación (para Deshacer) y si el menú está abierto
let energy, peekActive, queue, slowLeft, snapshot, menuOpen = false;
let combo, backToBack, lastMoveRotation, floaters;
// Desafío: modo activo, tiempo transcurrido, acumulador de basura y tiempo restante de visibilidad (modo invisible)
let mode = 'classic', challengeElapsed, garbageAccum, revealLeft;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

const challenge = () => CHALLENGES[mode];
const levelFor = n => Math.floor(n / 10) + 1 + (challenge().levelBase || 0);
const dropFor = lvl => Math.max(100, 1000 - (lvl - 1) * 90);
const reverseActive = () => !!challenge().reverseLevel && level >= challenge().reverseLevel;

// Bloques fijos iniciales: cada fila con huecos aleatorios (nunca completa)
function fillPreset(rows) {
  for (let r = ROWS - rows; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++)
      if (Math.random() < PRESET_FILL) board[r][c] = Math.floor(Math.random() * (NUT_TYPE - 1)) + 1;
    if (board[r].every(v => v)) board[r][Math.floor(Math.random() * COLS)] = 0;
  }
}

// Sube el tablero una fila e inserta basura con un hueco; devuelve false si no cabe
function addGarbage() {
  if (board[0].some(v => v)) return false;
  const hole = Math.floor(Math.random() * COLS);
  board.shift();
  board.push(Array.from({ length: COLS }, (_, c) => (c === hole ? 0 : GARBAGE_TYPE)));
  while (collide(current.shape, current.x, current.y) && current.y > 0) current.y--;
  return !collide(current.shape, current.x, current.y);
}

function formatTime(ms) {
  const t = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// Avanza los relojes del desafío (solo cuando la partida corre: no en pausa, animación ni congelación)
function tickChallenge(dt) {
  const cfg = challenge();
  challengeElapsed += dt;
  if (cfg.garbageEvery) {
    garbageAccum += dt;
    if (garbageAccum >= cfg.garbageEvery) {
      garbageAccum -= cfg.garbageEvery;
      if (!addGarbage()) { endGame(); return; }
      sfx('rotate');
    }
  }
  if (cfg.timeLimit && challengeElapsed >= cfg.timeLimit) {
    if (cfg.survive) winGame('¡SOBREVIVISTE!'); else endGame('TIEMPO AGOTADO');
    return;
  }
  updateChallengeHUD();
}

function updateChallengeHUD() {
  const cfg = challenge();
  let goal = '—', timer = '—';
  if (cfg.goalLines) goal = `Líneas ${Math.min(lines, cfg.goalLines)}/${cfg.goalLines}`;
  else if (cfg.survive) goal = 'Sobrevive';
  if (reverseActive()) goal += ' · Rotación inversa';
  if (cfg.timeLimit) timer = `⏱ ${formatTime(cfg.timeLimit - challengeElapsed)}`;
  if (cfg.garbageEvery) timer += ` · Basura en ${Math.ceil((cfg.garbageEvery - garbageAccum) / 1000)}s`;
  if (goalEl.textContent !== goal) goalEl.textContent = goal;
  if (timerEl.textContent !== timer) timerEl.textContent = timer;
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
  return randomNormalPiece();
}

// Pieza normal al azar (tetromino, tuerca o pentominó); no consume power-ups ni regalos pendientes
function randomNormalPiece() {
  const roll = Math.random();
  const type = roll < NUT_CHANCE ? NUT_TYPE
    : roll < NUT_CHANCE + PENTOMINO_CHANCE
      ? PENTOMINO_TYPES[Math.floor(Math.random() * PENTOMINO_TYPES.length)]
      : Math.floor(Math.random() * (NUT_TYPE - 1)) + 1;
  return makePiece(type);
}

// Pieza nueva (sin rotar) en la posición de spawn
function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

// Reserva la pieza actual (o la intercambia con la reservada); una vez por pieza.
// Power-ups y 1×1 de regalo no se pueden reservar.
// `force` (habilidad "Reservar") ignora el límite de una vez por pieza. Devuelve si se reservó.
function hold(force = false) {
  if ((holdUsed && !force) || current.power || current.type === SINGLE_TYPE) return false;
  const type = current.type;
  if (held == null) {
    held = type;
    spawn();
  } else {
    current = makePiece(held);
    held = type;
    lastMoveRotation = false;
    if (collide(current.shape, current.x, current.y)) endGame();
  }
  holdUsed = true;
  drawHold();
  return true;
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

function rotateCCW(shape) {
  return rotateCW(rotateCW(rotateCW(shape)));
}

function tryRotate() {
  const rotated = reverseActive() ? rotateCCW(current.shape) : rotateCW(current.shape);
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
      if (!peekActive) energy = Math.min(ENERGY_MAX, energy + ENERGY_TSPIN);
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
  let gained = ENERGY_GAIN[cleared] + (tspin ? ENERGY_TSPIN : 0);
  const prevLevel = level;
  level = levelFor(lines);
  const rev = challenge().reverseLevel;
  if (rev && prevLevel < rev && level >= rev) msgs.push('ROTACIÓN INVERSA');
  const due = Math.floor(lines / POWERUP_EVERY);
  powerupsOwed += due - powerupsGranted;
  powerupsGranted = due;
  dropInterval = dropFor(level);

  const perfect = board.every(row => row.every(v => v === 0));
  if (perfect) {
    score += PERFECT_CLEAR_SCORE * level;
    msgs.push('PERFECT CLEAR!');
    gained += ENERGY_PERFECT;
  }

  // Mientras la vista previa gasta la barra no se recarga
  if (!peekActive) {
    const wasFull = energy >= ENERGY_MAX;
    energy = Math.min(ENERGY_MAX, energy + gained);
    if (!wasFull && energy >= ENERGY_MAX) msgs.push('¡ENERGÍA LISTA! (E)');
  }

  if (msgs.length) announce(msgs);
  sfx(perfect ? 'perfect' : tspin ? 'tspin' : hard ? 'tetris' : 'clear', combo);
  if (perfect || hard || combo > 0) sparkle(perfect ? 60 : 24 + combo * 6);
  updateHUD();
  const goal = challenge().goalLines;
  if (goal && lines >= goal) winGame('¡RETO SUPERADO!');
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

// Estado previo a fijar la pieza actual, para la habilidad Deshacer (la energía no se restaura: ya se gastó)
function takeSnapshot() {
  const { type, power, axis } = current;
  const piece = power
    ? { type, power, axis, shape: [[POWER_TYPE]], x: Math.floor(COLS / 2), y: 0 }
    : type === SINGLE_TYPE
      ? { type, shape: [[SINGLE_TYPE]], x: Math.floor(COLS / 2), y: 0 }
      : makePiece(type);
  snapshot = {
    board: board.map(row => [...row]), piece, next, queue: [...queue],
    score, lines, level, combo, backToBack, held, holdUsed, freezeLeft,
    powerupsOwed, powerupsGranted, singlesOwed,
  };
}

function lockPiece() {
  takeSnapshot();
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
  revealLeft = Math.max(0, revealLeft - dt);
}

function spawn() {
  current = next;
  next = queue.length ? queue.shift() : randomPiece();
  if (peekActive) {
    energy -= ENERGY_PEEK_DRAIN;
    if (energy <= 0) {
      energy = 0;
      peekActive = false;
      // Las piezas ya vistas se conservan; solo dejan de generarse por adelantado
    } else {
      fillQueue();
    }
  }
  lastMoveRotation = false;
  holdUsed = false;
  revealLeft = REVEAL_MS;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
  drawHold();
  drawQueue();
  updatePowerupHUD();
}

// ---- Habilidades ----
function fillQueue() {
  while (queue.length < PEEK_COUNT - 1) queue.push(randomPiece());
}

// ¿Se puede usar ahora? Con un power-up animándose (`effect`) la pieza actual ya no se puede tocar.
function abilityAvailable(id) {
  switch (id) {
    case 'peek': return !peekActive;
    case 'swap': return !effect && !current.power && current.type !== SINGLE_TYPE;
    case 'slow': return true;
    case 'undo': return !!snapshot;
    case 'hold': return !effect && !current.power && current.type !== SINGLE_TYPE;
  }
  return false;
}

function canOpenAbilityMenu() {
  return energy >= ENERGY_MAX && !peekActive && !menuOpen && !paused && !gameOver;
}

function openAbilityMenu() {
  abilityList.replaceChildren();
  ABILITIES.forEach((ab, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.tabIndex = -1;
    btn.textContent = `${i + 1}. ${ab.name}`;
    btn.disabled = !abilityAvailable(ab.id);
    btn.addEventListener('click', () => chooseAbility(i));
    abilityList.appendChild(btn);
  });
  menuOpen = true;
  paused = true;
  cancelAnimationFrame(animId);
  abilityMenu.classList.remove('hidden');
}

function closeAbilityMenu() {
  if (!menuOpen) return;
  menuOpen = false;
  abilityMenu.classList.add('hidden');
  if (gameOver) return;
  paused = false;
  lastTime = performance.now();
  loop(lastTime);
}

function chooseAbility(i) {
  const ab = ABILITIES[i];
  if (!ab || !abilityAvailable(ab.id)) return;
  switch (ab.id) {
    case 'peek':
      peekActive = true;   // la barra se queda y se va gastando por pieza
      fillQueue();
      break;
    case 'swap': {
      // Pieza al azar distinta en tipo a la actual; si choca con el tablero se conserva la actual
      let piece;
      do piece = randomNormalPiece(); while (piece.type === current.type);
      if (collide(piece.shape, piece.x, piece.y)) return;
      current = piece;
      lastMoveRotation = false;
      energy = 0;
      break;
    }
    case 'slow':
      slowLeft = SLOW_MS;
      energy = 0;
      break;
    case 'undo':
      undoPlacement();
      energy = 0;
      break;
    case 'hold':
      if (!hold(true)) return;
      energy = 0;
      break;
  }
  sfx('clear');
  announce([{ peek: 'VISTA PREVIA', swap: 'CAMBIO', slow: 'TIEMPO LENTO', undo: 'DESHECHO', hold: 'RESERVA' }[ab.id]]);
  drawNext();
  drawQueue();
  updateHUD();
  closeAbilityMenu();
}

function undoPlacement() {
  const s = snapshot;
  snapshot = null;
  effect = null;
  board = s.board;
  current = s.piece;
  next = s.next;
  queue = s.queue;
  ({ score, lines, level, combo, backToBack, held, holdUsed, freezeLeft,
     powerupsOwed, powerupsGranted, singlesOwed } = s);
  dropInterval = dropFor(level);
  dropAccum = 0;
  lastMoveRotation = false;
  revealLeft = REVEAL_MS;
  drawHold();
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
  if (current) { draw(); drawNext(); drawHold(); drawQueue(); }
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  updateChallengeHUD();
  const parts = [];
  if (combo > 0) parts.push(`Combo x${combo + 1}`);
  if (backToBack) parts.push('B2B activo');
  const text = parts.join(' · ') || '—';
  if (comboEl.textContent !== text) comboEl.textContent = text;
  updateAbilityHUD();
}

function updateAbilityHUD() {
  const pct = Math.round(energy / ENERGY_MAX * 100);
  energyFill.style.width = `${pct}%`;
  energyBar.classList.toggle('full', energy >= ENERGY_MAX && !peekActive);
  energyBar.setAttribute('aria-valuenow', pct);
  const parts = [];
  if (peekActive) parts.push('Vista previa activa');
  else if (energy >= ENERGY_MAX) parts.push('¡Lista! Pulsa E');
  if (slowLeft > 0) parts.push(`🐌 Lento ${(slowLeft / 1000).toFixed(1)}s`);
  const text = parts.join(' · ') || `${pct}%`;
  if (abilityStatusEl.textContent !== text) abilityStatusEl.textContent = text;
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

  // board (en el modo invisible solo se ve un instante tras fijar una pieza)
  const boardAlpha = challenge().invisible ? revealLeft / REVEAL_MS : 1;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK, boardAlpha);

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

// Dibuja la pieza centrada en una caja 4×4 cuya esquina está en la celda (cx, cy) de tamaño `size`
function drawPreview(context, cvs, piece, size = 30, cx = 0, cy = 0, clear = true) {
  if (clear) context.clearRect(0, 0, cvs.width, cvs.height);
  if (!piece) return;
  const shape = piece.shape;
  const offX = cx + Math.floor((4 - shape[0].length) / 2);
  const offY = cy + Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], size, 1, glyphOf(piece));
}

// Piezas tras `next` (2×2 cajas de 4×4 a media escala); la sección se oculta si no hay ninguna
function drawQueue() {
  queueSection.hidden = !queue.length;
  queueCtx.clearRect(0, 0, queueCanvas.width, queueCanvas.height);
  queue.slice(0, 4).forEach((p, i) =>
    drawPreview(queueCtx, queueCanvas, p, 15, (i % 2) * 4, Math.floor(i / 2) * 4, false));
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, next);
}

// El slot se atenúa (.locked) mientras el hold está bloqueado en este turno
function drawHold() {
  drawPreview(holdCtx, holdCanvas, held == null ? null : makePiece(held));
  holdCanvas.classList.toggle('locked', !!holdUsed);
}

function endGame(title = 'GAME OVER') {
  if (gameOver) return;
  gameOver = true;
  cancelAnimationFrame(animId);
  overlay.classList.remove('win');
  overlayTitle.textContent = title;
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function winGame(title) {
  if (gameOver) return;
  gameOver = true;
  cancelAnimationFrame(animId);
  const secs = (challengeElapsed / 1000).toFixed(1);
  overlay.classList.add('win');
  overlayTitle.textContent = title;
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()} · ${secs}s`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver || menuOpen) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlay.classList.remove('win');
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  updateParticles(dt);
  if (slowLeft > 0 && !effect) {
    slowLeft = Math.max(0, slowLeft - dt);
    updateAbilityHUD();
  }
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
    tickChallenge(dt);
  }
  if (gameOver) { draw(); return; }
  if (dropAccum >= dropInterval * (slowLeft > 0 ? SLOW_FACTOR : 1)) {
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
  if (challenge().presetRows) fillPreset(challenge().presetRows);
  score = 0;
  lines = 0;
  level = levelFor(0);
  paused = false;
  gameOver = false;
  dropInterval = dropFor(level);
  challengeElapsed = 0;
  garbageAccum = 0;
  revealLeft = REVEAL_MS;
  dropAccum = 0;
  lastTime = performance.now();
  powerupsOwed = 0;
  singlesOwed = 0;
  held = null;
  holdUsed = false;
  powerupsGranted = 0;
  freezeLeft = 0;
  effect = null;
  particles = [];
  shakeLeft = 0;
  combo = -1;
  backToBack = false;
  lastMoveRotation = false;
  floaters = [];
  energy = 0;
  peekActive = false;
  queue = [];
  slowLeft = 0;
  snapshot = null;
  menuOpen = false;
  abilityMenu.classList.add('hidden');
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  ensureAudio(); // los navegadores exigen un gesto del usuario para iniciar el audio
  if (menuOpen) {
    // Con el menú abierto solo se elige habilidad (1-5) o se cancela
    const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) chooseAbility(Number(m[1]) - 1);
    else if (e.code === 'KeyE' || e.code === 'Escape') closeAbilityMenu();
    return;
  }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyE' && canOpenAbilityMenu()) { openAbilityMenu(); return; }
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
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      hold();
      break;
  }
  updateHUD();
});

for (const [key, cfg] of Object.entries(CHALLENGES)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = cfg.name;
  modeSelect.appendChild(opt);
}
try {
  const saved = localStorage.getItem('mode');
  if (saved in CHALLENGES) mode = saved;
} catch (e) {}
modeSelect.value = mode;

modeSelect.addEventListener('change', () => {
  mode = modeSelect.value;
  try { localStorage.setItem('mode', mode); } catch (e) {}
  modeSelect.blur(); // evita que las flechas/Space cambien el modo mientras se juega
  ensureAudio();
  init();
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
