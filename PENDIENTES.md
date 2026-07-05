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
