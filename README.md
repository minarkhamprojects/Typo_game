# Typo

> Buscapalabras estilo **Boggle** en un tablero **4×4**, en español, contrarreloj (1:30).
> HTML + CSS + JavaScript vanilla, sin frameworks ni build. Estética "keycap retro
> 8BitDo + terminal 90s".

Este README es la **guía de continuación**: contiene todo lo necesario para retomar el
proyecto (arquitectura, cómo correrlo, cómo probar, cómo publicar y qué falta).

---

## 1. Estado actual

- **Repo**: `minarkhamprojects/Typo_game` · rama de trabajo: `main`.
- **Jugable y completo**: tablero 4×4, diccionario de ~636k palabras, arrastre con
  Pointer Events, sonido "thock" mecánico, temporizador 1:30 con aviso a 10 s, giro del
  tablero, resumen final, y todo el rediseño visual (keycaps 3D, LCD, iconos 90s).
- **Diseño de referencia** (detallado, con capturas y diagrama de flujo):
  [`docs/DISENO-Y-ESTADO.md`](docs/DISENO-Y-ESTADO.md).
- **Reglas de juego**: [`docs/reglas.md`](docs/reglas.md).
- **Backlog**: [`PENDIENTES.md`](PENDIENTES.md).

### Cómo probar la última versión
- **Local**: clonar y abrir `index.html` en el navegador.
- **Móvil / compartir** (URL por commit, sin caché): 
  `https://rawcdn.githack.com/minarkhamprojects/Typo_game/<SHA>/index.html`
  (usa el SHA del último commit de `main`).
- **Artifact de claude.ai**: versión de un solo archivo (ver §5). Nota: su CSP bloquea
  Google Fonts, así que ahí las tipografías pixel/terminal caen a las de respaldo.

---

## 2. Estructura de archivos

```
Typo_game/
├── index.html              → página del juego (markup + carga de scripts)
├── style.css               → TODO el diseño (tema único oscuro, keycaps, layout, estados)
├── game.js                 → capa de UI: arrastre, sonido, temporizador, botones, modales
├── engine.js               → lógica pura (sin DOM): grid, diccionario, resolver, puntaje
├── words_es.js             → diccionario embebido (~636k palabras, generado)
├── data/words_es.txt       → diccionario en texto plano (fuente de words_es.js)
├── scripts/build_words.py  → normaliza la lista fuente → data/words_es.txt
├── .github/workflows/pages.yml → deploy a GitHub Pages (pendiente de activar, ver §6)
├── docs/
│   ├── DISENO-Y-ESTADO.md   → documento maestro de diseño (paleta, keycap, sonidos, flujo)
│   ├── reglas.md            → reglas y puntaje
│   └── img/                 → capturas por estado
├── README.md               → este archivo
├── PENDIENTES.md            → backlog / estado
└── PROMPT_CONTRACT.md       → contrato para agentes (heredado del template)
```

> **No hay build step.** El juego se sirve tal cual (index.html + los 3 scripts + css).

---

## 3. Arquitectura

**Separación motor / UI:**
- `engine.js` — funciones puras, testeables en Node (`module.exports`). Expone
  `TypoEngine`: `generateGrid`, `makeDictionary`, `solveBoardWithDict`,
  `generatePlayableGrid`, `buildTrie`, `scoreForLength`, `isValidPath`, `wordFromPath`,
  `boardLetterCounts`, `GRID_SIZE`, `MIN_WORD_LEN`.
- `game.js` — IIFE que conecta el motor con el DOM: render del grid, eventos de arrastre
  (Pointer Events + zona muerta + puente para arrastres rápidos), audio (Web Audio
  sintetizado), temporizador, giro, modales y feedback.

**Diccionario (clave para memoria en móvil):**
- `words_es.js` define `WORDS_ES_RAW` = un único string enorme (palabras en MAYÚSCULAS,
  una por línea, ordenadas).
- `makeDictionary(raw)` construye un índice de offsets → **membresía por búsqueda binaria**
  O(log n) sin crear un Set gigante.
- Para resolver/generar tableros se arma un **mini-trie por tablero** solo con las palabras
  cuyas letras caben en el tablero. Resultado: ~15–35 MB de RAM en vez de >100 MB.

**Puntaje** (`scoreForLength`): 3–4→1 · 5→2 · 6→3 · 7→5 · 8→11 · 9+→11 + 3 por letra extra.

**Sonido** (`game.js`, Web Audio, sin archivos): motor `keyThock` (ruido filtrado
bandpass+highpass + cuerpo grave de seno) = "thock" de tecla mecánica. `playKeyClick`
(por letra), `playSuccess` (doble thock), `playDup`, `playFail` (buzzer retro
descendente), `playWarnTick` (aviso ≤10 s). Manejo iOS: `navigator.audioSession="playback"`
(suena en silencio), unlock con buffer, `resume()` automático. Silencio persistido en
`localStorage` (`typo-muted`).

