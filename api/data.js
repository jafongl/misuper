// Almacena las compras en Upstash Redis (plan gratis vía Vercel Storage) para sincronizar entre dispositivos.
// Variables (las crea Vercel al conectar la base): UPSTASH_REDIS_REST_URL/TOKEN o KV_REST_API_URL/TOKEN.
const crypto = require("crypto");
const KEY = "misuper:purchases";

function same(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function storeCfg() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(cfg, cmd) {
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + cfg.token, "content-type": "application/json" },
    body: JSON.stringify(cmd)
  });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || "redis");
  return j.result;
}

function clean(p) {
  if (!p || typeof p !== "object") return null;
  const id = String(p.id || "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(p.date)) || !Array.isArray(p.items) || p.items.length > 300) return null;
  return {
    id,
    store: String(p.store || "").slice(0, 120),
    date: p.date,
    payment: String(p.payment || "").slice(0, 40),
    source: String(p.source || "manual").slice(0, 10),
    items: p.items.map((i) => ({
      name: String((i && i.name) || "").slice(0, 200),
      generic: String((i && i.generic) || "").slice(0, 120),
      unit: String((i && i.unit) || "").slice(0, 40),
      qty: Number(i && i.qty) || 1,
      amount: Number(i && i.amount) || 0,
      category: String((i && i.category) || "Otros").slice(0, 40)
    }))
  };
}

function money(n) {
  n = Number(n) || 0;
  return "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true })
  });
  return r.ok;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!process.env.APP_CODE) return res.status(500).json({ error: "config" });
  const { op, code } = req.body || {};
  if (!same(code || "", process.env.APP_CODE)) return res.status(401).json({ error: "code" });

  if (op === "notify") {
    const b = req.body || {};
    const store = String(b.store || "Sin tienda").slice(0, 120);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? b.date : "";
    const payment = String(b.payment || "").slice(0, 40);
    const count = Math.max(0, Number(b.count) || 0);
    const total = money(b.total);
    const kind = b.isNew ? "Nueva compra" : "Compra actualizada";
    const lines = [`🛒 ${kind}`, `${store}${date ? " · " + date : ""}`, `${count} ${count === 1 ? "ítem" : "ítems"} · Total: ${total}`];
    if (payment) lines.push(payment);
    const id = String(b.id || "");
    const host = req.headers && req.headers.host;
    if (/^[A-Za-z0-9_-]{1,64}$/.test(id) && host) lines.push(`Ver detalle: https://${host}/#p=${id}`);
    try {
      const sent = await sendTelegram(lines.join("\n"));
      return res.status(200).json({ sent });
    } catch (e) {
      return res.status(200).json({ sent: false });
    }
  }

  const cfg = storeCfg();
  if (!cfg) return res.status(501).json({ error: "nostore" });

  try {
    if (op === "list") {
      const r = await redis(cfg, ["HGETALL", KEY]);
      let vals = [];
      if (Array.isArray(r)) { for (let i = 0; i + 1 < r.length; i += 2) vals.push(r[i + 1]); }
      else if (r && typeof r === "object") vals = Object.values(r);
      const purchases = vals.map((v) => { try { return typeof v === "string" ? JSON.parse(v) : v; } catch (e) { return null; } }).filter(Boolean);
      return res.status(200).json({ purchases });
    }
    if (op === "bulk") {
      const list = (Array.isArray(req.body.purchases) ? req.body.purchases : []).slice(0, 100).map(clean).filter(Boolean);
      if (!list.length) return res.status(200).json({ ok: true });
      const cmd = ["HSET", KEY];
      list.forEach((p) => { cmd.push(p.id, JSON.stringify(p)); });
      await redis(cfg, cmd);
      return res.status(200).json({ ok: true });
    }
    if (op === "delete_many") {
      const ids = (Array.isArray(req.body.ids) ? req.body.ids : []).map(String).filter((x) => /^[A-Za-z0-9_-]{1,64}$/.test(x)).slice(0, 200);
      if (ids.length) await redis(cfg, ["HDEL", KEY, ...ids]);
      return res.status(200).json({ ok: true });
    }
    if (op === "wipe") {
      await redis(cfg, ["DEL", KEY]);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "op" });
  } catch (e) {
    return res.status(502).json({ error: "store" });
  }
};
