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
  }

  /* ── Celebración por palabra (la que grita "¡DON!" / "¡BRUTAL!") ──────────
     game.js avisa vía window.TypoCelebrate(word); el SKIN decide el mensaje.
     Criterio por longitud:
       3 letras  → nada
       4 letras  → a veces (mensaje suave)
       5-6       → siempre (medio)
       7+        → siempre (grande, entre más larga más épico)                 */
  var MESSAGES = {
    "default": {
      mild:   ["¡BIEN!", "¡VA!", "¡ESO!", "¡SÍ!"],
      medium: ["¡GENIAL!", "¡CRACK!", "¡ESO ES!", "¡MUY BIEN!", "¡GRANDE!"],
      big:    ["¡BRUTAL!", "¡INCREÍBLE!", "¡MAESTRO!", "¡IMPARABLE!", "¡ESPECTACULAR!", "¡LEYENDA!"]
    },
    "manga": {
      mild:   ["¡DON!", "¡ZUN!", "¡BAN!", "¡PAN!"],
      medium: ["¡DOGO!", "¡GOOO!", "¡DOKAN!", "¡GASHIN!", "¡ZUSHIN!"],
      big:    ["¡DODON!", "¡GOGOGO!", "¡ZUDAAAN!", "¡BAKUUN!", "¡DOGYAAAN!"]
    }
  };
  // Easter eggs de anime: aparecen de vez en cuando (manga, palabras de 5+).
  var ANIME_EGGS = ["¡NANI?!", "¡SUGOI!", "¡SENPAI!", "¡KAWAII!", "¡YOSH!", "¡ITADAKIMASU!", "¡OMAE WA MOU...!", "¡KAWARIMI!"];

  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  window.TypoCelebrate = function (word) {
    var len = (word || "").length;
    if (len <= 3) return;                       // 3 letras: nada
    var skin = current();
    var pool = MESSAGES[skin] || MESSAGES["default"];
    var tier, size;
    if (len === 4) {
      if (Math.random() > 0.55) return;         // 4 letras: solo a veces
      tier = pool.mild; size = 1.9;
    } else if (len <= 6) {
      tier = pool.medium; size = 2.5;
    } else {
      tier = pool.big; size = Math.min(4.2, 2.8 + (len - 6) * 0.35); // entre más larga, más grande
    }
    var host = document.getElementById("grid-wrap") || document.body;
    var r = host.getBoundingClientRect();
    var msg = pick(tier);
    if (skin === "manga" && len >= 5 && Math.random() < 0.16) msg = pick(ANIME_EGGS); // easter egg
    var n = document.createElement("div");
    n.className = "typo-sfx";
    n.textContent = msg;
    n.setAttribute("data-sfx", msg); // para la capa de granulado (::after)
    n.style.fontSize = size.toFixed(2) + "rem";
    n.style.left = (r.left + r.width * (0.18 + Math.random() * 0.4)) + "px";
    n.style.top = (r.top + r.height * (0.12 + Math.random() * 0.28)) + "px";
    if (skin === "manga") {
      // guiño de color manga→anime: las palabras grandes salen a todo color
      var hue = (Math.random() * 360) | 0;
      n.style.setProperty("--sfx-color", "hsl(" + hue + ", 90%, 55%)");
      if (len >= 7) n.classList.add("epic");
    }
    document.body.appendChild(n);
    requestAnimationFrame(function () { n.classList.add("go"); });
    setTimeout(function () { n.remove(); }, 1100);
  };

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
