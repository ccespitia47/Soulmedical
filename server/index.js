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
  origin: (origin, callback) => {
    // Permitir localhost y cualquier IP de red local (192.168.x.x, 10.x.x.x, 172.x.x.x)
    const allowed = !origin ||
      origin.includes("localhost") ||
      origin.includes("127.0.0.1") ||
      /^http:\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(origin);
    if (allowed) callback(null, true);
    else callback(new Error(`CORS bloqueado para: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Convertir HTML a PDF ──────────────────────────────────────────────────────
async function htmlToPdfBase64(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
    });
    return Buffer.from(pdfBuffer).toString("base64");
  } finally {
    await browser.close();
  }
}

// ── Caché de token ────────────────────────────────────────────────────────────
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  // Reusar token si aún es válido (con 2 min de margen)
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

// ── Resolver destinatarios (estáticos + grupos) ───────────────────────────────
async function resolveRecipients(recipients, users, currentUserEmail, formData) {
  const emails = new Set();

  for (const r of recipients) {
    if (r.type === "static" && r.email) {
      emails.add(r.email.trim().toLowerCase());
    } else if (r.type === "group" && r.group) {
      if (r.group === "current_user") {
        // Buscar el valor del campo email en los datos del formulario
        // formData tiene keys como "email", "correo", "correoelectronico", etc.
        const formEmail = findEmailInFormData(formData);
        if (formEmail) {
          emails.add(formEmail.trim().toLowerCase());
        } else if (currentUserEmail) {
          // Fallback: usar el correo del usuario logueado
          emails.add(currentUserEmail.trim().toLowerCase());
        }
      } else if (r.group === "me") {
        // Usuario logueado en la plataforma (sin depender de campos del formulario)
        if (currentUserEmail) {
          emails.add(currentUserEmail.trim().toLowerCase());
        }
      } else {
        const groupUsers = users.filter(
          (u) => u.role === r.group && u.active && u.email
        );
        groupUsers.forEach((u) => emails.add(u.email.trim().toLowerCase()));
      }
    }
  }

  return [...emails].map((email) => ({ emailAddress: { address: email } }));
}

function findEmailInFormData(formData) {
  if (!formData || typeof formData !== "object") return null;
  
  // Buscar cualquier valor que parezca un email válido
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === "string" && value.includes("@") && value.includes(".")) {
      // Verificar que sea un email válido básico
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(value.trim())) {
        return value.trim();
      }
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
      excelHtml       = null,
      excelFilename   = "formulario.pdf",
    } = req.body;

    let attachments = req.body.attachments ?? [];

    // Validaciones básicas
    if (!subject?.trim()) {
      return res.status(400).json({ error: "El asunto es obligatorio" });
    }
    if (!emailBody?.trim()) {
      return res.status(400).json({ error: "El cuerpo del email es obligatorio" });
    }

    // ── DEBUG TEMPORAL ───────────────────────────────────────────────────────
    console.log("\n========== /api/send-email DEBUG ==========");
    console.log("toRecipients:", JSON.stringify(toRecipients, null, 2));
    console.log("currentUserEmail:", currentUserEmail);
    console.log("formData keys:", Object.keys(formData || {}));
    console.log("users count:", Array.isArray(users) ? users.length : "no es array");
    console.log("============================================\n");

    // Resolver destinatarios
    const toList  = await resolveRecipients(toRecipients,  users, currentUserEmail, formData);
    const ccList  = await resolveRecipients(ccRecipients,  users, currentUserEmail, formData);
    const bccList = await resolveRecipients(bccRecipients, users, currentUserEmail, formData);

    console.log("toList resuelto:", JSON.stringify(toList));
    console.log("============================================\n");

    if (toList.length === 0) {
      return res.status(400).json({ error: "No hay destinatarios válidos en el campo Para (To)" });
    }

    // ── Generar PDF desde HTML del Excel ─────────────────────────────────────
    if (excelHtml?.trim()) {
      try {
        console.log("📊 Generando PDF desde Excel HTML...");
        const pdfBase64 = await htmlToPdfBase64(excelHtml);
        attachments = [
          ...attachments,
          {
            name: excelFilename,
            contentType: "application/pdf",
            contentBytes: pdfBase64,
          },
        ];
        console.log("✅ PDF del Excel generado correctamente");
      } catch (excelErr) {
        console.error("⚠️ Error generando PDF del Excel:", excelErr.message);
      }
    }

    // ── Generar PDF desde template HTML si está configurado ──────────────────
    if (attachPDF && pdfTemplate?.trim()) {
      try {
        console.log("📄 Generando PDF...");
        // Reemplazar placeholders en el PDF template con los datos del formulario
        let pdfHtml = pdfTemplate;
        if (formData) {
          for (const [key, value] of Object.entries(formData)) {
            pdfHtml = pdfHtml.replace(
              new RegExp(`\\$\\{${key}\\}`, "g"),
              String(value ?? "")
            );
          }
        }
        const pdfBase64 = await htmlToPdfBase64(pdfHtml);
        attachments = [
          ...attachments,
          {
            name: pdfFilename,
            contentType: "application/pdf",
            contentBytes: pdfBase64,
          },
        ];
        console.log("✅ PDF generado correctamente");
      } catch (pdfErr) {
        console.error("⚠️ Error generando PDF:", pdfErr.message);
        // Continuar sin PDF si falla
      }
    }

    // Obtener token
    const token = await getAccessToken();

    // Construir mensaje
    const message = {
      subject,
      body: {
        contentType: "HTML",
        content: emailBody,
      },
      toRecipients:  toList,
      ccRecipients:  ccList,
      bccRecipients: bccList,
    };

    // Nombre del remitente
    if (senderName?.trim()) {
      message.from = {
        emailAddress: {
          name:    senderName.trim(),
          address: process.env.SENDER_EMAIL,
        },
      };
    }

    // Reply-To
    if (replyTo?.trim()) {
      message.replyTo = [{
        emailAddress: { address: replyTo.trim() },
      }];
    }

    // Adjuntos (PDF/Excel en base64)
    if (attachments.length > 0) {
      message.attachments = attachments.map((att) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name:         att.name,
        contentType:  att.contentType,
        contentBytes: att.contentBytes, // ya en base64
      }));
    }

    // Enviar via Graph API
    const graphUrl = `https://graph.microsoft.com/v1.0/users/${process.env.SENDER_EMAIL}/sendMail`;

    const graphRes = await fetch(graphUrl, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, saveToSentItems: true }),
    });

    if (graphRes.status === 202) {
      console.log(`✅ Email enviado a ${toList.length} destinatario(s): ${subject}`);
      return res.json({
        success: true,
        message: `Email enviado a ${toList.length} destinatario(s)`,
        recipients: toList.length,
      });
    }

    const errBody = await graphRes.text();
    console.error("❌ Error Graph API:", graphRes.status, errBody);
    return res.status(500).json({
      error: `Error al enviar email: ${graphRes.status}`,
      detail: errBody,
    });

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
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SoulForms API corriendo en http://localhost:${PORT}`);
  console.log(`📧 Remitente configurado: ${process.env.SENDER_EMAIL}`);
});