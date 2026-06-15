const { json, sessionCookie } = require("./_auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" }, { Allow: "POST" });
  return json(200, { authenticated: false }, { "Set-Cookie": sessionCookie("", 0) });
};
