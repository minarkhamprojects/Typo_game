// Motor puro del juego: generación de grid, diccionario, trie, resolver y puntaje.
// Sin dependencias del DOM para poder probarse en Node.

const GRID_SIZE = 4;
const MIN_WORD_LEN = 3;

// Frecuencia aproximada de letras en español (para generar tableros jugables)
const LETTER_FREQ = {
  E: 13.68, A: 12.53, O: 8.68, S: 7.98, R: 6.87, N: 6.71, I: 6.25, D: 5.86,
  L: 4.97, C: 4.68, T: 4.63, U: 3.93, M: 3.15, P: 2.51, B: 1.42, G: 1.01,
  V: 0.90, Y: 0.90, Q: 0.88, H: 0.70, F: 0.69, Z: 0.52, J: 0.44, Ñ: 0.31,
  X: 0.22, W: 0.02, K: 0.01,
};

function buildLetterPool() {
  const letters = Object.keys(LETTER_FREQ);
  const weights = letters.map((l) => LETTER_FREQ[l]);
  const total = weights.reduce((a, b) => a + b, 0);
  const cumulative = [];
  let acc = 0;
  for (const w of weights) {
    acc += w / total;
    cumulative.push(acc);
  }
  return { letters, cumulative };
}

function pickLetter(pool, rand) {
  const r = rand();
  for (let i = 0; i < pool.cumulative.length; i++) {
    if (r <= pool.cumulative[i]) return pool.letters[i];
  }
  return pool.letters[pool.letters.length - 1];
}

function generateGrid(rand = Math.random, size = GRID_SIZE) {
  const pool = buildLetterPool();
  const grid = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) {
      row.push(pickLetter(pool, rand));
    }
    grid.push(row);
  }
  return grid;
}

function parseDictionary(rawText) {
  const set = new Set();
  for (const line of rawText.split("\n")) {
    const w = line.trim();
    if (w.length >= MIN_WORD_LEN) set.add(w);
  }
  return set;
}

function buildTrie(wordSet) {
  const root = {};
  for (const word of wordSet) {
    let node = root;
    for (const ch of word) {
      node = node[ch] || (node[ch] = {});
    }
    node.end = true;
  }
  return root;
}

function scoreForLength(length) {
  if (length <= 4) return 1;
  if (length === 5) return 2;
  if (length === 6) return 3;
  if (length === 7) return 5;
  if (length === 8) return 11;
  return 11 + (length - 8) * 3;
}

const NEIGHBOR_OFFSETS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

function isValidPath(grid, path) {
  if (path.length < MIN_WORD_LEN) return false;
  const seen = new Set();
  for (let i = 0; i < path.length; i++) {
    const [r, c] = path[i];
    if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length) return false;
    const key = r + "," + c;
    if (seen.has(key)) return false;
    seen.add(key);
    if (i > 0) {
      const [pr, pc] = path[i - 1];
      if (Math.abs(pr - r) > 1 || Math.abs(pc - c) > 1) return false;
    }
  }
  return true;
}

function wordFromPath(grid, path) {
  return path.map(([r, c]) => grid[r][c]).join("");
}

// Resuelve el tablero completo usando el trie para podar caminos inválidos.
function solveBoard(grid, trie) {
  const rows = grid.length;
  const cols = grid[0].length;
  const found = new Map(); // word -> score
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const chars = [];

  function dfs(r, c, node) {
    const letter = grid[r][c];
    const child = node[letter];
    if (!child) return;
    chars.push(letter);
    if (child.end && chars.length >= MIN_WORD_LEN) {
      const word = chars.join("");
      if (!found.has(word)) found.set(word, scoreForLength(word.length));
    }
    visited[r][c] = true;
    for (const [dr, dc] of NEIGHBOR_OFFSETS) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !visited[nr][nc]) {
        dfs(nr, nc, child);
      }
    }
    visited[r][c] = false;
    chars.pop();
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dfs(r, c, trie);
    }
  }

  return found;
}

// Genera un tablero jugable: reintenta si tiene muy pocas palabras posibles.
function generatePlayableGrid(trie, opts = {}) {
  const rand = opts.rand || Math.random;
  const minWords = opts.minWords ?? 60;
  const maxAttempts = opts.maxAttempts ?? 5;
  let grid = generateGrid(rand);
  let solved = solveBoard(grid, trie);
  let attempts = 1;
  while (solved.size < minWords && attempts < maxAttempts) {
    grid = generateGrid(rand);
    solved = solveBoard(grid, trie);
    attempts++;
  }
  return { grid, solved, attempts };
}

const api = {
  GRID_SIZE,
  MIN_WORD_LEN,
  LETTER_FREQ,
  generateGrid,
  parseDictionary,
  buildTrie,
  scoreForLength,
  isValidPath,
  wordFromPath,
  solveBoard,
  generatePlayableGrid,
};

if (typeof module !== "undefined") module.exports = api;
if (typeof window !== "undefined") window.TypoEngine = api;
