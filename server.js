const express = require("express");
const nodemailer = require("nodemailer");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));

const PORT = Number(process.env.PORT || 3000);

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const CONTACT_TO = process.env.CONTACT_TO || SMTP_USER;
const CONTACT_FROM_NAME = process.env.CONTACT_FROM_NAME || "TAMS Software";

const allowedMotives = new Set([
  "Solicitar demostración de TAMS",
  "Solicitar presupuesto",
  "Servicio integral de captura y procesado",
  "Procesado de datos capturados por colaborador",
  "Implantación de TAMS",
  "Soporte técnico",
  "Otro"
]);

function clean(value, max) {
  return String(value ?? "").trim().replace(/\u0000/g, "").slice(0, max);
}

function escapeHtml(value) {
  return clean(value, 10000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

// Límite sencillo en memoria: máx. 5 intentos por IP cada 15 minutos.
const attempts = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const current = attempts.get(ip);
  if (!current || now - current.start > windowMs) {
    attempts.set(ip, { start: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 5;
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    smtp_configured: Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && CONTACT_TO)
  });
});

app.post("/api/contacto", async (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress || "unknown";

    if (rateLimited(ip)) {
      return res.status(429).json({
        ok: false,
        error: "rate_limited",
        message: "Has realizado varios intentos. Espera unos minutos antes de volver a enviar."
      });
    }

    // Honeypot: los usuarios normales no ven ni rellenan este campo.
    if (clean(req.body.website, 200)) {
      return res.json({ ok: true });
    }

    const nombre = clean(req.body.nombre, 120);
    const empresa = clean(req.body.empresa, 160);
    const email = clean(req.body.email, 254).toLowerCase();
    const telefono = clean(req.body.telefono, 80);
    const interesRaw = clean(req.body.interes, 120);
    const interes = allowedMotives.has(interesRaw) ? interesRaw : "Otro";
    const mensaje = clean(req.body.mensaje, 5000);

    if (!nombre || !email || !mensaje) {
      return res.status(400).json({
        ok: false,
        error: "missing_fields",
        message: "Completa nombre, correo y mensaje."
      });
    }

    if (!validEmail(email)) {
      return res.status(400).json({
        ok: false,
        error: "invalid_email",
        message: "Introduce una dirección de correo válida."
      });
    }

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !CONTACT_TO) {
      console.error("[TAMS contacto] SMTP no configurado");
      return res.status(503).json({
        ok: false,
        error: "smtp_not_configured",
        message: "El formulario no está disponible temporalmente. Puedes escribirnos a soporte@tamssoftware.es."
      });
    }

    const subject = `[TAMS] ${interes} - ${nombre}${empresa ? " · " + empresa : ""}`;

    const text = [
      "Nueva solicitud desde tamssoftware.es",
      "",
      `Nombre: ${nombre}`,
      `Empresa: ${empresa || "-"}`,
      `Correo: ${email}`,
      `Teléfono: ${telefono || "-"}`,
      `Motivo: ${interes}`,
      "",
      "Mensaje:",
      mensaje
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:700px;color:#172b45">
        <h2 style="color:#365f9c">Nueva solicitud desde TAMS</h2>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="padding:8px;border-bottom:1px solid #e7edf4"><strong>Nombre</strong></td><td style="padding:8px;border-bottom:1px solid #e7edf4">${escapeHtml(nombre)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e7edf4"><strong>Empresa</strong></td><td style="padding:8px;border-bottom:1px solid #e7edf4">${escapeHtml(empresa || "-")}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e7edf4"><strong>Correo</strong></td><td style="padding:8px;border-bottom:1px solid #e7edf4">${escapeHtml(email)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e7edf4"><strong>Teléfono</strong></td><td style="padding:8px;border-bottom:1px solid #e7edf4">${escapeHtml(telefono || "-")}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e7edf4"><strong>Motivo</strong></td><td style="padding:8px;border-bottom:1px solid #e7edf4">${escapeHtml(interes)}</td></tr>
        </table>
        <h3 style="margin-top:24px">Mensaje</h3>
        <div style="white-space:pre-wrap;line-height:1.6;background:#f6f9fc;padding:16px;border-radius:10px">${escapeHtml(mensaje)}</div>
      </div>`;

    await transporter.sendMail({
      from: `"${CONTACT_FROM_NAME}" <${SMTP_USER}>`,
      to: CONTACT_TO,
      replyTo: email,
      subject,
      text,
      html
    });

    console.log(`[TAMS contacto] Enviado: ${new Date().toISOString()} · ${interes}`);

    return res.json({
      ok: true,
      message: "Solicitud enviada correctamente."
    });
  } catch (error) {
    console.error("[TAMS contacto] Error SMTP:", error && error.message ? error.message : error);
    return res.status(500).json({
      ok: false,
      error: "send_failed",
      message: "No se ha podido enviar la solicitud. Inténtalo de nuevo o escribe a soporte@tamssoftware.es."
    });
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[TAMS contacto] API activa en 127.0.0.1:${PORT}`);
});
