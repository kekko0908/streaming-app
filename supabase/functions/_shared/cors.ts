const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function configuredOrigins() {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function configuredOriginSuffixes() {
  return (Deno.env.get("ALLOWED_ORIGIN_SUFFIXES") ?? "")
    .split(",")
    .map((suffix) => suffix.trim().toLowerCase())
    .filter((suffix) => suffix.startsWith("-") && suffix.endsWith(".vercel.app"));
}

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  let hostname = "";
  try { hostname = new URL(origin).hostname.toLowerCase(); } catch { hostname = ""; }
  const allowed = LOCAL_ORIGIN.test(origin)
    || configuredOrigins().includes(origin)
    || configuredOriginSuffixes().some((suffix) => hostname.endsWith(suffix));
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
