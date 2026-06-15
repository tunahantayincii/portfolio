const { createToken, hasRequiredEnvironment, json, safeEqual, sessionCookie } = require("./_auth");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" }, { Allow: "POST" });
  if (!hasRequiredEnvironment()) return json(500, { error: "Authentication is not configured" });

  let credentials;
  try { credentials = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Invalid request" }); }

  const validUsername = safeEqual(credentials.username || "", process.env.ADMIN_USERNAME);
  const validPassword = safeEqual(credentials.password || "", process.env.ADMIN_PASSWORD);
  if (!validUsername || !validPassword) return json(401, { error: "Invalid credentials" });

  return json(200, { authenticated: true }, {
    "Set-Cookie": sessionCookie(createToken(process.env.ADMIN_USERNAME))
  });
};
