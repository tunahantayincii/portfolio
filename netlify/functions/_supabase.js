const { json } = require("./_auth");

function config() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase is not configured");
  return { url, key };
}

async function supabaseFetch(path, options = {}) {
  const { url, key } = config();
  return fetch(`${url}${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...options.headers
    }
  });
}

function supabaseError(error) {
  console.error(error);
  return json(500, { error: "Data service unavailable" });
}

module.exports = { config, supabaseError, supabaseFetch };
