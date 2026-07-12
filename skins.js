/* ═══════════════════════════════════════════════════════════════════════════
   TYPO · SKINS — selector + efectos propios de cada skin.
   No toca game.js: escucha el DOM.

   Cambiar skin:  ?skin=manga   ·   localStorage typo-skin   ·   TypoSkin.set()
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var SKINS = ["default", "manga"];
  var KEY = "typo-skin";

  function current() {
    var q = new URLSearchParams(location.search).get("skin");
    if (q && SKINS.indexOf(q) !== -1) return q;
    var s = localStorage.getItem(KEY);
    return SKINS.indexOf(s) !== -1 ? s : "default";
  }

  function apply(skin) {
    document.documentElement.setAttribute("data-skin", skin);
    try { localStorage.setItem(KEY, skin); } catch (e) {}
    if (skin === "manga") mountSfx(); else unmountSfx();
  }

  /* ── SFX de manga: el acierto grita ────────────────────────────────────── */
  var SFX = ["¡DON!", "¡ZUN!", "¡BAN!", "¡GOU!", "¡DOGA!", "¡ZUSHI!"];
  var observer = null;
  var lastShout = 0;

  function shout(el) {
    var now = Date.now();
    if (now - lastShout < 350) return;   // una palabra = un grito, no uno por letra
    lastShout = now;

    var r = el.getBoundingClientRect();
    var n = document.createElement("div");
    n.className = "typo-sfx";
    n.textContent = SFX[(Math.random() * SFX.length) | 0];
    n.style.fontSize = (1.9 + Math.random() * 1.3).toFixed(2) + "rem";
    n.style.left = (r.left + r.width * 0.3) + "px";
    n.style.top = (r.top - 18) + "px";
    document.body.appendChild(n);
    requestAnimationFrame(function () { n.classList.add("go"); });
    setTimeout(function () { n.remove(); }, 1100);
  }

  function mountSfx() {
    if (observer) return;
    var grid = document.querySelector(".grid");
    if (!grid) return;
    observer = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var t = muts[i].target;
        if (t.classList && t.classList.contains("cell") && t.classList.contains("valid")) {
          shout(t);
          return;
        }
      }
    });
    observer.observe(grid, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  function unmountSfx() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  /* ── Selector de skin en el menú (inyectado, no toca index.html) ───────── */
  var NAMES = { "default": "Clásico", "manga": "Manga" };

  function mountSelector() {
    var modal = document.querySelector("#help-overlay .modal");
    if (!modal || document.getElementById("skin-select")) return;

    var wrap = document.createElement("div");
    wrap.id = "skin-select";
    wrap.className = "skin-select";

    var label = document.createElement("div");
    label.className = "skin-select-label";
    label.textContent = "Estilo";
    wrap.appendChild(label);

    var row = document.createElement("div");
    row.className = "skin-row";
    SKINS.forEach(function (s) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "skin-btn";
      b.setAttribute("data-skin", s);
      b.textContent = NAMES[s] || s;
      b.addEventListener("click", function () { apply(s); refresh(); });
      row.appendChild(b);
    });
    wrap.appendChild(row);

    // Colocar arriba del todo del menú (antes del selector de modo si existe).
    var anchor = modal.querySelector(".mode-select") || modal.querySelector("h3, h2");
    if (anchor) modal.insertBefore(wrap, anchor);
    else modal.appendChild(wrap);

    function refresh() {
      var cur = current();
      row.querySelectorAll(".skin-btn").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-skin") === cur);
      });
    }
    refresh();
  }

  /* ── API ──────────────────────────────────────────────────────────────── */
  window.TypoSkin = {
    list: SKINS,
    get: current,
    set: apply,
    cycle: function () {
      var i = SKINS.indexOf(current());
      apply(SKINS[(i + 1) % SKINS.length]);
    }
  };

  apply(current());
  document.addEventListener("DOMContentLoaded", function () { apply(current()); mountSelector(); });
  // por si el DOM ya estaba listo cuando cargó el script
  if (document.readyState !== "loading") mountSelector();
})();
