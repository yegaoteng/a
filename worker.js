export default {
  async fetch(request, env) {
    // 1. 处理浏览器的 CORS 预检请求（非常重要，否则前端 POST 会报错）
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
        
        // 动态接收前端传来的 code 和 redirect_uri
        if (!body.code || !body.redirect_uri) {
          return new Response(JSON.stringify({ error: "Missing code or redirect_uri" }), { status: 400 });
        }

        // 请求 Prism 的 Token 端点
        const res = await fetch(`${env.PRISM_URL}/api/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code: body.code,
            redirect_uri: body.redirect_uri, // 前端传过来的当前项目回调地址
            client_id: env.CLIENT_ID,
            client_secret: env.CLIENT_SECRET,
          }),
        });

        // 将 Prism 的结果原样返回给前端，并附带 CORS 头
        return new Response(await res.text(), {
          status: res.status,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": request.headers.get("Origin") || "*",
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Access-Control-Allow-Origin": request.headers.get("Origin") || "*" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
