# Glosario de la Base de Datos

Base: **MongoDB** → `soulformsdb` (puerto 27017)
Base auxiliar: **PostgreSQL/TypeORM** → tabla `users` y `admin_actions` (autenticación y auditoría)

Mantenemos los nombres técnicos en inglés (estándar y lo que espera el código Nest/Mongoose). Este glosario traduce qué guarda cada colección.

---

## Colecciones MongoDB

| Colección | En español | Qué guarda |
|---|---|---|
| `projects` | **Proyectos** | Proyectos raíz que agrupan formularios y carpetas. Campos: `name`, `color`, `icon`, `isActive`, `ownerId`. |
| `folders` | **Carpetas** | Carpetas dentro de un proyecto. Jerarquía para organizar formularios. |
| `forms` | **Formularios** | Definición de cada formulario (campos, estructura, versión, carpeta a la que pertenece). |
| `form_submissions` | **Respuestas / Envíos de formulario** | Cada vez que un usuario diligencia un formulario, se guarda aquí (datos capturados, firmas, fotos, metadatos). |
| `tasks` | **Tareas** | Tareas asignadas a usuarios (recordatorios, envíos pendientes, resends, share links, one-shots). |
| `assignments_history` | **Historial de asignaciones** | Log/auditoría de cambios en asignaciones de formularios a usuarios. |
| `user_form_assignments` | **Asignaciones usuario↔formulario** | Qué formularios tiene asignados cada usuario. |
| `groups` | **Grupos** | Grupos de usuarios (para permisos y asignaciones masivas). |
| `user_group_memberships` | **Membresías de grupo** | Relación usuario ↔ grupo. |
| `api_keys` | **Llaves API** | Tokens de integración para consumir el backend desde fuera. |
| `public_form_otps` | **OTPs de formularios públicos** | Códigos de un solo uso para acceder a formularios públicos sin login. |
| `secure_downloads` | **Descargas seguras** | Tokens temporales para descargar PDFs/exports sin exponer la URL. |
| `consent_records` | **Consentimientos informados** | Registros firmados de consentimiento (vacunación, VIH, tuberculina, venopunción, etc.). |
| `form_assets.files` + `form_assets.chunks` | **Assets de formularios (GridFS)** | Imágenes/archivos usados en la definición de formularios (logos, encabezados). |
| `submission_files.files` + `submission_files.chunks` | **Archivos de envíos (GridFS)** | Firmas y fotos capturadas al diligenciar formularios. Binarios grandes van aquí. |
| `report_downloads` | *(legacy)* | Colección antigua, ya no la usa el código actual. Candidata a eliminar previa verificación. |

> **Nota sobre GridFS:** las colecciones `*.files` y `*.chunks` son automáticas de MongoDB para guardar binarios grandes (>16MB). No se tocan directamente.

---

## Tablas PostgreSQL (TypeORM)

| Tabla | En español | Qué guarda |
|---|---|---|
| `users` | **Usuarios** | Credenciales, roles, permisos, perfil. Login/auth sale de aquí. |
| `admin_actions` | **Acciones administrativas** | Auditoría de operaciones sensibles del admin. |

---

## Cómo verificar cuántos documentos hay realmente

En **Compass**, el preview de "Aggregations" muestra solo 4 tarjetas de muestra. El total real está en:
- La pestaña **"Documents"** (muestra el contador correcto y permite paginar).
- El contador que aparece arriba del preview: *"N Documents in the collection"*.
- O desde el shell:
  ```js
  db.projects.countDocuments({})
  db.forms.countDocuments({})
  db.form_submissions.countDocuments({})
  ```

Para ver los creados en las últimas 24h:
```js
db.projects.find({ createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) } })
```
