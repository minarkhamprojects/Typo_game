(function () {
  const testSeconds = Number(new URLSearchParams(window.location.search).get("t"));
  const GAME_SECONDS = testSeconds > 0 ? testSeconds : 90;
  const WARN_SECONDS = 10;

  const gridEl = document.getElementById("grid");
  const gridWrapEl = document.getElementById("grid-wrap");
  const overlayEl = document.getElementById("path-overlay");
  const pathLineEl = document.getElementById("path-line");
  const muteBtn = document.getElementById("mute-btn");
  const rotateLeftBtn = document.getElementById("rotate-left");
  const rotateRightBtn = document.getElementById("rotate-right");
  const menuBtn = document.getElementById("menu-btn");
  const helpOverlay = document.getElementById("help-overlay");
  const helpCloseBtn = document.getElementById("help-close-btn");
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

  // El diccionario (6.75 MB) se carga async como texto plano (words_es.txt) para
  // no congelar la apertura en equipos modestos. Se puebla en bootDictionary().
  let dictionary = null;
  let dictReady = false;
  let revealSplashStart = null; // lo define la sección de splash; lo dispara el dict-ready

  let grid = [];
  let solved = new Map();
  let foundWords = new Map(); // word -> score
  let path = []; // array of [r, c]
  let dragging = false;
  let state = "idle"; // idle | playing | ended
  let timeLeft = GAME_SECONDS;
  let timerHandle = null;
  let possibleCount = 0; // palabras posibles en el tablero actual
  let longestRecordThisGame = false; // ¿la palabra más larga récord cayó hoy?
  let onlineSession = null; // sesión de duelo en vivo (multijugador) o null
  let onlineClockHandle = null;

  // ——— Rango de diseño del tablero ———
  // Ajusta estos números para hacer las partidas más entretenidas: más palabras
  // mínimas, un rango sano de vocales, y un tope de vocales/consonantes seguidas.
  const DESIGN = {
    minWords: 90,        // palabras posibles mínimas (tablero rico)
    maxWords: Infinity,  // tope opcional
    minVowels: 6,        // vocales mínimas de las 16 casillas
    maxVowels: 9,        // vocales máximas
    maxSameTypeRun: 3,   // máx. vocales o consonantes seguidas (fila/columna)
    maxAttempts: 60,
  };

  // ——— Récords personales (localStorage) ———
  const RECORDS_KEY = "typo-records";
  function loadRecords() {
    try { return JSON.parse(localStorage.getItem(RECORDS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveRecords() {
    try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
  }
  let records = loadRecords(); // { longestWord, bestScore, bestWords }

  // ——— Tips del ticker: base + récords + definiciones de palabras encontradas ———
  const BASE_TIPS = [
    "MÍNIMO 3 LETRAS POR PALABRA",
    "ARRASTRA LETRAS VECINAS — TAMBIÉN EN DIAGONAL",
    "PALABRAS MÁS LARGAS = MÁS PUNTOS",
    "¿ATASCADO? GIRA EL TABLERO CON ↺ ↻",
    "REPETIR UNA PALABRA NO SUMA PUNTOS",
    "ENCADENA 6+ LETRAS PARA UN GRAN BONUS",
  ];
  const defCache = {}; // palabra(min) -> definición ("" = sin dato / pendiente)

  // ——— Tableros temáticos (palabras secretas) ———
  const THEMED_CHANCE = 0.35; // prob. de que un tablero salga temático ("de repente")
  const SECRET_BONUS = 5; // puntos extra por cada palabra secreta encontrada
  let secretWords = new Set(); // palabras secretas del tablero actual
  let themeName = "";
  let secretsFound = 0;

  // ——— Juego especial: una letra vale más (×mult), resaltada en el tablero ———
  const SPECIAL_CHANCE = 0.2; // prob. de que un tablero sea "especial"
  const SPECIAL_MULT = 2;     // la letra especial vale el doble
  let boostedLetter = "";     // letra potenciada del tablero actual ("" = normal)
  let boostMult = 1;

  // Valor de una tecla considerando la letra especial. "QU" = Q + U.
  function tileValue(cell) {
    let v = 0;
    for (const ch of cell) v += TypoEngine.letterValue(ch) * (ch === boostedLetter ? boostMult : 1);
    return v;
  }
  // Puntaje de una palabra con la letra especial aplicada.
  function scoreWord(word) {
    let v = 0;
    for (const ch of word) v += TypoEngine.letterValue(ch) * (ch === boostedLetter ? boostMult : 1);
    return v;
  }
  // Elige (o no) la letra especial del tablero recién generado.
  function pickSpecial(g) {
    boostedLetter = "";
    boostMult = 1;
    if (Math.random() >= SPECIAL_CHANCE) return;
    const letters = [...new Set(g.flat().flatMap((cell) => [...cell]))];
    if (!letters.length) return;
    boostedLetter = letters[Math.floor(Math.random() * letters.length)];
    boostMult = SPECIAL_MULT;
  }
  const themeBanner = document.getElementById("theme-banner");
  const themeNameEl = document.getElementById("theme-name");
  const secretCountEl = document.getElementById("secret-count");
  const bannerTagEl = document.getElementById("banner-tag");
  const bannerLabelEl = document.getElementById("banner-label");
  const wordLabelEl = document.getElementById("word-label");

  // ——— Modo de juego: clásico | trivia | contrarreloj ———
  const MODE_KEY = "typo-mode";
  const VALID_MODES = ["clasico", "trivia", "contrarreloj"];
  const savedMode = localStorage.getItem(MODE_KEY);
  let gameMode = VALID_MODES.includes(savedMode) ? savedMode : "clasico";

  // ——— Modo Contrarreloj: arranca en 1:30 y cada palabra suma tiempo ———
  const CONTRA_START_SECONDS = 90;  // 1:30 igual que el clásico
  let contraElapsed = 0;            // segundos que llevas vivo esta partida
  let contraSecondsGained = 0;      // total de segundos que sumaron tus palabras
  const CONTRA_RECORDS_KEY = "typo-contra-records";
  function loadContraRecords() {
    try { return JSON.parse(localStorage.getItem(CONTRA_RECORDS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveContraRecords() {
    try { localStorage.setItem(CONTRA_RECORDS_KEY, JSON.stringify(contraRecords)); }
    catch (e) {}
  }
  let contraRecords = loadContraRecords(); // { longestWord, bestScore, bestWords, bestTime }

  const TRIVIA_SECONDS = 120;       // reloj global de la partida trivia
  const QUESTION_SECONDS = 15;      // tiempo por pregunta
  const TRIVIA_COMPLETE_BONUS = 8;  // bono por encontrar todas las respuestas
  const REVEAL_MS = 950;            // pausa para revelar antes de la siguiente pregunta
  // estado de trivia
  let triviaEntry = null;           // { id, clue, answers }
  let answerSet = new Set();        // respuestas encontrables en el tablero actual
  let questionFound = new Set();    // respuestas ya halladas esta pregunta
  let questionTimeLeft = 0;
  let questionsPlayed = 0;
  let triviaAnswersTotal = 0;
  let triviaScore = 0;
  let questionLocked = false;       // durante la pausa de revelación
  let lastTriviaId = null;
  let usedTriviaIds = new Set();    // preguntas ya usadas en esta partida (sin repetir)
  let triviaFoundWords = [];        // respuestas acertadas en toda la partida
  // ——— Handicap estilo golf (por modo): calibra en 10 juegos, luego promedio móvil ———
  const HANDICAP_KEY = "typo-handicap";
  const HC_CALIBRATION = 10; // juegos para calibrar
  const HC_WINDOW = 10;      // ventana móvil (últimos N)
  function loadHandicap() {
    try { return JSON.parse(localStorage.getItem(HANDICAP_KEY)) || {}; }
    catch (e) { return {}; }
  }
  let handicapHist = loadHandicap(); // { clasico:[...], contrarreloj:[...], trivia:[...] }
  function saveHandicap() {
    try { localStorage.setItem(HANDICAP_KEY, JSON.stringify(handicapHist)); } catch (e) {}
  }
  function modeHistory(mode) { return handicapHist[mode] || (handicapHist[mode] = []); }
  // Handicap actual del modo (promedio de últimos 10). null mientras calibra.
  function handicapFor(mode) {
    const h = modeHistory(mode);
    if (h.length < HC_CALIBRATION) return null;
    const last = h.slice(-HC_WINDOW);
    return Math.round(last.reduce((a, b) => a + b, 0) / last.length);
  }
  // Registra el score de una partida en el historial del modo (conserva últimos 10).
  function recordGameScore(mode, score) {
    const h = modeHistory(mode);
    h.push(score);
    if (h.length > HC_WINDOW) h.splice(0, h.length - HC_WINDOW);
    saveHandicap();
  }

  const TRIVIA_RECORDS_KEY = "typo-trivia-records";
  function loadTriviaRecords() {
    try { return JSON.parse(localStorage.getItem(TRIVIA_RECORDS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveTriviaRecords() {
    try { localStorage.setItem(TRIVIA_RECORDS_KEY, JSON.stringify(triviaRecords)); } catch (e) {}
  }
  let triviaRecords = loadTriviaRecords(); // { bestScore, bestAnswers }

  // iOS Safari no tiene navigator.vibrate. Truco: en iOS 17.4+ un <input switch>
  // dispara un tick háptico al TOGGLEARSE con .click() (no con .checked=). Para
  // que se sienta más fuerte, lanzamos una RÁFAGA de ticks muy juntos.
  function iosHapticBurst(ticks) {
    if (!hapticSwitch) return;
    let i = 0;
    const fire = () => {
      try {
        hapticSwitch.click();
      } catch (e) {}
      if (++i < ticks) setTimeout(fire, 20);
    };
    fire();
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      // Android: vibración real, se usa el patrón tal cual (fuerte)
      try { navigator.vibrate(pattern); } catch (e) {}
      return;
    }
    // iOS: fuerza ~ nº de pulsos del patrón -> nº de ticks en ráfaga
    let onPulses;
    if (Array.isArray(pattern)) onPulses = Math.ceil(pattern.length / 2);
    else onPulses = pattern >= 30 ? 3 : pattern >= 18 ? 2 : 1;
    const ticks = Math.max(1, Math.min(9, Math.round(onPulses * 1.7)));
    iosHapticBurst(ticks);
  }

  // --- Sonido retro sintetizado (Web Audio, sin archivos externos) ---
  let audioCtx = null;
  let muted = localStorage.getItem("typo-muted") === "1";

  function initAudio() {
    // iOS 16.4+: que el audio suene aunque el iPhone tenga el switch de silencio
    if (navigator.audioSession) {
      try {
        navigator.audioSession.type = "playback";
      } catch (e) {
        /* no soportado: seguimos igual */
      }
    }
    if (audioCtx) {
      if (audioCtx.state === "suspended") audioCtx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    // Unlock clásico de iOS: reproducir un buffer silencioso dentro del gesto
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const src = audioCtx.createBufferSource();
    src.buffer = buffer;
    src.connect(audioCtx.destination);
    src.start(0);
  }

  function tone(freq, startIn, duration, type, volume) {
    if (!audioCtx || muted) return;
    // iOS suspende el contexto al bloquear pantalla / cambiar de app
    if (audioCtx.state === "suspended") audioCtx.resume();
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

  // Buffer de ruido reutilizable para el "thock" ASMR de tecla mecánica
  let _noiseBuf = null;
  function _noise() {
    if (_noiseBuf) return _noiseBuf;
    const b = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.1), audioCtx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (_noiseBuf = b);
  }

  // thock de tecla: transiente de ruido filtrado + cuerpo grave de seno
  function keyThock(startIn, o) {
    if (!audioCtx || muted) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    o = o || {};
    const g = o.gain || 0.4;
    const t = audioCtx.currentTime + (startIn || 0);
    const src = audioCtx.createBufferSource(); src.buffer = _noise();
    const bp = audioCtx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = o.click || 2400; bp.Q.value = 0.9;
    const hp = audioCtx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(g * 0.1, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(bp); bp.connect(hp); hp.connect(ng); ng.connect(audioCtx.destination);
    src.start(t); src.stop(t + 0.05);
    const os = audioCtx.createOscillator(); os.type = "sine";
    os.frequency.setValueAtTime(o.thock || 130, t);
    os.frequency.exponentialRampToValueAtTime((o.thock || 130) * 0.7, t + 0.045);
    const og = audioCtx.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(g * 0.13, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    os.connect(og); og.connect(audioCtx.destination); os.start(t); os.stop(t + 0.07);
  }

  function playKeyClick() {
    keyThock(0, { thock: 128 + Math.random() * 22, click: 2300 + Math.random() * 500, gain: 0.4 });
  }

  // Blip electrónico: arpegio ascendente brillante + chispa aguda (síntesis pura)
  function blip(startIn, freq, dur, type, vol) {
    if (!audioCtx || muted) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime + startIn;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur * 0.9);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playSuccess() {
    if (isManga()) return playSuccessManga();
    // acierto = "power-up" electrónico: tríada ascendente (C6·E6·G6) + brillo
    blip(0.0,  1047, 0.11, "square",   0.16); // C6
    blip(0.06, 1319, 0.11, "square",   0.15); // E6
    blip(0.12, 1568, 0.16, "triangle", 0.18); // G6
    blip(0.13, 3136, 0.12, "sine",     0.08); // chispa aguda (octava arriba)
  }

  function playSecret() {
    // palabra secreta = fanfarria más larga y brillante (arpegio C-E-G-C-E + chispas)
    blip(0.0,  1047, 0.1,  "square",   0.16); // C6
    blip(0.05, 1319, 0.1,  "square",   0.16); // E6
    blip(0.1,  1568, 0.1,  "triangle", 0.17); // G6
    blip(0.15, 2093, 0.12, "triangle", 0.18); // C7
    blip(0.21, 2637, 0.18, "sine",     0.16); // E7 (remate)
    blip(0.22, 4186, 0.14, "sine",     0.07); // chispa muy aguda
  }

  function playNextQuestion() {
    // pitido corto al cambiar de pregunta (dos tonos)
    blip(0.0,  784,  0.09, "square", 0.14); // G5
    blip(0.07, 1047, 0.12, "sine",   0.13); // C6
  }

  function playDup() {
    keyThock(0, { thock: 175, click: 2200, gain: 0.42 });
  }

  function playFail() {
    if (isManga()) return playFailManga();
    // buzzer retro descendente de dos tonos
    if (!audioCtx || muted) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime;
    [[330, 0], [247, 0.085], [160, 0.17]].forEach(([f, dt]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + dt);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + dt + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.1);
      o.connect(g); g.connect(audioCtx.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.11);
    });
  }

  function playWarnTick() {
    tone(880, 0, 0.06, "square", 0.14);
  }

  function isManga() {
    return document.documentElement.getAttribute("data-skin") === "manga";
  }
  // Barrido de frecuencia (whoosh / carga anime).
  function sweep(f0, f1, startIn, dur, type, vol) {
    if (!audioCtx || muted) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime + (startIn || 0);
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || "sawtooth";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t); o.stop(t + dur + 0.03);
  }
  // Acierto estilo anime: "whoosh" de carga ascendente + campanitas kirakira.
  function playSuccessManga() {
    sweep(300, 1500, 0, 0.16, "sawtooth", 0.13); // carga que sube
    blip(0.13, 2093, 0.1, "sine", 0.11);
    blip(0.19, 2637, 0.1, "sine", 0.12);
    blip(0.25, 3520, 0.16, "sine", 0.1);         // destello
    blip(0.27, 4699, 0.14, "sine", 0.06);        // chispa muy aguda
  }
  // Error estilo anime: "chiin" cómico — barrido que cae + campana que se apaga.
  function playFailManga() {
    sweep(540, 150, 0, 0.5, "triangle", 0.13);
    blip(0.0, 392, 0.42, "sine", 0.1);
  }
  // Sonido final cuando se acaba el tiempo (suena junto con ir a resultados).
  function playTimeUp() {
    if (isManga()) {
      tone(120, 0, 0.6, "sine", 0.3);       // gong grave
      tone(181, 0, 0.6, "triangle", 0.15);
      blip(0.02, 90, 0.7, "sine", 0.2);
    } else {
      blip(0.0, 784, 0.14, "square", 0.16);
      blip(0.12, 587, 0.16, "square", 0.16);
      blip(0.26, 392, 0.5, "triangle", 0.2);
      tone(120, 0.26, 0.55, "sine", 0.18);
    }
  }

  function updateMuteBtn() {
    muteBtn.classList.toggle("muted", muted);
    muteBtn.setAttribute("aria-label", muted ? "Activar sonido" : "Silenciar sonido");
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function cellAt(r, c) {
    return gridEl.querySelector(`[data-r="${r}"][data-c="${c}"]`);
  }

  // Marcas rojas secundarias de las teclas (decorativas, estilo teclado retro)

  function renderGrid() {
    gridEl.innerHTML = "";
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.r = r;
        cell.dataset.c = c;

        // Keycap 3D = cuerpo + 4 paredes biseladas (trapecios) + tapa cóncava.
        const body = document.createElement("div");
        body.className = "cell__body";
        for (const side of ["ft", "fb", "fl", "fr"]) {
          const f = document.createElement("div");
          f.className = "cell__f cell__" + side;
          body.appendChild(f);
        }
        const face = document.createElement("div");
        face.className = "cell__face";
        const cellVal = grid[r][c];
        const mark = document.createElement("span");
        mark.className = "key-mark";
        // Esquina = valor de la tecla (dificultad); si es la letra especial, ×mult.
        mark.textContent = String(tileValue(cellVal));
        if (boostedLetter && cellVal.includes(boostedLetter)) {
          mark.classList.add("key-mark--boost");
          cell.classList.add("boosted");
        }
        const legend = document.createElement("span");
        legend.className = "key-legend";
        // La tecla "QU" se muestra como "Qu" (en español la Q siempre lleva U).
        legend.textContent = cellVal === "QU" ? "Qu" : cellVal;
        face.appendChild(mark);
        face.appendChild(legend);
        body.appendChild(face);
        cell.appendChild(body);
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
    }, 480);
  }

  function renderFoundList() {
    foundListEl.innerHTML = "";
    for (const [word, pts] of foundWords.entries()) {
      const li = document.createElement("li");
      li.dataset.word = word;
      if (secretWords.has(word)) {
        li.classList.add("secret");
        li.textContent = "★ " + word;
      } else {
        li.textContent = word;
      }
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
    if (gameMode === "trivia") {
      scoreEl.textContent = String(triviaScore);
      wordCountEl.textContent = String(questionsPlayed);
      wordCountEl.classList.remove("has-total");
      if (wordLabelEl) wordLabelEl.textContent = "Ronda";
    } else {
      scoreEl.textContent = String(totalScore());
      // Contador de palabras: encontradas / posibles en el tablero
      wordCountEl.textContent = possibleCount
        ? foundWords.size + "/" + possibleCount
        : String(foundWords.size);
      wordCountEl.classList.toggle("has-total", possibleCount > 0);
      if (wordLabelEl) wordLabelEl.textContent = "Palabras";
    }
    timerEl.textContent = formatTime(timeLeft);
    timerEl.classList.toggle(
      "warning",
      state === "playing" && timeLeft <= WARN_SECONDS
    );
  }

  // Compone el texto del ticker: récords + (en juego) definiciones de las
  // palabras encontradas; si no, los tips base.
  const tipsEls = document.querySelectorAll(".tips-text");
  function tickerStream() {
    const parts = [];
    if (records.longestWord)
      parts.push("RÉCORD PALABRA: " + records.longestWord + " (" + records.longestWord.length + ")");
    if (records.bestScore) parts.push("MEJOR PUNTAJE: " + records.bestScore);
    if (records.bestWords) parts.push("MÁS PALABRAS: " + records.bestWords);

    if (state === "playing" && foundWords.size) {
      for (const w of foundWords.keys()) {
        const d = defCache[w.toLowerCase()];
        parts.push(d ? w + " — " + d : w);
      }
    } else {
      parts.push.apply(parts, BASE_TIPS);
    }
    return "›  " + parts.join("     •     ") + "     •     ";
  }
  const tipsScreenEl = document.querySelector(".tips-screen");
  function renderTicker() {
    if (gameMode === "trivia" && state === "playing" && triviaEntry) {
      if (tipsScreenEl) tipsScreenEl.classList.add("clue");
      const clue = "» " + triviaEntry.clue.toUpperCase();
      tipsEls.forEach((el, i) => (el.textContent = i === 0 ? clue : ""));
      return;
    }
    if (tipsScreenEl) tipsScreenEl.classList.remove("clue");
    const s = tickerStream();
    tipsEls.forEach((el) => (el.textContent = s));
  }

  // Panel de récords en el resumen final
  function renderRecords(flags, recObj, extraRows) {
    flags = flags || {};
    recObj = recObj || records;
    const recEl = document.getElementById("records");
    if (!recEl) return;
    const badge = (on) => (on ? ' <b class="rec-new">¡NUEVO!</b>' : "");
    const rows = [
      {
        label: "Palabra más larga",
        val: recObj.longestWord
          ? recObj.longestWord + " (" + recObj.longestWord.length + ")"
          : "—",
        isNew: flags.newWord,
      },
      { label: "Mejor puntaje", val: recObj.bestScore || 0, isNew: flags.newScore },
      { label: "Más palabras", val: recObj.bestWords || 0, isNew: flags.newWords },
    ];
    if (extraRows) rows.push(...extraRows);
    recEl.innerHTML = rows
      .map(
        (r) =>
          '<div class="rec-row"><span class="rec-label">' +
          r.label +
          '</span><span class="rec-val">' +
          r.val +
          badge(r.isNew) +
          "</span></div>"
      )
      .join("");
  }

  // Handicap estilo golf en el resumen: neto = score − handicap (partidas previas).
  // Calcula ANTES de registrar esta partida, luego la registra.
  function renderHandicap(mode, score) {
    const el = document.getElementById("handicap-line");
    const before = handicapFor(mode);
    const played = modeHistory(mode).length;
    recordGameScore(mode, score);
    if (!el) return;
    if (before === null) {
      const n = Math.min(played + 1, HC_CALIBRATION);
      el.innerHTML = "Calibrando handicap · <b>" + n + "/" + HC_CALIBRATION + "</b>";
    } else {
      const net = score - before;
      const cls = net >= 0 ? "net-pos" : "net-neg";
      el.innerHTML =
        "Handicap <b>" + before + "</b> · Tu neto <b class='" + cls + "'>" +
        (net >= 0 ? "+" : "") + net + "</b>";
    }
    el.hidden = false;
  }

  // Definición desde el Wikcionario en español (mejor esfuerzo, requiere red).
  // En el extract de Wikcionario el número del sentido va en su PROPIA línea
  // (o "2 Astronomía") y la definición viene en la línea siguiente.
  const SKIP_NEXT = /^(sinónimo|sinónimos|hiperónimo|hipónimo|antónimo|ejemplo|uso|ámbito|relacionado|derivad|\d)/i;
  function cleanDefinition(extract) {
    if (!extract) return "";
    const lines = extract.split("\n").map((s) => s.trim()).filter(Boolean);
    // 1) primer sentido numerado -> la definición es la línea siguiente
    for (let i = 0; i < lines.length; i++) {
      if (/^\d+(\s+.{0,22})?$/.test(lines[i])) {
        const next = lines[i + 1];
        if (next && next.length > 4 && !SKIP_NEXT.test(next)) return trimDef(next);
      }
    }
    // 2) forma flexiva: "Forma del femenino plural de dolido"
    for (const ln of lines) {
      if (/^forma\b/i.test(ln) && ln.length > 10) return trimDef(ln);
    }
    return "";
  }
  function trimDef(d) {
    d = d.replace(/\s+/g, " ").trim();
    if (d.length > 84) d = d.slice(0, 84).replace(/\s+\S*$/, "") + "…";
    return d.toUpperCase();
  }
  function fetchDefinition(word) {
    const key = word.toLowerCase();
    if (key in defCache) return; // ya pedida
    defCache[key] = ""; // marca como pendiente
    if (typeof fetch !== "function") return;
    const url =
      "https://es.wiktionary.org/w/api.php?action=query&format=json&redirects=1&prop=extracts&explaintext=1&exsectionformat=plain&origin=*&titles=" +
      encodeURIComponent(key);
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const pages = data && data.query && data.query.pages;
        let extract = "";
        if (pages) {
          const k = Object.keys(pages)[0];
          extract = (pages[k] && pages[k].extract) || "";
        }
        const def = cleanDefinition(extract);
        if (def) {
          defCache[key] = def;
          renderTicker();
        }
      })
      .catch(() => {});
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
      // El duelo en vivo manda sobre el modo guardado (trivia/clásico) del jugador.
      if (onlineSession && !onlineSession.ended) {
        submitOnline(word);
        path = [];
        renderPath();
        return;
      }
      if (gameMode === "trivia") {
        submitTrivia(word);
        path = [];
        renderPath();
        return;
      }
      const validWord = dictionary.has(word) && TypoEngine.isValidPath(grid, path);
      if (validWord && !foundWords.has(word)) {
        const isSecret = secretWords.has(word);
        const base = scoreWord(word);
        const pts = isSecret ? base + SECRET_BONUS : base;
        foundWords.set(word, pts);
        if (isSecret) {
          // palabra secreta: bono, flash dorado, háptico y fanfarria
          secretsFound++;
          updateThemeBanner();
          // secreta = el háptico más fuerte (ráfaga larga)
          vibrate([30, 20, 30, 20, 30, 20, 30, 20, 120]);
          playSecret();
          flashResult(path, "secret");
        } else {
          // acierto = háptico fuerte
          vibrate([35, 25, 35, 25, 35, 25, 75]);
          playSuccess();
          flashResult(path, "valid");
        }
        // "+N" flotante con el puntaje ganado (sube hacia el jugador).
        showScorePop(pts);
        if (window.TypoCelebrate) window.TypoCelebrate(word); // grito de celebración (según skin/longitud)
        // Contrarreloj: +1 s por palabra; +2 s si tiene más de 5 letras.
        if (gameMode === "contrarreloj") {
          const add = word.length > 5 ? 2 : 1;
          timeLeft += add;
          contraSecondsGained += add;
          showTimeGain(add);
        }
        renderFoundList();
        updateStats();
        // récord: palabra más larga en vivo (según el modo activo)
        const recObj = gameMode === "contrarreloj" ? contraRecords : records;
        if (word.length > (recObj.longestWord ? recObj.longestWord.length : 0)) {
          recObj.longestWord = word;
          longestRecordThisGame = true;
          if (gameMode === "contrarreloj") saveContraRecords();
          else saveRecords();
        }
        // definición para el ticker (mejor esfuerzo, online) + refresco
        fetchDefinition(word);
        renderTicker();
      } else if (validWord) {
        // Repetida: amarillo, y resalta el chip de la palabra en la lista
        vibrate(20);
        playDup();
        flashResult(path, "dup");
        flashFoundChip(word);
      } else {
        playFail();
        flashResult(path, "invalid");
        // la lectura de la palabra parpadea en rojo
        currentWordEl.classList.add("invalid");
        setTimeout(() => currentWordEl.classList.remove("invalid"), 480);
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

  // "+N" flotante (solo el puntaje) que sube y se desvanece hacia el jugador al
  // acertar una palabra. Se ancla sobre el readout verde de la palabra.
  function showScorePop(pts) {
    const host = document.querySelector(".board-area");
    if (!host) return;
    const pop = document.createElement("span");
    pop.className = "score-pop";
    pop.textContent = "+" + pts;
    if (currentWordEl) pop.style.top = currentWordEl.offsetTop + "px";
    host.appendChild(pop);
    setTimeout(() => pop.remove(), 900);
  }

  // Flash "+Ns" verde junto al reloj cuando una palabra suma tiempo (Contrarreloj).
  function showTimeGain(sec) {
    const host = timerEl.parentElement;
    if (!host) return;
    const tag = document.createElement("span");
    tag.className = "time-gain";
    tag.textContent = "+" + sec + "s";
    host.appendChild(tag);
    setTimeout(() => tag.remove(), 850);
    timerEl.classList.add("gain");
    setTimeout(() => timerEl.classList.remove("gain"), 400);
  }

  function tick() {
    timeLeft -= 1;
    if (gameMode === "contrarreloj" && state === "playing") {
      contraElapsed += 1; // segundos sobrevividos (para el récord de tiempo)
    }
    if (gameMode === "trivia" && state === "playing" && !questionLocked) {
      questionTimeLeft -= 1;
      if (questionTimeLeft <= 0) {
        endQuestion(false); // se acabó el tiempo de la pregunta → siguiente
      } else {
        renderTriviaBanner();
      }
    }
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

  // Gira la matriz del tablero 90° (dir=1 horario, dir=-1 antihorario). Las
  // adyacencias se conservan: las palabras posibles (solved) son las mismas.
  function rotateBoard(dir) {
    if (dragging || !grid.length) return;
    const n = grid.length;
    const rotated = Array.from({ length: n }, () => new Array(n));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (dir === 1) rotated[c][n - 1 - r] = grid[r][c];
        else rotated[n - 1 - c][r] = grid[r][c];
      }
    }
    grid = rotated;
    path = [];
    renderGrid();
    renderPath();
    playKeyClick();
  }

  // ————————————— MODO TRIVIA —————————————

  // Genera un tablero que contiene respuestas de la pregunta. Baja secretCount
  // (6→3) porque los sinónimos no comparten letras. Devuelve {grid,solved,findable}.
  function triviaBoardFor(answers) {
    for (let sc = Math.min(6, answers.length); sc >= 3; sc--) {
      const res = TypoEngine.generateThemedGrid(dictionary, answers, {
        secretCount: sc,
        maxAttempts: 160,
      });
      if (res) {
        const solvedSet = new Set(res.solved.keys());
        const findable = answers.filter((w) => solvedSet.has(w));
        if (findable.length >= 3) return { grid: res.grid, solved: res.solved, findable };
      }
    }
    return null;
  }

  function startQuestion() {
    const bank = window.TYPO_TRIVIA || [];
    if (!bank.length) return;
    // pool SIN repetir en esta partida (si se agotan, se reinicia el ciclo)
    let pool = bank.filter((e) => !usedTriviaIds.has(e.id));
    if (!pool.length) {
      usedTriviaIds.clear();
      pool = bank.slice();
    }
    // baraja y toma la primera entrada que genere un tablero viable
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    let entry = null;
    let bd = null;
    for (const cand of pool) {
      const b = triviaBoardFor(cand.answers);
      if (b) { entry = cand; bd = b; break; }
    }
    if (!bd) return;
    usedTriviaIds.add(entry.id);
    lastTriviaId = entry.id;
    triviaEntry = entry;
    grid = bd.grid;
    solved = bd.solved;
    answerSet = new Set(bd.findable);
    questionFound = new Set();
    foundWords = new Map();
    possibleCount = 0;
    secretWords = new Set();
    questionsPlayed++;
    questionTimeLeft = QUESTION_SECONDS;
    questionLocked = false;
    path = [];
    renderGrid();
    renderPath();
    renderFoundList();
    updateStats();
    renderTriviaBanner();
    renderTicker(); // muestra la pista en la pantalla verde
    if (questionsPlayed > 1) playNextQuestion(); // pitido al cambiar de pregunta
  }

  // Reusa el #theme-banner como barra de trivia: contador + progreso
  function renderTriviaBanner() {
    if (!themeBanner) return;
    themeBanner.hidden = false;
    themeBanner.classList.add("trivia");
    const done = answerSet.size > 0 && questionFound.size >= answerSet.size;
    themeBanner.classList.toggle("complete", done);
    themeBanner.classList.toggle("urgent", !done && questionTimeLeft <= 5);
    if (bannerTagEl) bannerTagEl.textContent = "⏱ " + Math.max(0, questionTimeLeft) + "s";
    if (themeNameEl) themeNameEl.textContent = "";
    if (bannerLabelEl) bannerLabelEl.textContent = "Respuestas";
    if (secretCountEl) secretCountEl.textContent = questionFound.size + "/" + answerSet.size;
  }

  // Revela en la lista las respuestas que faltaron (al terminar la pregunta)
  function revealMissedAnswers() {
    for (const w of answerSet) {
      if (questionFound.has(w)) continue;
      const li = document.createElement("li");
      li.className = "missed-answer";
      li.textContent = w;
      foundListEl.appendChild(li);
    }
  }

  // Fin de una pregunta (completada o por tiempo) → pausa breve → siguiente
  function endQuestion(completed) {
    if (questionLocked) return;
    questionLocked = true;
    if (completed) {
      triviaScore += TRIVIA_COMPLETE_BONUS;
      vibrate([30, 20, 30, 20, 30, 20, 30, 20, 120]);
      playSecret();
    } else {
      vibrate(20);
      playDup();
    }
    revealMissedAnswers();
    updateStats();
    setTimeout(() => {
      if (state === "playing" && timeLeft > 0) startQuestion();
    }, REVEAL_MS);
  }

  function submitTrivia(word) {
    if (questionLocked) return;
    const valid = dictionary.has(word) && TypoEngine.isValidPath(grid, path);
    if (!valid) {
      playFail();
      flashResult(path, "invalid");
      currentWordEl.classList.add("invalid");
      setTimeout(() => currentWordEl.classList.remove("invalid"), 480);
      return;
    }
    if (answerSet.has(word)) {
      if (foundWords.has(word)) {
        // ya la encontraste esta pregunta
        playDup();
        flashResult(path, "dup");
        flashFoundChip(word);
        return;
      }
      const pts = scoreWord(word);
      foundWords.set(word, pts);
      questionFound.add(word);
      triviaScore += pts;
      triviaAnswersTotal++;
      triviaFoundWords.push(word);
      if (word.length > (triviaRecords.longestWord ? triviaRecords.longestWord.length : 0)) {
        triviaRecords.longestWord = word;
      }
      vibrate([35, 25, 35, 25, 35, 25, 75]);
      playSuccess();
      flashResult(path, "valid");
      showScorePop(pts);
      if (window.TypoCelebrate) window.TypoCelebrate(word);
      renderFoundList();
      renderTriviaBanner();
      updateStats();
      if (questionFound.size >= answerSet.size) endQuestion(true);
    } else {
      // palabra válida pero NO es respuesta de la pista → no cuenta (ámbar)
      playDup();
      flashResult(path, "dup");
    }
  }

  function endTrivia() {
    const newScore = triviaScore > (triviaRecords.bestScore || 0);
    const newAnswers = triviaAnswersTotal > (triviaRecords.bestAnswers || 0);
    if (newScore) triviaRecords.bestScore = triviaScore;
    if (newAnswers) triviaRecords.bestAnswers = triviaAnswersTotal;
    saveTriviaRecords();

    finalScoreEl.textContent = String(triviaScore);
    finalDetailsEl.textContent =
      questionsPlayed + " preguntas · " + triviaAnswersTotal + " respuestas acertadas";

    const secretsEl = document.getElementById("secrets-reveal");
    if (secretsEl) secretsEl.hidden = true;
    if (themeBanner) themeBanner.hidden = true;

    // récords de trivia
    const recEl = document.getElementById("records");
    if (recEl) {
      const badge = (on) => (on ? ' <b class="rec-new">¡NUEVO!</b>' : "");
      const lw = triviaRecords.longestWord
        ? triviaRecords.longestWord + " (" + triviaRecords.longestWord.length + ")"
        : "—";
      recEl.innerHTML =
        '<div class="rec-row"><span class="rec-label">Palabra más larga</span><span class="rec-val">' + lw + "</span></div>" +
        '<div class="rec-row"><span class="rec-label">Mejor puntaje</span><span class="rec-val">' + (triviaRecords.bestScore || 0) + badge(newScore) + "</span></div>" +
        '<div class="rec-row"><span class="rec-label">Más respuestas</span><span class="rec-val">' + (triviaRecords.bestAnswers || 0) + badge(newAnswers) + "</span></div>";
    }

    // palabras que encontraste en la partida
    const missedSection = document.getElementById("missed-section");
    const missedTitle = document.getElementById("missed-title");
    const found = [...new Set(triviaFoundWords)];
    if (missedTitle) missedTitle.textContent = "Palabras que encontraste (" + found.length + ")";
    missedListEl.innerHTML = "";
    found.forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      missedListEl.appendChild(li);
    });
    if (missedSection) missedSection.hidden = found.length === 0;

    renderHandicap("trivia", triviaScore);
    summaryOverlay.hidden = false;
  }

  // ————————————————————————————————————————

  function startGame() {
    if (!dictReady) return; // el diccionario aún no carga; el splash no debería dejar llegar aquí
    if (onlineSession && !onlineSession.ended) return; // en pleno duelo no se arranca juego local
    initAudio();
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } // evita intervalos huérfanos
    state = "playing";
    gridWrapEl.classList.remove("blurred");
    foundWords = new Map();
    path = [];
    if (gameMode === "trivia" && (window.TYPO_TRIVIA || []).length) {
      timeLeft = TRIVIA_SECONDS;
      triviaScore = 0;
      questionsPlayed = 0;
      triviaAnswersTotal = 0;
      lastTriviaId = null;
      usedTriviaIds = new Set();
      triviaFoundWords = [];
      questionLocked = false;
      newBoardBtn.hidden = false; // en Trivia sí se usa: "Saltar"
      newBoardBtn.disabled = false;
      newBoardBtn.textContent = "Saltar";
      updateStartBtn();
      renderFoundList();
      updateStats();
      startQuestion();
      timerHandle = setInterval(tick, 1000);
      return;
    }
    timeLeft = GAME_SECONDS;
    longestRecordThisGame = false;
    contraElapsed = 0;
    contraSecondsGained = 0;
    renderFoundList();
    renderPath();
    updateStats();
    newBoardBtn.hidden = true; // "Cambiar tablero" eliminado en Clásico/Contrarreloj
    updateStartBtn();
    renderTicker(); // al iniciar, el ticker pasará a mostrar definiciones
    timerHandle = setInterval(tick, 1000);
  }

  function updateStartBtn() {
    startBtn.textContent =
      state === "playing"
        ? "Terminar"
        : state === "ended"
        ? "Jugar de nuevo"
        : "Comenzar";
  }

  function endGame() {
    playTimeUp(); // sonido final, al mismo tiempo que la transición a resultados
    state = "ended";
    gridWrapEl.classList.add("blurred");
    clearInterval(timerHandle);
    timerHandle = null;
    newBoardBtn.hidden = gameMode !== "trivia";
    updateStartBtn();

    if (gameMode === "trivia") {
      endTrivia();
      return;
    }

    const missedSectionEl = document.getElementById("missed-section");
    if (missedSectionEl) missedSectionEl.hidden = false;
    const missedTitleEl = document.getElementById("missed-title");
    if (missedTitleEl) missedTitleEl.textContent = "Palabras que te perdiste";

    // Récords: puntaje y nº de palabras de esta partida (por modo)
    const isContra = gameMode === "contrarreloj";
    const recObj = isContra ? contraRecords : records;
    const sc = totalScore();
    const wc = foundWords.size;
    const newScore = sc > (recObj.bestScore || 0);
    const newWords = wc > (recObj.bestWords || 0);
    const newTime = isContra && contraElapsed > (contraRecords.bestTime || 0);
    if (newScore) recObj.bestScore = sc;
    if (newWords) recObj.bestWords = wc;
    if (newTime) contraRecords.bestTime = contraElapsed;
    if (newScore || newWords || longestRecordThisGame || newTime) {
      if (isContra) saveContraRecords();
      else saveRecords();
    }
    const extraRows = isContra
      ? [{ label: "Mejor tiempo", val: formatTime(contraRecords.bestTime || 0), isNew: newTime }]
      : null;
    renderRecords({ newScore, newWords, newWord: longestRecordThisGame }, recObj, extraRows);
    renderTicker();

    const missed = [...solved.entries()]
      .filter(([word]) => !foundWords.has(word))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);

    finalScoreEl.textContent = String(totalScore());
    const words = [...foundWords.keys()];
    let details = `${foundWords.size} de ${possibleCount} palabras posibles`;
    if (words.length) {
      const maxLen = Math.max(...words.map((w) => w.length));
      const longest = words.filter((w) => w.length === maxLen);
      const label = longest.length > 1 ? "más largas" : "más larga";
      details += ` · ${label} (${maxLen} letras): ${longest.join(", ")}`;
    }
    if (isContra) {
      details = `Ganaste +${contraSecondsGained}s de tiempo · ` + details;
    }
    finalDetailsEl.textContent = details;

    // Handicap estilo golf: neto = tu score − tu handicap (según partidas previas)
    renderHandicap(gameMode, sc);

    // Revelar las palabras secretas del tablero temático
    const secretsEl = document.getElementById("secrets-reveal");
    if (secretsEl) {
      if (secretWords.size) {
        const items = [...secretWords]
          .map((w) => {
            const got = foundWords.has(w);
            return (
              '<span class="secret-reveal ' +
              (got ? "got" : "missed") +
              '">' +
              (got ? "★ " : "") +
              w +
              "</span>"
            );
          })
          .join("");
        secretsEl.innerHTML =
          '<h3>Secretas · ' +
          themeName +
          " (" +
          secretsFound +
          "/" +
          secretWords.size +
          ")</h3><div class=\"secret-reveal-list\">" +
          items +
          "</div>";
        secretsEl.hidden = false;
      } else {
        secretsEl.hidden = true;
      }
    }

    missedListEl.innerHTML = "";
    missed.forEach(([word, pts]) => {
      const li = document.createElement("li");
      li.textContent = `${word} (+${pts})`;
      missedListEl.appendChild(li);
    });

    summaryOverlay.hidden = false;
  }

  // Construye el tablero: ~THEMED_CHANCE de las veces intenta uno temático con 5
  // palabras secretas; si no lo logra (o no toca), cae a uno normal.
  function buildBoard() {
    const themes = window.TYPO_THEMES;
    if (themes && themes.length && Math.random() < THEMED_CHANCE) {
      const theme = themes[Math.floor(Math.random() * themes.length)];
      const res = TypoEngine.generateThemedGrid(dictionary, theme.words, {
        secretCount: 5,
        maxAttempts: 140,
      });
      if (res && res.secretWords.length >= 5) {
        return {
          grid: res.grid,
          solved: res.solved,
          secrets: new Set(res.secretWords),
          theme: theme.name,
        };
      }
    }
    const res = TypoEngine.generatePlayableGrid(dictionary, DESIGN);
    return { grid: res.grid, solved: res.solved, secrets: new Set(), theme: "" };
  }

  function updateThemeBanner() {
    if (!themeBanner) return;
    themeBanner.classList.remove("trivia", "urgent");
    if (secretWords.size) {
      themeBanner.hidden = false;
      if (bannerTagEl) bannerTagEl.textContent = "◆ Tema";
      if (bannerLabelEl) bannerLabelEl.textContent = "Secretas";
      if (themeNameEl) themeNameEl.textContent = themeName;
      if (secretCountEl) secretCountEl.textContent = secretsFound + "/" + secretWords.size;
      themeBanner.classList.toggle("complete", secretsFound >= secretWords.size);
    } else {
      themeBanner.hidden = true;
    }
  }

  function newBoard() {
    if (!dictReady) {
      // El diccionario sigue bajando; bootDictionary() llamará newBoard() al terminar.
      if (hintEl) hintEl.textContent = "Cargando diccionario...";
      return;
    }
    if (hintEl) hintEl.textContent = "Generando tablero...";
    startBtn.disabled = true;
    newBoardBtn.disabled = true;
    setTimeout(() => {
      const board = buildBoard();
      grid = board.grid;
      solved = board.solved;
      secretWords = board.secrets;
      themeName = board.theme;
      secretsFound = 0;
      possibleCount = solved.size; // contador de palabras posibles del tablero
      pickSpecial(grid); // ¿juego especial? (una letra vale más)
      updateThemeBanner();
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
      newBoardBtn.hidden = gameMode !== "trivia"; // solo Trivia usa el botón (Saltar)
      newBoardBtn.disabled = false;
      updateStartBtn();
      renderTicker();
    }, 10);
  }

  // Carga async del diccionario: baja words_es.txt, construye el índice y recién
  // entonces genera el primer tablero y habilita "Comenzar" en el splash.
  function bootDictionary() {
    fetch("words_es.txt")
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (txt) {
        dictionary = TypoEngine.makeDictionary(txt);
        dictReady = true;
        // OJO: si hay un duelo en vivo activo (entró por link y el diccionario
        // tardó más que el 'start' del host), NO generar tablero local: pisaría
        // el tablero del servidor y el rival jugaría en un mapa distinto.
        if (!onlineSession) newBoard();   // primer tablero (necesita el diccionario)
        if (revealSplashStart) revealSplashStart();
      })
      .catch(function () {
        if (hintEl) hintEl.textContent = "No se pudo cargar el diccionario. Revisa tu conexión y recarga.";
      });
  }

  gridEl.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  // Click en el tablero blurreado (en reposo) = comenzar la partida.
  gridWrapEl.addEventListener("click", () => {
    if (state === "idle") {
      initAudio();
      startGame();
    }
  });

  startBtn.addEventListener("click", () => {
    if (state === "playing") {
      endGame();
    } else if (state === "ended") {
      summaryOverlay.hidden = true;
      newBoard();
    } else {
      startGame();
    }
  });
  newBoardBtn.addEventListener("click", () => {
    if (gameMode === "trivia" && state === "playing") {
      if (!questionLocked) endQuestion(false); // saltar pregunta
      return;
    }
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
  rotateLeftBtn.addEventListener("click", () => rotateBoard(-1));
  rotateRightBtn.addEventListener("click", () => rotateBoard(1));
  menuBtn.addEventListener("click", () => {
    updateMenu();
    helpOverlay.hidden = false;
  });
  helpCloseBtn.addEventListener("click", () => {
    helpOverlay.hidden = true;
  });
  helpOverlay.addEventListener("click", (e) => {
    if (e.target === helpOverlay) helpOverlay.hidden = true;
  });

  // Selector de modo (Clásico / Trivia) en el menú
  const modeBtns = document.querySelectorAll(".mode-btn");
  function updateModeButtons() {
    modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === gameMode));
  }
  // Menú dinámico: récords + instrucciones del modo seleccionado
  function updateMenu() {
    const ic = document.getElementById("instr-clasico");
    const it = document.getElementById("instr-trivia");
    const ico = document.getElementById("instr-contrarreloj");
    if (ic) ic.hidden = gameMode !== "clasico";
    if (it) it.hidden = gameMode !== "trivia";
    if (ico) ico.hidden = gameMode !== "contrarreloj";
    const nameEl = document.getElementById("menu-mode-name");
    if (nameEl)
      nameEl.textContent =
        gameMode === "trivia" ? "Trivia" : gameMode === "contrarreloj" ? "Contrarreloj" : "Clásico";
    const rec = document.getElementById("menu-records");
    if (rec) {
      let rows;
      if (gameMode === "trivia") {
        rows = [
          ["Palabra más larga", triviaRecords.longestWord ? triviaRecords.longestWord + " (" + triviaRecords.longestWord.length + ")" : "—"],
          ["Mejor puntaje", triviaRecords.bestScore || 0],
          ["Más respuestas", triviaRecords.bestAnswers || 0],
        ];
      } else if (gameMode === "contrarreloj") {
        rows = [
          ["Palabra más larga", contraRecords.longestWord ? contraRecords.longestWord + " (" + contraRecords.longestWord.length + ")" : "—"],
          ["Mejor puntaje", contraRecords.bestScore || 0],
          ["Más palabras", contraRecords.bestWords || 0],
          ["Mejor tiempo", formatTime(contraRecords.bestTime || 0)],
        ];
      } else {
        rows = [
          ["Palabra más larga", records.longestWord ? records.longestWord + " (" + records.longestWord.length + ")" : "—"],
          ["Mejor puntaje", records.bestScore || 0],
          ["Más palabras", records.bestWords || 0],
        ];
      }
      const hc = handicapFor(gameMode);
      const hcVal = hc === null
        ? "calibrando " + Math.min(modeHistory(gameMode).length, HC_CALIBRATION) + "/" + HC_CALIBRATION
        : hc;
      rows.unshift(["Handicap", hcVal]);
      rec.innerHTML = rows
        .map((r) => '<div class="rec-row"><span class="rec-label">' + r[0] + '</span><span class="rec-val">' + r[1] + "</span></div>")
        .join("");
    }
  }
  modeBtns.forEach((b) =>
    b.addEventListener("click", () => {
      gameMode = VALID_MODES.includes(b.dataset.mode) ? b.dataset.mode : "clasico";
      try { localStorage.setItem(MODE_KEY, gameMode); } catch (e) {}
      updateModeButtons();
      updateMenu();
    })
  );
  updateModeButtons();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  });

  updateMuteBtn();
  renderTicker();
  bootDictionary(); // carga el diccionario async; genera el primer tablero al terminar

  // ——— Multijugador en vivo (duelo): lógica y API usada por multiplayer.js ———
  function submitOnline(word) {
    // Si el diccionario aún no baja (entró por link con datos lentos), no se
    // valida localmente: el servidor es la autoridad y confirmará con word_ok.
    const ok = (!dictionary || dictionary.has(word)) && TypoEngine.isValidPath(grid, path);
    if (!ok) {
      playFail();
      flashResult(path, "invalid");
      currentWordEl.classList.add("invalid");
      setTimeout(() => currentWordEl.classList.remove("invalid"), 420);
      return;
    }
    if (foundWords.has(word)) {
      playDup();
      flashResult(path, "dup");
      flashFoundChip(word);
      return;
    }
    // válida localmente: feedback optimista + enviar al servidor (él confirma puntaje/tiempo)
    vibrate([35, 25, 35, 25, 75]);
    playSuccess();
    flashResult(path, "valid");
    if (window.TypoCelebrate) window.TypoCelebrate(word);
    if (onlineSession.onWord) onlineSession.onWord(word);
  }

  function startOnlineClock() {
    stopOnlineClock();
    onlineClockHandle = setInterval(() => {
      if (!onlineSession) return stopOnlineClock();
      const left = Math.max(0, Math.round((onlineSession.deadline - Date.now()) / 1000));
      timerEl.textContent = formatTime(left);
      timerEl.classList.toggle("warning", left <= WARN_SECONDS && left > 0);
    }, 250);
  }
  function stopOnlineClock() {
    if (onlineClockHandle) { clearInterval(onlineClockHandle); onlineClockHandle = null; }
  }
  function renderOnlineStats() {
    let s = 0; for (const v of foundWords.values()) s += v;
    scoreEl.textContent = String(s);
    wordCountEl.textContent = String(foundWords.size);
  }

  // API pública para el cliente de multijugador (multiplayer.js)
  window.TypoOnline = {
    // Empieza un duelo: pinta el tablero del servidor y arranca el reloj compartido.
    begin(serverGrid, deadline, onWord) {
      // Reconexión al MISMO duelo (el server re-manda el tablero): no borrar el
      // progreso local, solo actualizar reloj y callback.
      if (onlineSession && !onlineSession.ended && grid.length &&
          JSON.stringify(grid) === JSON.stringify(serverGrid)) {
        onlineSession.deadline = deadline;
        onlineSession.onWord = onWord;
        startOnlineClock();
        return;
      }
      if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
      onlineSession = { deadline, onWord, ended: false };
      grid = serverGrid;
      foundWords = new Map();
      secretWords = new Set();
      boostedLetter = ""; boostMult = 1;
      possibleCount = 0;
      path = [];
      state = "playing";
      newBoardBtn.hidden = true;
      if (themeBanner) themeBanner.hidden = true;
      gridWrapEl.classList.remove("blurred");
      renderGrid();
      renderPath();
      renderFoundList();
      renderOnlineStats();
      startOnlineClock();
    },
    setDeadline(dl) { if (onlineSession) onlineSession.deadline = dl; },
    // El servidor confirmó una palabra: suma puntaje y muestra +N (+Ns si dio tiempo).
    wordConfirmed(word, pts, gainedTime) {
      if (!onlineSession) return;
      if (!foundWords.has(word)) { foundWords.set(word, pts); renderFoundList(); renderOnlineStats(); }
      showScorePop(pts);
      if (gainedTime) showTimeGain(gainedTime);
    },
    myScore() { let s = 0; for (const v of foundWords.values()) s += v; return s; },
    // Reconexión: el server re-manda mis palabras ya validadas; se restaura la lista.
    restore(words) {
      if (!onlineSession || !Array.isArray(words)) return;
      for (const w of words) {
        if (!foundWords.has(w)) foundWords.set(w, TypoEngine.scoreForWord(w));
      }
      renderFoundList();
      renderOnlineStats();
    },
    // La sala murió (p.ej. el server se reinició): salir del duelo sin congelarse.
    abort(msg) {
      onlineSession = null;
      stopOnlineClock();
      if (hintEl && msg) hintEl.textContent = msg;
      newBoard();
    },
    // Termina el duelo (el servidor mandó 'end'): congela el tablero.
    finish() {
      if (!onlineSession) return;
      playTimeUp();
      onlineSession.ended = true;
      state = "ended";
      stopOnlineClock();
      gridWrapEl.classList.add("blurred");
    },
    // Sale del modo online y vuelve al estado normal (idle con tablero nuevo).
    quit() {
      onlineSession = null;
      stopOnlineClock();
      newBoard();
    },
    formatTime,
  };

  // ——— Portada / splash: título + carga + botón Comenzar ———
  const splashEl = document.getElementById("splash");
  const splashStart = document.getElementById("splash-start");
  const splashLoader = document.getElementById("splash-loader");
  // Tablero "fantasma" detrás de la carga (efecto glitch de arranque).
  const splashGhost = document.getElementById("splash-ghost");
  if (splashGhost) {
    const g = TypoEngine.generateGrid();
    splashGhost.innerHTML = g
      .flat()
      .map((cell) => '<span class="ghost-cell">' + (cell === "QU" ? "Qu" : cell) + "</span>")
      .join("");
  }

  if (splashEl && splashStart) {
    // "Comenzar" se revela solo cuando el diccionario terminó de cargar, con un
    // mínimo de 1300 ms para que se alcance a ver la animación de carga.
    const splashShownAt = Date.now();
    revealSplashStart = function () {
      const wait = Math.max(0, 1300 - (Date.now() - splashShownAt));
      setTimeout(() => {
        if (splashLoader) splashLoader.hidden = true;
        splashStart.hidden = false;
      }, wait);
    };
    if (dictReady) revealSplashStart(); // por si el diccionario ganó la carrera
    splashStart.addEventListener("click", () => {
      initAudio(); // el gesto del usuario desbloquea el audio
      vibrate([40, 30, 60]); // "arma" el háptico dentro del gesto + feedback
      splashEl.classList.add("hidden");
      startGame();
    });
  }

  // PWA: registra el service worker (app instalable + offline, network-first)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
