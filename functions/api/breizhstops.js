export async function onRequest(context) {
  const base = String(context.env.BREIZHSTOPS_API_URL || "").replace(/\/$/, "");
  if (!base) {
    return new Response(JSON.stringify({
      error: "BREIZHSTOPS_API_URL n’est pas configurée dans Cloudflare Pages."
    }), {
      status: 500,
      headers: {"Content-Type":"application/json; charset=utf-8"}
    });
  }

  const incoming = new URL(context.request.url);
  const path = incoming.searchParams.get("path") || "";
  if (!path.startsWith("/api/public/")) {
    return new Response(JSON.stringify({error:"Chemin API non autorisé."}), {
      status:400,
      headers:{"Content-Type":"application/json; charset=utf-8"}
    });
  }

  const target = base + path;
  const init = {
    method: context.request.method,
    headers: {"Content-Type":"application/json"}
  };

  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = await context.request.text();
  }

  try {
    const response = await fetch(target, init);
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({error:"Impossible de joindre BreizhStops.",details:String(error.message || error)}), {
      status:502,
      headers:{"Content-Type":"application/json; charset=utf-8"}
    });
  }
}
