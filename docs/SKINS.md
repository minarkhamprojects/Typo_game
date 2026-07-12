# Sistema de skins — handoff

> Estado: **tablero tokenizado y funcionando con 2 skins** (`default`, `manga`).
> HUD, modales, portada y barra de controles **todavía NO están tokenizados**.
> Fecha: 2026-07-12

---

## 1. Qué problema resolvía

`style.css` tenía un `:root` con ~25 variables que *parecían* un sistema de temas, pero **la mayoría eran zombis**: `--key-face`, `--key-legend`, `--key-skirt`, `--plate`, `--plate-border`, `--key-drag-*`, `--invalid-*`, `--font-lcd`, `--font-pixel` estaban declaradas y **no se usaban en ningún selector**.

El estilo real estaba hardcodeado: **173 colores hex + 145 `rgba()`** repartidos en ~1,600 líneas. Cambiar de skin significaba buscar y reemplazar a mano.

---

## 2. Archivos tocados / creados

| Archivo | Estado | Qué es |
|---|---|---|
| `style.css` | **modificado** | Bloque del tablero reescrito para colgar de tokens. Sin cambio visual en la skin default. |
| `style.css.bak-20260712-1457` | nuevo | Backup del original antes de tokenizar. |
| `skins.css` | **nuevo** | Definición de la skin `manga`. Solo redefine tokens. |
| `skins.js` | **nuevo** | Selector de skin + SFX de manga. **No toca `game.js`.** |
| `index.html` | **modificado** | 4 cambios: fuentes, `<link skins.css>`, filtro SVG `#typo-ink`, `<script skins.js>`. |
| `scripts/tokenize_board.py` | nuevo | El script que hizo la tokenización (idempotente, se puede releer). |
| `scripts/wire_skins.py` | nuevo | El script que parcheó `index.html` (idempotente). |
| `skins/manga/index.html` | nuevo | Prototipo standalone de la skin (referencia visual, no se usa en el juego). |
| `skins/micelio/` | nuevo | Prototipo de skin fotográfica + 4 PNG. **Experimental, no conectado.** |

> **Ojo:** `git status` reporta `multiplayer.js` y `pcbfx.js` como modificados. **Yo no los toqué.** Verificar de dónde vienen esos cambios antes de commitear.

---

## 3. El contrato de la arquitectura

**Regla dura: la geometría del keycap NO cambia entre skins.**

Las 6 capas (`socket` → `cell__body` → 4 paredes con `clip-path` → `cell__face` → `key-legend`) son las mismas en todas las skins. Una skin **solo redefine variables CSS**. Si una skin necesita tocar estructura o el DOM, está mal pensada — hay que replantearla como tokens.

Corolario: **`game.js` y `engine.js` no saben que existen las skins.** No hay que tocarlos nunca para agregar una.

---

## 4. Cómo funciona

### Activación

```html
<html data-skin="manga">
```

`skins.js` lo pone al cargar, leyendo en este orden:

1. `?skin=manga` en la URL
2. `localStorage.getItem("typo-skin")`
3. fallback → `"default"`

API expuesta:

```js
TypoSkin.list       // ["default", "manga"]
TypoSkin.get()      // skin activa
TypoSkin.set("manga")
TypoSkin.cycle()    // rota entre skins
```

### Selectores

- **`default`** → los tokens viven en `:root` dentro de `style.css`. Los valores son exactamente los de antes de la refactorización.
- **`manga`** → `[data-skin="manga"] { ... }` en `skins.css` sobreescribe los tokens.

Como `[data-skin="x"]` tiene más especificidad que `:root`, no hace falta `!important` en ningún lado.

---

## 5. Los tokens

Todos viven en `:root` de `style.css`, bajo el comentario `TOKENS DE SKIN`.

### Placa (`.grid`)
```
--plate-radius   --plate-pad     --plate-gap     --plate-border
--plate-tex      --plate-tex-size --plate-bg     --plate-shadow
--plate-blur     --plate-filter
```

