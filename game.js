(function () {
  const testSeconds = Number(new URLSearchParams(window.location.search).get("t"));
  const GAME_SECONDS = testSeconds > 0 ? testSeconds : 180;

  const gridEl = document.getElementById("grid");
  const overlayEl = document.getElementById("path-overlay");
  const pathLineEl = document.getElementById("path-line");
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
    if (navigator.vibrate) navigator.vibrate(pattern);
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
    const liveValid =
      currentWord.length >= TypoEngine.MIN_WORD_LEN &&
      dictionary.has(currentWord) &&
      !foundWords.has(currentWord);

    gridEl.querySelectorAll(".cell").forEach((el) => {
      el.classList.remove("selected", "live-valid");
      const badge = el.querySelector(".order-badge");
      if (badge) badge.remove();
    });
    path.forEach(([r, c], i) => {
      const el = cellAt(r, c);
      if (!el) return;
      el.classList.add("selected");
      if (liveValid) el.classList.add("live-valid");
      const badge = document.createElement("span");
      badge.className = "order-badge";
      badge.textContent = String(i + 1);
      el.appendChild(badge);
    });
    renderLine(liveValid);
    currentWordEl.textContent = path.length
      ? TypoEngine.wordFromPath(grid, path)
      : " ";
  }

  function renderLine(liveValid) {
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
    overlayEl.classList.toggle("live-valid", Boolean(liveValid));
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
        renderPath();
      }
    }
  }

  function submitPath() {
    if (path.length >= TypoEngine.MIN_WORD_LEN) {
      const word = TypoEngine.wordFromPath(grid, path);
      const alreadyFound = foundWords.has(word);
      const validWord = dictionary.has(word) && TypoEngine.isValidPath(grid, path);
      if (validWord && !alreadyFound) {
        const pts = TypoEngine.scoreForLength(word.length);
        foundWords.set(word, pts);
        vibrate([30, 40, 60]);
        flashResult(path, "valid");
        renderFoundList();
        updateStats();
      } else {
        flashResult(path, "invalid");
      }
    }
    path = [];
    renderPath();
  }

  function onPointerDown(e) {
    if (state !== "playing") return;
    const pos = cellFromPoint(e.clientX, e.clientY, false);
    if (!pos) return;
    dragging = true;
    path = [pos];
    vibrate(10);
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
    }
  }

  function startGame() {
    state = "playing";
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
    clearInterval(timerHandle);
    timerHandle = null;
    newBoardBtn.disabled = false;

    const missed = [...solved.entries()]
      .filter(([word]) => !foundWords.has(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    finalScoreEl.textContent = String(totalScore());
    const longest = [...foundWords.keys()].sort((a, b) => b.length - a.length)[0] || "—";
    finalDetailsEl.textContent = `${foundWords.size} palabras encontradas · más larga: ${longest}`;

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

  newBoard();
})();
