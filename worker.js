const SUPABASE_URL = "https://vvyrgcxqlmduaijzznil.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ2eXJnY3hxbG1kdWFqaXp6bmlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MzA0NDMsImV4cCI6MjA5NDEwNjQ0M30.vliNa1OOEUy_uSabBq-aPxyCrI7e42PnGdPCetfIvWE";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const supabasePath = url.pathname.replace(/^\/api\//, "");
      const targetUrl = `${SUPABASE_URL}/rest/v1/${supabasePath}${url.search}`;
      const headers = new Headers(request.headers);

      headers.set("apikey", SUPABASE_KEY);
      headers.set("Authorization", `Bearer ${SUPABASE_KEY}`);
      headers.delete("host");

      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      });

      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Cache-Control", "no-store");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
