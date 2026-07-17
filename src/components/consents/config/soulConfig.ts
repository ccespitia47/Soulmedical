import type { EntityConfig } from "./entityConfig";
import logo from "../../../assets/consents/soul-logo.png";

export const soulConfig: EntityConfig = {
  meta: {
    key: "soul",
    formId: "consent-vaccination-soul",
    entidadNombre: "SOULMEDICAL LTDA",
    displayName: "SOUL",
    codigo: "SV-FT-B01",
    version: "01",
    logo,
  },
  datosGenerales: [
    { id: "fecha", label: "Fecha", type: "date", required: true, half: true },
    { id: "ciudad", label: "Ciudad", type: "text", half: true },
    { id: "pacienteNombre", label: "Nombre y Apellidos", type: "text", required: true, placeholder: "Nombres y apellidos" },
    { id: "pacienteTipoDoc", label: "Tipo de documento", type: "select", required: true, half: true, options: ["CC", "TI", "CE", "Pasaporte", "RC"] },
    { id: "pacienteNumDoc", label: "Documento", type: "text", required: true, half: true, placeholder: "Ej: 1020304050" },
    { id: "pacienteFechaNac", label: "Fecha de nacimiento", type: "date", half: true },
    { id: "rh", label: "RH", type: "text", half: true, placeholder: "Ej: O+" },
    { id: "entidad", label: "Entidad", type: "text", half: true },
    { id: "eps", label: "EPS", type: "text", half: true },
    { id: "direccion", label: "Dirección del domicilio", type: "text" },
    { id: "pacienteTelefono", label: "Teléfono", type: "tel", half: true, placeholder: "Ej: 3001234567" },
    { id: "pacienteEmail", label: "Email", type: "email", required: true, half: true, placeholder: "paciente@correo.com" },
  ],
  seccionA: {
    tetanosAnios: { id: "tetanosAnios", label: "¿Cuánto tiempo (años) desde su última inyección contra el TÉTANOS?", type: "number", placeholder: "Años" },
    condiciones: {
      id: "condiciones",
      label: "Marque todo lo que aplique a usted:",
      options: ["Asma/Epoc", "Diabetes", "Enfermedad cardiaca", "Fumador de tabaco", "Inmunosupresión", "65 años o mayor"],
    },
    antineumococica: {
      id: "antineumococica",
      num: "2",
      text: "Si marcó alguna de las anteriores, ¿alguna vez ha recibido la vacuna ANTINEUMOCÓCICA?",
      thirdLabel: "No está seguro",
    },
    antineumococicaFecha: { id: "antineumococicaFecha", label: "Si la respuesta es afirmativa, ¿cuándo?", type: "text", placeholder: "Ej: 2021" },
    herpesZoster: {
      id: "herpesZoster",
      num: "3",
      text: "Pacientes de 60 años o mayores: ¿Alguna vez ha recibido la vacuna contra el HERPES ZOSTER?",
      thirdLabel: "No está seguro",
    },
  },
  seccionB: [
    { id: "b1", num: "1", text: "¿Se siente enfermo hoy?", thirdLabel: "No está seguro" },
    { id: "b2", num: "2", text: "¿Tiene una alergia seria a ALGÚN medicamento o alimento (p. ej., huevos, gelatina, timerosal, neomicina, gentamicina, etc.)?", thirdLabel: "No está seguro", note: { id: "b2Indique", label: "De ser así, indique:" } },
    { id: "b3", num: "3", text: "¿Alguna vez ha tenido una reacción seria o se ha desmayado después de recibir alguna vacuna?", thirdLabel: "No está seguro" },
    { id: "b4", num: "4", text: "¿Tiene sensibilidad al látex (p. ej., guantes o vendajes)?", thirdLabel: "No está seguro" },
    { id: "b5", num: "5", text: "¿Tiene un trastorno de convulsiones o trastorno cerebral? (Solo Tdap)", thirdLabel: "No está seguro" },
    { id: "b6", num: "6", text: "Para mujeres: ¿Está embarazada o está considerando quedar embarazada en el próximo mes?", thirdLabel: "No está seguro" },
  ],
  virusVivos: [
    { id: "v7", num: "7", text: "¿Ha recibido alguna vacuna en las últimas cuatro semanas?", thirdLabel: "No está seguro", note: { id: "v7Indique", label: "De ser así, indique:" } },
    { id: "v8", num: "8", text: "¿Tiene cáncer, leucemia, VIH, herpes activo o cualquier otro problema del sistema inmunológico?", thirdLabel: "No está seguro" },
    { id: "v9", num: "9", text: "¿Toma prednisona, esteroides orales, medicamentos contra el cáncer o antivirales o medicamentos que afecten el sistema inmunológico?", thirdLabel: "No está seguro" },
    { id: "v10", num: "10", text: "Durante el último año, ¿ha recibido una transfusión de sangre o productos sanguíneos, se le ha administrado inmunoglobulina (gamma) o ha tenido radioterapia?", thirdLabel: "No está seguro" },
    { id: "v11", num: "11", text: "¿Se le ha extirpado la glándula timo o tiene un historial de problemas con su timo, como miastenia gravis, síndrome DiGeorge o timoma? (Solo fiebre amarilla)", thirdLabel: "No está seguro" },
    { id: "v12", num: "12", text: "¿Actualmente está tomando algún antibiótico o medicamentos antimaláricos? (Solo tifoidea oral)", thirdLabel: "No está seguro" },
    { id: "v13", num: "13", text: "¿Tiene un historial de trombocitopenia o trombocitopenia púrpura? (Solo MMR® II)", thirdLabel: "No está seguro" },
  ],
  seccionC: {
    columns: [
      { id: "nombre", label: "Nombre vacuna" },
      { id: "dosis", label: "N° Dosis" },
      { id: "lote", label: "Lote" },
      { id: "vencimiento", label: "Fecha vencimiento" },
      { id: "proxima", label: "Fecha próxima vacuna" },
      { id: "fabricante", label: "Fabricante" },
    ],
  },
  legalText: `Por la presente hago constar que soy: (a) el paciente, mayor de 18 años; (b) la madre / el padre / tutor legal del paciente menor de edad; o (c) el tutor legal del paciente. Asimismo, por este medio doy mi consentimiento a SOULMEDICAL LTDA, según corresponda, para que administren la(s) vacuna(s) solicitadas. Tengo entendido que no es posible predecir todos los posibles efectos secundarios o complicaciones a consecuencia de la administración de la(s) vacuna(s). Entiendo los riesgos y beneficios asociados a la(s) vacuna(s) descrita(s) arriba; he recibido, leído y/o se me ha explicado las vacunas que he decidido recibir. También reconozco que se me ha dado la oportunidad de hacer preguntas, las cuales fueron contestadas a mi entera satisfacción. Además, admito que se me ha aconsejado permanecer cerca del lugar asignado a la vacunación por aproximadamente 15 minutos después de recibir la(s) vacuna(s) para estar bajo la observación del proveedor de servicios de salud que administra la(s) vacuna(s). El suscrito, en mi nombre, y en nombre de mis herederos y representantes personales, por la presente certifico eximir de cualquier responsabilidad y dejar en paz y a salvo a "SOULMEDICAL LTDA", a su personal, agentes, sucesores, divisiones, afiliados, subsidiarias, dirigentes, directores, contratistas y empleados, de toda responsabilidad o queja, ya sea conocida o desconocida, derivada en virtud de y respecto a la administración de la(s) vacuna(s) administradas. Hago constar que: (a) entiendo los objetivos y beneficios del registro de vacunación ("Registro distrital") y el intercambio de información de salud de mi estado; y (b) el "Proveedor de Aplicación" puede divulgar la información de mi vacunación a –o a través del Registro distrital para propósitos de información de salud pública o a mis proveedores de servicios de salud inscritos en el Registro distrital para fines de coordinación de los cuidados de salud. Entiendo que, dependiendo de la ley de mi estado, puedo prevenir que "SOULMEDICAL", (a) divulguen la información de mi vacunación al Registro distrital; o (b) el Registro distrital compartan la información de mi vacunación con cualquiera de mis otros proveedores de salud inscritos en el Registro distrital. Estoy consciente de que, conforme a la ley, es requerido que otorgue mi consentimiento específico, salvo que la ley disponga lo contrario, con mi firma a continuación; por lo que doy mi autorización al "Proveedor de Aplicación SOULMEDICAL LTDA" para que divulgue la información de mi vacunación, a las entidades correspondientes y para los fines descritos en este Consentimiento informado de vacunación. A menos que yo proporcione al "Proveedor de Aplicación" la planilla de exclusión aprobada, tengo entendido que mi consentimiento permanecerá en vigor hasta que retire dicho permiso y puedo retirar mi consentimiento al proporcionar a "SOULMEDICAL", según corresponda, la planilla de exclusión voluntaria. Entiendo que, aunque no otorgue mi consentimiento o, aunque retire dicho consentimiento, las leyes de mi estado podrán permitir ciertas revelaciones de la información de mi vacunación a través del Registro distrital, según corresponda. Asimismo, doy mi autorización a "SOULMEDICAL" para que (a) dé a conocer mi información médica u otra información pertinente, incluso información sobre mis enfermedades transmisibles (como VIH), salud mental y abuso de drogas / alcohol a los profesionales encargados de los cuidados de mi salud, SOULMEDICAL, o terceros pagadores requeridos para efectuar cuidados o pagos, (b) presentar una reclamación de gastos a mi compañía de seguros por concepto de los productos y servicios arriba solicitados, y (c) solicitar que los pagos correspondientes a beneficios autorizados en mi nombre por los productos y servicios arriba solicitados se hagan a "SOULMEDICAL". Estoy de acuerdo en asumir la responsabilidad financiera completa por cualquier copago, coaseguro y deducible incurrido por los productos y servicios solicitados, así como por otros productos y servicios cuyo costo no esté incluido en la cubierta de mi plan de salud. Tengo entendido que es mi responsabilidad hacer los pagos a los que estoy obligado al momento de recibir dichos productos y servicios; en caso de que "SOULMEDICAL" remita las facturas correspondientes con fecha posterior a la realización de los servicios, dichas facturas son pagaderas al momento de recibirlas.`,
  habeasData: `SECCIÓN E: HABEAS DATA (Ley estatutaria 1581 2012). Otorgo por este medio autorización a SOULMEDICAL para que almacenen, administren, y / o utilicen la información de mis datos personales y los transfieran entre ella según requiera en desarrollo de la IPS SOULMEDICAL, así mismo autorizo para que me contacten de manera telefónica, electrónica, física o cualquier otro medio de comunicación para darme información o brindarme apoyo de tipo educativo relacionado con temas de salud y manejo de mi enfermedad. Ley 1581 2012 ART. 3, 4, 5, 6, 7.

Conozco y entiendo que tengo el derecho de conocer, actualizar, corregir o solicitar que se certifique o elimine mi información personal de las bases de datos en que se encuentre.

Entiendo que los responsables del manejo de mi información es SOULMEDICAL LTDA y que estos no compartirán mi información con terceros salvo con aquellos que utilicen para el manejo de la base de datos.`,
  firmas: {
    firmaPaciente: { id: "firma", label: "Firma del paciente (o Madre / Padre / Tutor legal si es menor de edad)" },
    firmaResponsable: { id: "firmaResponsable", label: "Firma responsable de vacunación" },
  },
};
