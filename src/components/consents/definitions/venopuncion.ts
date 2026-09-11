// Definición del consentimiento de Venopunción (motor config-driven).
//
// Fuente: consentify/consen_veno.php (campos del formulario) +
// guardar_consentimientov.php (columnas persistidas en la tabla `venopuncion`:
// nombres, apellidos, tipo_documento, numero_documento, genero, autorizo,
// toma_medicamento + cuales_medicamentos, sufre_enfermedad +
// cuales_enfermedades, ayuno_8_a_12_horas, ha_consumido_licor, dieta_especial +
// especificar_dieta, realiza_ejercicio, fecha_ultima_menstruacion, fecha_firma,
// nombre_acompanante, apellido_acompanante, tipodoc_acompanante,
// documento_acompanante, firma_paciente, nombre_profesional (viene del select
// "responsable_prueba"), cargo_profesional (viene de "cargo_responsable")).
// generarv_pdf.php contiene el único texto legal/Habeas Data (el HTML del
// formulario no lo trae); se extrajo de ahí, quitando el markup HTML
// (<b>/<strong>/<br>) y la interpolación dinámica de identidad del paciente
// (ver reporte de la tarea, sección "PARA VALIDACIÓN DEL USUARIO").
//
// Tipo de único formulario (sin selector SOUL/SAI): la IPS responsable del
// procedimiento es siempre Servicios y Asesorías en Infectología SAI, por lo
// que `meta.entidad` queda sin definir (no es multi-entidad).
//
// Identidad: `nombres`/`apellidos`/`tipoDoc`/`numDoc` son los ids CANÓNICOS
// del paciente. El acompañante/acudiente y el profesional responsable NO son
// la identidad del paciente: usan ids propios (`acompanante*`, `profesional*`)
// para que fluyan a `respuestas` sin pisar los campos canónicos.

import { ACCEPT_FIELD_ID, SIGNATURE_FIELD_ID } from "../config/entityConfig";
import logo from "../../../assets/consents/sai-logo.png";
import type { ConsentDefinition } from "../engine/consentDefinition";

const RESPONSABLES_PRUEBA = [
  "Anyela Giset Borja Rodríguez",
  "Liliana Milena Velandia Granados",
  "Ivonne Catherine Espitia Barreto",
  "Lina Ximena Medina Bustos",
  "Yumei Vanneza Orozco Mora",
];

const TIPO_DOC_OPTIONS = ["CC", "CE", "PB", "RC", "TI"];

const legalText = [
  "Autorizo a la IPS Servicios y Asesorías en Infectología SAI S.A.S. la realización de venopunción, procedimiento que consiste en la extracción de sangre venosa o capilar, realizada por un profesional o flebotomista idóneo, durante una o varias punciones (según el tipo de prueba o las venas), en el cual se puede sentir dolor moderado o sensación de pinchazo o picadura. La venopunción se realiza para obtener muestras importantes para análisis paraclínicos, cuyos reportes ayudan al médico tratante a esclarecer diagnósticos y a monitorizar afecciones de salud crónicas o de forma preventiva.",
  "En caso de que la punción no sea exitosa porque no se logre ubicar correctamente la vena o la muestra sea insuficiente, es posible que se requiera una segunda venopunción. Si no desea que se le repita, o prefiere que lo haga otra persona, puede manifestarlo y se concertará una solución adecuada para usted y viable para el servicio. RIESGOS: sangrado excesivo, mareo, desmayo, hematoma, infección (por ruptura de la piel), lesión en nervios, flebitis (dolor, edema, enrojecimiento y sensibilidad de la piel).",
  "BENEFICIOS: los análisis paraclínicos constituyen un apoyo diagnóstico para su médico tratante, quien con base en la historia clínica y los resultados puede tomar decisiones de diagnóstico, tratamiento, pronóstico y prevención de enfermedades.",
  "ENTIENDO que la venopunción es el único procedimiento para la obtención de muestras y DECLARO que he entendido la información suministrada por el personal de la IPS Servicios y Asesorías en Infectología SAI S.A.S. con respecto a los riesgos previstos, habiendo tenido oportunidad de aclarar mis dudas, y que constaté que el personal utiliza los elementos de protección personal (EPP) necesarios para la atención y prevención. He recibido respuesta a todas mis preguntas, por lo que asumo que SAI S.A.S. y su personal no tendrán responsabilidad médica, financiera, penal o de otra índole derivada de este procedimiento.",
  "CONOZCO mi obligación sobre el uso de elementos de protección personal, para así mismo proteger al profesional de salud que me atiende, y mi derecho de acceder a los resultados y a la confidencialidad de los mismos. Conozco las condiciones óptimas requeridas para presentarme a la toma de mi muestra que garanticen resultados precisos, y asumo la responsabilidad de las consecuencias clínicas y económicas que se deriven si insisto en la venopunción aun sin cumplir dichas condiciones.",
].join("\n\n");

