// Definición del consentimiento de Tuberculina (motor config-driven).
//
// Fuente: consentify/consen_tuber.php (campos del formulario) +
// guardar_consentimientot.php (columnas persistidas en
// `consentimientos_tuberculina`: fecha_aplicacion, nombres, apellidos,
// tipo_identificacion, numero_identificacion, enfermedades_inmunosupresoras +
// otras_enfermedades_inmunosupresoras, tuberculosis_pulmonar + hace_cuanto +
// realizo_tratamiento + tiempo_tratamiento, antecedentes_exposicionales_contacto
// + quien_contacto + dias_contacto, consumo_medicamentos + otras_medicaciones,
// vacunas_recientes + tipos_vacunas, sintomas_ultimos_15_dias,
// grupo_poblacional, firma, fecha_firma (NOW() en servidor, no viene del
// formulario), responsable_prueba, cargo_responsable). El HTML del formulario
// NO trae el texto legal/Habeas Data; ese texto se imprime en el PDF generado
// por generart_pdf.php, de donde se extrajo verbatim (ver reporte de la tarea
// para el detalle de las correcciones/reorganizaciones marcadas para
// validación).
//
// Tipo de único formulario (sin selector SOUL/SAI): la IPS responsable de la
// prueba es siempre Servicios y Asesorías en Infectología SAI, por lo que
// `meta.entidad` queda sin definir (no es multi-entidad).

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

const legalText = [
  "Por la presente hago constar que soy: (a) el paciente, mayor de 18 años; (b) la madre / el padre / tutor legal del paciente menor de edad; o (c) el tutor legal del paciente. Asimismo, por este medio doy mi consentimiento a Servicios y Asesorías en Infectología SAI, según corresponda, para que administren la prueba de tuberculina PPD, prueba que consiste en la aplicación de un producto denominado Tuberculina (PPD) en la zona externa del antebrazo izquierdo, con el objetivo de confirmar o descartar la infección tuberculosa (no la enfermedad).",
  "BENEFICIOS: confirmar o descartar infección por el bacilo Mycobacterium tuberculosis y detectar individuos con alto riesgo de enfermedad de tuberculosis.",
  "RIESGOS: esta aplicación puede producir una reacción inflamatoria, pápula (roncha) y/o enrojecimiento en el sitio de aplicación; se puede presentar una pequeña molestia (dolor, ardor, comezón).",
  "INDICACIONES DURANTE EL PROCESO: no debe rascarse ni colocar sustancias en el sitio de la aplicación. La reacción desaparecerá paulatinamente en los días siguientes a la aplicación; puede lavar el brazo y secarlo con suavidad mientras vuelve a la lectura.",
  "Debe regresar a las 72 horas de la aplicación (3 días). Es muy importante realizar este segundo paso del procedimiento; de lo contrario no se podrá conocer su resultado. Los resultados serán entregados el día que cite a la lectura.",
].join("\n\n");

const habeasData = [
  "Otorgo por este medio autorización a SAI para que almacene, administre y/o utilice la información de mis datos personales y los transfiera según se requiera en desarrollo de la IPS SAI; así mismo, autorizo para que me contacten de manera telefónica, electrónica, física o por cualquier otro medio de comunicación para darme información o brindarme apoyo de tipo educativo relacionado con temas de salud y manejo de mi enfermedad (Ley 1581 de 2012, artículos 3, 4, 5, 6 y 7).",
  "Conozco y entiendo que tengo el derecho de conocer, actualizar, corregir o solicitar que se certifique o elimine mi información personal de las bases de datos en que se encuentre. Entiendo que el responsable del manejo de mi información es SAI, Calle 50 # 13-62, Piso 2, oficina 201, teléfono 601 7449571 opción 2, y que no compartirá mi información con terceros salvo con aquellos que la utilicen para fines clínicos.",
].join("\n\n");

