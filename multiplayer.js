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

  // Identidad persistente del jugador (sobrevive reconexiones y cambios de app)
  let PID;
  try {
    PID = localStorage.getItem("typo-pid");
    if (!PID) { PID = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "p" + Date.now() + "-" + Math.floor(Math.random() * 1e9); localStorage.setItem("typo-pid", PID); }
  } catch (e) { PID = "p" + Date.now(); }

  let lastRoom = null;         // { code, nick } para reconectar
  let intentionalClose = false;
  let reconnectTimer = null;

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
    try { if (ws) { ws.onclose = null; ws.close(); } } catch (e) {}
    intentionalClose = false;
    ws = new WebSocket(SERVER_URL);
    ws.onopen = () => then && then();
    ws.onmessage = (e) => { try { handle(JSON.parse(e.data)); } catch (err) {} };
    ws.onerror = () => {};
    ws.onclose = () => { scheduleReconnect(); };
  }

  // Reconexión automática: al cerrarse la conexión (p.ej. cambiaste de app para
  // compartir el código, o se durmió la pantalla) reintenta unirse a la sala.
  function scheduleReconnect() {
    if (intentionalClose || !lastRoom || !lastRoom.code) return;
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (ws && ws.readyState === 1) return;
      connect(() => sendMsg("join_room", { code: lastRoom.code, nick: lastRoom.nick, pid: PID, handicap: myHandicap() }));
    }, 700);
  }
  // Al volver a la app, reconecta de inmediato si hace falta.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && lastRoom && lastRoom.code && (!ws || ws.readyState !== 1)) {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      connect(() => sendMsg("join_room", { code: lastRoom.code, nick: lastRoom.nick, pid: PID, handicap: myHandicap() }));
    }
  });
  function sendMsg(type, data) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(Object.assign({ type }, data || {})));
  }

  function handle(m) {
    switch (m.type) {
      case "room":
        if (m.youId) youId = m.youId;
        code = m.code; hostId = m.host; players = m.players;
        isHost = youId === hostId;
        lastRoom = { code: m.code, nick: (lastRoom && lastRoom.nick) || (nickIn.value || "").trim() };
        // Si el duelo ya está en curso no mostramos el lobby encima (llega board después).
        if (scorebar.hidden) renderLobby();
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
    var skin = document.documentElement.getAttribute("data-skin") || "default";
    var hostIcon = skin === "manga" ? "★ " : "◆ "; // anfitrión, según el estilo del juego
    playersEl.innerHTML = players
      .map((p) => {
        const you = p.id === youId ? ' <span class="mp-you">(tú)</span>' : "";
        const host = p.id === hostId ? '<span class="mp-host">' + hostIcon + "</span>" : "";
        return "<li>" + host + escapeHtml(p.nick) + you + "</li>";
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
  function leaveRoom() {
    intentionalClose = true;
    lastRoom = null;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    sendMsg("leave", {});
    try { if (ws) { ws.onclose = null; ws.close(); } } catch (e) {}
  }

  $("mp-open") && $("mp-open").addEventListener("click", () => { if ($("help-overlay")) $("help-overlay").hidden = true; openOverlay(); });
  $("mp-create") && $("mp-create").addEventListener("click", () => { clearErr(); lastRoom = { code: null, nick: getNick() }; connect(() => sendMsg("create_room", { nick: getNick(), handicap: myHandicap(), pid: PID })); });
  $("mp-join") && $("mp-join").addEventListener("click", () => {
    clearErr();
    const c = (codeIn.value || "").trim().toUpperCase();
    if (c.length !== 4) return showErr("El código es de 4 caracteres.");
    lastRoom = { code: c, nick: getNick() };
    connect(() => sendMsg("join_room", { code: c, nick: getNick(), handicap: myHandicap(), pid: PID }));
  });
  codeIn && codeIn.addEventListener("input", () => { codeIn.value = codeIn.value.toUpperCase(); });
  startBtn && startBtn.addEventListener("click", () => sendMsg("start", {}));
  // Compartir el código con la hoja nativa (NO manda la app a segundo plano → no corta la conexión)
  $("mp-share") && $("mp-share").addEventListener("click", async () => {
    const base = location.href.split("?")[0].split("#")[0];
    const url = base + "?sala=" + (code || "");            // el link YA lleva el código
    const text = "¡Te reto a un duelo en Typo! ⚔️ Toca para entrar:\n" + url;
    try {
      if (navigator.share) await navigator.share({ title: "Typo — duelo en vivo", text, url });
      else { await navigator.clipboard.writeText(text); showErr("Link copiado ✓ pégalo en WhatsApp"); }
    } catch (e) { /* el usuario canceló el compartir */ }
  });
  $("mp-close") && $("mp-close").addEventListener("click", () => { leaveRoom(); overlay.hidden = true; resetToHome(); });
  $("mp-again") && $("mp-again").addEventListener("click", () => { resultsOv.hidden = true; renderLobby(); });
  $("mp-exit") && $("mp-exit").addEventListener("click", () => { leaveRoom(); resultsOv.hidden = true; if (window.TypoOnline) window.TypoOnline.quit(); });

  // Si el link trae ?sala=CODE (compartido), entra directo al lobby y se une.
  (function autoJoinFromUrl() {
    var sala;
    try { sala = new URLSearchParams(location.search).get("sala"); } catch (e) { sala = null; }
    if (!sala) return;
    var c = String(sala).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (c.length !== 4) return;
    var go = function () {
      var sp = document.getElementById("splash");
      if (sp) sp.classList.add("hidden");
      if ($("help-overlay")) $("help-overlay").hidden = true;
      openOverlay();
      codeIn.value = c;
      var nick = "";
      try { nick = (localStorage.getItem("typo-nick") || "").trim(); } catch (e) {}
      if (nick) {
        nickIn.value = nick;
        lastRoom = { code: c, nick: nick };
        connect(function () { sendMsg("join_room", { code: c, nick: nick, handicap: myHandicap(), pid: PID }); });
      } else {
        nickIn.focus();
        showErr("Pon tu nombre y toca Unirse para entrar a la sala " + c);
      }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go);
    else setTimeout(go, 50);
  })();
})();
