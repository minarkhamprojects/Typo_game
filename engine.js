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

// Diccionario liviano: guarda el texto ordenado (una palabra por línea, en
// MAYÚSCULAS) y un índice de offsets de inicio de línea. Validar es búsqueda
// binaria O(log n); no construimos un Set ni un trie gigante en memoria.
// Con ~636k palabras esto ocupa ~15 MB en vez de ~80-110 MB.
function makeDictionary(rawText) {
  const text = rawText;
  const n = text.length;
  const offsets = [0];
  for (let i = 0; i < n; i++) {
    if (text.charCodeAt(i) === 10) offsets.push(i + 1);
  }
  // Descarta un posible offset vacío final (texto terminado en \n).
  if (offsets[offsets.length - 1] >= n) offsets.pop();
  const count = offsets.length;

  function wordAt(idx) {
    const start = offsets[idx];
    let end = idx + 1 < count ? offsets[idx + 1] - 1 : n;
    return text.slice(start, end);
  }

  function has(word) {
    let lo = 0;
    let hi = count - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const w = wordAt(mid);
      if (w === word) return true;
      if (w < word) lo = mid + 1;
      else hi = mid - 1;
    }
    return false;
  }

  // Palabras del diccionario cuyas letras caben en el multiconjunto del tablero
  // (avail: mapa charCode -> cantidad). Recorre el texto sin trocearlo entero.
  function subsetForBoard(avail) {
    const out = [];
    let start = 0;
    while (start < n) {
      let end = text.indexOf("\n", start);
      if (end === -1) end = n;
      const wlen = end - start;
      if (wlen >= MIN_WORD_LEN) {
        const cnt = {};
        let ok = true;
        for (let i = start; i < end; i++) {
          const code = text.charCodeAt(i);
          cnt[code] = (cnt[code] || 0) + 1;
          if (cnt[code] > (avail[code] || 0)) {
            ok = false;
            break;
          }
        }
        if (ok) out.push(text.slice(start, end));
      }
      start = end + 1;
    }
    return out;
  }

  return { has, subsetForBoard, count, wordAt };
}

// Cuenta las letras del tablero como mapa charCode -> cantidad.
function boardLetterCounts(grid) {
  const avail = {};
  for (const row of grid) {
    for (const ch of row) {
      const code = ch.charCodeAt(0);
      avail[code] = (avail[code] || 0) + 1;
    }
  }
  return avail;
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

// Resuelve un tablero usando el diccionario: filtra las palabras que caben en
// las letras del tablero, arma un mini-trie con ellas (pequeño y rápido) y hace
// la búsqueda DFS. Devuelve un Map palabra -> puntaje.
function solveBoardWithDict(grid, dict) {
  const subset = dict.subsetForBoard(boardLetterCounts(grid));
  const miniTrie = buildTrie(subset);
  return solveBoard(grid, miniTrie);
}

// Genera un tablero jugable: reintenta si tiene muy pocas palabras posibles.
function generatePlayableGrid(dict, opts = {}) {
  const rand = opts.rand || Math.random;
  const minWords = opts.minWords ?? 60;
  const maxAttempts = opts.maxAttempts ?? 20;
  let grid = generateGrid(rand);
  let solved = solveBoardWithDict(grid, dict);
  let attempts = 1;
  while (solved.size < minWords && attempts < maxAttempts) {
    grid = generateGrid(rand);
    solved = solveBoardWithDict(grid, dict);
    attempts++;
  }
  return { grid, solved, attempts };
}

const api = {
  GRID_SIZE,
  MIN_WORD_LEN,
  LETTER_FREQ,
  generateGrid,
  makeDictionary,
  boardLetterCounts,
  buildTrie,
  scoreForLength,
  isValidPath,
  wordFromPath,
  solveBoard,
  solveBoardWithDict,
  generatePlayableGrid,
};

if (typeof module !== "undefined") module.exports = api;
if (typeof window !== "undefined") window.TypoEngine = api;
