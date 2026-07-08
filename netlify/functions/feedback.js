const { json } = require("./_auth");
const { supabaseError, supabaseFetch } = require("./_supabase");

const LIMITS = {
  name: 80,
  email: 120,
  message: 600,
  projectTitle: 160
};

function clean(value, limit) {
  return String(value || "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function cleanMessage(value) {
  return String(value || "").replace(/<[^>]*>/g, "").trim().slice(0, LIMITS.message);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" }, { Allow: "POST" });

  let payload;
  try { payload = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Geçersiz istek." }); }

  if (payload.website) return json(200, { saved: true });

  const projectId = clean(payload.projectId, 120);
  const projectTitle = clean(payload.projectTitle, LIMITS.projectTitle);
  const name = clean(payload.name, LIMITS.name);
  const email = clean(payload.email, LIMITS.email);
  const message = cleanMessage(payload.message);

  if (!projectId || !name || !message) {
    return json(400, { error: "Ad ve geri bildirim alanı zorunlu." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { error: "E-posta adresi geçerli görünmüyor." });
  }

  try {
    const response = await supabaseFetch("/rest/v1/portfolio_content?id=eq.main&select=content");
    if (!response.ok) throw new Error(await response.text());
    const rows = await response.json();
    if (!rows.length) return json(404, { error: "İçerik bulunamadı." });

    const content = rows[0].content || {};
    const projects = Array.isArray(content.projects) ? content.projects : [];
    const project = projects.find((item) => item.id === projectId);
    if (!project) return json(404, { error: "Proje bulunamadı." });

    const feedback = Array.isArray(content.feedback) ? content.feedback : [];
    feedback.unshift({
      id: `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      projectTitle: projectTitle || project.title || "",
      name,
      email,
      message,
      approved: false,
      createdAt: new Date().toISOString()
    });
    content.feedback = feedback.slice(0, 250);

    const saveResponse = await supabaseFetch("/rest/v1/portfolio_content?on_conflict=id", {
      method: "POST",
      headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: "main", content, updated_at: new Date().toISOString() })
    });
    if (!saveResponse.ok) throw new Error(await saveResponse.text());
    return json(200, { saved: true });
  } catch (error) {
    return supabaseError(error);
  }
};

