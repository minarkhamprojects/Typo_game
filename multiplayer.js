// Cliente de multijugador en vivo para Typo.
// Maneja el lobby (crear/unirse por código), el marcador del rival y los
// resultados. El tablero, el drag y el reloj los maneja game.js vía window.TypoOnline.
(function () {
  const SERVER_URL =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "ws://localhost:8790"
      : "wss://typo.minpeniche.com";

  const $ = (id) => document.getElementById(id);
  let ws = null, youId = null, code = null, hostId = null, players = [], isHost = false;

  // ——— refs ———
  const overlay = $("mp-overlay");
  const homeEl = $("mp-home");
  const lobbyEl = $("mp-lobby");
  const nickIn = $("mp-nick");
  const codeIn = $("mp-code");
  const codeDisplay = $("mp-code-display");
  const playersEl = $("mp-players");
  const startBtn = $("mp-start");
  const waitEl = $("mp-wait");
  const errEl = $("mp-error");
  const scorebar = $("mp-scorebar");
  const resultsOv = $("mp-results");
  const winnerEl = $("mp-winner");
  const resultsList = $("mp-results-list");

  function showErr(msg) { if (errEl) { errEl.textContent = msg; errEl.hidden = false; } }
  function clearErr() { if (errEl) errEl.hidden = true; }
  function getNick() {
    const n = (nickIn.value || "").trim().slice(0, 16) || "Tú";
    try { localStorage.setItem("typo-nick", n); } catch (e) {}
    return n;
  }
  function myHandicap() {
    try {
      const h = JSON.parse(localStorage.getItem("typo-handicap") || "{}");
      const arr = h.clasico || [];
      if (arr.length < 10) return 0;
      const last = arr.slice(-10);
      return Math.round(last.reduce((a, b) => a + b, 0) / last.length);
    } catch (e) { return 0; }
  }

  function connect(then) {
    try { if (ws) ws.close(); } catch (e) {}
    ws = new WebSocket(SERVER_URL);
    ws.onopen = () => then && then();
    ws.onmessage = (e) => { try { handle(JSON.parse(e.data)); } catch (err) {} };
    ws.onerror = () => showErr("Sin conexión con el servidor. Intenta de nuevo.");
    ws.onclose = () => {};
  }
  function sendMsg(type, data) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(Object.assign({ type }, data || {})));
  }

  function handle(m) {
    switch (m.type) {
      case "room":
        if (m.youId) youId = m.youId;
        code = m.code; hostId = m.host; players = m.players;
        isHost = youId === hostId;
        renderLobby();
        break;
      case "board":
        // deadline local = mi reloj + los ms restantes que dice el servidor
        startDuel(m.grid, Date.now() + (m.ms != null ? m.ms : 90000));
        break;
      case "state":
        players = m.players;
        if (window.TypoOnline && m.ms != null) window.TypoOnline.setDeadline(Date.now() + m.ms);
        renderScorebar();
        break;
      case "word_ok":
        if (window.TypoOnline) window.TypoOnline.wordConfirmed(m.word, m.pts, m.gainedTime);
        break;
      case "end":
        endDuel(m.results, m.winner);
        break;
      case "error":
        showErr(m.msg);
        break;
    }
  }

  // ——— lobby ———
  function openOverlay() {
    clearErr();
    homeEl.hidden = false;
    lobbyEl.hidden = true;
    resultsOv.hidden = true;
    overlay.hidden = false;
    try { nickIn.value = localStorage.getItem("typo-nick") || ""; } catch (e) {}
  }
  function renderLobby() {
    clearErr();
    homeEl.hidden = true;
    lobbyEl.hidden = false;
    overlay.hidden = false;
    resultsOv.hidden = true;
    codeDisplay.textContent = code || "----";
    playersEl.innerHTML = players
      .map((p) => {
        const you = p.id === youId ? ' <span class="mp-you">(tú)</span>' : "";
        const crown = p.id === hostId ? "👑 " : "";
        return "<li>" + crown + escapeHtml(p.nick) + you + "</li>";
      })
      .join("");
    startBtn.hidden = !isHost || players.length < 2;
    waitEl.hidden = isHost;
  }
  function resetToHome() {
    homeEl.hidden = false;
    lobbyEl.hidden = true;
  }

  // ——— duelo ———
  function startDuel(grid, deadline) {
    overlay.hidden = true;
    resultsOv.hidden = true;
    scorebar.hidden = false;
    renderScorebar();
    if (window.TypoOnline) window.TypoOnline.begin(grid, deadline, (word) => sendMsg("found", { word }));
  }
  function renderScorebar() {
    if (!scorebar || scorebar.hidden) return;
    const sorted = players.slice().sort((a, b) => b.score - a.score);
    scorebar.innerHTML = sorted
      .map((p) => {
        const me = p.id === youId ? " me" : "";
        return '<span class="mp-chip' + me + '"><b>' + escapeHtml(p.nick) + "</b> " + p.score + "</span>";
      })
      .join("");
  }
  function endDuel(results, winner) {
    if (window.TypoOnline) window.TypoOnline.finish();
    scorebar.hidden = true;
    const me = results.find((r) => r.id === youId);
    const iWon = me && winner.includes(me.nick);
    const tie = winner.length > 1;
    winnerEl.textContent = tie ? "¡Empate!" : iWon ? "¡Ganaste! 🏆" : "Ganó " + winner[0];
    resultsList.innerHTML = results
      .map((r) => {
        const me2 = r.id === youId ? " me" : "";
        return (
          '<div class="rec-row' + me2 + '"><span class="rec-label">' + escapeHtml(r.nick) +
          '</span><span class="rec-val">' + r.score + " pts · neto " + (r.net >= 0 ? "+" : "") + r.net + "</span></div>"
        );
      })
      .join("");
    resultsOv.hidden = false;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  // ——— wiring ———
  $("mp-open") && $("mp-open").addEventListener("click", () => { if ($("help-overlay")) $("help-overlay").hidden = true; openOverlay(); });
  $("mp-create") && $("mp-create").addEventListener("click", () => { clearErr(); connect(() => sendMsg("create_room", { nick: getNick(), handicap: myHandicap() })); });
  $("mp-join") && $("mp-join").addEventListener("click", () => {
    clearErr();
    const c = (codeIn.value || "").trim().toUpperCase();
    if (c.length !== 4) return showErr("El código es de 4 caracteres.");
    connect(() => sendMsg("join_room", { code: c, nick: getNick(), handicap: myHandicap() }));
  });
  codeIn && codeIn.addEventListener("input", () => { codeIn.value = codeIn.value.toUpperCase(); });
  startBtn && startBtn.addEventListener("click", () => sendMsg("start", {}));
  $("mp-close") && $("mp-close").addEventListener("click", () => { sendMsg("leave", {}); try { ws && ws.close(); } catch (e) {} overlay.hidden = true; resetToHome(); });
  $("mp-again") && $("mp-again").addEventListener("click", () => { resultsOv.hidden = true; renderLobby(); });
  $("mp-exit") && $("mp-exit").addEventListener("click", () => { sendMsg("leave", {}); try { ws && ws.close(); } catch (e) {} resultsOv.hidden = true; if (window.TypoOnline) window.TypoOnline.quit(); });
})();