### Keycap — las 4 capas
```
socket:   --socket-radius  --socket-bg  --socket-shadow  --socket-border
cuerpo:   --body-inset     --body-radius --body-bg  --body-shadow  --body-border
paredes:  --wall-t  --wall-b  --wall-l  --wall-r
          --wall-t-shadow  --wall-b-shadow
tapa:     --dish-radius  --dish-bg  --dish-shadow  --dish-border
leyenda:  --legend-font  --legend-size  --legend-weight
          --legend-ink   --legend-shadow  --mark-ink
```

> `--body-inset` usa el shorthand `top right bottom left` — así una skin puede hundir la tecla cambiando una sola variable.

### Estados
Cada estado (`selected` / `valid` / `invalid` / `dup`) tiene el mismo juego de tokens con prefijo:

```
--sel-socket-bg  --sel-socket-shadow  --sel-body-inset  --sel-body-bg
--sel-body-shadow  --sel-wall-t/b/l/r  --sel-dish-bg  --sel-dish-shadow
--sel-legend-ink  --sel-legend-shadow

--ok-*   (mismo set)  + --ok-anim
--err-*  (mismo set)  + --err-anim
--dup-*  (mismo set)  + --dup-anim
```

Los `--*-anim` permiten que una skin cambie o desactive la animación (`--err-anim: none`).

### Capa extra (opcional)
```
--key-behind          /* fondo del ::before de .cell — ráfaga, halo, lo que sea */
--key-behind-inset
--key-behind-mask
```
Apagada por default (`none`). Manga la usa para la ráfaga de impacto detrás de la tecla acertada.

---

## 6. La skin `manga` — decisiones de diseño

Están documentadas en los comentarios de `skins.css`, pero el resumen:

**El volumen no se pinta con degradado: se pinta con trama.** Pero **la luz sigue mandando**, y esa es la clave de que no se vea plano:

- La **tapa** acumula hatching a 45° **abajo-derecha** — donde no llega la luz.
- El **socket** acumula screentone **arriba-izquierda** — su pared en sombra.
- Ese **inverso** es lo que hunde el hueco y levanta la tecla. Es exactamente el mismo truco que en un render con degradados, traducido a tinta.
- El **especular es blanco reservado** (un trozo de papel sin tocar arriba-izquierda), nunca un gradiente.
- La **sombra proyectada es negro sólido sin blur** (`--body-shadow: 5px 5px 0`), desplazada al lado contrario de la luz. En tinta no existe el desenfoque.

**Los 4 estados sin usar un solo color:**

| Estado | Tratamiento |
|---|---|
| reposo | papel + hatching |
| arrastre | la tecla se rellena de screentone 50% |
| acierto | **negativo**: tinta plena, letra en blanco reservado, ráfaga radial detrás |
| error | **cross-hatch** cruzado — no es rojo, es rabia de tinta |
| repetida | trama más densa |

**La letra nunca se pierde:** en trama lleva halo blanco de 8 direcciones; en negativo es blanco reservado; en cross-hatch, halo grueso.

**La línea tiembla.** Filtro SVG `#typo-ink` (`feTurbulence` + `feDisplacementMap`) aplicado a `.grid` vía `--plate-filter`. Sin esto el trazo se ve de Illustrator, no de plumilla. Es el detalle que más carga el estilo y cuesta 6 líneas.

**La escena cambia de material:** `.pcb-scene` pasa de motherboard a papel con fibra y líneas cinéticas. `#pcb-fx` se apaga (`display: none`) — un canvas de electricidad no tiene sentido sobre papel.

---

## 7. El SFX (y por qué no toqué `game.js`)

`skins.js` monta un `MutationObserver` sobre `.grid` que escucha cuando una `.cell` gana la clase `valid`, y dispara un SFX (`¡DON!`, `¡ZUN!`, `¡BAN!`, `¡GOU!`, `¡DOGA!`, `¡ZUSHI!`) con animación de sobreimpulso.

