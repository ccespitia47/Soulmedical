// Definición de Vacunación · Esquema B (multi-entidad SOUL/SAI).
//
// Investigación de fuente (Task 5): comparado contra el estándar de
// Vacunación (Plan 2), el formulario web de la variante B
// (`consen_vacunaen.php`) tiene el MISMO cuestionario clínico que el
// estándar (`consen_vacuna.php`): mismas 6 condiciones de la Sección A,
// mismas preguntas de la Sección B (1-6) y de virus vivos (7-13), y mismas
// columnas de la tabla de vacunas (Sección C). Las únicas diferencias de
// campos son administrativas y YA están excluidas de la definición
// curada: variante B no tiene el campo "género" ni la sección de pago
// particular (medio de pago, número de vacunas, valores unitarios) que sí
// trae el estándar.
//
// El generador de PDF de la variante B (`generarvacunab_pdf.php`) es
// exclusivamente de marca SOUL (logo, encabezado CÓDIGO: SV-FT-B01,
// VERSIÓN/FECHA de la tabla de control de cambios 01/19-11-2019, texto de
// "Consentimiento informado" y "Habeas Data" de SOULMEDICAL) — ese
// contenido es, verificado línea a línea, el mismo que ya usa
// `vacunacionDefinition("soul")` (Plan 2: mismo código, misma versión,
// mismo texto legal y habeas data). El sistema legado NO tiene una
// plantilla de PDF de variante B para SAI (generarvacunab_pdf.php no
// tiene rama SAI); para esa entidad se reutiliza el mismo contenido
// curado que la Vacunación estándar, ya que no hay una fuente B distinta
// que justifique un texto diferente.
//
// Conclusión (ver task-5-report.md, "PARA VALIDACIÓN DEL USUARIO"):
// Vacunación‑B es, en contenido de consentimiento, la MISMA definición que
// Vacunación estándar; solo cambia `meta.tipo`. Se reutiliza
// `vacunacionDefinition` en vez de duplicar toda la estructura de
// secciones.

import { vacunacionDefinition } from "./vacunacion";
import type { EntityKey } from "../config";
import type { ConsentDefinition } from "../engine/consentDefinition";

export function vacunacionBDefinition(entity: EntityKey): ConsentDefinition {
  const base = vacunacionDefinition(entity);
  return {
    ...base,
    meta: { ...base.meta, tipo: "vacunacion_b" },
  };
}
