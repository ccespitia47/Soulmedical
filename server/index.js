import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";
import puppeteer from "puppeteer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middlewares ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: "50mb" }));
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST"],
}));

// ── Convertir HTML a PDF optimizado ──────────────────────────────────────────
async function htmlToPdfBase64(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();

    // Detectar orientación desde el HTML (@page size)
    const isLandscape = html.includes("A4 landscape");

    // Viewport exacto al tamaño A4 en píxeles a 96dpi
    const viewportW = isLandscape ? 1123 : 794;
    const viewportH = isLandscape ? 794 : 1123;
    await page.setViewport({ width: viewportW, height: viewportH, deviceScaleFactor: 1 });

    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: isLandscape,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "6mm", bottom: "6mm", left: "6mm", right: "6mm" },
    });

    const base64 = Buffer.from(pdfBuffer).toString("base64");
    const sizeMB = pdfBuffer.length / (1024 * 1024);
    console.log(`📄 PDF generado: ${sizeMB.toFixed(2)} MB`);

    if (sizeMB > 5) {
      console.warn(`⚠️ PDF supera 5MB, reintentando comprimido...`);
      await browser.close();
      return await htmlToPdfBase64Compressed(html);
    }

    return base64;
  } finally {
    await browser.close();
  }
}

// ── Fallback con mayor compresión si supera 5MB ───────────────────────────────
async function htmlToPdfBase64Compressed(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const normalizedHtml = injectPdfStyles(html, true); // modo comprimido
    await page.setContent(normalizedHtml, { waitUntil: "networkidle0" });
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: false, // sin fondos para ahorrar peso
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
      scale: 0.75,
    });

    const sizeMB = pdfBuffer.length / (1024 * 1024);
    console.log(`📄 PDF comprimido: ${sizeMB.toFixed(2)} MB`);

    return Buffer.from(pdfBuffer).toString("base64");
  } finally {
    await browser.close();
  }
}

