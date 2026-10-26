# SoulForms MCP

Servidor MCP para que Claude Code cree formularios en SoulForms a partir
de descripciones en lenguaje natural.

## Tools expuestas

- `list_widget_types` — Catálogo de los 26 widgets soportados.
- `list_projects` — Proyectos accesibles.
- `list_folders` — Carpetas dentro de un proyecto.
- `create_folder` — Crea una carpeta nueva.
- `list_forms_in_folder` — Lista formularios de una carpeta.
- `get_form` — Devuelve un formulario por id.
- `create_form` — Crea un formulario con la lista de widgets.

Reglas, email templates y PDF templates no están incluidas (fuera de scope).

## Setup

1. `npm install` dentro de esta carpeta.
2. Copia `.env.example` a `.env` y rellena las 4 variables.
3. `npm run typecheck` para verificar.
4. Registra el servidor en Claude Code apuntando a `src/server.ts`.

Ver `.env.example` para la lista de variables de entorno.

## Autenticación

JWT en dos pasos: login con email/password → `otplib` genera el TOTP desde
el secret → `/auth/2fa/verify-login` devuelve el JWT. El JWT queda en
memoria y se refresca al primer 401.

## Catálogo

Los 26 tipos se definen estáticamente en `src/widget-catalog.ts` con el
mismo `defaultConfig` que el builder. Si se añaden widgets nuevos al
proyecto principal, hay que sincronizarlos aquí.

## Scripts

- `npm run typecheck` — chequea TS sin emitir.
- `npm run start` — arranca el servidor stdio.
- `npm run build` — emite JS a `dist/`.
