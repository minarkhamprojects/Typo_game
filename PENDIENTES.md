# PENDIENTES — Typo
*Última actualización: 2026-07-05*

---

## En progreso

- [ ] Ninguna tarea activa

---

## Backlog

- [ ] Guardar mejores puntajes localmente (localStorage) para ver récord personal
- [ ] Soporte para deshacer con tecla Escape además de arrastrar hacia atrás
- [ ] Modo sin temporizador (libre)
- [ ] Haptic en iPhone: `navigator.vibrate` no existe en iOS Safari; solo sería posible
      con un envoltorio nativo (Capacitor/app). Pendiente si se quiere app nativa.

---

## Bloqueados

- [ ] Ninguno

---

## Completados

- [x] Setup inicial del repo (creado desde proyecto-base)
- [x] Diccionario en español normalizado (~636.000 palabras con conjugaciones); validación
      por búsqueda binaria + mini-trie por tablero para no gastar memoria en móvil
- [x] Motor del juego: generación de tablero jugable, trie, resolver, puntaje (`engine.js`)
- [x] UI del tablero 4×4 con selección por arrastre (mouse y touch vía Pointer Events)
- [x] Temporizador de 3 minutos, panel de palabras encontradas, resumen final con
      palabras que te perdiste
- [x] Modo claro/oscuro
- [x] Probado en navegador (Playwright): palabra válida, duplicado rechazado, arrastre
      inválido no rompe la app, fin de partida y reinicio
- [x] Línea que conecta las celdas seleccionadas, con iluminación en vivo (verde) cuando
      lo conectado ya es una palabra válida no encontrada
- [x] Haptic feedback (`navigator.vibrate`): tick por letra conectada y patrón al lograr
      palabra — Android/Chrome; iOS Safari no soporta la API
- [x] Selección menos sensible: zona muerta al centro de la celda para no seleccionar
      vecinas por rozar bordes; puente que rellena celdas saltadas en arrastres rápidos
      (arregla que no se detectaran palabras largas)
- [x] Blur del tablero antes de comenzar y al terminar la partida (no se pueden estudiar
      las letras con el reloj parado)
- [x] Sonido retro sintetizado (Web Audio): click por letra, chime al acertar, doble nota
      en repetida, buzz en inválida; botón 🔊/🔇 persistido en localStorage
- [x] Veredicto solo al soltar (se quitó el verde en vivo durante el arrastre)
- [x] Palabra repetida: destello ámbar en las teclas y resaltado del chip en la lista
- [x] Haptic iOS best-effort: toggle de un switch nativo oculto (iOS 17.4+); si Apple
      exige toggle manual queda como no-op — haptic pleno solo con app nativa
- [x] Partida de 1:30 (antes 3:00)
- [x] Aviso en los últimos 10 segundos: reloj rojo pulsante + tick sonoro + vibración
- [x] Botón 🔄 para girar el tablero 90° (misma partida, otra perspectiva)
- [x] Resumen final: la(s) palabra(s) más larga(s) con su número de letras, mostrando
      empates en vez de elegir una arbitraria
- [x] Audio robusto en iOS: navigator.audioSession='playback' (suena aunque el iPhone
      esté en silencio, iOS 16.4+), unlock con buffer silencioso y resume() automático
      si el contexto se suspende (bloqueo de pantalla / cambio de app)
- [x] Giro del tablero con botones ⟲/⟳ a ambos lados del tablero (antes un solo 🔄)
- [x] Rediseño visual "8BitDo retro": escena oscura cálida, chasis crema, teclas crema
      con marca roja secundaria, tecla oscura al arrastrar, retroiluminación roja al
      acertar (pulse) y shake en inválidas; tipografías Archivo + Space Grotesk; el
      acento es una sola variable CSS (--accent)
- [x] Marcas miniatura de las teclas en rojo fijo (#D8342E), desacopladas del acento
- [x] Botón principal con relieve de keycap 3D rojo; cambia de función:
      Comenzar → Terminar (corta la partida) → Jugar de nuevo
- [x] Keycap 3D según guía: cuerpo con degradado radial + tapa cóncava (::before, más
      recortada abajo) + faldón doble; estados (arrastre oscuro, acierto rojo con glow,
      inválida, repetida ámbar) con override del cuerpo y de la tapa
- [x] Distribución de la guía: pantalla LCD ámbar "Typo", marcadores como teclas crema,
      botón ☰ (abre Cómo jugar), tablero sin placa con gap ~7px, y barra inferior
      ↺ · Comenzar · Cambiar tablero · Son · ↻ (giros movidos a la barra inferior)
