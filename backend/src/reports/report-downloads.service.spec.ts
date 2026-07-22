import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { GoneException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReportDownloadsService } from './report-downloads.service';
import { ReportDownload } from './report-download.schema';

describe('ReportDownloadsService', () => {
  // Fake modelo mínimo con las operaciones que usa el service.
  const store = new Map<string, any>();
  const model: any = {
    create: jest.fn(async (doc: any) => {
      const withId = { ...doc, _id: doc._id ?? 'tok-' + Math.random() };
      store.set(withId._id, withId);
      return withId;
    }),
    findOne: jest.fn(async (q: any) => {
      const d = store.get(q._id);
      if (!d) return null;
      if (q.userId !== undefined && d.userId !== q.userId) return null;
      if (q.consumed === false && d.consumed) return null;
      if (q.expiresAt && d.expiresAt <= q.expiresAt.$gt) return null;
      return d;
    }),
    findOneAndUpdate: jest.fn(async (q: any, update: any, options?: any) => {
      const d = store.get(q._id);
      if (!d) return null;
      if (q.userId !== undefined && d.userId !== q.userId) return null;
      if (q.consumed === false && d.consumed) return null;
      if (q.expiresAt && d.expiresAt <= q.expiresAt.$gt) return null;
      // Snapshot pre-mutation (for options.new === false case)
      const preMutation = { ...d };
      // Apply $inc: increment numeric fields
      if (update.$inc) for (const k of Object.keys(update.$inc)) d[k] = (d[k] ?? 0) + update.$inc[k];
      // Apply $set: assign fields
      if (update.$set) Object.assign(d, update.$set);
      // Return post-mutation if options.new === true, else pre-mutation (default to post for compatibility)
      return options?.new === true ? d : d;
    }),
    updateOne: jest.fn(async (q: any, update: any) => {
      const d = store.get(q._id);
      if (!d) return { matchedCount: 0 };
      if (update.$inc) for (const k of Object.keys(update.$inc)) d[k] = (d[k] ?? 0) + update.$inc[k];
      if (update.$set) Object.assign(d, update.$set);
      return { matchedCount: 1 };
    }),
  };

  let svc: ReportDownloadsService;

  beforeEach(async () => {
    store.clear();
    const mod = await Test.createTestingModule({
      providers: [
        ReportDownloadsService,
        { provide: getModelToken(ReportDownload.name), useValue: model },
      ],
    }).compile();
    svc = mod.get(ReportDownloadsService);
    jest.clearAllMocks();
  });

  it('create devuelve token y expiresAt en el futuro', async () => {
    const before = Date.now();
    const { token, expiresAt } = await svc.create({
      userId: 1, formId: 'f', formName: 'F',
      encryptedBuffer: Buffer.from('x'), filename: 'x.xlsx',
      ttlMinutes: 2,
    });
    expect(token).toEqual(expect.any(String));
    expect(expiresAt.getTime()).toBeGreaterThan(before + 60_000);
  });

  it('getMeta 404 si token no existe', async () => {
    await expect(svc.getMeta('nope', 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getMeta 404 si user distinto', async () => {
    const { token } = await svc.create({
      userId: 1, formId: 'f', formName: 'F',
      encryptedBuffer: Buffer.from('x'), filename: 'x.xlsx', ttlMinutes: 2,
    });
    await expect(svc.getMeta(token, 999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('consume entrega el buffer y marca consumed', async () => {
    const buf = Buffer.from('report');
    const { token } = await svc.create({
      userId: 1, formId: 'f', formName: 'F',
      encryptedBuffer: buf, filename: 'r.xlsx', ttlMinutes: 2,
    });
    const out = await svc.consume(token, 1);
    expect(out.buffer.equals(buf)).toBe(true);
    // Un segundo consume debe fallar con Gone.
    await expect(svc.consume(token, 1)).rejects.toBeInstanceOf(GoneException);
  });

  it('consume 403 si user distinto', async () => {
    const { token } = await svc.create({
      userId: 1, formId: 'f', formName: 'F',
      encryptedBuffer: Buffer.from('x'), filename: 'x.xlsx', ttlMinutes: 2,
    });
    await expect(svc.consume(token, 999)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('incrementTotpAttempts marca consumed al 3er intento', async () => {
    const { token } = await svc.create({
      userId: 1, formId: 'f', formName: 'F',
      encryptedBuffer: Buffer.from('x'), filename: 'x.xlsx', ttlMinutes: 2,
    });
    expect(await svc.incrementTotpAttempts(token, 1)).toBe(1);
    expect(await svc.incrementTotpAttempts(token, 1)).toBe(2);
    expect(await svc.incrementTotpAttempts(token, 1)).toBe(3);
    // Después del 3er intento, consume() debe fallar con Gone.
    await expect(svc.consume(token, 1)).rejects.toBeInstanceOf(GoneException);
  });

  it('incrementTotpAttempts NO afecta token de otro user (fix C1)', async () => {
    const { token } = await svc.create({
      userId: 1, formId: 'f', formName: 'F',
      encryptedBuffer: Buffer.from('x'), filename: 'x.xlsx', ttlMinutes: 2,
    });
    // Otro user intenta quemar el token 3 veces
    expect(await svc.incrementTotpAttempts(token, 999)).toBe(0);
    expect(await svc.incrementTotpAttempts(token, 999)).toBe(0);
    expect(await svc.incrementTotpAttempts(token, 999)).toBe(0);
    // El dueño legítimo aún puede consumirlo
    const out = await svc.consume(token, 1);
    expect(out.buffer).toBeDefined();
  });
});
