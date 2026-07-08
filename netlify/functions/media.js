const crypto = require("crypto");
const { getCookie, json, verifyToken } = require("./_auth");
const { config, supabaseError, supabaseFetch } = require("./_supabase");

const MIME_RULES = {
  image: /^image\/(?:jpeg|png|webp)$/,
  pdf: /^application\/pdf$/
};

exports.handler = async (event) => {
  if (!verifyToken(getCookie(event))) return json(401, { error: "Unauthorized" });

  if (event.httpMethod === "GET") return listMedia();
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" }, { Allow: "GET, POST" });

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Yükleme isteği okunamadı. Sayfayı yenileyip tekrar deneyin." });
  }

  const requestedKind = body.kind === "pdf" ? "pdf" : "image";
  let kind = requestedKind;
  const match = String(body.dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return json(400, { error: kind === "pdf" ? "PDF dosyası okunamadı." : "Görsel dosyası okunamadı." });
  }

  const mime = match[1];
  kind = body.kind === "pdf" || mime === "application/pdf" ? "pdf" : "image";
  if (!MIME_RULES[kind].test(mime)) {
    return json(400, { error: kind === "pdf" ? "Seçilen dosya PDF değil." : "Seçilen dosya desteklenen bir görsel değil." });
  }

  const bytes = Buffer.from(match[2], "base64");
  const maxSize = 4 * 1024 * 1024;
  if (bytes.length > maxSize) {
    return json(413, { error: kind === "pdf" ? "PDF çok büyük. En fazla 3 MB PDF yükleyin." : "Görsel çok büyük. Daha küçük bir görsel deneyin." });
  }

  const extension = kind === "pdf" ? "pdf" : mime.split("/")[1].replace("jpeg", "jpg");
  return uploadMedia(bytes, mime, extension, body.prefix || (kind === "pdf" ? "pages" : "project"));
};

async function listMedia() {
  try {
    const { url } = config();
    const items = [];
    for (const prefix of ["hero", "covers", "pages"]) {
      const response = await supabaseFetch("/storage/v1/object/list/portfolio-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, limit: 100, sortBy: { column: "created_at", order: "desc" } })
      });
      if (!response.ok) throw new Error(await response.text());
      const files = await response.json();
      files.filter((file) => file.name && !file.id?.endsWith("/")).forEach((file) => items.push({
        name: file.name,
        prefix,
        url: `${url}/storage/v1/object/public/portfolio-media/${prefix}/${file.name}`
      }));
    }
    return json(200, { items });
  } catch (error) {
    return supabaseError(error);
  }
}

async function uploadMedia(bytes, contentType, extension, rawPrefix) {
  const prefix = String(rawPrefix || "project").replace(/[^a-z0-9-]/gi, "-").slice(0, 40);
  const filename = `${prefix}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extension}`;

  try {
    const response = await supabaseFetch(`/storage/v1/object/portfolio-media/${filename}`, {
      method: "POST",
      headers: { "Content-Type": contentType, "x-upsert": "false" },
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
}
