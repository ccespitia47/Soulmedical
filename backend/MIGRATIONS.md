# Migraciones TypeORM

`synchronize: true` fue desactivado. Ahora todo cambio al schema PostgreSQL
(entidades en `src/**/*.entity.ts`) debe pasar por una migración explícita.

> Mongo (MongooseModule) **no** está afectado — sigue siendo schemaless.

## Comandos disponibles

Desde `backend/`:

| Comando | Qué hace |
|---|---|
| `npm run migration:generate` | Genera una migración con el diff entre entities y la DB actual. Crea `src/migrations/<timestamp>-Migration.ts`. |
| `npm run migration:create` | Crea una migración **vacía** (para escribirla a mano). |
| `npm run migration:run` | Aplica todas las migraciones pendientes. |
| `npm run migration:revert` | Revierte la última migración aplicada. |
| `npm run migration:show` | Lista qué migraciones existen y cuáles ya están aplicadas. |

Todos leen la conexión desde [`src/data-source.ts`](src/data-source.ts), que a
su vez lee `DB_HOST`/`DB_PORT`/`DB_USERNAME`/`DB_PASSWORD`/`DB_DATABASE` del
`.env` (igual que la app Nest).

## Primer uso

### Caso A — DB vacía (entorno nuevo)

```powershell
npm run migration:generate    # captura el schema completo en una migración
npm run migration:run         # crea las tablas
```

### Caso B — DB ya existente (creada por synchronize previo)

La DB ya tiene la tabla `users`, pero TypeORM no sabe que ninguna migración
está aplicada. Si corres `migration:generate` directo, generará un diff vacío
(o muy pequeño). Pasos seguros:

```powershell
# 1. Crear una migración "baseline" vacía y registrarla como aplicada.
npm run migration:create   # → src/migrations/<ts>-Migration.ts (vacía)
npm run migration:run      # la marca como aplicada sin tocar la DB
```

A partir de aquí, cualquier cambio futuro en las entities se captura así:

```powershell
# Modificas user.entity.ts (añadir columna, índice, etc.)
npm run migration:generate # genera el diff
npm run migration:run      # lo aplica
```

## En producción

1. Hacer build: `npm run build`
2. Subir el artefacto + `dist/migrations/*.js`
3. Correr `npm run migration:run` (NestJS la lee del `dist/`)

> **Importante**: nunca volver a poner `synchronize: true`. Cualquier `ALTER
> TABLE` automático puede borrar datos en silencio.
