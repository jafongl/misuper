// Función serverless (Vercel): recibe fotos del recibo, las lee con Claude y devuelve JSON.
// Variables de entorno requeridas: ANTHROPIC_API_KEY, APP_CODE. Opcional: MODEL.
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

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!process.env.ANTHROPIC_API_KEY || !process.env.APP_CODE) return res.status(500).json({ error: "config" });

  const { images, code } = req.body || {};
  if (!same(code || "", process.env.APP_CODE)) return res.status(401).json({ error: "code" });
  if (!Array.isArray(images) || images.length < 1 || images.length > 3) return res.status(400).json({ error: "images" });

  let total = 0;
  const content = [];
  for (const img of images) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(img));
    if (!m) return res.status(400).json({ error: "images" });
    total += m[2].length;
    content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
  }
  if (total > 4000000) return res.status(413).json({ error: "size" });
  content.push({ type: "text", text: PROMPT });

  let r, data;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: process.env.MODEL || "claude-sonnet-5", max_tokens: 4000, messages: [{ role: "user", content }] })
    });
    data = await r.json();
  } catch (e) {
    return res.status(502).json({ error: "upstream", detail: "sin conexión con la API" });
  }
  if (!r.ok) {
    if (r.status === 429 || r.status === 529) return res.status(503).json({ error: "busy" });
    return res.status(502).json({ error: "upstream", detail: (data && data.error && data.error.message) || "" });
  }
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const parsed = extractJson(text);
  if (!parsed) return res.status(502).json({ error: "parse" });
  return res.status(200).json(parsed);
};