export const tuberculinaDefinition: ConsentDefinition = {
  meta: {
    tipo: "tuberculina",
    titulo: "Consentimiento Informado para Aplicación de Prueba de Tuberculina (Técnica de Mantoux)",
    entidadNombre: "SERVICIOS Y ASESORÍAS EN INFECTOLOGÍA SAI",
    displayName: "SAI",
    codigo: "PPPPD-FT-02",
    version: "02",
    logo,
  },
  sections: [
    {
      id: "identidad",
      kind: "fields",
      title: "Datos personales",
      fields: [
        { id: "fecha", label: "Fecha de aplicación", type: "date", required: true, half: true },
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
      ],
    },
    {
      id: "antecedentesPersonales",
      kind: "conditions",
      title: "Antecedentes personales",
      group: {
        id: "enfermedadesInmunosupresoras",
        label: "Enfermedades inmunosupresoras",
        options: ["Artritis", "Psoriasis", "Cáncer", "VIH", "Colitis", "LES (Lupus)", "Nefropatía", "Otra"],
      },
    },
    {
      id: "antecedentesPersonalesOtra",
      kind: "fields",
      fields: [{ id: "otraEnfermedadCual", label: "Otra ¿cuál?", type: "text", half: true }],
    },
    {
      id: "tuberculosisPulmonar",
      kind: "tristate",
      title: "Información sobre tuberculosis",
      questions: [
        {
          id: "tuberculosisPulmonar",
          num: "1",
          text: "¿Presenta o ha presentado tuberculosis pulmonar?",
          thirdLabel: "No aplica",
          required: true,
        },
        {
          id: "realizoTratamiento",
          num: "1.1",
          text: "¿Realizó tratamiento?",
          thirdLabel: "No aplica",
        },
      ],
    },
    {
      id: "tuberculosisPulmonarDetalle",
      kind: "fields",
      fields: [
        { id: "haceCuanto", label: "Hace cuánto", type: "text", half: true },
        { id: "tiempoTratamiento", label: "¿Por cuánto tiempo?", type: "text", half: true },
      ],
    },
    {
      id: "antecedentesExposicionales",
      kind: "tristate",
      title: "Antecedentes exposicionales",
      questions: [
        {
          id: "contactoTuberculosis",
          num: "2",
          text: "¿Ha estado en contacto con alguien que tenga o haya tenido tuberculosis pulmonar?",
          thirdLabel: "No aplica",
        },
      ],
    },
    {
      id: "antecedentesExposicionalesDetalle",
      kind: "fields",
      fields: [
        { id: "quienContacto", label: "¿Quién?", type: "text", half: true },
        { id: "diasContacto", label: "¿Cuántas horas o días compartió con él/ella?", type: "text", half: true },
      ],
    },
    {
      id: "antecedentesFarmacologicos",
      kind: "conditions",
      title: "Antecedentes farmacológicos",
      group: {
        id: "consumoMedicamentos",
        label: "Consumo actual de medicamentos",
        options: ["Inmunosupresores", "Corticoides", "Antiagregantes", "Anticoagulantes", "Antirretrovirales", "Otros"],
      },
    },
    {
      id: "antecedentesFarmacologicosOtra",
      kind: "fields",
      fields: [{ id: "otrasMedicaciones", label: "Otros ¿cuál?", type: "text", half: true }],
    },
    {
      id: "antecedentesInmunologicos",
      kind: "tristate",
      title: "Antecedentes inmunológicos",
      questions: [
        {
          id: "vacunasRecientes",
          num: "3",
          text: "Aplicación de vacunas en las últimas 4 semanas",
          thirdLabel: "No aplica",
        },
      ],
    },
    {
      id: "antecedentesInmunologicosDetalle",
      kind: "conditions",
      group: {
        id: "tiposVacunas",
        label: "Tipos de vacuna aplicada",
        options: ["Sarampión", "Varicela", "Influenza", "Rubeola", "Neumococo", "Covid-19", "Otros"],
      },
    },
    {
      id: "antecedentesInmunologicosOtra",
      kind: "fields",
      fields: [{ id: "cualInmuno", label: "Otros ¿cuál?", type: "text", half: true }],
    },
    {
      id: "sintomas",
      kind: "conditions",
      title: "Ha presentado los siguientes síntomas en los últimos 15 días",
      group: {
        id: "sintomas",
        label: "Síntomas",
        options: ["Tos con expectoración", "Fiebre", "Dificultad para respirar", "Pérdida de peso repentino", "Sudoración nocturna"],
      },
    },
    {
      id: "gruposPoblacionales",
      kind: "conditions",
      title: "Pertenece a uno de los siguientes grupos poblacionales",
      group: {
        id: "gruposPoblacionales",
        label: "Grupos poblacionales",
        options: [
          "Trabajador de la salud",
          "Candidato a trasplante de órganos",
          "Contacto con personas con diagnóstico de TBC",
          "Población carcelaria (reclusos o empleados)",
          "Enfermedad renal crónica en manejo de diálisis",
        ],
      },
    },
    {
      id: "responsablePrueba",
      kind: "fields",
      title: "Responsable de la prueba",
      fields: [
        {
          id: "profesional",
          label: "Responsable de la prueba",
          type: "select",
          required: true,
          half: true,
          options: RESPONSABLES_PRUEBA,
        },
        { id: "cargoProfesional", label: "Cargo del profesional", type: "text", half: true, placeholder: "Ej: Enfermera" },
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
