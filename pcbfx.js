/* pcbfx.js — Electricidad viajando por la placa madre.
   Dibuja trazas estilo PCB (ruteo Manhattan con esquinas) sobre el fondo, con
   pulsos de luz que viajan por ellas simulando que la tarjeta está "encendida".
   Autocontenido, sin dependencias. Se apaga si el usuario pide menos movimiento. */
(function () {
  var canvas = document.getElementById("pcb-fx");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var W = 0, H = 0, DPR = 1;
  var traces = [];
  var pulses = [];

  // Paleta eléctrica (teal/cian/verde) coherente con la motherboard
  var COLORS = ["#54ffd0", "#63e0ff", "#8affa8", "#3ad1ff"];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  // Construye una traza: polilínea con segmentos horizontales/verticales (Manhattan)
  function buildTrace() {
    var grid = 26;                      // paso de rejilla del ruteo
    var cols = Math.max(6, Math.round(W / grid));
    var rows = Math.max(6, Math.round(H / grid));
    var x = (Math.random() * cols) | 0;
    var y = (Math.random() * rows) | 0;
    var pts = [[x, y]];
    var steps = 6 + ((Math.random() * 10) | 0);
    var horiz = Math.random() < 0.5;
    for (var i = 0; i < steps; i++) {
      var len = 2 + ((Math.random() * 6) | 0);
      if (horiz) x += (Math.random() < 0.5 ? -1 : 1) * len;
      else y += (Math.random() < 0.5 ? -1 : 1) * len;
      x = Math.max(0, Math.min(cols, x));
      y = Math.max(0, Math.min(rows, y));
      var last = pts[pts.length - 1];
      if (x !== last[0] || y !== last[1]) pts.push([x, y]);
      horiz = !horiz;
    }
    // a coordenadas de pantalla + longitudes acumuladas
    var poly = pts.map(function (p) { return [p[0] * grid, p[1] * grid]; });
    var segs = [], total = 0;
    for (var j = 1; j < poly.length; j++) {
      var dx = poly[j][0] - poly[j - 1][0], dy = poly[j][1] - poly[j - 1][1];
      var d = Math.hypot(dx, dy);
      if (d < 1) continue;
      segs.push({ x0: poly[j - 1][0], y0: poly[j - 1][1], dx: dx, dy: dy, len: d, acc: total });
      total += d;
    }
    return { poly: poly, segs: segs, total: total, color: pick(COLORS) };
  }

  // Punto a distancia s a lo largo de una traza
  function pointAt(tr, s) {
    var segs = tr.segs;
    for (var i = 0; i < segs.length; i++) {
      var sg = segs[i];
      if (s <= sg.acc + sg.len) {
        var t = (s - sg.acc) / sg.len;
        return [sg.x0 + sg.dx * t, sg.y0 + sg.dy * t];
      }
    }
    var last = tr.poly[tr.poly.length - 1];
    return [last[0], last[1]];
  }

  function spawnPulse(tr) {
    return {
      trace: tr,
      pos: rand(0, tr.total),
      speed: rand(55, 120) / 60,   // px por frame aprox
      life: 1,
      tail: rand(60, 130),
      color: tr.color,
    };
  }

  function rebuild() {
    var area = W * H;
    var count = Math.max(10, Math.min(26, Math.round(area / 32000)));
    traces = [];
    pulses = [];
    for (var i = 0; i < count; i++) {
      var tr = buildTrace();
      if (tr.total > 40) {
        traces.push(tr);
        pulses.push(spawnPulse(tr));
        if (Math.random() < 0.6) pulses.push(spawnPulse(tr));
      }
    }
  }

  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    rebuild();
    if (reduce) drawStatic();
  }

  // Trazas base tenues (los "cables")
  function drawTraces() {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var i = 0; i < traces.length; i++) {
      var tr = traces[i];
      ctx.beginPath();
      ctx.moveTo(tr.poly[0][0], tr.poly[0][1]);
      for (var j = 1; j < tr.poly.length; j++) ctx.lineTo(tr.poly[j][0], tr.poly[j][1]);
      ctx.strokeStyle = "rgba(90,220,180,0.08)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    drawTraces();
  }

  function frame() {
    ctx.clearRect(0, 0, W, H);
    drawTraces();
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < pulses.length; i++) {
      var p = pulses[i];
      p.pos += p.speed;
      if (p.pos > p.trace.total + p.tail) {
        // reaparece en otra traza para que la red parezca viva
        var tr = traces[(Math.random() * traces.length) | 0] || p.trace;
        pulses[i] = spawnPulse(tr);
        continue;
      }
      // estela: varios puntos detrás de la cabeza, desvaneciéndose
      var head = p.pos;
      var samples = 10;
      for (var k = 0; k < samples; k++) {
        var back = head - (k / samples) * p.tail;
        if (back < 0) break;
        var pt = pointAt(p.trace, back);
        var a = (1 - k / samples);
        var r = 2.8 * a + 0.6;
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.1 + 0.4 * a;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 13 * a;
        ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2);
        ctx.fill();
      }
      // cabeza brillante
      var hp = pointAt(p.trace, Math.min(head, p.trace.total));
      ctx.beginPath();
      ctx.fillStyle = "#eafff7";
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 16;
      ctx.arc(hp[0], hp[1], 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = "source-over";
    raf = requestAnimationFrame(frame);
  }

  var raf = null;
  function start() { if (!reduce && raf == null) raf = requestAnimationFrame(frame); }
  function stop() { if (raf != null) { cancelAnimationFrame(raf); raf = null; } }

  // Pausar cuando la pestaña no está visible (ahorra batería)
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });

  resize();
  start();
})();
