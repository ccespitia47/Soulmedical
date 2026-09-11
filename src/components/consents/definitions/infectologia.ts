// Definición del consentimiento de Infectología (motor config-driven).
//
// Fuente: consentify/consen_infe.php (campos del formulario, incluida la
// captura de foto del paciente) + guardar_consentimientoinfe.php (columnas
// persistidas: nombres, apellidos, tipo_documento, numero_documento, ciudad,
// fecha_firma, firma_paciente, nombre_profesional, foto). El HTML del
// formulario NO trae el texto legal/Habeas Data; ese texto se imprime en el
// PDF generado por generarinfe_pdf.php, de donde se extrajo verbatim (ver
// reporte de la tarea para las dos correcciones marcadas para validación).
//
// Tipo de único formulario (sin selector SOUL/SAI): la IPS responsable de la
// consulta es siempre Servicios y Asesorías en Infectología SAI, por lo que
// `meta.entidad` queda sin definir (no es multi-entidad).

import { ACCEPT_FIELD_ID, SIGNATURE_FIELD_ID } from "../config/entityConfig";
import logo from "../../../assets/consents/sai-logo.png";
import type { ConsentDefinition } from "../engine/consentDefinition";

const legalText = [
  "El paciente acude a consulta externa de infectología con el objetivo de recibir atención médica especializada para el diagnóstico, tratamiento y seguimiento de enfermedades infecciosas, de acuerdo con los protocolos establecidos por la institución de salud.",
  "Se me ha informado que la consulta incluirá: entrevista clínica detallada; revisión de antecedentes médicos y factores de riesgo; exámenes físicos y, si es necesario, la solicitud de estudios complementarios; y formulación de tratamiento y recomendaciones médicas.",
  "También comprendo que, como en cualquier acto médico, existen riesgos inherentes, como reacciones adversas a medicamentos o procedimientos indicados, y la posibilidad de que se requieran estudios adicionales para un diagnóstico preciso.",
  "Declaro que la información proporcionada en este documento es veraz y que he sido informado de los aspectos relacionados con la consulta de infectología.",
].join("\n\n");

const habeasData = [
  "Cumpliendo lo dispuesto en la Ley 1581 de 2012, la Ley 1266 de 2008, el Decreto 1377 de 2013 y demás normas que los complementen o sustituyan, autorizo al consultorio de infectología y al profesional responsable a recopilar, almacenar y tratar mis datos personales y de salud con el propósito de brindarme atención médica, gestionar mi historia clínica y cumplir con las obligaciones legales en materia de salud. Entiendo que estos datos serán manejados con estricta confidencialidad y solo podrán ser compartidos con terceros en los casos previstos por la ley.",
  "Así mismo, autorizo al consultorio de infectología y al profesional responsable a contactarme por llamada telefónica, correo electrónico y/o mensaje de texto, con el fin de brindar la atención en salud requerida con oportunidad y calidad.",
].join("\n\n");

export const infectologiaDefinition: ConsentDefinition = {
  meta: {
    tipo: "infectologia",
    titulo: "Consentimiento Informado - Consulta Externa de Infectología",
    entidadNombre: "SERVICIOS Y ASESORÍAS EN INFECTOLOGÍA SAI",
    displayName: "SAI",
    codigo: "PRSP-CP-ft-01",
    version: "01",
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
      id: "foto",
      kind: "photo",
      title: "Foto del paciente",
      photo: { id: "foto", label: "Captura de imagen del paciente" },
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
