# PROMPT CONTRACT
### Guía universal para generar agentes — apps, templates, VMs, workflows, lo que sea
*Basado en el framework Goal · Constraints · Format · Failure*

---

## Por qué existe este archivo

Un prompt de chatbot es un deseo. Un prompt de agente es un contrato.

La diferencia: un agente tiene herramientas, autonomía y un loop. Sin un contrato claro,
toma decisiones por ti — y las pagas en tokens, en tiempo, o en código que no querías.

Este archivo es tu punto de partida para cualquier proyecto nuevo.
Llena las 4 secciones antes de presionar Enter. Siempre.

---

## Las 4 Secciones

### 1. GOAL — El resultado, no la acción

Responde una sola pregunta: **¿Cómo se ve "terminado"?**

❌ Acción: *"Construye una landing page"*
✅ Resultado: *"Una landing page de una sola página que convierte visitantes en suscriptores de email, con el CTA visible sin hacer scroll, lista para revisar en local antes de cualquier deploy"*

Tu goal debe incluir:
- Qué es el entregable
- Para qué sirve / qué problema resuelve
- Cuál es la línea de llegada (¿cuándo sabe el agente que terminó?)

> **Regla:** Si tu oración de goal no tiene línea de llegada, el agente la inventará.

💡 **Si no sabes exactamente cómo redactar tu goal**, responde estas 3 preguntas
en lenguaje natural y conviértelas en una oración:
- ¿Qué estoy construyendo?
- ¿Para qué lo voy a usar?
- ¿Cómo sé que está listo?

---

### 2. CONSTRAINTS — Los rieles

Todo lo que el agente **no puede hacer**. Esta sección previene desastres.

Preguntas para generar tus constraints:
- ¿Qué archivos NO puede tocar?
- ¿Qué dependencias NO puede instalar?
- ¿Qué servicios NO puede llamar o deployar?
- ¿Qué tecnologías o frameworks están prohibidos?
- ¿Qué datos son sensibles o intocables?
- ¿Qué comportamiento "técnicamente válido" sería inaceptable para ti?

Ejemplos por tipo de proyecto:

```
# App / Frontend
- No instalar dependencias sin preguntar
- No usar frameworks JS externos
- No tocar archivos fuera de la carpeta del proyecto
- No hacer deploy — solo archivos locales
- Solo light mode

# Workflow / Automatización (n8n, Make, etc.)
- No modificar nodos existentes, solo agregar
- No cambiar variables de entorno — solo proponer
- El código debe ser compatible con el entorno [especificar]
- No asumir estructura de payload — pedir ejemplo real primero

# VM / Infraestructura
- No abrir puertos sin aprobación explícita
- No instalar servicios que corran en background sin listarlos
- No modificar configuraciones del sistema fuera del directorio del proyecto
- Documentar cada cambio en un log antes de ejecutarlo

# Template / Documento
- No inventar copy — usar solo lo que se provee
- No cambiar la estructura de secciones sin preguntar
- Respetar la guía de tono [adjuntar si existe]
```

> **Regla:** Tu lista de constraints es tu scar tissue. Crece con cada proyecto.
> Cada vez que un agente hace algo que no querías → nueva constraint permanente.

💡 **Si no sabes qué constraints poner**, usa estos defaults universales.
Aplican a casi cualquier proyecto y te protegen de los errores más comunes:

```
# DEFAULTS DE SEGURIDAD — úsalos cuando no tengas constraints propias

- No instalar dependencias nuevas sin listarlas primero y pedir aprobación
- No modificar archivos que no hayas creado tú en esta sesión
- No hacer deploy a ningún servicio externo — solo entregables locales
- No usar credenciales, API keys ni tokens hardcodeados en el código
- No borrar ni sobreescribir archivos existentes sin confirmación explícita
- No asumir estructura de datos externa — pedir un ejemplo real primero
- No tomar decisiones irreversibles (borrar, publicar, enviar) sin preguntar
- Documentar cualquier asunción que hagas como comentario en el código
```

Estos defaults no reemplazan las constraints específicas de tu proyecto.
Son el piso mínimo. Agrégalos siempre que una sección esté vacía.

---

### 3. FORMAT — La forma exacta del entregable

Decide la forma del output **antes** de que el agente empiece.

Responde:
- ¿Qué archivos se entregan? ¿Con qué nombres?
- ¿Qué estructura de carpetas?
- ¿Va acompañado de documentación? ¿De qué tipo?
- ¿Hay un orden específico en la respuesta?

Ejemplos:

```
# App web
Una carpeta /landing que contiene:
  index.html (CSS inline, sin JS frameworks)
  brief.md (lista de secciones con el copy usado)

# Workflow
Un archivo workflow_patch.js completo
+ el comando exacto para aplicarlo
+ el comando de reinicio del servicio
En ese orden.

# VM / Servidor
Un script setup.sh comentado línea por línea
+ un archivo README.md con los comandos de verificación post-setup

# Template / Documento
Un archivo [nombre].md listo para copiar
+ una sección de variables al inicio con los campos a personalizar
```

> **Regla:** Si no puedes describir el formato en 2 oraciones, no sabes todavía
> qué quieres. No presiones Enter aún.

💡 **Si no sabes qué formato pedir**, usa este default universal:

