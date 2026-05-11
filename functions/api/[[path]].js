const SUPABASE_URL = "https://vvyrgcxqlmduaijzznil.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2eXJnY3hxbG1kdWFqaXp6bmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MzA0NDMsImV4cCI6MjA5NDEwNjQ0M30.vliNa1OOEUy_uSabBq-aPxyCrI7e42PnGdPCetfIvWE";

export async function onRequest(context) {
  const path = Array.isArray(context.params.path)
    ? context.params.path.join("/")
    : context.params.path || "";
  const requestUrl = new URL(context.request.url);
  const targetUrl = `${SUPABASE_URL}/rest/v1/${path}${requestUrl.search}`;

  const headers = new Headers(context.request.headers);
  headers.set("apikey", SUPABASE_KEY);
  headers.set("Authorization", `Bearer ${SUPABASE_KEY}`);
  headers.delete("host");

  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body: ["GET", "HEAD"].includes(context.request.method) ? undefined : context.request.body,
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Cache-Control", "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
