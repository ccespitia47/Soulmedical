# SP1 · Plan 1 — Backend de Consentimientos (persistencia + API) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear el backend dedicado de consentimientos: colección Mongo `consent_records`, validación por tipo, hash de verificación y API NestJS (crear/listar/obtener/editar/anular/verificar).

**Architecture:** Módulo NestJS `consents` con una colección Mongoose propia (aislada del `form_submissions` genérico). Los binarios (firmas/foto) llegan como data URL, se suben a GridFS con `FilesService.uploadDataUrl` y se guardan como referencias `gridfs:<id>`. Cada registro guarda un `hashVerificacion` (sha-256 del contenido canónico) para validar el PDF descargado. La API se protege con `JwtAuthGuard` + `PermissionsGuard` + `@RequirePermission(Permission.CONSIENTIFY_ACCESS)`.

**Tech Stack:** NestJS 11, Mongoose 9 (@nestjs/mongoose), class-validator, Jest 30 + ts-jest, Node crypto.

**Spec:** `docs/superpowers/specs/2026-09-10-sp1-consentimientos-design.md`

## Global Constraints

- TypeScript estricto. Archivos pequeños y enfocados (regla del proyecto: evitar archivos gigantes).
- Persistencia del dominio consentimientos en **MongoDB** (Mongoose), colección `consent_records`. NO usar Postgres/TypeORM para esto.
- Binarios SIEMPRE en GridFS vía `FilesService`; en el documento solo va la referencia `gridfs:<id>`.
- Tests: Jest, specs co-locados `*.spec.ts`, se corren desde `backend/` con `npx jest <ruta>` (config en `backend/jest.config.js`). Estilo del repo: instanciar el servicio directamente con mocks (ver `src/submissions/records.service.spec.ts`), sin `Test.createTestingModule` salvo para el controller.
- Todos los comandos se ejecutan desde `backend/`.
- Enum de tipos verbatim: `vacunacion | vacunacion_b | tuberculina | venopuncion | vih | infectologia`.
- Permiso de acceso verbatim: `Permission.CONSIENTIFY_ACCESS` (`'consientify_access'`).
- Commits: mensajes en español, prefijo convencional (`feat:`, `test:`). Terminar cada commit con la línea de atribución del proyecto.

---

### Task 1: Enum de tipos + Schema Mongoose `ConsentRecord`

**Files:**
- Create: `backend/src/consents/consent-record.schema.ts`
- Test: `backend/src/consents/consent-record.schema.spec.ts`

**Interfaces:**
- Produces:
  - `enum TipoConsentimiento { VACUNACION='vacunacion', VACUNACION_B='vacunacion_b', TUBERCULINA='tuberculina', VENOPUNCION='venopuncion', VIH='vih', INFECTOLOGIA='infectologia' }`
  - `enum EstadoConsentimiento { BORRADOR='borrador', FIRMADO='firmado', ANULADO='anulado' }`
  - `class ConsentRecord` (Mongoose) con `_id: string`, `tipo: TipoConsentimiento`, `entidad: 'SAI'|'SOUL'|null`, `tipoDoc/numDoc/nombres/apellidos: string`, `ciudad/profesional: string|null`, `estado: EstadoConsentimiento`, `respuestas: Record<string,unknown>`, `firmaPaciente/firmaResponsable/foto: string|null`, `hashVerificacion: string`, `createdById: number|null`, `createdAt: Date`, `updatedAt: Date|null`, `pdfGeneradoEn: Date|null`
  - `ConsentRecordSchema` (SchemaFactory) con `toJSON` que expone `id` y borra `__v`
  - `type ConsentRecordDocument = ConsentRecord & Document`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/consents/consent-record.schema.spec.ts
import { model } from 'mongoose';
import {
  ConsentRecord,
  ConsentRecordSchema,
  TipoConsentimiento,
  EstadoConsentimiento,
} from './consent-record.schema';

