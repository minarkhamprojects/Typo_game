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

// Valor de cada letra según qué tan difícil es usarla en español (base Scrabble
// español). Letras comunes = 1; raras (X, Z, Ñ, J, Q, K, W) valen más.
const LETTER_VALUES = {
  A: 1, E: 1, O: 1, I: 1, S: 1, N: 1, R: 1, U: 1, L: 1, T: 1,
  D: 2, G: 2,
  C: 3, B: 3, M: 3, P: 3,
  H: 4, F: 4, V: 4, Y: 4,
  Q: 5, J: 5,
  Ñ: 8, X: 8, K: 8, W: 8,
  Z: 10,
};

function letterValue(ch) {
  return LETTER_VALUES[ch] || 1;
}

// Puntaje de una palabra = suma del valor de sus letras (dificultad de uso).
function scoreForWord(word) {
  let s = 0;
  for (const ch of word) s += letterValue(ch);
  return s;
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
      if (!found.has(word)) found.set(word, scoreForWord(word));
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

const VOWELS = new Set(["A", "E", "I", "O", "U"]);

function countVowels(grid) {
  let v = 0;
  for (const row of grid) for (const ch of row) if (VOWELS.has(ch)) v++;
  return v;
}

// Racha más larga de casillas del MISMO tipo (vocal o consonante) en línea recta
// (filas y columnas). Sirve para evitar tableros con muchas consonantes juntas.
function maxSameTypeRun(grid) {
  const rows = grid.length,
    cols = grid[0].length;
  const isV = (ch) => VOWELS.has(ch);
  let mx = 1;
  for (let r = 0; r < rows; r++) {
    let run = 1;
    for (let c = 1; c < cols; c++) {
      run = isV(grid[r][c]) === isV(grid[r][c - 1]) ? run + 1 : 1;
      if (run > mx) mx = run;
    }
  }
  for (let c = 0; c < cols; c++) {
    let run = 1;
    for (let r = 1; r < rows; r++) {
      run = isV(grid[r][c]) === isV(grid[r - 1][c]) ? run + 1 : 1;
      if (run > mx) mx = run;
    }
  }
  return mx;
}

// Genera un tablero jugable respetando el "rango de diseño":
//   minWords/maxWords     — cuántas palabras posibles debe tener (entretenido)
//   minVowels/maxVowels   — cuántas vocales hay en las 16 casillas
//   maxSameTypeRun        — máx. vocales o consonantes seguidas en fila/columna
// Reintenta hasta maxAttempts; si ninguno cumple minWords, devuelve el mejor
// candidato visto (para no dejar al jugador sin tablero).
function generatePlayableGrid(dict, opts = {}) {
  const rand = opts.rand || Math.random;
  const minWords = opts.minWords ?? 80;
  const maxWords = opts.maxWords ?? Infinity;
  const minVowels = opts.minVowels ?? 6;
  const maxVowels = opts.maxVowels ?? 9;
  const maxRun = opts.maxSameTypeRun ?? 3;
  const maxAttempts = opts.maxAttempts ?? 60;

  let best = null;
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    const grid = generateGrid(rand);
    const v = countVowels(grid);
    if (v < minVowels || v > maxVowels) continue;
    if (maxSameTypeRun(grid) > maxRun) continue;
    const solved = solveBoardWithDict(grid, dict);
    if (!best || solved.size > best.solved.size) best = { grid, solved, attempts };
    if (solved.size >= minWords && solved.size <= maxWords) {
      return { grid, solved, attempts };
    }
  }
  if (best) return best;
  const grid = generateGrid(rand);
  return { grid, solved: solveBoardWithDict(grid, dict), attempts };
}

// ——— Tableros temáticos: colocar palabras concretas en la cuadrícula ———

function shuffleInPlace(arr, rand) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

// Coloca `word` como un camino Boggle (8-adyacente, sin reusar celda dentro de la
// misma palabra). Puede pasar por celdas ya ocupadas si la letra coincide
// (palabras que comparten celdas). Devuelve el camino [[r,c],…] o null.
function placeWordInGrid(grid, word, rand = Math.random) {
  const size = grid.length;

  function dfs(i, r, c, used, path) {
    const cell = grid[r][c];
    if (cell !== "" && cell !== word[i]) return false;
    used[r][c] = true;
    path.push([r, c]);
    if (i === word.length - 1) return true;
    const dirs = shuffleInPlace(NEIGHBOR_OFFSETS.slice(), rand);
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      if (used[nr][nc]) continue;
      if (dfs(i + 1, nr, nc, used, path)) return true;
    }
    used[r][c] = false;
    path.pop();
    return false;
  }

  const starts = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (grid[r][c] === "" || grid[r][c] === word[0]) starts.push([r, c]);
  shuffleInPlace(starts, rand);

  for (const [sr, sc] of starts) {
    const used = Array.from({ length: size }, () => new Array(size).fill(false));
    const path = [];
    if (dfs(0, sr, sc, used, path)) return path;
  }
  return null;
}

function fillEmptyCells(grid, rand = Math.random) {
  const pool = buildLetterPool();
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c < grid[r].length; c++)
      if (grid[r][c] === "") grid[r][c] = pickLetter(pool, rand);
}

// Genera un tablero que contiene al menos `secretCount` palabras del tema.
// Coloca palabras (cortas primero) hasta llegar a la meta, rellena el resto y
// resuelve. Devuelve { grid, secretWords, solved } o null si no lo logró.
function generateThemedGrid(dict, candidateWords, opts = {}) {
  const rand = opts.rand || Math.random;
  const size = opts.size || GRID_SIZE;
  const target = opts.secretCount || 5;
  const maxAttempts = opts.maxAttempts || 140;

  const pool = candidateWords.filter(
    (w) => w.length >= MIN_WORD_LEN && w.length <= size * size && dict.has(w)
  );
  if (pool.length < target) return null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const grid = Array.from({ length: size }, () => new Array(size).fill(""));
    const words = shuffleInPlace(pool.slice(), rand).sort((a, b) => a.length - b.length);
    const placed = [];
    for (const w of words) {
      if (placed.length >= target) break;
      if (placed.some((p) => p.word === w)) continue;
      const path = placeWordInGrid(grid, w, rand);
      if (path) {
        for (let k = 0; k < path.length; k++) grid[path[k][0]][path[k][1]] = w[k];
        placed.push({ word: w, path });
      }
    }
    if (placed.length >= target) {
      fillEmptyCells(grid, rand);
      const solved = solveBoardWithDict(grid, dict);
      return {
        grid,
        secretWords: placed.slice(0, target).map((p) => p.word),
        solved,
        attempts: attempt + 1,
      };
    }
  }
  return null;
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
  LETTER_VALUES,
  letterValue,
  scoreForWord,
  isValidPath,
  wordFromPath,
  solveBoard,
  solveBoardWithDict,
  generatePlayableGrid,
  countVowels,
  maxSameTypeRun,
  placeWordInGrid,
  generateThemedGrid,
};

if (typeof module !== "undefined") module.exports = api;
if (typeof window !== "undefined") window.TypoEngine = api;
