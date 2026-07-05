# Cómo usar este template

Este repositorio es un **GitHub Template Repository** (`proyecto-base`). Su trabajo es
**arrancar proyectos nuevos** con una estructura estándar y el contrato para agentes AI
(`PROMPT_CONTRACT.md`) ya listos.

La idea clave: **este repo NUNCA se ensucia con el trabajo de un proyecto.** Cada proyecto
nuevo vive en **su propio repositorio**, creado a partir de este. Así el template siempre
queda limpio y listo para el siguiente.

---

## Empezar un proyecto nuevo (recomendado: botón "Use this template")

1. En GitHub, abre `minarkhamprojects/proyecto-base`.
2. Pulsa **« Use this template » → Create a new repository**.
3. Ponle nombre al repo del proyecto nuevo (ej. `mi-proyecto-x`).
   - Esto crea un repo **independiente, con historia limpia**, copiando esta estructura.
   - **`proyecto-base` queda intacto** — listo para el próximo proyecto. No tienes que "resetear" nada.
4. Clona TU repo nuevo (no este):
   ```bash
   git clone https://github.com/minarkhamprojects/mi-proyecto-x.git
   cd mi-proyecto-x
   cp .env.example .env       # y rellena los valores reales
   ```
5. Personaliza para tu proyecto:
   - `README.md` → reemplaza los `[placeholders]` por los datos reales.
   - `PROMPT_CONTRACT.md` → llena las 4 secciones (Goal · Constraints · Format · Failure) antes de poner a trabajar a cualquier agente.
   - `PENDIENTES.md` → arranca tu backlog.
   - `.env.example` → declara las variables que tu proyecto necesite.

> Alternativa por CLI: `gh repo create minarkhamprojects/mi-proyecto-x --template minarkhamprojects/proyecto-base --private`

---

## Regla de oro

- **El trabajo de un proyecto NUNCA se comitea en `proyecto-base`.** Va en el repo del proyecto.
- `main` de `proyecto-base` se mantiene **siempre como el andamiaje limpio**.
- Si necesitas iterar el template en sí (mejorar la estructura, el contrato, etc.), hazlo en una
  **rama** y fusiónala a `main` por PR — pero eso es mejorar *el template*, no construir *un proyecto*.

---

## Qué incluye el andamiaje

```
proyecto-base/
├── README.md            → portada del proyecto (con placeholders a rellenar)
├── PROMPT_CONTRACT.md   → contrato Goal·Constraints·Format·Failure para agentes AI
├── PENDIENTES.md        → backlog / estado del proyecto
├── USO-DEL-TEMPLATE.md  → este archivo
├── .env.example         → variables requeridas (sin valores)
├── .gitignore           → protege secretos y basura del SO
├── scripts/             → lógica/automatización del proyecto
└── docs/                → documentación técnica
```

---

## Mantener el template sano

- ¿Descubriste una constraint o estructura útil para TODOS los proyectos? Mejórala aquí (en una rama → `main`).
- ¿Es específica de un proyecto? Va en el repo de ese proyecto, no aquí.
