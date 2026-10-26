// Diagnóstico end-to-end: reproduce EXACTAMENTE lo que hace submitPublic
// al generar el PDF. Descarga el excelBase64 + mappings del form + la
// última submission, arma los values, corre fillXlsx, convierte a PDF y
// lo guarda en scripts/out.pdf para inspeccionar.
//
// Uso: node scripts/diagnose-pdf-generation.mjs <formId>
// Ej.:  node scripts/diagnose-pdf-generation.mjs 846173ae-d548-4219-ac54-fd8fd6051342

import 'dotenv/config';
import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';

const execFileP = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SOFFICE = process.env.SOFFICE_PATH || 'C:\\Program Files\\LibreOffice\\program\\soffice.exe';
const FORM_ID = process.argv[2] || '846173ae-d548-4219-ac54-fd8fd6051342';

await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/soulformsdb');
const db = mongoose.connection.db;

const form = await db.collection('forms').findOne({ _id: FORM_ID });
if (!form) throw new Error(`Form ${FORM_ID} no existe`);

const excelBase64 = form.emailTemplate?.excelBase64;
const mappings = form.emailTemplate?.excelMappings ?? [];
console.log(`Form: "${form.name}"`);
console.log(`Mappings: ${mappings.length}`);
console.log(`Widgets: ${(form.schema?.widgets ?? []).length}`);

const sub = await db.collection('form_submissions').findOne(
  { formId: FORM_ID },
  { sort: { submittedAt: -1 } },
);
if (!sub) throw new Error(`No hay submissions del form`);
console.log(`\nÚltima submission: ${sub._id}`);
console.log(`  submittedAt: ${sub.submittedAt}`);

// Construir values usando normalizeKey igual que hace forms.service.ts
const normalizeKey = (label) => label.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/gi, '');
const widgets = form.schema?.widgets ?? [];
const values = {};
for (const [wid, val] of Object.entries(sub.data ?? {})) {
  const s = val == null ? '' : String(val);
  values[wid] = s;
  const w = widgets.find(x => x.id === wid);
  if (w?.label) {
    const norm = normalizeKey(w.label);
    if (norm) values[norm] = s;
  }
}

console.log(`\nValues por mapping:`);
for (const m of mappings) {
  const key = m.placeholder.replace(/^\$\{/, '').replace(/\}$/, '');
  const val = values[key];
  console.log(`  ${m.coord}  ${m.placeholder}  →  ${val ? val.substring(0, 60) : '(SIN VALOR — no matchea key "' + key + '")'}`);
}

// Cargar el Excel y detectar merges
const buffer = Buffer.from(
  excelBase64.includes(',') ? excelBase64.split(',')[1] : excelBase64,
  'base64',
);
const wb = new ExcelJS.Workbook();
await wb.xlsx.load(buffer);
const ws = wb.worksheets[0];

console.log(`\nMerges del Excel (${Object.keys(ws._merges ?? {}).length} rangos):`);
for (const [key, range] of Object.entries(ws._merges ?? {})) {
  console.log(`  ${key}  top=${range.top} bottom=${range.bottom} left=${range.left} right=${range.right}`);
}

// Para cada mapping, ver si está en un merge
console.log(`\nMappings vs merges:`);
for (const m of mappings) {
  const cell = ws.getCell(m.coord);
  const row = Number(cell.row);
  const col = Number(cell.col);
  let mergedInfo = 'NO mergeada';
  for (const range of Object.values(ws._merges ?? {})) {
    if (row >= range.top && row <= range.bottom && col >= range.left && col <= range.right) {
      mergedInfo = `mergeada en ${range.top},${range.left}→${range.bottom},${range.right}`;
      break;
    }
  }
  console.log(`  ${m.coord} (row=${row} col=${col}): ${mergedInfo}`);
}

// Aplicar los cambios de fillXlsx sobre el wb
console.log(`\n=== Aplicando fillXlsx en memoria ===`);
for (const m of mappings) {
  const key = m.placeholder.replace(/^\$\{/, '').replace(/\}$/, '');
  const val = values[key];
  if (val === undefined) continue;

  if (typeof val === 'string' && val.startsWith('gridfs:')) {
    console.log(`  ${m.coord}: valor gridfs → NECESITA descarga a buffer (no lo simulo)`);
    continue;
  }
  const cell = ws.getCell(m.coord);
  cell.value = val;
  cell.alignment = {
    ...(cell.alignment ?? {}),
    horizontal: 'left',
    vertical: 'bottom',
    indent: 1,
    wrapText: true,
  };
  console.log(`  ${m.coord}: value="${String(val).substring(0, 40)}" alignment=left/bottom`);
}

// Escribir el xlsx modificado y convertir a PDF
const workDir = path.join(os.tmpdir(), `diagnose-${randomBytes(4).toString('hex')}`);
fs.mkdirSync(workDir, { recursive: true });
const xlsxPath = path.join(workDir, 'filled.xlsx');
const outBuffer = await wb.xlsx.writeBuffer();
fs.writeFileSync(xlsxPath, Buffer.from(outBuffer));
console.log(`\nXLSX generado: ${xlsxPath} (${Math.round(outBuffer.byteLength / 1024)}KB)`);

const userProfileArg = `-env:UserInstallation=file:///${workDir.replace(/\\/g, '/')}/profile`;
await execFileP(SOFFICE, [
  userProfileArg,
  '--headless',
  '--convert-to', 'pdf',
  '--outdir', workDir,
  xlsxPath,
], { timeout: 90000 });

const pdfPath = path.join(workDir, 'filled.pdf');
if (!fs.existsSync(pdfPath)) throw new Error('LibreOffice no generó PDF');
const outPdf = path.join(__dirname, 'out.pdf');
fs.copyFileSync(pdfPath, outPdf);
console.log(`\n✅ PDF final copiado a: ${outPdf} (${Math.round(fs.statSync(outPdf).size / 1024)}KB)`);
console.log(`Abrilo para inspeccionar: start "" "${outPdf}"`);

fs.rmSync(workDir, { recursive: true, force: true });
await mongoose.disconnect();
