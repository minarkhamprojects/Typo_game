# Reglas de Typo

## Tablero

- 4×4 letras (16 celdas), generadas al azar según la frecuencia de letras del español.
- Al generarse, el tablero se resuelve internamente (motor de búsqueda con trie) y se
  descarta/regenera si tiene muy pocas palabras posibles, para evitar tableros "muertos".

## Formar palabras

- Una palabra se forma conectando letras **adyacentes** (incluidas diagonales).
- No se puede repetir la misma celda dentro de una misma palabra.
- Largo mínimo: 3 letras.
- La palabra debe existir en el diccionario embebido (`words_es.js`).
- No se puede repetir una palabra ya encontrada en la misma partida.
- Mientras arrastras, una línea conecta las letras seleccionadas. El veredicto se da
  **al soltar**: destello verde si la palabra es válida y nueva, ámbar si ya la habías
  encontrado (y se resalta en tu lista), rojo si no existe.
- El tablero se ve borroso hasta que pulsas Comenzar (y se vuelve a difuminar al acabar
  el tiempo), para que no puedas estudiar las letras con el reloj parado.
- Sonido retro: click de tecla por letra conectada, chime al acertar, doble nota si la
  palabra está repetida y buzz si es inválida. Se silencia con el botón 🔊.
- En dispositivos con soporte de vibración (Android/Chrome), hay un tick suave por cada
  letra conectada y una vibración más marcada al lograr una palabra. En iPhone, iOS no
  permite vibración desde la web; el feedback principal ahí es el sonido.

## Puntaje

| Largo de palabra | Puntos |
|---|---|
| 3-4 | 1 |
| 5 | 2 |
| 6 | 3 |
| 7 | 5 |
| 8 | 11 |
| 9+ | 11 + 3 por cada letra extra sobre 8 |

## Partida

- Dura 3 minutos (180 segundos) desde que se pulsa **Comenzar**.
- Al acabar el tiempo se muestra el puntaje final, la palabra más larga encontrada, y
  hasta 15 de las palabras de mayor puntaje que existían en el tablero y no encontraste.
- **Nuevo tablero** genera un tablero distinto en cualquier momento (reinicia la partida).
