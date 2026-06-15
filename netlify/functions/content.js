const { getCookie, json, verifyToken } = require("./_auth");
const { supabaseError, supabaseFetch } = require("./_supabase");

exports.handler = async (event) => {
  if (event.httpMethod === "GET") {
    try {
      const response = await supabaseFetch("/rest/v1/portfolio_content?id=eq.main&select=content");
      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json();
      if (!rows.length) return json(404, { error: "Content not found" });
      return json(200, rows[0].content);
    } catch (error) {
      return supabaseError(error);
    }
  }

  if (event.httpMethod === "PUT") {
    if (!verifyToken(getCookie(event))) return json(401, { error: "Unauthorized" });
    let content;
    try { content = JSON.parse(event.body || "{}"); }
    catch { return json(400, { error: "Invalid content" }); }
    if (!content.settings || !Array.isArray(content.projects)) return json(400, { error: "Invalid content" });

    try {
      const response = await supabaseFetch("/rest/v1/portfolio_content?on_conflict=id", {
        method: "POST",
        headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ id: "main", content, updated_at: new Date().toISOString() })
      });
      if (!response.ok) throw new Error(await response.text());
      return json(200, { saved: true });
    } catch (error) {
      return supabaseError(error);
    }
  }

  return json(405, { error: "Method not allowed" }, { Allow: "GET, PUT" });
};