- Throttle de **350 ms** → grita una vez por palabra, no una por letra.
- El observer solo se monta si la skin es `manga`; se desconecta al cambiar de skin.
- La animación vive en `.typo-sfx` / `@keyframes typoSfx` dentro de `skins.css`.

**Consecuencia:** la skin es **puramente aditiva**. Borra `skins.css` + `skins.js` y el juego queda idéntico a antes.

---

## 8. Qué falta (el siguiente bloque)

Estos siguen hardcodeados y por eso **manga se ve mezclada con el estilo viejo** fuera del tablero:

- [ ] **HUD / marcadores** (`.score-item`) — hay un parche parcial en `skins.css` pero sin tokens.
- [ ] **Barra de controles** (`.btn`, `.key-btn`, iconos grabados) — ~130 líneas con hex fijos.
- [ ] **Ticker / tips** (verde retro con scanlines).
- [ ] **Modales** (`.modal`, tabla de puntaje, leyenda de controles).
- [ ] **Portada / splash** (título dot-matrix, tecla Enter ISO).
- [ ] **Panel de récords** y **tableros temáticos** (dorado de secretas).
- [ ] **Modo trivia** (`trivia.js` + su CSS).

**Método sugerido para cada bloque:** mismo patrón — extraer los literales a tokens semánticos en `:root` con los valores actuales como default (verificar que no cambia nada), y luego sobreescribirlos en `[data-skin="manga"]`.

### Otros pendientes

- [ ] **Selector de skin en el menú** — hoy solo se cambia por URL o `TypoSkin.set()`. Falta el botón.
- [ ] **Fuentes:** `Dela Gothic One` y `Zen Kaku Gothic New` se cargan siempre, aunque la skin sea default. Convendría cargarlas condicionalmente.
- [ ] **`pcbfx.js` no lee tokens.** Sus colores están en JS. Para una skin como "neón" (donde la electricidad es protagonista) habría que hacerlo leer `--accent` en runtime.
- [ ] **Cache busting:** `skins.css?v=1` y `skins.js?v=1` — subir el `v=` al cambiar.

---

## 9. Prototipos que NO están conectados

Viven en `skins/` como referencia visual. No los carga el juego.

- **`skins/manga/index.html`** — el prototipo standalone del que salió la skin. Tiene sliders y botones de demo. Útil para iterar sin abrir el juego.
- **`skins/micelio/`** — experimento distinto: skin **fotográfica**. 4 PNG generados (dormante / arrastre / esporulado / podrido), un tablero 4×4 por estado con los sombreros en blanco. Cada celda hace `background-size: 400%` y se posiciona en su cuadrante → 16 hongos únicos por estado a partir de una sola imagen. **La letra la pone el CSS** (`mix-blend-mode: screen` + copia desenfocada), así el glow sigue siendo procedural.
  - Pesa ~10 MB en PNG. Habría que pasar a WebP q80 (~250 KB c/u) antes de considerarlo.
  - Requiere calibrar el recorte (los sliders del prototipo escupen los valores de CSS).
  - **Decisión pendiente:** si vale la pena una skin con assets, o si todas deben ser CSS puro.

---

## 10. Cómo agregar una skin nueva

1. Añadir el id a `SKINS` en `skins.js`.
2. Bloque nuevo en `skins.css`:
   ```css
   [data-skin="mi-skin"] {
     --plate-bg: ...;
     --socket-bg: ...;
     /* solo los tokens que cambien */
   }
   ```
3. Si la skin necesita algo que no existe como token → **agregar el token a `:root` en `style.css` con el valor actual como default**, y usar el selector correspondiente. Nunca hardcodear dentro de la skin.
4. Probar con `?skin=mi-skin`.

**Lo que NO se debe hacer:**
- Tocar `game.js` / `engine.js`.
- Añadir elementos al DOM desde la skin (usar `--key-behind` o pseudo-elementos ya existentes).
- Usar `!important`.
