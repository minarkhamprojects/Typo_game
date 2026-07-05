# Typo

> Buscapalabras estilo Boggle en un tablero de 9×9, en español, contrarreloj.

---

## Qué es

Typo genera un tablero de 81 letras (con la frecuencia real del español) y te da 3 minutos
para encontrar tantas palabras válidas como puedas conectando letras adyacentes. Cada
tablero se valida al generarse para garantizar que tenga suficientes palabras posibles, y
al terminar la partida te muestra las mejores palabras que se te escaparon.

---

## Stack

- HTML + CSS + JavaScript vanilla, sin frameworks ni build step
- Diccionario de ~71.000 palabras en español, embebido como dato estático
- Sin backend, sin dependencias — se juega abriendo `index.html` en el navegador

---

## Estructura

```
typo_game/
├── index.html            → página del juego
├── style.css             → estilos (soporta modo claro/oscuro)
├── engine.js             → lógica pura: grid, diccionario, trie, resolver, puntaje
├── game.js                → capa de UI: eventos de arrastre, temporizador, panel final
├── words_es.js            → diccionario embebido (generado por scripts/build_words.py)
├── data/words_es.txt      → diccionario en texto plano (fuente de words_es.js)
├── scripts/build_words.py → normaliza el diccionario fuente y regenera data/words_es.txt
├── README.md
├── PROMPT_CONTRACT.md      → contrato Goal·Constraints·Format·Failure de este proyecto
├── PENDIENTES.md
└── docs/                  → reglas del juego
```

---

## Cómo jugar

```bash
# Clona el repo y abre el juego directamente en el navegador
git clone https://github.com/minarkhamprojects/typo_game.git
cd typo_game
open index.html   # o doble clic / arrastrar al navegador
```

1. Pulsa **Comenzar** para arrancar el temporizador de 3 minutos.
2. Arrastra el mouse (o el dedo) sobre letras adyacentes — incluidas diagonales — para
   formar una palabra de al menos 3 letras.
3. Suelta para confirmar la palabra. Si es válida y no la habías encontrado antes, suma
   puntos según su longitud.
4. Al acabarse el tiempo, revisa tu puntaje final y las palabras que te perdiste.
5. Pulsa **Nuevo tablero** para jugar con un tablero distinto.

Ver reglas completas de puntaje en [`docs/reglas.md`](docs/reglas.md).

---

## Regenerar el diccionario

El diccionario embebido en `words_es.js` se generó a partir de una lista pública de
palabras en español, normalizada (sin tildes, en mayúsculas, solo A-Z y Ñ, largo 3-16).
Para regenerarlo desde una fuente actualizada:

```bash
python3 scripts/build_words.py   # regenera data/words_es.txt
# luego reconstruir words_es.js a partir de data/words_es.txt
```

---

## Variables de entorno

Este proyecto no usa variables de entorno — no tiene backend ni servicios externos.
Ver `.env.example` de todas formas por si se agregan en el futuro.

---

## Pendientes

Ver `PENDIENTES.md`