// ── Inyectar estilos normalizadores para ajuste A4 ───────────────────────────
function injectPdfStyles(html, compressed = false) {
  const baseStyles = `
    <style>
      /* Reset y normalización para PDF */
      *, *::before, *::after {
        box-sizing: border-box !important;
      }
      html, body {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: ${compressed ? "0" : "4px"} !important;
        background: ${compressed ? "#fff" : "inherit"} !important;
        font-size: ${compressed ? "11px" : "12px"} !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      /* Contenedores principales se ajustan al ancho */
      .container, .wrapper, main, article, section, div[class*="container"] {
        max-width: 100% !important;
        width: 100% !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }
      /* Imágenes no se desbordan */
      img {
        max-width: 100% !important;
        height: auto !important;
        ${compressed ? "filter: grayscale(20%);" : ""}
      }
      /* Tablas responsivas */
      table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: fixed !important;
        word-break: break-word !important;
        font-size: inherit !important;
      }
      td, th {
        word-break: break-word !important;
        overflow-wrap: break-word !important;
      }
      /* Evitar saltos de página dentro de elementos */
      .field, .card, [class*="field"], [class*="card"] {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      /* Quitar sombras pesadas en modo comprimido */
      ${compressed ? `
        * {
          box-shadow: none !important;
          text-shadow: none !important;
        }
        .container, .card, [class*="container"] {
          border-radius: 0 !important;
        }
      ` : ""}
    </style>
  `;

  // Si el HTML ya tiene <head>, inyectar al final del head
  if (html.includes("</head>")) {
    return html.replace("</head>", `${baseStyles}</head>`);
  }
  // Si no tiene estructura completa, envolver
  if (!html.trim().startsWith("<!DOCTYPE") && !html.trim().startsWith("<html")) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}</head><body>${html}</body></html>`;
  }
  // Insertar al inicio del body
  return html.replace("<body", `<head-injected>${baseStyles}</head-injected><body`).replace("<head-injected>", "").replace("</head-injected>", "");
}

// ── Caché de token ────────────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 120_000) {
    return cachedToken;
  }
  const url = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id:     process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
    scope:         "https://graph.microsoft.com/.default",
    grant_type:    "client_credentials",
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Error obteniendo token: ${err}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// ── Resolver destinatarios ────────────────────────────────────────────────────
async function resolveRecipients(recipients, users, currentUserEmail, formData) {
  const emails = new Set();
  for (const r of recipients) {
    if (r.type === "static" && r.email) {
      emails.add(r.email.trim().toLowerCase());
    } else if (r.type === "group" && r.group) {
      if (r.group === "current_user") {
        const formEmail = findEmailInFormData(formData);
        if (formEmail) emails.add(formEmail.trim().toLowerCase());
        else if (currentUserEmail) emails.add(currentUserEmail.trim().toLowerCase());
      } else {
        const groupUsers = users.filter(u => u.role === r.group && u.active && u.email);
        groupUsers.forEach(u => emails.add(u.email.trim().toLowerCase()));
      }
    }
  }
  return [...emails].map(email => ({ emailAddress: { address: email } }));
}

function findEmailInFormData(formData) {
  if (!formData || typeof formData !== "object") return null;
  for (const [, value] of Object.entries(formData)) {
    if (typeof value === "string" && value.includes("@") && value.includes(".")) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(value.trim())) return value.trim();
    }
  }
  return null;
}

// ── Endpoint: POST /api/send-email ────────────────────────────────────────────
app.post("/api/send-email", async (req, res) => {
  try {
    const {
      subject,
      emailBody,
      senderName,
      replyTo,
      toRecipients    = [],
      ccRecipients    = [],
      bccRecipients   = [],
      users           = [],
      currentUserEmail = null,
      formData        = {},
      pdfTemplate,
      pdfFilename     = "formulario.pdf",
      attachPDF       = false,
    } = req.body;

    let attachments = req.body.attachments ?? [];
    const excelHtml     = req.body.excelHtml     ?? "";
    const excelFilename = req.body.excelFilename ?? "formulario.pdf";

    if (!subject?.trim()) return res.status(400).json({ error: "El asunto es obligatorio" });
    if (!emailBody?.trim()) return res.status(400).json({ error: "El cuerpo del email es obligatorio" });

    const toList  = await resolveRecipients(toRecipients,  users, currentUserEmail, formData);
    const ccList  = await resolveRecipients(ccRecipients,  users, currentUserEmail, formData);
    const bccList = await resolveRecipients(bccRecipients, users, currentUserEmail, formData);

    if (toList.length === 0) return res.status(400).json({ error: "No hay destinatarios válidos en Para (To)" });

    // ── Modo Excel: HTML del frontend → Puppeteer → PDF vectorial ────────────
    if (excelHtml?.trim()) {
      try {
        console.log("📊 Generando PDF desde HTML del Excel con Puppeteer...");
        const pdfBase64 = await htmlToPdfBase64(excelHtml);
        const attachSizeMB = (pdfBase64.length * 0.75) / (1024 * 1024);
        console.log(`📎 PDF Excel: ${attachSizeMB.toFixed(2)} MB`);
        if (attachSizeMB <= 5) {
          attachments = [...attachments, {
            name: excelFilename,
            contentType: "application/pdf",
            contentBytes: pdfBase64,
          }];
          console.log("✅ PDF Excel adjuntado correctamente");
        } else {
          console.warn(`⚠️ PDF Excel muy grande (${attachSizeMB.toFixed(2)} MB), omitiendo`);
        }
      } catch (pdfErr) {
        console.error("⚠️ Error generando PDF Excel:", pdfErr.message);
      }
    }

    // ── Modo HTML: template con placeholders → Puppeteer → PDF ───────────────
    if (attachPDF && pdfTemplate?.trim()) {
      try {
        console.log("📄 Generando PDF...");
        let pdfHtml = pdfTemplate;
        if (formData) {
          for (const [key, value] of Object.entries(formData)) {
            pdfHtml = pdfHtml.replace(new RegExp(`\\$\\{${key}\\}`, "g"), String(value ?? ""));
          }
        }
        const pdfBase64 = await htmlToPdfBase64(pdfHtml);

        // ── Verificar tamaño del adjunto final ──────────────────────────────
        const attachSizeMB = (pdfBase64.length * 0.75) / (1024 * 1024); // base64 → bytes reales
        console.log(`📎 Adjunto PDF: ${attachSizeMB.toFixed(2)} MB`);

        if (attachSizeMB <= 5) {
          attachments = [...attachments, {
            name: pdfFilename,
            contentType: "application/pdf",
            contentBytes: pdfBase64,
          }];
          console.log("✅ PDF generado y adjuntado correctamente");
        } else {
          console.warn(`⚠️ PDF demasiado grande (${attachSizeMB.toFixed(2)} MB), omitiendo adjunto`);
        }
      } catch (pdfErr) {
        console.error("⚠️ Error generando PDF:", pdfErr.message);
      }
    }

    // ── Verificar tamaño total de adjuntos ────────────────────────────────────
    const totalAttachMB = attachments.reduce((acc, att) => {
      return acc + (att.contentBytes ? (att.contentBytes.length * 0.75) / (1024 * 1024) : 0);
    }, 0);
    console.log(`📦 Tamaño total adjuntos: ${totalAttachMB.toFixed(2)} MB`);

    // Si el total supera 5MB, omitir adjuntos pero enviar el email igual
    const finalAttachments = totalAttachMB <= 5 ? attachments : [];
    if (totalAttachMB > 5) {
      console.warn("⚠️ Adjuntos superan 5MB, se enviará el email sin adjuntos");
    }

    const token = await getAccessToken();

    const message = {
      subject,
      body: { contentType: "HTML", content: emailBody },
      toRecipients: toList,
      ccRecipients: ccList,
      bccRecipients: bccList,
    };

    if (senderName?.trim()) {
      message.from = { emailAddress: { name: senderName.trim(), address: process.env.SENDER_EMAIL } };
    }
    if (replyTo?.trim()) {
      message.replyTo = [{ emailAddress: { address: replyTo.trim() } }];
    }
    if (finalAttachments.length > 0) {
      message.attachments = finalAttachments.map(att => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name:         att.name,
        contentType:  att.contentType,
        contentBytes: att.contentBytes,
      }));
    }

    const graphUrl = `https://graph.microsoft.com/v1.0/users/${process.env.SENDER_EMAIL}/sendMail`;
    const graphRes = await fetch(graphUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    if (graphRes.status === 202) {
      console.log(`✅ Email enviado a ${toList.length} destinatario(s): ${subject}`);
      return res.json({
        success: true,
        message: `Email enviado a ${toList.length} destinatario(s)`,
        recipients: toList.length,
        attachmentsIncluded: finalAttachments.length,
        attachmentsSizeMB: totalAttachMB.toFixed(2),
      });
    }

    const errBody = await graphRes.text();
    console.error("❌ Error Graph API:", graphRes.status, errBody);
    return res.status(500).json({ error: `Error al enviar email: ${graphRes.status}`, detail: errBody });

  } catch (err) {
    console.error("❌ Error servidor:", err.message);
    return res.status(500).json({ error: "Error interno del servidor", detail: err.message });
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Iniciar servidor ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 SoulForms API corriendo en http://localhost:${PORT}`);
  console.log(`📧 Remitente: ${process.env.SENDER_EMAIL}`);
});