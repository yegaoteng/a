export default {
  async fetch(request, env) {
    // 1. 处理 CORS 预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const url = new URL(request.url);
    
    // 2. 处理换取 Token 的请求
    if (request.method === "POST" && url.pathname === "/api/token") {
      try {
        const body = await request.json();
        
        if (!body.code || !body.redirect_uri) {
          return new Response(JSON.stringify({ error: "Missing code or redirect_uri" }), { 
            status: 400,
            headers: { "Access-Control-Allow-Origin": request.headers.get("Origin") || "*", "Content-Type": "application/json" }
          });
        }

        const params = new URLSearchParams({
          grant_type: "authorization_code",
          code: body.code,
          redirect_uri: body.redirect_uri,
          client_id: env.CLIENT_ID,
          client_secret: env.CLIENT_SECRET, // 机密客户端必须带 Secret
        });

        // 【关键修复】如果前端传了 PKCE 验证码，一起带上
        if (body.code_verifier) {
          params.append("code_verifier", body.code_verifier);
        }

        // 请求 Prism 换取 Token
        const res = await fetch(`${env.PRISM_URL}/api/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });

        const resData = await res.text();

        return new Response(resData, {
          status: res.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Access-Control-Allow-Origin": request.headers.get("Origin") || "*", "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
