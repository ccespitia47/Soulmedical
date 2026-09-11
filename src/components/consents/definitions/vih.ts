// Definición del consentimiento de VIH (motor config-driven).
//
// Fuente: consentify/consen_vih.php (campos del formulario) +
// guardar_consentimientovih.php (columnas persistidas: nombres, apellidos,
// tipo_documento, numero_documento, ciudad, fecha_firma, firma_paciente,
// nombre_profesional). El HTML del formulario NO trae el texto legal/Habeas
// Data (solo campos + firma); ese texto se imprime en el PDF generado por
// generarvih_pdf.php, de donde se extrajo verbatim (ver reporte de la tarea
// para el detalle de las dos correcciones menores marcadas para validación).
//
// Tipo de único formulario (sin selector SOUL/SAI): la IPS responsable de la
// prueba es siempre Servicios y Asesorías en Infectología SAI, por lo que
// `meta.entidad` queda sin definir (no es multi-entidad).

import { ACCEPT_FIELD_ID, SIGNATURE_FIELD_ID } from "../config/entityConfig";
import logo from "../../../assets/consents/sai-logo.png";
import type { ConsentDefinition } from "../engine/consentDefinition";

const legalText = [
  "Autorización voluntaria para realizar la prueba de VIH (Decreto 1543 de 1997 del Ministerio de Salud, por el cual se reglamentan los mecanismos para la prevención, diagnóstico, manejo y reporte epidemiológico de la infección por VIH).",
  "Por este conducto certifico que me ha sido explicado de manera escrita o verbal qué es la infección por el Virus de Inmunodeficiencia Humana (VIH), las consecuencias que puede tener para mi salud y la importancia de realizarme una prueba para saber si soy o no portador de este virus, así como el procedimiento de esta prueba rápida de detección, a la cual accedo de manera voluntaria.",
  "De igual manera, confirmo que he recibido la información sobre las formas de transmisión y cómo prevenirla, así como consejería relativa a las implicaciones de esta prueba: es un examen presuntivo de laboratorio que indica posible infección por el VIH y cuyo resultado, en caso de ser reactivo, requiere confirmación por otro procedimiento de mayor especificidad denominado prueba confirmatoria para VIH (Western Blot o Carga Viral VIH); en cuyo caso se me enviará al lugar apropiado para que se realice la prueba confirmatoria y se me brinde atención médica.",
  "Así mismo, entiendo que, aunque la prueba rápida es voluntaria y confidencial, el resultado me será entregado personalmente por un consejero y/o personal de salud capacitado que debe conocer mi resultado para poder orientarme, y que en ninguna circunstancia divulgará el resultado de mi prueba o dato alguno que permita mi identificación a terceros.",
].join("\n\n");

const habeasData =
  "He sido informado que la IPS Servicios y Asesorías en Infectología SAI será responsable del tratamiento y manejo de mis datos personales, cumpliendo lo dispuesto en la Ley 1581 de 2012, la Ley 1266 de 2008, el Decreto 1377 de 2013 y demás normas que los complementen o sustituyan.";

export const vihDefinition: ConsentDefinition = {
  meta: {
    tipo: "vih",
    titulo: "Consentimiento Informado para la Prueba de VIH",
    entidadNombre: "SERVICIOS Y ASESORÍAS EN INFECTOLOGÍA SAI",
    displayName: "SAI",
    codigo: "SL-FT-19",
    version: "02",
    logo,
  },
  sections: [
    {
      id: "identidad",
      kind: "fields",
      title: "Datos personales",
      fields: [
        { id: "nombres", label: "Nombres", type: "text", required: true, half: true },
        { id: "apellidos", label: "Apellidos", type: "text", required: true, half: true },
        {
          id: "tipoDoc",
          label: "Tipo de identificación",
          type: "select",
          required: true,
          half: true,
          options: ["CC", "CE", "PB", "RC", "TI"],
        },
        { id: "numDoc", label: "Número de identificación", type: "text", required: true, half: true, placeholder: "Ej: 1020304050" },
        { id: "ciudad", label: "Ciudad", type: "text", required: true, half: true },
        { id: "profesional", label: "Profesional responsable", type: "text", required: true, half: true },
        { id: "fecha", label: "Fecha de firma", type: "date", required: true, half: true },
      ],
    },
    {
      id: "legal",
      kind: "legal",
      title: "Consentimiento informado",
      legalText,
      habeasData,
      acceptId: ACCEPT_FIELD_ID,
    },
    {
      id: "firmas",
      kind: "signatures",
      firmaPaciente: { id: SIGNATURE_FIELD_ID, label: "Firma del paciente" },
    },
  ],
};