describe('ConsentRecordSchema', () => {
  const Model = model(ConsentRecord.name, ConsentRecordSchema);

  it('genera _id string por defecto y aplica defaults', () => {
    const doc = new Model({
      tipo: TipoConsentimiento.VIH,
      tipoDoc: 'CC',
      numDoc: '900064854',
      nombres: 'Juan',
      apellidos: 'Perez',
      respuestas: {},
      hashVerificacion: 'abc',
    });
    expect(typeof doc._id).toBe('string');
    expect(doc._id.length).toBeGreaterThan(10);
    expect(doc.estado).toBe(EstadoConsentimiento.BORRADOR);
    expect(doc.entidad ?? null).toBeNull();
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it('toJSON expone id y elimina __v', () => {
    const doc = new Model({
      tipo: TipoConsentimiento.VIH, tipoDoc: 'CC', numDoc: '1', nombres: 'A',
      apellidos: 'B', respuestas: {}, hashVerificacion: 'h',
    });
    const json = doc.toJSON() as Record<string, unknown>;
    expect(json.id).toBe(doc._id);
    expect(json.__v).toBeUndefined();
  });

  it('rechaza tipo fuera del enum', () => {
    const doc = new Model({
      tipo: 'otro', tipoDoc: 'CC', numDoc: '1', nombres: 'A', apellidos: 'B',
      respuestas: {}, hashVerificacion: 'h',
    });
    const err = doc.validateSync();
    expect(err?.errors?.tipo).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/consents/consent-record.schema.spec.ts`
Expected: FAIL — `Cannot find module './consent-record.schema'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/consents/consent-record.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum TipoConsentimiento {
  VACUNACION = 'vacunacion',
  VACUNACION_B = 'vacunacion_b',
  TUBERCULINA = 'tuberculina',
  VENOPUNCION = 'venopuncion',
  VIH = 'vih',
  INFECTOLOGIA = 'infectologia',
}

export enum EstadoConsentimiento {
  BORRADOR = 'borrador',
  FIRMADO = 'firmado',
  ANULADO = 'anulado',
}

export type ConsentRecordDocument = ConsentRecord & Document;

@Schema({ collection: 'consent_records' })
export class ConsentRecord {
  @Prop({ type: String, default: () => crypto.randomUUID() })
  _id: string;

  @Prop({ required: true, index: true, enum: Object.values(TipoConsentimiento) })
  tipo: TipoConsentimiento;

  @Prop({ type: String, enum: ['SAI', 'SOUL'], default: null })
  entidad: 'SAI' | 'SOUL' | null;

  @Prop({ required: true }) tipoDoc: string;
  @Prop({ required: true, index: true }) numDoc: string;
  @Prop({ required: true }) nombres: string;
  @Prop({ required: true }) apellidos: string;

  @Prop({ type: String, default: null }) ciudad: string | null;
  @Prop({ type: String, default: null }) profesional: string | null;

  @Prop({
    required: true,
    enum: Object.values(EstadoConsentimiento),
    default: EstadoConsentimiento.BORRADOR,
  })
  estado: EstadoConsentimiento;

  @Prop({ type: Object, required: true, default: {} })
  respuestas: Record<string, unknown>;

  @Prop({ type: String, default: null }) firmaPaciente: string | null;
  @Prop({ type: String, default: null }) firmaResponsable: string | null;
  @Prop({ type: String, default: null }) foto: string | null;

  @Prop({ required: true }) hashVerificacion: string;

  @Prop({ type: Number, default: null }) createdById: number | null;
  @Prop({ default: () => new Date(), index: true }) createdAt: Date;
  @Prop({ type: Date, default: null }) updatedAt: Date | null;
  @Prop({ type: Date, default: null }) pdfGeneradoEn: Date | null;
}

export const ConsentRecordSchema = SchemaFactory.createForClass(ConsentRecord);

ConsentRecordSchema.index({ tipo: 1, createdAt: -1 });

ConsentRecordSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc: unknown, ret: Record<string, unknown>) => {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/consents/consent-record.schema.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/consents/consent-record.schema.ts src/consents/consent-record.schema.spec.ts
git commit -m "feat(consents): schema Mongoose consent_records + enums de tipo/estado"
```

---

### Task 2: DTOs de creación y edición

**Files:**
- Create: `backend/src/consents/dto/create-consent.dto.ts`
- Create: `backend/src/consents/dto/update-consent.dto.ts`
- Test: `backend/src/consents/dto/create-consent.dto.spec.ts`

**Interfaces:**
- Consumes: `TipoConsentimiento` (Task 1).
- Produces:
  - `class CreateConsentDto { tipo; entidad?; tipoDoc; numDoc; nombres; apellidos; ciudad?; profesional?; respuestas; firmaPaciente; firmaResponsable?; foto? }`
  - `class UpdateConsentDto` (PartialType de CreateConsentDto)

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/consents/dto/create-consent.dto.spec.ts
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateConsentDto } from './create-consent.dto';

function build(overrides: Partial<CreateConsentDto> = {}) {
  return plainToInstance(CreateConsentDto, {
    tipo: 'vih',
    tipoDoc: 'CC',
    numDoc: '900064854',
    nombres: 'Juan',
    apellidos: 'Perez',
    respuestas: { ciudad_confirmada: 'Bogota' },
    firmaPaciente: 'data:image/png;base64,AAAA',
    ...overrides,
  });
}

describe('CreateConsentDto', () => {
  it('acepta un payload válido', () => {
    expect(validateSync(build())).toHaveLength(0);
  });

  it('rechaza tipo fuera del enum', () => {
    const errs = validateSync(build({ tipo: 'otro' as never }));
    expect(errs.some((e) => e.property === 'tipo')).toBe(true);
  });

  it('exige firmaPaciente', () => {
    const errs = validateSync(build({ firmaPaciente: '' }));
    expect(errs.some((e) => e.property === 'firmaPaciente')).toBe(true);
  });

  it('exige respuestas como objeto', () => {
    const errs = validateSync(build({ respuestas: 'x' as never }));
    expect(errs.some((e) => e.property === 'respuestas')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/consents/dto/create-consent.dto.spec.ts`
Expected: FAIL — `Cannot find module './create-consent.dto'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/consents/dto/create-consent.dto.ts
import {
  IsEnum, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MaxLength,
} from 'class-validator';
import { TipoConsentimiento } from '../consent-record.schema';

export class CreateConsentDto {
  @IsEnum(TipoConsentimiento)
  tipo: TipoConsentimiento;

  @IsOptional()
  @IsIn(['SAI', 'SOUL'])
  entidad?: 'SAI' | 'SOUL';

  @IsString() @IsNotEmpty() @MaxLength(20)
  tipoDoc: string;

  @IsString() @IsNotEmpty() @MaxLength(40)
  numDoc: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  nombres: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  apellidos: string;

  @IsOptional() @IsString() @MaxLength(120)
  ciudad?: string;

  @IsOptional() @IsString() @MaxLength(160)
  profesional?: string;

  @IsObject()
  respuestas: Record<string, unknown>;

  // data URL (nueva firma) o referencia gridfs:<id> (edición). Obligatoria.
  @IsString() @IsNotEmpty()
  firmaPaciente: string;

  @IsOptional() @IsString()
  firmaResponsable?: string;

  @IsOptional() @IsString()
  foto?: string;
}
```

```typescript
// backend/src/consents/dto/update-consent.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateConsentDto } from './create-consent.dto';

export class UpdateConsentDto extends PartialType(CreateConsentDto) {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/consents/dto/create-consent.dto.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/consents/dto/
git commit -m "feat(consents): DTOs de creación y edición con class-validator"
```

---

### Task 3: Utilidad de hash de verificación

**Files:**
- Create: `backend/src/consents/consent-hash.ts`
- Test: `backend/src/consents/consent-hash.spec.ts`

**Interfaces:**
- Produces:
  - `canonicalize(value: unknown): string` — JSON con llaves ordenadas recursivamente.
  - `consentHash(payload: Record<string, unknown>): string` — sha-256 hex de `canonicalize(payload)`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/consents/consent-hash.spec.ts
import { canonicalize, consentHash } from './consent-hash';

describe('consent-hash', () => {
  it('canonicalize ordena llaves de forma estable', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
  });

  it('hash es idéntico sin importar el orden de llaves', () => {
    const a = consentHash({ tipo: 'vih', numDoc: '1', respuestas: { x: 1, y: 2 } });
    const b = consentHash({ respuestas: { y: 2, x: 1 }, numDoc: '1', tipo: 'vih' });
    expect(a).toBe(b);
  });

  it('hash cambia si cambia un valor', () => {
    const a = consentHash({ numDoc: '1' });
    const b = consentHash({ numDoc: '2' });
    expect(a).not.toBe(b);
  });

  it('devuelve sha-256 hex de 64 chars', () => {
    expect(consentHash({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/consents/consent-hash.spec.ts`
Expected: FAIL — `Cannot find module './consent-hash'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/consents/consent-hash.ts
import { createHash } from 'crypto';

/** Serializa a JSON con llaves ordenadas recursivamente (estable). */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`).join(',')}}`;
}

/** sha-256 hex del contenido canónico del consentimiento. */
export function consentHash(payload: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/consents/consent-hash.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/consents/consent-hash.ts src/consents/consent-hash.spec.ts
git commit -m "feat(consents): hash de verificación canónico (sha-256)"
```

---

### Task 4: Servicio de validación por tipo

**Files:**
- Create: `backend/src/consents/consent-validation.service.ts`
- Test: `backend/src/consents/consent-validation.service.spec.ts`

**Interfaces:**
- Consumes: `TipoConsentimiento` (Task 1), `CreateConsentDto` (Task 2).
- Produces: `class ConsentValidationService { validate(dto: Pick<CreateConsentDto,'tipo'|'entidad'>): void }` — lanza `BadRequestException` si las invariantes de tipo/entidad no se cumplen. En Plan 1 valida invariantes de tipo (la validación profunda por definición llega en Plan 2, reemplazando/extendiendo este servicio).

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/consents/consent-validation.service.spec.ts
import { BadRequestException } from '@nestjs/common';
import { ConsentValidationService } from './consent-validation.service';
import { TipoConsentimiento } from './consent-record.schema';

describe('ConsentValidationService', () => {
  const svc = new ConsentValidationService();

  it('acepta vacunacion con entidad', () => {
    expect(() =>
      svc.validate({ tipo: TipoConsentimiento.VACUNACION, entidad: 'SOUL' }),
    ).not.toThrow();
  });

  it('exige entidad en vacunacion', () => {
    expect(() => svc.validate({ tipo: TipoConsentimiento.VACUNACION })).toThrow(
      BadRequestException,
    );
  });

  it('rechaza entidad en un tipo que no es vacunacion', () => {
    expect(() =>
      svc.validate({ tipo: TipoConsentimiento.VIH, entidad: 'SAI' }),
    ).toThrow(BadRequestException);
  });

  it('acepta vih sin entidad', () => {
    expect(() => svc.validate({ tipo: TipoConsentimiento.VIH })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/consents/consent-validation.service.spec.ts`
Expected: FAIL — `Cannot find module './consent-validation.service'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/consents/consent-validation.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { TipoConsentimiento } from './consent-record.schema';

@Injectable()
export class ConsentValidationService {
  /** Invariantes de tipo/entidad. Solo Vacunación usa entidad (SAI/SOUL). */
  validate(input: { tipo: TipoConsentimiento; entidad?: 'SAI' | 'SOUL' }): void {
    const esVacunacion =
      input.tipo === TipoConsentimiento.VACUNACION ||
      input.tipo === TipoConsentimiento.VACUNACION_B;

    if (esVacunacion && !input.entidad) {
      throw new BadRequestException(
        'El consentimiento de vacunación requiere entidad (SAI o SOUL).',
      );
    }
    if (!esVacunacion && input.entidad) {
      throw new BadRequestException(
        `El tipo ${input.tipo} no admite entidad.`,
      );
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/consents/consent-validation.service.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/consents/consent-validation.service.ts src/consents/consent-validation.service.spec.ts
git commit -m "feat(consents): servicio de validación de invariantes por tipo"
```

---

### Task 5: `ConsentsService.create`

**Files:**
- Create: `backend/src/consents/consents.service.ts`
- Test: `backend/src/consents/consents.service.spec.ts`

**Interfaces:**
- Consumes: `ConsentRecord` model, `FilesService.uploadDataUrl(dataUrl, meta) => Promise<string|null>`, `UsersService.findByIds`, `ConsentValidationService.validate`, `consentHash`, `CreateConsentDto`.
- Produces: `class ConsentsService { constructor(model, filesService, usersService, validation); create(dto: CreateConsentDto, userId: number|null): Promise<ConsentRecord> }`. `create` valida, sube binarios data-URL a GridFS (deja refs `gridfs:<id>`; conserva refs existentes), calcula `hashVerificacion`, fija `estado='firmado'`, persiste con `model.create(...)`.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/consents/consents.service.spec.ts
import { ConsentsService } from './consents.service';
import { TipoConsentimiento, EstadoConsentimiento } from './consent-record.schema';

function makeDeps() {
  const model: any = { create: jest.fn((d) => Promise.resolve({ ...d })) };
  const filesService: any = { uploadDataUrl: jest.fn() };
  const usersService: any = { findByIds: jest.fn() };
  const validation: any = { validate: jest.fn() };
  const service = new ConsentsService(model, filesService, usersService, validation);
  return { service, model, filesService, usersService, validation };
}

const baseDto = {
  tipo: TipoConsentimiento.VIH,
  tipoDoc: 'CC', numDoc: '900064854', nombres: 'Juan', apellidos: 'Perez',
  respuestas: { ciudad_confirmada: 'Bogota' },
  firmaPaciente: 'data:image/png;base64,AAAA',
} as any;

describe('ConsentsService.create', () => {
  it('valida, sube la firma a GridFS y persiste con hash + estado firmado', async () => {
    const { service, model, filesService, validation } = makeDeps();
    filesService.uploadDataUrl.mockResolvedValue('64ab');

    const saved = await service.create(baseDto, 7);

    expect(validation.validate).toHaveBeenCalledWith({ tipo: 'vih', entidad: undefined });
    expect(filesService.uploadDataUrl).toHaveBeenCalledTimes(1);
    const doc = model.create.mock.calls[0][0];
    expect(doc.firmaPaciente).toBe('gridfs:64ab');
    expect(doc.estado).toBe(EstadoConsentimiento.FIRMADO);
    expect(doc.createdById).toBe(7);
    expect(doc.hashVerificacion).toMatch(/^[0-9a-f]{64}$/);
    expect(saved).toBeDefined();
  });

  it('conserva una referencia gridfs existente sin re-subir', async () => {
    const { service, model, filesService } = makeDeps();
    await service.create({ ...baseDto, firmaPaciente: 'gridfs:existente' }, 7);
    expect(filesService.uploadDataUrl).not.toHaveBeenCalled();
    expect(model.create.mock.calls[0][0].firmaPaciente).toBe('gridfs:existente');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/consents/consents.service.spec.ts`
Expected: FAIL — `Cannot find module './consents.service'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/consents/consents.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FilesService } from '../files/files.service';
import { UsersService } from '../users/users.service';
import { ConsentValidationService } from './consent-validation.service';
import { consentHash } from './consent-hash';
import { CreateConsentDto } from './dto/create-consent.dto';
import {
  ConsentRecord,
  ConsentRecordDocument,
  EstadoConsentimiento,
} from './consent-record.schema';

@Injectable()
export class ConsentsService {
  constructor(
    @InjectModel(ConsentRecord.name)
    private readonly model: Model<ConsentRecordDocument>,
    private readonly filesService: FilesService,
    private readonly usersService: UsersService,
    private readonly validation: ConsentValidationService,
  ) {}

  /** Sube un data URL a GridFS y devuelve 'gridfs:<id>'. Si ya es una
   *  referencia gridfs o está vacío, lo devuelve tal cual. */
  private async persistBinario(
    value: string | undefined | null,
    tipo: string,
    widgetId: string,
    kind: 'signature' | 'photo',
    userId: number | null,
  ): Promise<string | null> {
    if (!value) return null;
    if (value.startsWith('gridfs:')) return value;
    const id = await this.filesService.uploadDataUrl(value, {
      kind,
      formId: `consent:${tipo}`,
      widgetId,
      submittedById: userId,
    });
    return id ? `gridfs:${id}` : null;
  }

  async create(dto: CreateConsentDto, userId: number | null): Promise<ConsentRecord> {
    this.validation.validate({ tipo: dto.tipo, entidad: dto.entidad });

    const firmaPaciente = await this.persistBinario(
      dto.firmaPaciente, dto.tipo, 'firma_paciente', 'signature', userId,
    );
    const firmaResponsable = await this.persistBinario(
      dto.firmaResponsable, dto.tipo, 'firma_responsable', 'signature', userId,
    );
    const foto = await this.persistBinario(
      dto.foto, dto.tipo, 'foto', 'photo', userId,
    );

    const base = {
      tipo: dto.tipo,
      entidad: dto.entidad ?? null,
      tipoDoc: dto.tipoDoc,
      numDoc: dto.numDoc,
      nombres: dto.nombres,
      apellidos: dto.apellidos,
      ciudad: dto.ciudad ?? null,
      profesional: dto.profesional ?? null,
      respuestas: dto.respuestas,
      firmaPaciente,
      firmaResponsable,
      foto,
    };

    const hashVerificacion = consentHash(base as unknown as Record<string, unknown>);

    return this.model.create({
      ...base,
      estado: EstadoConsentimiento.FIRMADO,
      hashVerificacion,
      createdById: userId,
      createdAt: new Date(),
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/consents/consents.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/consents/consents.service.ts src/consents/consents.service.spec.ts
git commit -m "feat(consents): ConsentsService.create (GridFS + hash + persistencia)"
```

---

### Task 6: `ConsentsService` listar / obtener / editar / anular

**Files:**
- Modify: `backend/src/consents/consents.service.ts`
- Modify: `backend/src/consents/consents.service.spec.ts`

**Interfaces:**
- Consumes: lo de Task 5, `UpdateConsentDto` (Task 2), `consentHash`.
- Produces (métodos nuevos en `ConsentsService`):
  - `list(opts: { page: number; limit: number; tipo?: string; search?: string; from?: string; to?: string }): Promise<{ data: any[]; total: number; page: number; limit: number }>`
  - `findOne(id: string): Promise<ConsentRecord>` — lanza `NotFoundException`
  - `update(id: string, dto: UpdateConsentDto, userId: number|null): Promise<ConsentRecord>` — re-sube binarios data-URL, recalcula `hashVerificacion`, fija `updatedAt`
  - `anular(id: string): Promise<ConsentRecord>` — `estado='anulado'`

- [ ] **Step 1: Write the failing test (añadir al spec existente)**

```typescript
// añadir en backend/src/consents/consents.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { EstadoConsentimiento } from './consent-record.schema';

describe('ConsentsService.list/findOne/update/anular', () => {
  it('list arma query por tipo y rango, y enriquece nombres de creador', async () => {
    const { service, model, usersService } = makeDeps();
    const chain = {
      sort: () => chain, skip: () => chain, limit: () => chain,
      lean: () => Promise.resolve([
        { _id: 'r1', tipo: 'vih', numDoc: '1', createdById: 7, createdAt: new Date() },
      ]),
    };
    model.find = jest.fn().mockReturnValue(chain);
    model.countDocuments = jest.fn().mockResolvedValue(1);
    usersService.findByIds.mockResolvedValue({ 7: { name: 'Sara', email: 's@x' } });

    const page = await service.list({ page: 1, limit: 50, tipo: 'vih', from: '2026-01-01' });

    expect(model.find).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'vih', createdAt: expect.any(Object) }),
    );
    expect(page.total).toBe(1);
    expect(page.data[0].creadoPor).toBe('Sara');
  });

  it('findOne lanza NotFound si no existe', async () => {
    const { service, model } = makeDeps();
    model.findById = jest.fn().mockReturnValue({ lean: () => Promise.resolve(null) });
    await expect(service.findOne('x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update recalcula hash y fija updatedAt', async () => {
    const { service, model, filesService } = makeDeps();
    model.findById = jest.fn().mockReturnValue({
      lean: () => Promise.resolve({
        _id: 'r1', tipo: 'vih', entidad: null, tipoDoc: 'CC', numDoc: '1',
        nombres: 'A', apellidos: 'B', ciudad: null, profesional: null,
        respuestas: { x: 1 }, firmaPaciente: 'gridfs:a', firmaResponsable: null, foto: null,
      }),
    });
    model.findByIdAndUpdate = jest.fn().mockReturnValue({
      lean: () => Promise.resolve({ _id: 'r1', respuestas: { x: 2 } }),
    });

    await service.update('r1', { respuestas: { x: 2 } } as any, 7);

    const patch = model.findByIdAndUpdate.mock.calls[0][1];
    expect(patch.hashVerificacion).toMatch(/^[0-9a-f]{64}$/);
    expect(patch.updatedAt).toBeInstanceOf(Date);
    expect(filesService.uploadDataUrl).not.toHaveBeenCalled();
  });

  it('anular fija estado anulado', async () => {
    const { service, model } = makeDeps();
    model.findByIdAndUpdate = jest.fn().mockReturnValue({
      lean: () => Promise.resolve({ _id: 'r1', estado: 'anulado' }),
    });
    const r: any = await service.anular('r1');
    expect(model.findByIdAndUpdate).toHaveBeenCalledWith(
      'r1', { estado: EstadoConsentimiento.ANULADO }, { new: true },
    );
    expect(r.estado).toBe('anulado');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/consents/consents.service.spec.ts`
Expected: FAIL — `service.list is not a function` (y análogos).

- [ ] **Step 3: Write minimal implementation (añadir métodos a ConsentsService)**

```typescript
// añadir imports arriba
import { UpdateConsentDto } from './dto/update-consent.dto';

// añadir dentro de la clase ConsentsService:

  async list(opts: {
    page: number; limit: number; tipo?: string; search?: string; from?: string; to?: string;
  }): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const query: Record<string, unknown> = {};
    if (opts.tipo) query.tipo = opts.tipo;
    if (opts.from || opts.to) {
      const range: Record<string, Date> = {};
      if (opts.from) range.$gte = new Date(opts.from);
      if (opts.to) range.$lte = new Date(opts.to + 'T23:59:59.999Z');
      query.createdAt = range;
    }
    if (opts.search && opts.search.trim()) {
      const rx = new RegExp(opts.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ numDoc: rx }, { nombres: rx }, { apellidos: rx }];
    }

    const skip = (opts.page - 1) * opts.limit;
    const [docs, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip(skip).limit(opts.limit).lean(),
      this.model.countDocuments(query),
    ]);

    const ids = [...new Set(docs.map((d: any) => d.createdById).filter((x): x is number => x != null))];
    const users = ids.length ? await this.usersService.findByIds(ids) : {};

    const data = docs.map((d: any) => ({
      ...d,
      id: d._id,
      creadoPor: d.createdById != null ? users[d.createdById]?.name ?? null : null,
    }));

    return { data, total, page: opts.page, limit: opts.limit };
  }

  async findOne(id: string): Promise<ConsentRecord> {
    const doc = await this.model.findById(id).lean();
    if (!doc) throw new NotFoundException(`Consentimiento ${id} no encontrado`);
    return doc as unknown as ConsentRecord;
  }

  async update(id: string, dto: UpdateConsentDto, userId: number | null): Promise<ConsentRecord> {
    const current = (await this.model.findById(id).lean()) as any;
    if (!current) throw new NotFoundException(`Consentimiento ${id} no encontrado`);
    if (dto.tipo || dto.entidad) {
      this.validation.validate({
        tipo: dto.tipo ?? current.tipo,
        entidad: (dto.entidad ?? current.entidad) ?? undefined,
      });
    }

    const tipo = dto.tipo ?? current.tipo;
    const firmaPaciente = dto.firmaPaciente
      ? await this.persistBinario(dto.firmaPaciente, tipo, 'firma_paciente', 'signature', userId)
      : current.firmaPaciente;
    const firmaResponsable = dto.firmaResponsable
      ? await this.persistBinario(dto.firmaResponsable, tipo, 'firma_responsable', 'signature', userId)
      : current.firmaResponsable;
    const foto = dto.foto
      ? await this.persistBinario(dto.foto, tipo, 'foto', 'photo', userId)
      : current.foto;

    const base = {
      tipo,
      entidad: (dto.entidad ?? current.entidad) ?? null,
      tipoDoc: dto.tipoDoc ?? current.tipoDoc,
      numDoc: dto.numDoc ?? current.numDoc,
      nombres: dto.nombres ?? current.nombres,
      apellidos: dto.apellidos ?? current.apellidos,
      ciudad: (dto.ciudad ?? current.ciudad) ?? null,
      profesional: (dto.profesional ?? current.profesional) ?? null,
      respuestas: dto.respuestas ?? current.respuestas,
      firmaPaciente, firmaResponsable, foto,
    };
    const hashVerificacion = consentHash(base as unknown as Record<string, unknown>);

    const updated = await this.model
      .findByIdAndUpdate(id, { ...base, hashVerificacion, updatedAt: new Date() }, { new: true })
      .lean();
    return updated as unknown as ConsentRecord;
  }

  async anular(id: string): Promise<ConsentRecord> {
    const updated = await this.model
      .findByIdAndUpdate(id, { estado: EstadoConsentimiento.ANULADO }, { new: true })
      .lean();
    if (!updated) throw new NotFoundException(`Consentimiento ${id} no encontrado`);
    return updated as unknown as ConsentRecord;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/consents/consents.service.spec.ts`
Expected: PASS (todos, incluidos los de Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/consents/consents.service.ts src/consents/consents.service.spec.ts
git commit -m "feat(consents): listar/obtener/editar/anular en ConsentsService"
```

---

### Task 7: Verificación + Controller + wiring del módulo

**Files:**
- Modify: `backend/src/consents/consents.service.ts` (método `verificar`)
- Create: `backend/src/consents/consents.controller.ts`
- Create: `backend/src/consents/consents.controller.spec.ts`
- Modify: `backend/src/consents/consents.module.ts`
- Modify: `backend/src/consents/consents.service.spec.ts` (test de `verificar`)

**Interfaces:**
- Consumes: `ConsentsService` (Tasks 5-6), `consentHash`, guards de `../auth`, `Permission.CONSIENTIFY_ACCESS`.
- Produces:
  - `ConsentsService.verificar(id): Promise<{ valido: boolean; hash: string }>` — recalcula el hash del contenido y lo compara con `hashVerificacion` guardado.
  - `ConsentsController` con: `POST /consents`, `GET /consents`, `GET /consents/:id`, `PATCH /consents/:id`, `POST /consents/:id/anular`, `GET /consents/:id/verificar`.
  - `ConsentsModule` registrando el modelo, el controller y los providers.

- [ ] **Step 1: Write the failing tests**

```typescript
// añadir en backend/src/consents/consents.service.spec.ts
describe('ConsentsService.verificar', () => {
  it('devuelve valido=true cuando el hash coincide', async () => {
    const { service, model } = makeDeps();
    const base = {
      tipo: 'vih', entidad: null, tipoDoc: 'CC', numDoc: '1', nombres: 'A', apellidos: 'B',
      ciudad: null, profesional: null, respuestas: { x: 1 },
      firmaPaciente: 'gridfs:a', firmaResponsable: null, foto: null,
    };
    const { consentHash } = require('./consent-hash');
    model.findById = jest.fn().mockReturnValue({
      lean: () => Promise.resolve({ _id: 'r1', ...base, hashVerificacion: consentHash(base) }),
    });
    const res = await service.verificar('r1');
    expect(res.valido).toBe(true);
  });

  it('devuelve valido=false si el contenido fue alterado', async () => {
    const { service, model } = makeDeps();
    model.findById = jest.fn().mockReturnValue({
      lean: () => Promise.resolve({
        _id: 'r1', tipo: 'vih', entidad: null, tipoDoc: 'CC', numDoc: '1',
        nombres: 'A', apellidos: 'B', ciudad: null, profesional: null,
        respuestas: { x: 999 }, firmaPaciente: 'gridfs:a', firmaResponsable: null, foto: null,
        hashVerificacion: 'no-coincide',
      }),
    });
    const res = await service.verificar('r1');
    expect(res.valido).toBe(false);
  });
});
```

```typescript
// backend/src/consents/consents.controller.spec.ts
import { ConsentsController } from './consents.controller';

describe('ConsentsController', () => {
  const service: any = {
    create: jest.fn(), list: jest.fn(), findOne: jest.fn(),
    update: jest.fn(), anular: jest.fn(), verificar: jest.fn(),
  };
  const ctrl = new ConsentsController(service);

  beforeEach(() => jest.clearAllMocks());

  it('POST /consents pasa el userId del request', async () => {
    service.create.mockResolvedValue({ id: 'r1' });
    await ctrl.create({ tipo: 'vih' } as any, { user: { id: 9 } } as any);
    expect(service.create).toHaveBeenCalledWith({ tipo: 'vih' }, 9);
  });

  it('GET /consents parsea page/limit y filtros', async () => {
    service.list.mockResolvedValue({ data: [], total: 0, page: 2, limit: 10 });
    await ctrl.list('2', '10', 'vih', 'juan', '2026-01-01', '2026-02-01');
    expect(service.list).toHaveBeenCalledWith({
      page: 2, limit: 10, tipo: 'vih', search: 'juan', from: '2026-01-01', to: '2026-02-01',
    });
  });

  it('GET /consents/:id/verificar delega en el servicio', async () => {
    service.verificar.mockResolvedValue({ valido: true, hash: 'h' });
    const r = await ctrl.verificar('r1');
    expect(r.valido).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/consents/consents.controller.spec.ts src/consents/consents.service.spec.ts`
Expected: FAIL — `Cannot find module './consents.controller'` y `service.verificar is not a function`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// añadir dentro de ConsentsService (consents.service.ts)
  async verificar(id: string): Promise<{ valido: boolean; hash: string }> {
    const d = (await this.model.findById(id).lean()) as any;
    if (!d) throw new NotFoundException(`Consentimiento ${id} no encontrado`);
    const base = {
      tipo: d.tipo, entidad: d.entidad ?? null, tipoDoc: d.tipoDoc, numDoc: d.numDoc,
      nombres: d.nombres, apellidos: d.apellidos, ciudad: d.ciudad ?? null,
      profesional: d.profesional ?? null, respuestas: d.respuestas,
      firmaPaciente: d.firmaPaciente ?? null, firmaResponsable: d.firmaResponsable ?? null,
      foto: d.foto ?? null,
    };
    const hash = consentHash(base as unknown as Record<string, unknown>);
    return { valido: hash === d.hashVerificacion, hash };
  }
```

```typescript
// backend/src/consents/consents.controller.ts
import {
  Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';
import { Permission } from '../auth/permissions';
import { ConsentsService } from './consents.service';
import { CreateConsentDto } from './dto/create-consent.dto';
import { UpdateConsentDto } from './dto/update-consent.dto';

interface AuthRequest { user?: { id: number } }

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission(Permission.CONSIENTIFY_ACCESS)
@Controller('consents')
export class ConsentsController {
  constructor(private readonly service: ConsentsService) {}

  @Post()
  create(@Body() dto: CreateConsentDto, @Request() req: AuthRequest) {
    return this.service.create(dto, req.user?.id ?? null);
  }

  @Get()
  list(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('tipo') tipo?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.list({
      page: parseInt(page, 10), limit: parseInt(limit, 10), tipo, search, from, to,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateConsentDto,
    @Request() req: AuthRequest,
  ) {
    return this.service.update(id, dto, req.user?.id ?? null);
  }

  @Post(':id/anular')
  anular(@Param('id') id: string) {
    return this.service.anular(id);
  }

  @Get(':id/verificar')
  verificar(@Param('id') id: string) {
    return this.service.verificar(id);
  }
}
```

```typescript
// backend/src/consents/consents.module.ts  (reemplazar contenido)
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormsModule } from '../forms/forms.module';
import { UsersModule } from '../users/users.module';
import { FilesModule } from '../files/files.module';
import { ConsentsSeeder } from './consents.seeder';
import { ConsentsService } from './consents.service';
import { ConsentValidationService } from './consent-validation.service';
import { ConsentsController } from './consents.controller';
import { ConsentRecord, ConsentRecordSchema } from './consent-record.schema';

@Module({
  imports: [
    FormsModule,
    UsersModule,
    FilesModule,
    MongooseModule.forFeature([
      { name: ConsentRecord.name, schema: ConsentRecordSchema },
    ]),
  ],
  controllers: [ConsentsController],
  providers: [ConsentsSeeder, ConsentsService, ConsentValidationService],
})
export class ConsentsModule {}
```

- [ ] **Step 4: Run tests + build to verify**

Run: `npx jest src/consents/`
Expected: PASS (todos los specs del módulo).
Run: `npm run build`
Expected: compila sin errores de tipos (verifica que `UsersModule`/`FilesModule` exporten sus servicios; si `FilesModule` no exporta `FilesService`, añadir `exports: [FilesService]` en `src/files/files.module.ts` — cambio incluido en este task si el build lo exige).

- [ ] **Step 5: Commit**

```bash
git add src/consents/ src/files/files.module.ts
git commit -m "feat(consents): verificación + API REST + wiring del módulo"
```

---

## Self-Review

**1. Spec coverage:**
- Sección 6 (modelo `consent_records`) → Task 1. ✔
- Sección 7 (API crear/listar/obtener/editar/anular/verificar) → Tasks 5,6,7. ✔ (El endpoint `GET /consents/:id/pdf` que resuelve binarios de GridFS se difiere al **Plan 3** —vista de registros/PDF—, donde se confirma la API de lectura de `FilesService`; el `findOne` de Plan 1 ya devuelve las refs `gridfs:<id>`.)
- Hash de verificación (Sección 6 y 7) → Task 3 + Task 7. ✔
- Validación por definición (Sección 7) → Task 4 (invariantes de tipo en Plan 1; validación profunda por definición en Plan 2). ✔
- Permisos: gate por `CONSIENTIFY_ACCESS` → Task 7. ✔
- Migración de Vacunación (Sección 8) → **Plan 2** (no en Plan 1). ✔
- Motor front / definiciones / vista de registros / navegación (Secciones 5,9,10) → **Planes 2 y 3**. ✔

**2. Placeholder scan:** Sin TBD/TODO; cada step trae test y código reales. ✔

**3. Type consistency:** `TipoConsentimiento`/`EstadoConsentimiento` (Task 1) usados igual en Tasks 2,4,5,6,7. `persistBinario`, `create`, `list`, `findOne`, `update`, `anular`, `verificar` nombrados consistentemente entre service y controller. Refs de binarios siempre `gridfs:<id>`. ✔

## Alcance de Planes siguientes (no incluidos aquí)

- **Plan 2:** motor front (`ConsentDefinition`, `ConsentRenderer`, primitivas, `buildConsentPdf`, `useConsentSubmission` → API), refactor de Vacunación al motor + **migración de datos** de submissions a `consent_records`.
- **Plan 3:** definiciones de los 5 tipos nuevos, endpoint/flujo de PDF (resuelve GridFS), vista de registros unificada, selector de tipo y navegación/UX (estilo Vercel).