---

## 4. Cómo correr / editar en local

```bash
git clone https://github.com/minarkhamprojects/Typo_game.git
cd Typo_game
open index.html            # macOS · en Linux: xdg-open · o arrastra el archivo al navegador
```

Editar es directo: tocar `style.css` / `game.js` / `engine.js` y recargar el navegador.
No hay que compilar nada.

### Regenerar el diccionario
Fuente: [`words/an-array-of-spanish-words`](https://github.com/words/an-array-of-spanish-words)
(~636k, incluye conjugaciones). Se normaliza (sin tildes, MAYÚSCULAS, solo A-Z y Ñ, largo
3–16) y se ordena.

```bash
python3 scripts/build_words.py   # regenera data/words_es.txt desde la lista fuente
# luego reconstruir words_es.js como:  const WORDS_ES_RAW = "<líneas unidas por \n>";
```

---

## 5. Versión de un solo archivo (para Artifact / pruebas)

Para producir un `.html` autocontenido (todo inline) — útil para el Artifact de claude.ai
o para abrir sin servidor:

```python
# bundle.py  (ejecutar en la raíz del repo)
css=open("style.css").read(); words=open("words_es.js").read()
engine=open("engine.js").read(); game=open("game.js").read(); html=open("index.html").read()
body=html.split("<body>")[1].split("<script")[0].strip()
open("typo-standalone.html","w").write(f"""<title>Typo</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Archivo:wght@600;700;800;900&family=VT323&family=Silkscreen:wght@400;700&display=swap" rel="stylesheet"/>
<style>\n{css}\n</style>\n\n{body}\n
<script>\n{words}\n</script>
<script>\n{engine}\n</script>
<script>\n{game}\n</script>""")
```

> **Mantener sincronizado**: el single-file es una *copia derivada*. La fuente de verdad
> son los archivos multi-archivo del repo; regenera el standalone tras cada cambio.

---

## 6. Deploy

**Hoy** se comparte con URL de githack por commit (§1). Es estable pero **cambia con cada
versión** (va atada al SHA).

**Pendiente — URL fija con GitHub Pages** (ya existe `.github/workflows/pages.yml`):
1. En GitHub: repo **Settings → Pages** (Settings *del repo*, no de la cuenta).
2. En **Source** elegir **"GitHub Actions"**.
3. El workflow publica en cada push a `main` → `https://minarkhamprojects.github.io/Typo_game/`.

(Este paso es manual una sola vez; la primera ejecución del workflow falla hasta activarlo
porque el token de Actions no puede crear el sitio de Pages por sí solo.)

---

## 7. Pruebas

El proyecto se verifica con **Playwright** manejando Chromium (arrastres, feedback, blur,
sonidos con `AudioContext` stubbeado, giro, menú). El script de pruebas **no está commiteado**
(vive en el scratchpad de la sesión de trabajo). Patrón: cargar `index.html?t=5` (partida
de 5 s para test), leer el grid del DOM, resolver con `TypoEngine.solveBoardWithDict` para
encontrar una palabra y su ruta, simular el arrastre con `page.mouse`, y afirmar sobre
clases/estado/contadores de audio.

> **Recomendado al continuar**: mover ese test a `tests/` en el repo para que quede versionado.

---

## 8. Flujo de trabajo git

- Desarrollar en `main` (o una rama y PR si colaboran varios).
- Tras cada cambio: probar → `git add -A` → commit descriptivo → `git push`.
- **Handoff con diseño**: si otra persona/sesión sube cambios, hacer `git pull --rebase`
  antes de pushear. Ojo con **duplicados** (p. ej. bloques CSS pegados al final o scripts
  de audio paralelos): mantener una sola fuente por responsabilidad
  (`style.css` para estilos, `game.js` para sonido).

---

## 9. Gotchas / notas conocidas

- **iOS y sonido**: si no suena en iPhone suele ser el *switch de silencio* o el volumen.
  El juego ya fuerza `audioSession="playback"` (iOS 16.4+) para sonar en silencio.
- **Haptic en iOS**: `navigator.vibrate` no existe en iOS Safari; solo hay vibración en
  Android. Haptic pleno requeriría app nativa.
- **Fuentes en el Artifact**: el CSP de claude.ai bloquea Google Fonts → en el Artifact se
  ven fallbacks; en githack/local se ven VT323/Silkscreen reales.
- **Acento**: el color `--accent` (rojo `#d8342e`) re-tinta acierto/estela/lectura/botón.
  Las **marcas rojas** de las teclas y el botón de acción usan rojo **fijo** a propósito.

---

## 10. Qué sigue (backlog)

Ver [`PENDIENTES.md`](PENDIENTES.md). Ideas abiertas: récord personal (localStorage),
modo sin temporizador, **tips en pantalla** (LCD), **selector de acento** en el menú,
y versionar el test de Playwright.
