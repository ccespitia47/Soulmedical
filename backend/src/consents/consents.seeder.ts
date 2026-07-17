import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Form, FormDocument } from '../forms/form.schema';

// Carpeta lógica del sistema. Debe coincidir con CONSENT_FOLDER_ID del frontend
// (src/components/consents/config/entityConfig.ts).
const CONSENT_FOLDER_ID = 'consent-system-folder';

type Widget = {
  id: string;
  type: string;
  label: string;
  required: boolean;
  config: Record<string, unknown>;
};

// Widgets comunes a ambas entidades. tetanosAnios se agrega solo a SOUL.
// El id de cada widget DEBE coincidir con el id del campo/pregunta enviado
// desde el frontend (configs SOUL/SAI), para que la firma baje a GridFS y el
// export a Power BI conserve los labels.
function buildWidgets(includeTetanos: boolean): Widget[] {
  const w = (id: string, type: string, label: string, required = false): Widget => ({
    id,
    type,
    label,
    required,
    config: {},
  });
  const list: Widget[] = [
    // Datos generales
    w('fecha', 'date', 'Fecha', true),
    w('ciudad', 'text', 'Ciudad'),
    w('pacienteNombre', 'text', 'Nombre y Apellidos', true),
    w('pacienteTipoDoc', 'select', 'Tipo de documento', true),
    w('pacienteNumDoc', 'text', 'Documento', true),
    w('pacienteFechaNac', 'date', 'Fecha de nacimiento'),
    w('edad', 'number', 'Edad'),
    w('rh', 'text', 'RH'),
    w('entidad', 'text', 'Entidad'),
    w('entidadRemite', 'text', 'Entidad que lo remite'),
    w('eps', 'text', 'EPS'),
    w('direccion', 'text', 'Dirección del domicilio'),
    w('pacienteTelefono', 'phone', 'Teléfono'),
    w('pacienteEmail', 'email', 'Correo electrónico', true),
  ];
  if (includeTetanos) {
    list.push(w('tetanosAnios', 'number', 'Años desde última vacuna de tétanos'));
  }
  list.push(
    // Sección A
    w('condiciones', 'text', 'Condiciones (Sección A)'),
    w('antineumococica', 'text', '¿Ha recibido antineumocócica?'),
    w('antineumococicaFecha', 'text', 'Antineumocócica ¿cuándo?'),
    w('herpesZoster', 'text', '¿Ha recibido herpes zóster?'),
    // Sección B
    w('b1', 'text', '¿Se siente enfermo hoy?'),
    w('b2', 'text', '¿Alergia seria a medicamento o alimento?'),
    w('b2Indique', 'text', 'Alergia — indique'),
    w('b3', 'text', '¿Reacción seria o desmayo tras vacuna?'),
    w('b4', 'text', '¿Sensibilidad al látex?'),
    w('b5', 'text', '¿Trastorno de convulsiones o cerebral? (Tdap)'),
    w('b6', 'text', '¿Embarazo o considera embarazo próximo mes?'),
    // Virus vivos
    w('v7', 'text', '¿Vacuna en últimas cuatro semanas?'),
    w('v7Indique', 'text', 'Vacuna reciente — indique'),
    w('v8', 'text', '¿Cáncer, leucemia, VIH u otro problema inmune?'),
    w('v9', 'text', '¿Prednisona/esteroides/antivirales/inmunosupresores?'),
    w('v10', 'text', '¿Transfusión, inmunoglobulina o radioterapia (último año)?'),
    w('v11', 'text', '¿Problemas del timo? (fiebre amarilla)'),
    w('v12', 'text', '¿Antibiótico o antimaláricos? (tifoidea oral)'),
    w('v13', 'text', '¿Historial de trombocitopenia o púrpura?'),
    // Sección C + firmas
    w('seccionC', 'text', 'Datos de vacunas (Sección C)'),
    w('aceptaConsentimiento', 'checkbox', 'Acepta el consentimiento', true),
    w('firma', 'signature', 'Firma del paciente / acudiente', true),
    w('firmaResponsable', 'signature', 'Firma responsable de vacunación', true),
  );
  return list;
}

const FORMS = [
  { id: 'consent-vaccination-soul', name: 'Consentimiento de Vacunación · SOUL', widgets: buildWidgets(true) },
  { id: 'consent-vaccination-sai', name: 'Consentimiento de Vacunación · SAI', widgets: buildWidgets(false) },
];

@Injectable()
export class ConsentsSeeder implements OnModuleInit {
  private readonly logger = new Logger(ConsentsSeeder.name);

  constructor(
    @InjectModel(Form.name) private readonly formModel: Model<FormDocument>,
  ) {}

  // Al arrancar, asegura (upsert) los formularios reales de consentimiento por
  // entidad con _id fijo, para que los envíos del frontend persistan contra
  // ellos (y las firmas se descarguen a GridFS).
  async onModuleInit(): Promise<void> {
    for (const f of FORMS) {
      try {
        await this.formModel.updateOne(
          { _id: f.id } as Record<string, unknown>,
          {
            $set: {
              name: f.name,
              folderId: CONSENT_FOLDER_ID,
              schema: { widgets: f.widgets, rules: [] },
              isActive: true,
            },
            $setOnInsert: {
              createdById: 0,
              version: 1,
              emailTemplate: null,
              isPublic: false,
              sendConfirmationEmail: false,
            },
          },
          { upsert: true },
        );
        this.logger.log(`Formulario "${f.name}" sembrado/actualizado`);
      } catch (err) {
        this.logger.error(`No se pudo sembrar ${f.id}`, err as Error);
      }
    }
  }
}