```
# DEFAULT DE FORMAT — cuando no tienes preferencia clara

Entrega los archivos con nombres descriptivos en una carpeta con el nombre
del proyecto. Incluye un archivo CHANGES.md que liste en orden: qué creaste,
qué modificaste, y qué asumir para continuar.
```

Esto te da siempre un punto de partida revisable, sin sorpresas de estructura.

---

### 4. FAILURE — Qué hacer cuando se atasca

La sección que nadie escribe. La que más tokens ahorra.

Sin instrucciones, los agentes hacen lo peor: siguen intentando, loopean,
gastan recursos hasta que algo funciona o tú los matas.

Una oración lo resuelve. Elige tu modo:

```
# Modo conservador (recomendado para proyectos nuevos)
Si te falta información para continuar, detente y haz
UNA sola pregunta consolidada antes de seguir.

# Modo autónomo (cuando confías en el contexto)
Si algo es ambiguo, toma la decisión más conservadora,
documéntala como asunción y continúa.

# Modo reportero (para tareas de infraestructura)
Si un comando falla dos veces seguidas, detente y reporta
exactamente qué intentaste y qué error obtuviste.

# Modo mixto (lo más común)
Si te falta el contexto técnico (payload, credenciales, estructura real),
detente y pregunta. Si es una decisión de diseño menor, asume y documenta.
```

> **Regla:** Define el comportamiento ante incertidumbre o el agente lo definirá
> por ti — y será caro.

💡 **Si no sabes qué modo elegir**, usa este default universal.
Funciona para el 80% de los proyectos nuevos:

```
# DEFAULT DE FAILURE — cuando no tienes experiencia previa con esta tarea

Si te falta información técnica crítica (estructura de datos, credenciales,
comportamiento esperado), detente y haz UNA sola pregunta consolidada.
Si la duda es de diseño o preferencia menor, toma la opción más conservadora,
documéntala como asunción, y continúa.
Si un comando o tool call falla dos veces seguidas, detente y reporta
exactamente qué intentaste y qué error obtuviste — no sigas intentando.
```

---

## El Template — Copia esto para cada proyecto nuevo

Llena lo que sabes. Donde no tengas contexto, usa el bloque de defaults
de esa sección. No dejes ninguna sección vacía.

```
## GOAL
[Una oración con el resultado concreto y la línea de llegada]

## CONSTRAINTS
- [Qué NO puede tocar]
- [Qué NO puede instalar]
- [Qué NO puede deployar o llamar]
- [Qué tecnologías están prohibidas]
- [Qué datos son intocables]
- [Comportamiento válido pero inaceptable]
→ Si no tienes constraints propias: copia los DEFAULTS DE SEGURIDAD de arriba.

## FORMAT
[Descripción exacta de los archivos, estructura y orden del entregable]
→ Si no tienes preferencia: copia el DEFAULT DE FORMAT de arriba.

## FAILURE
[Una oración sobre qué hacer cuando se atasca o le falta información]
→ Si no sabes qué modo usar: copia el DEFAULT DE FAILURE de arriba.
```

---

## Ejemplo completo — App web

```
## GOAL
Construir una landing page de una sola página para el lanzamiento de mi SaaS,
optimizada para convertir visitantes en suscriptores de email con el CTA
visible sin hacer scroll, lista para revisar en local antes de cualquier deploy.

## CONSTRAINTS
- Un solo archivo index.html
- CSS inline, sin archivos externos
- Sin frameworks JavaScript
- Sin scripts de CDN externos
- Solo light mode, responsive mobile-first
- No tocar ningún archivo fuera de la carpeta /landing
- No hacer deploy en ningún servicio

## FORMAT
Una carpeta /landing con:
  index.html — la página completa
  brief.md — lista de cada sección con el headline copy usado, en orden

## FAILURE
Si el público objetivo o la propuesta de valor no están claros en el contexto,
detente y haz una sola pregunta consolidada antes de continuar.
```

---

## Ejemplo completo — Workflow / Automatización

```
## GOAL
Agregar detección de intención "elogio pasivo" al nodo clasificador
del workflow de DMs, antes de cualquier bifurcación, para que aplique
a todos los usuarios independientemente de su estado.

## CONSTRAINTS
- No modificar lógica existente de tracking de mensajes
- No tocar archivos fuera de /scripts
- El código debe ser compatible con el entorno de ejecución actual (sin módulos externos)
- No aplicar cambios al servidor — solo preparar el script de patch
- Si el cambio afecta anclas de texto, actualizar ambos archivos simultáneamente

## FORMAT
1. El archivo JS modificado completo
2. El comando exacto de patch
3. El comando de reinicio del servicio
En ese orden, sin texto entre bloques de código.

## FAILURE
Si no tienes un ejemplo real del payload del webhook para validar,
detente y pídelo antes de escribir cualquier lógica de detección.
```

---

## Dónde vive este archivo

```
Tu repo (raíz o /docs)     → PROMPT_CONTRACT.md   ← este archivo
Tu proyecto de Claude      → Como archivo del proyecto (contexto permanente)
Cursor / Claude Code       → Lo lee automáticamente si está en la raíz
```

Cada vez que descubras una constraint nueva que aplique universalmente,
agrégala a los ejemplos de esta guía. Este documento también crece.

---

*Framework original: Goal · Constraints · Format · Failure*
*Adaptado para uso universal — apps, templates, VMs, workflows, agentes*
