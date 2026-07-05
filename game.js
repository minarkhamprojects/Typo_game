(function () {
  const testSeconds = Number(new URLSearchParams(window.location.search).get("t"));
  const GAME_SECONDS = testSeconds > 0 ? testSeconds : 90;
  const WARN_SECONDS = 10;

  const gridEl = document.getElementById("grid");
  const gridWrapEl = document.getElementById("grid-wrap");
  const overlayEl = document.getElementById("path-overlay");
  const pathLineEl = document.getElementById("path-line");
  const muteBtn = document.getElementById("mute-btn");
  const rotateBtn = document.getElementById("rotate-btn");
  const hapticSwitch = document.getElementById("haptic-switch");
  const timerEl = document.getElementById("timer");
  const scoreEl = document.getElementById("score");
  const wordCountEl = document.getElementById("word-count");
  const currentWordEl = document.getElementById("current-word");
  const foundListEl = document.getElementById("found-list");
  const startBtn = document.getElementById("start-btn");
  const newBoardBtn = document.getElementById("new-board-btn");
  const hintEl = document.getElementById("hint");
  const summaryOverlay = document.getElementById("summary-overlay");
  const finalScoreEl = document.getElementById("final-score");
  const finalDetailsEl = document.getElementById("final-details");
  const missedListEl = document.getElementById("missed-list");
  const playAgainBtn = document.getElementById("play-again-btn");

  const dictionary = TypoEngine.makeDictionary(WORDS_ES_RAW);

  let grid = [];
  let solved = new Map();
  let foundWords = new Map(); // word -> score
  let path = []; // array of [r, c]
  let dragging = false;
  let state = "idle"; // idle | playing | ended
  let timeLeft = GAME_SECONDS;
  let timerHandle = null;

  function vibrate(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    } else if (hapticSwitch) {
      // iOS Safari no tiene navigator.vibrate; togglear un switch nativo
      // produce un tick háptico en iOS 17.4+ (best-effort, no-op si Apple
      // exige interacción manual).
      hapticSwitch.checked = !hapticSwitch.checked;
    }
  }

  // --- Sonido retro sintetizado (Web Audio, sin archivos externos) ---
  let audioCtx = null;
  let muted = localStorage.getItem("typo-muted") === "1";

  function initAudio() {
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }

  function tone(freq, startIn, duration, type, volume) {
    if (!audioCtx || muted) return;
    const t = audioCtx.currentTime + startIn;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration);
  }

  function playKeyClick() {
    // Click mecánico corto con tono levemente variable para no sonar a metralleta
    tone(1400 + Math.random() * 500, 0, 0.035, "square", 0.06);
  }

  function playSuccess() {
    tone(523, 0, 0.09, "triangle", 0.22); // do
    tone(659, 0.08, 0.09, "triangle", 0.22); // mi
    tone(784, 0.16, 0.14, "triangle", 0.22); // sol
  }

  function playDup() {
    tone(440, 0, 0.12, "triangle", 0.18);
    tone(440, 0.13, 0.12, "triangle", 0.14);
  }

  function playFail() {
    tone(160, 0, 0.16, "sawtooth", 0.16);
    tone(120, 0.1, 0.2, "sawtooth", 0.14);
  }

  function playWarnTick() {
    tone(880, 0, 0.06, "square", 0.14);
  }

  function updateMuteBtn() {
    muteBtn.textContent = muted ? "🔇" : "🔊";
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function cellAt(r, c) {
    return gridEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  }

  function renderGrid() {
    gridEl.innerHTML = "";
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.textContent = grid[r][c];
        gridEl.appendChild(cell);
      }
    }
  }

  function renderPath() {
    const currentWord = path.length ? TypoEngine.wordFromPath(grid, path) : "";

    gridEl.querySelectorAll(".cell").forEach((el) => {
      el.classList.remove("selected");
      const badge = el.querySelector(".order-badge");
      if (badge) badge.remove();
    });
    path.forEach(([r, c], i) => {
      const el = cellAt(r, c);
      if (!el) return;
      el.classList.add("selected");
      const badge = document.createElement("span");
      badge.className = "order-badge";
      badge.textContent = String(i + 1);
      el.appendChild(badge);
    });
    renderLine();
    currentWordEl.textContent = path.length
      ? TypoEngine.wordFromPath(grid, path)
      : " ";
  }

  function renderLine() {
    overlayEl.setAttribute("viewBox", `0 0 ${gridEl.offsetWidth} ${gridEl.offsetHeight}`);
    const points = path
      .map(([r, c]) => {
        const el = cellAt(r, c);
        if (!el) return null;
        return `${el.offsetLeft + el.offsetWidth / 2},${el.offsetTop + el.offsetHeight / 2}`;
      })
      .filter(Boolean)
      .join(" ");
    pathLineEl.setAttribute("points", points);
  }

  function flashResult(cells, className) {
    cells.forEach(([r, c]) => {
      const el = cellAt(r, c);
      if (el) el.classList.add(className);
    });
    setTimeout(() => {
      cells.forEach(([r, c]) => {
        const el = cellAt(r, c);
        if (el) el.classList.remove(className);
      });
    }, 350);
  }

  function renderFoundList() {
    foundListEl.innerHTML = "";
    for (const [word, pts] of foundWords.entries()) {
      const li = document.createElement("li");
      li.dataset.word = word;
      li.textContent = word;
      const span = document.createElement("span");
      span.className = "pts";
      span.textContent = `+${pts}`;
      li.appendChild(span);
      foundListEl.appendChild(li);
    }
  }

  function totalScore() {
    let sum = 0;
    for (const pts of foundWords.values()) sum += pts;
    return sum;
  }

  function updateStats() {
    scoreEl.textContent = String(totalScore());
    wordCountEl.textContent = String(foundWords.size);
    timerEl.textContent = formatTime(timeLeft);
    timerEl.classList.toggle(
      "warning",
      state === "playing" && timeLeft <= WARN_SECONDS
    );
  }

  // Fracción del semilado de la celda (desde el centro) que cuenta como acierto.
  // Al arrastrar exigimos estar cerca del centro para no seleccionar celdas
  // vecinas por rozar sus bordes; al iniciar (strict=false) somos permisivos.
  const HIT_RATIO = 0.6;

  function cellFromPoint(x, y, strict) {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const cellEl = el.closest(".cell");
    if (!cellEl || !gridEl.contains(cellEl)) return null;
    if (strict) {
      const rect = cellEl.getBoundingClientRect();
      const dx = Math.abs(x - (rect.left + rect.width / 2)) / (rect.width / 2);
      const dy = Math.abs(y - (rect.top + rect.height / 2)) / (rect.height / 2);
      if (dx > HIT_RATIO || dy > HIT_RATIO) return null;
    }
    return [Number(cellEl.dataset.r), Number(cellEl.dataset.c)];
  }

  function isAdjacent(a, b) {
    return Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 && !(a[0] === b[0] && a[1] === b[1]);
  }

  function pathHas(r, c) {
    return path.some(([pr, pc]) => pr === r && pc === c);
  }

  function extendPathTo(r, c) {
    if (!path.length) {
      path.push([r, c]);
      vibrate(10);
      playKeyClick();
      renderPath();
      return;
    }
    const last = path[path.length - 1];
    if (last[0] === r && last[1] === c) return;

    if (path.length >= 2) {
      const prev = path[path.length - 2];
      if (prev[0] === r && prev[1] === c) {
        path.pop();
        renderPath();
        return;
      }
    }

    if (pathHas(r, c)) return;

    if (isAdjacent(last, [r, c])) {
      path.push([r, c]);
      vibrate(10);
      playKeyClick();
      renderPath();
      return;
    }

    // Arrastre rápido: el dedo saltó una celda intermedia. Si el salto es de
    // como mucho 2 filas/columnas y existe una celda puente adyacente a ambas
    // (libre y en el tablero), la insertamos para no perder la palabra.
    const dr = r - last[0];
    const dc = c - last[1];
    if (Math.abs(dr) <= 2 && Math.abs(dc) <= 2) {
      const mid = [last[0] + Math.sign(dr), last[1] + Math.sign(dc)];
      if (
        !pathHas(mid[0], mid[1]) &&
        cellAt(mid[0], mid[1]) &&
        isAdjacent(last, mid) &&
        isAdjacent(mid, [r, c])
      ) {
        path.push(mid);
        path.push([r, c]);
        vibrate(10);
        playKeyClick();
        renderPath();
      }
    }
  }

  function submitPath() {
    if (path.length >= TypoEngine.MIN_WORD_LEN) {
      const word = TypoEngine.wordFromPath(grid, path);
      const validWord = dictionary.has(word) && TypoEngine.isValidPath(grid, path);
      if (validWord && !foundWords.has(word)) {
        const pts = TypoEngine.scoreForLength(word.length);
        foundWords.set(word, pts);
        vibrate([30, 40, 60]);
        playSuccess();
        flashResult(path, "valid");
        renderFoundList();
        updateStats();
      } else if (validWord) {
        // Repetida: amarillo, y resalta el chip de la palabra en la lista
        vibrate(20);
        playDup();
        flashResult(path, "dup");
        flashFoundChip(word);
      } else {
        playFail();
        flashResult(path, "invalid");
      }
    }
    path = [];
    renderPath();
  }

  function flashFoundChip(word) {
    const chip = foundListEl.querySelector(`li[data-word="${word}"]`);
    if (!chip) return;
    chip.classList.add("flash-dup");
    chip.scrollIntoView({ block: "nearest" });
    setTimeout(() => chip.classList.remove("flash-dup"), 1000);
  }

  function onPointerDown(e) {
    if (state !== "playing") return;
    const pos = cellFromPoint(e.clientX, e.clientY, false);
    if (!pos) return;
    dragging = true;
    path = [pos];
    vibrate(10);
    playKeyClick();
    renderPath();
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging || state !== "playing") return;
    const pos = cellFromPoint(e.clientX, e.clientY, true);
    if (!pos) return;
    extendPathTo(pos[0], pos[1]);
  }

  function onPointerUp() {
    if (!dragging) return;
    dragging = false;
    submitPath();
  }

  function tick() {
    timeLeft -= 1;
    updateStats();
    if (timeLeft <= 0) {
      endGame();
      return;
    }
    if (timeLeft <= WARN_SECONDS) {
      playWarnTick();
      vibrate(15);
    }
  }

  // Gira la matriz del tablero 90° horario. Las adyacencias se conservan, así
  // que las palabras posibles (solved) son las mismas; solo cambia la vista.
  function rotateBoard() {
    if (dragging || !grid.length) return;
    const n = grid.length;
    const rotated = Array.from({ length: n }, () => new Array(n));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        rotated[c][n - 1 - r] = grid[r][c];
      }
    }
    grid = rotated;
    path = [];
    renderGrid();
    renderPath();
    playKeyClick();
  }

  function startGame() {
    initAudio();
    state = "playing";
    gridWrapEl.classList.remove("blurred");
    timeLeft = GAME_SECONDS;
    foundWords = new Map();
    path = [];
    renderFoundList();
    renderPath();
    updateStats();
    startBtn.disabled = true;
    newBoardBtn.disabled = true;
    hintEl.textContent = "Arrastra sobre letras adyacentes para formar palabras de al menos 3 letras.";
    timerHandle = setInterval(tick, 1000);
  }

  function endGame() {
    state = "ended";
    gridWrapEl.classList.add("blurred");
    clearInterval(timerHandle);
    timerHandle = null;
    newBoardBtn.disabled = false;

    const missed = [...solved.entries()]
      .filter(([word]) => !foundWords.has(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    finalScoreEl.textContent = String(totalScore());
    const words = [...foundWords.keys()];
    let details = `${foundWords.size} palabras encontradas`;
    if (words.length) {
      const maxLen = Math.max(...words.map((w) => w.length));
      const longest = words.filter((w) => w.length === maxLen);
      const label = longest.length > 1 ? "más largas" : "más larga";
      details += ` · ${label} (${maxLen} letras): ${longest.join(", ")}`;
    }
    finalDetailsEl.textContent = details;

    missedListEl.innerHTML = "";
    missed.forEach(([word, pts]) => {
      const li = document.createElement("li");
      li.textContent = `${word} (+${pts})`;
      missedListEl.appendChild(li);
    });

    summaryOverlay.hidden = false;
  }

  function newBoard() {
    hintEl.textContent = "Generando tablero...";
    startBtn.disabled = true;
    newBoardBtn.disabled = true;
    setTimeout(() => {
      const result = TypoEngine.generatePlayableGrid(dictionary, { minWords: 60, maxAttempts: 20 });
      grid = result.grid;
      solved = result.solved;
      state = "idle";
      gridWrapEl.classList.add("blurred");
      timeLeft = GAME_SECONDS;
      foundWords = new Map();
      path = [];
      renderGrid();
      renderPath();
      renderFoundList();
      updateStats();
      startBtn.disabled = false;
      newBoardBtn.disabled = false;
      hintEl.textContent = "Arrastra sobre letras adyacentes para formar palabras de al menos 3 letras.";
    }, 10);
  }

  gridEl.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  startBtn.addEventListener("click", startGame);
  newBoardBtn.addEventListener("click", () => {
    if (state === "playing") clearInterval(timerHandle);
    newBoard();
  });
  playAgainBtn.addEventListener("click", () => {
    summaryOverlay.hidden = true;
    newBoard();
  });
  muteBtn.addEventListener("click", () => {
    muted = !muted;
    localStorage.setItem("typo-muted", muted ? "1" : "0");
    updateMuteBtn();
  });
  rotateBtn.addEventListener("click", rotateBoard);

  updateMuteBtn();
  newBoard();
})();
