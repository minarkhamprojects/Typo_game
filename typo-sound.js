/* ============================================================
   TYPO — Motor de sonido (vanilla, Web Audio API)
   Sonidos aprobados: thock ASMR de tecla mecánica, acierto,
   inválido (buzzer retro), repetida, giro de tablero.
   Sin dependencias. Se auto-inicializa al primer gesto.

   USO:
     <script src="typo-sound.js"></script>
     TypoSound.play('tap');     // encadenar / pulsar letra
     TypoSound.play('valid');   // palabra correcta
     TypoSound.play('invalid'); // palabra inválida
     TypoSound.play('repeat');  // palabra ya encontrada
     TypoSound.mute(true|false) // silenciar
     TypoSound.toggle()         // alterna, devuelve el nuevo estado
   ============================================================ */
(function (global) {
  var AC = null, noiseBuf = null, muted = false;

  function ctx() {
    if (!AC) AC = new (global.AudioContext || global.webkitAudioContext)();
    if (AC.state === "suspended") AC.resume();
    return AC;
  }

  function noise(ac) {
    if (noiseBuf) return noiseBuf;
    var b = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.1), ac.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = b);
  }

  // thock de tecla: transiente de ruido filtrado + cuerpo grave de seno
  function keyClick(ac, t, o) {
    o = o || {};
    var g = o.gain || 0.4;
    var src = ac.createBufferSource(); src.buffer = noise(ac);
    var bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = o.click || 2400; bp.Q.value = 0.9;
    var hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
    var ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(g * 0.1, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(bp); bp.connect(hp); hp.connect(ng); ng.connect(ac.destination);
    src.start(t); src.stop(t + 0.05);

    var os = ac.createOscillator(); os.type = "sine";
    os.frequency.setValueAtTime(o.thock || 130, t);
    os.frequency.exponentialRampToValueAtTime((o.thock || 130) * 0.7, t + 0.045);
    var og = ac.createGain();
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(g * 0.13, t + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    os.connect(og); og.connect(ac.destination); os.start(t); os.stop(t + 0.07);
  }

  // inválido: buzzer retro descendente de dos tonos
  function errorSound(ac, t) {
    [[330, 0], [247, 0.085], [160, 0.17]].forEach(function (p) {
      var f = p[0], dt = p[1];
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + dt);
      g.gain.exponentialRampToValueAtTime(0.05, t + dt + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.1);
      o.connect(g); g.connect(ac.destination); o.start(t + dt); o.stop(t + dt + 0.11);
    });
  }

  function play(type) {
    if (muted) return;
    try {
      var ac = ctx(), t = ac.currentTime;
      if (type === "invalid") return errorSound(ac, t);
      if (type === "valid") {
        keyClick(ac, t,        { thock: 155, click: 2700, gain: 0.5 });
        keyClick(ac, t + 0.055, { thock: 200, click: 3100, gain: 0.42 });
        return;
      }
      if (type === "repeat") return keyClick(ac, t, { thock: 175, click: 2200, gain: 0.42 });
      // 'tap' (y cualquier otro): thock con leve variación de tono
      keyClick(ac, t, { thock: 128 + Math.random() * 22, click: 2300 + Math.random() * 500, gain: 0.4 });
    } catch (e) {}
  }

  global.TypoSound = {
    play: play,
    mute: function (v) { muted = !!v; },
    toggle: function () { muted = !muted; return muted; },
    get muted() { return muted; }
  };
})(window);
