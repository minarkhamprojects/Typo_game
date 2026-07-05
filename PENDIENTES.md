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

---

## Bloqueados

- [ ] Ninguno

---

## Completados

- [x] Setup inicial del repo (creado desde proyecto-base)
- [x] Diccionario en español normalizado (~71.000 palabras, `scripts/build_words.py`)
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
