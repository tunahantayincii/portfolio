const { json } = require("./_auth");

function config() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase is not configured");
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
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|Invalid URL/i.test(message)) {
    return json(500, { error: "SUPABASE_URL hatalı veya Supabase'e ulaşılamıyor." });
  }
  return json(500, { error: "Supabase veri servisi yanıt vermedi. Netlify Function loglarını kontrol edin." });
}

module.exports = { config, supabaseError, supabaseFetch };
