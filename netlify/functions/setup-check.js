const { getCookie, json, verifyToken } = require("./_auth");
const { supabaseFetch } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" }, { Allow: "GET" });
  if (!verifyToken(getCookie(event))) return json(401, { error: "Önce admin paneline giriş yapın." });

  const checks = {
    adminEnvironment: Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET),
    supabaseUrl: Boolean(process.env.SUPABASE_URL),
    supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    contentTable: false,
    mediaBucket: false
  };

  if (!checks.supabaseUrl || !checks.supabaseServiceRoleKey) {
    return json(200, { checks, next: "Eksik Supabase ortam değişkenlerini Netlify'a ekleyip yeniden deploy edin." });
  }

  try {
    const tableResponse = await supabaseFetch("/rest/v1/portfolio_content?select=id&limit=1");
    checks.contentTable = tableResponse.ok;
    if (!tableResponse.ok) checks.contentTableError = await tableResponse.text();
  } catch (error) {
    checks.contentTableError = String(error.message || error);
  }

  try {
    const bucketResponse = await supabaseFetch("/storage/v1/bucket/portfolio-media");
    checks.mediaBucket = bucketResponse.ok;
    if (!bucketResponse.ok) checks.mediaBucketError = await bucketResponse.text();
  } catch (error) {
    checks.mediaBucketError = String(error.message || error);
  }

  return json(200, {
    checks,
    next: checks.contentTable && checks.mediaBucket
      ? "Kurulum tamam. Görsel yüklemeyi tekrar deneyin."
      : "Supabase SQL Editor içinde supabase-setup.sql dosyasını çalıştırın ve yeniden deneyin."
  });
};
