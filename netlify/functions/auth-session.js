const { getCookie, json, verifyToken } = require("./_auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed" }, { Allow: "GET" });
  if (!verifyToken(getCookie(event))) return json(401, { authenticated: false });
  return json(200, { authenticated: true });
};
