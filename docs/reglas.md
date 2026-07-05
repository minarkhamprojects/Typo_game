# Reglas de Typo

## Tablero

- 9×9 letras (81 celdas), generadas al azar según la frecuencia de letras del español.
- Al generarse, el tablero se resuelve internamente (motor de búsqueda con trie) y se
  descarta/regenera si tiene muy pocas palabras posibles, para evitar tableros "muertos".

## Formar palabras

- Una palabra se forma conectando letras **adyacentes** (incluidas diagonales).
- No se puede repetir la misma celda dentro de una misma palabra.
- Largo mínimo: 3 letras.
- La palabra debe existir en el diccionario embebido (`words_es.js`).
- No se puede repetir una palabra ya encontrada en la misma partida.

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
