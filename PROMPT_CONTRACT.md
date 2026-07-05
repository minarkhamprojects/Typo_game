# PROMPT CONTRACT — Typo

*Basado en el framework Goal · Constraints · Format · Failure. Ver el original en
[proyecto-base/PROMPT_CONTRACT.md](https://github.com/minarkhamprojects/proyecto-base/blob/main/PROMPT_CONTRACT.md).*

---

## GOAL

Un buscapalabras estilo Boggle jugable en el navegador (`index.html`, sin build ni
backend): tablero de 9×9 letras en español generado con frecuencias reales, partida de 3
minutos donde el jugador forma palabras arrastrando sobre letras adyacentes, con puntaje
por longitud de palabra y un resumen final que incluye las mejores palabras que se le
escaparon. Terminado significa: se puede abrir `index.html` en un navegador, jugar una
partida completa de principio a fin, y ver el puntaje y resumen final sin errores.

## CONSTRAINTS

- Sin frameworks de UI ni build step — HTML/CSS/JS vanilla únicamente.
- Sin backend, sin llamadas a servicios externos, sin analytics.
- Sin dependencias nuevas que instalar para jugar (todo el diccionario va embebido).
- No modificar `proyecto-base` — este repo es independiente, creado desde el template.
- No hardcodear credenciales ni tokens (no aplica aquí: no hay servicios externos).
- Cualquier asunción de diseño (ej. puntaje, duración, tamaño de tablero) se documenta en
  `docs/reglas.md`, no se deja implícita en el código.

## FORMAT

Un sitio estático de una sola página:
```
index.html + style.css + game.js + engine.js + words_es.js
docs/reglas.md      → reglas del juego
scripts/build_words.py + data/words_es.txt → reproducibilidad del diccionario
```
Sin pasos de build: se juega abriendo `index.html` directamente.

## FAILURE

Si falta una decisión de diseño menor (puntaje, duración, tamaño de tablero, idioma), se
toma la opción más simple/estándar de Boggle, se documenta en `docs/reglas.md` o en el
commit, y se continúa. Si falta contexto técnico crítico (p. ej. qué diccionario de
palabras usar), se detiene y se pregunta antes de escribir lógica de validación.