const habeasData = [
  "La IPS Servicios y Asesorías en Infectología SAI S.A.S. será responsable del tratamiento y manejo de los datos personales, cumpliendo lo dispuesto en la Ley 1581 de 2012, la Ley 1266 de 2008, el Decreto 1377 de 2013 y demás normas que los complementen o sustituyan.",
  "Autorizo al laboratorio clínico de la IPS Servicios y Asesorías en Infectología SAI S.A.S. para que pueda contactarme vía telefónica, WhatsApp, correo electrónico o mensaje de texto con el fin de recolectar, almacenar, usar y tratar mis datos personales y clínicos, a fin de brindar la atención en salud requerida con oportunidad y calidad, realizar verificación de satisfacción del servicio, publicar nuevos servicios, actualizar información y enviar comunicaciones relacionadas con prevención en salud y diagnóstico de enfermedad.",
].join("\n\n");

export const venopuncionDefinition: ConsentDefinition = {
  meta: {
    tipo: "venopuncion",
    titulo: "Consentimiento Informado para Venopunción",
    entidadNombre: "SERVICIOS Y ASESORÍAS EN INFECTOLOGÍA SAI",
    displayName: "SAI",
    codigo: "SL-FT-14",
    version: "03",
    logo,
  },
  sections: [
    {
      id: "datosPaciente",
      kind: "fields",
      title: "Datos del paciente",
      fields: [
        { id: "nombres", label: "Nombres", type: "text", required: true, half: true },
        { id: "apellidos", label: "Apellidos", type: "text", required: true, half: true },
        {
          id: "tipoDoc",
          label: "Tipo de identificación",
          type: "select",
          required: true,
          half: true,
          options: TIPO_DOC_OPTIONS,
        },
        { id: "numDoc", label: "Número de identificación", type: "text", required: true, half: true, placeholder: "Ej: 1020304050" },
        {
          id: "genero",
          label: "Género",
          type: "select",
          required: true,
          half: true,
          options: ["Masculino", "Femenino"],
        },
      ],
    },
    {
      id: "autorizacion",
      kind: "tristate",
      title: "Autorización",
      questions: [
        {
          id: "autorizoContacto",
          num: "A",
          text: "Autorizo al laboratorio clínico a contactarme por vía telefónica, WhatsApp, correo electrónico y envío de resultados.",
          thirdLabel: "No aplica",
          required: true,
        },
      ],
    },
    {
      id: "saludDiagnostico",
      kind: "tristate",
      title: "Salud y diagnóstico",
      questions: [
        {
          id: "tomaMedicamento",
          num: "1",
          text: "¿Toma algún medicamento?",
          thirdLabel: "No aplica",
          required: true,
          note: { id: "cualesMedicamentos", label: "¿Cuál/es?" },
        },
        {
          id: "sufreEnfermedad",
          num: "2",
          text: "¿Sufre de alguna enfermedad?",
          thirdLabel: "No aplica",
          required: true,
          note: { id: "cualesEnfermedades", label: "¿Cuál/es?" },
        },
        {
          id: "ayuno8a12Horas",
          num: "3",
          text: "¿Tiene usted un ayuno de 8 a 12 horas?",
          thirdLabel: "No aplica",
          required: true,
        },
        {
          id: "haConsumidoLicor",
          num: "4",
          text: "¿Ha consumido licor en las últimas 72 horas?",
          thirdLabel: "No aplica",
          required: true,
        },
        {
          id: "dietaEspecial",
          num: "5",
          text: "¿Tiene usted alguna dieta especial?",
          thirdLabel: "No aplica",
          required: true,
          note: { id: "especificarDieta", label: "Especifique" },
        },
        {
          id: "realizaEjercicio",
          num: "6",
          text: "¿Realiza usted ejercicio físico?",
          thirdLabel: "No aplica",
          required: true,
        },
      ],
    },
    {
      id: "menstruacion",
      kind: "fields",
      fields: [
        {
          id: "fechaUltimaMenstruacion",
          label: "7. Fecha de última menstruación (si aplica)",
          type: "date",
        },
      ],
    },
    {
      id: "certifico",
      kind: "fields",
      title: "Certifico",
      fields: [
        {
          id: "fecha",
          label: "Que el documento ha sido leído y entendido por mí en su integridad. Este consentimiento se firma:",
          type: "date",
          required: true,
        },
      ],
    },
    {
      id: "acompanante",
      kind: "fields",
      title: "Datos del acompañante / acudiente (si el paciente es menor de edad o viene con un acudiente)",
      fields: [
        { id: "acompananteNombre", label: "Nombres", type: "text", half: true },
        { id: "acompananteApellido", label: "Apellidos", type: "text", half: true },
        {
          id: "acompananteTipoDoc",
          label: "Tipo de identificación",
          type: "select",
          half: true,
          options: TIPO_DOC_OPTIONS,
        },
        { id: "acompananteNumDoc", label: "Número de identificación", type: "text", half: true },
      ],
    },
    {
      id: "profesional",
      kind: "fields",
      title: "Responsable de la prueba",
      fields: [
        {
          id: "profesionalNombre",
          label: "Responsable de la prueba",
          type: "select",
          required: true,
          half: true,
          options: RESPONSABLES_PRUEBA,
        },
        { id: "profesionalCargo", label: "Cargo del profesional", type: "text", half: true, placeholder: "Ej: Enfermera" },
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
      firmaPaciente: { id: SIGNATURE_FIELD_ID, label: "Firma del paciente o representante" },
    },
  ],
};
