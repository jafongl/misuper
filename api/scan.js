// Función serverless (Vercel): recibe fotos del recibo, las lee con Claude y devuelve JSON.
// Proveedor gratis: Google Gemini (GEMINI_API_KEY). Alternativa de pago: Claude (ANTHROPIC_API_KEY).
// Variables de entorno: APP_CODE (obligatoria) + GEMINI_API_KEY o ANTHROPIC_API_KEY.
// Opcionales: PROVIDER ("gemini" | "anthropic"), GEMINI_MODEL, MODEL (Claude).
const crypto = require("crypto");

const CATS = ["Frutas y verduras", "Carnes y pescados", "Lácteos y huevos", "Panadería", "Despensa", "Bebidas", "Snacks y dulces", "Congelados", "Limpieza del hogar", "Cuidado personal", "Mascotas", "Otros"];

const PROMPT = `Eres un lector de recibos de supermercado de Panamá (moneda: dólares/balboas). Las imágenes adjuntas son UN mismo recibo (pueden ser varias partes de un recibo largo). Extrae todos los productos comprados.

Responde SOLO con un JSON, sin texto adicional, con esta forma:
{"tienda":"nombre del comercio","fecha":"YYYY-MM-DD o cadena vacía si no se ve","total":número con el total pagado según el recibo,"items":[{"nombre":"nombre legible del producto (expande abreviaturas cuando sea obvio)","producto":"nombre genérico corto para agrupar, ej. Leche, Arroz, Pollo, Papel higiénico","cantidad":número,"monto":número con el total final de esa línea,"categoria":"una de: ${CATS.join(" | ")}"}]}

Reglas:
- "monto" es el total de la línea (cantidad × precio unitario), no el precio unitario. En productos por peso usa el monto cobrado.
- Si hay un descuento asociado a un producto (20% de descuento, 2x1, etc.), réstalo del monto de ese producto. Si es un descuento general que no se puede asociar, réstalo del ítem más grande.
- Los impuestos van sumados al ítem que los causa: los ítems gravados con ITBMS (7%) llevan monto = (precio − descuento) × 1.07, redondeado a 2 decimales. Los ítems exentos no llevan impuesto. NO agregues una línea aparte de impuestos.
- La suma de todos los montos debe ser igual al "total" del recibo. Si no cuadra por redondeo, ajusta la diferencia en el ítem gravado más grande.
- No incluyas subtotales, formas de pago, cambio, propinas, stickers ni puntos de fidelidad como ítems.
- Si algo no se lee con certeza, da tu mejor estimación; no inventes productos que no aparezcan.
- Usa punto como separador decimal.`;

function same(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function extractJson(t) {
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

function providerName() {
  if (process.env.PROVIDER) return process.env.PROVIDER;
  return process.env.GEMINI_API_KEY ? "gemini" : "anthropic";
}

async function callGemini(images) {
  const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
  const parts = images.map((i) => ({ inline_data: { mime_type: i.mime, data: i.data } }));
  parts.push({ text: PROMPT });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0, responseMimeType: "application/json" } })
  });
  const data = await r.json();
  const text = ((data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || []).map((p) => p.text || "").join("");
  return { ok: r.ok, status: r.status, text, detail: (data && data.error && data.error.message) || "" };
}

async function callAnthropic(images) {
  const content = images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mime, data: i.data } }));
  content.push({ type: "text", text: PROMPT });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: process.env.MODEL || "claude-sonnet-5", max_tokens: 4000, messages: [{ role: "user", content }] })
  });
  const data = await r.json();
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  return { ok: r.ok, status: r.status, text, detail: (data && data.error && data.error.message) || "" };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const provider = providerName();
  const key = provider === "gemini" ? process.env.GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY;
  if (!key || !process.env.APP_CODE) return res.status(500).json({ error: "config" });

  const { images, code } = req.body || {};
  if (!same(code || "", process.env.APP_CODE)) return res.status(401).json({ error: "code" });
  if (!Array.isArray(images) || images.length < 1 || images.length > 3) return res.status(400).json({ error: "images" });

  let total = 0;
  const parsedImages = [];
  for (const img of images) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(img));
    if (!m) return res.status(400).json({ error: "images" });
    total += m[2].length;
    parsedImages.push({ mime: m[1], data: m[2] });
  }
  if (total > 4000000) return res.status(413).json({ error: "size" });

  let out;
  try {
    out = provider === "gemini" ? await callGemini(parsedImages) : await callAnthropic(parsedImages);
  } catch (e) {
    return res.status(502).json({ error: "upstream", detail: "sin conexión con la API" });
  }
  if (!out.ok) {
    if (out.status === 429 || out.status === 529 || out.status === 503) return res.status(503).json({ error: "busy", detail: out.detail });
    return res.status(502).json({ error: "upstream", detail: out.detail });
  }
  const parsed = extractJson(out.text);
  if (!parsed) return res.status(502).json({ error: "parse" });
  return res.status(200).json(parsed);
};
