const crypto = require("crypto");
const { getCookie, json, verifyToken } = require("./_auth");
const { config, supabaseError, supabaseFetch } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" }, { Allow: "POST" });
  if (!verifyToken(getCookie(event))) return json(401, { error: "Unauthorized" });

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Invalid request" }); }

  const match = String(body.dataUrl || "").match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) return json(400, { error: "Invalid image" });
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 4 * 1024 * 1024) return json(413, { error: "Görsel çok büyük. Daha küçük bir görsel deneyin." });

  const extension = match[1].split("/")[1].replace("jpeg", "jpg");
  const prefix = String(body.prefix || "project").replace(/[^a-z0-9-]/gi, "-").slice(0, 40);
  const filename = `${prefix}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extension}`;

  try {
    const response = await supabaseFetch(`/storage/v1/object/portfolio-media/${filename}`, {
      method: "POST",
      headers: { "Content-Type": match[1], "x-upsert": "false" },
      body: bytes
    });
    if (!response.ok) throw new Error(await response.text());
    const { url } = config();
    return json(200, { url: `${url}/storage/v1/object/public/portfolio-media/${filename}` });
  } catch (error) {
    const message = String(error.message || error);
    if (message.includes("Supabase is not configured")) {
      return json(500, { error: "Supabase ortam değişkenleri eksik." });
    }
    if (/bucket not found/i.test(message)) {
      return json(500, { error: "Supabase'de portfolio-media bucket'ı bulunamadı." });
    }
    if (/invalid|jwt|api key|unauthorized/i.test(message)) {
      return json(500, { error: "Supabase service_role anahtarı geçersiz." });
    }
    return supabaseError(error);
  }
};
