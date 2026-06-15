const { json } = require("./_auth");

function config() {
  const rawUrl = (process.env.SUPABASE_URL || "").trim().replace(/^["']|["']$/g, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!rawUrl || !key) throw new Error("Supabase is not configured");

  let parsed;
  try { parsed = new URL(rawUrl); }
  catch { throw new Error("Invalid SUPABASE_URL"); }

  if (!parsed.hostname.endsWith(".supabase.co")) throw new Error("Invalid SUPABASE_URL");
  const url = `${parsed.protocol}//${parsed.host}`;
  return { url, key };
}

async function supabaseFetch(path, options = {}) {
  const { url, key } = config();
  const authorization = key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {};
  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      ...authorization,
      ...options.headers
    }
  });
}

function supabaseError(error) {
  console.error(error);
  const message = String(error.message || error);
  if (message.includes("Supabase is not configured")) {
    return json(500, { error: "Supabase ortam değişkenleri eksik." });
  }
  if (/portfolio_content|relation.*does not exist|PGRST205/i.test(message)) {
    return json(500, { error: "Supabase portfolio_content tablosu bulunamadı. supabase-setup.sql dosyasını çalıştırın." });
  }
  if (/invalid.*key|invalid.*jwt|unauthorized|jwt/i.test(message)) {
    return json(500, { error: "Supabase service_role anahtarı hatalı veya geçersiz." });
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|Invalid URL|Invalid SUPABASE_URL/i.test(message)) {
    return json(500, { error: "SUPABASE_URL hatalı veya Supabase'e ulaşılamıyor." });
  }
  return json(500, { error: "Supabase veri servisi yanıt vermedi. Netlify Function loglarını kontrol edin." });
}

module.exports = { config, supabaseError, supabaseFetch };
