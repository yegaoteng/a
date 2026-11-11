export default {
  async fetch(request, env) {
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
          client_secret: env.CLIENT_SECRET,
        });

        if (body.code_verifier) {
          params.append("code_verifier", body.code_verifier);
        }

        // 1. 换取 Token
        const tokenRes = await fetch(`${env.PRISM_URL}/api/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });

        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          return new Response(errText, {
            status: tokenRes.status,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": request.headers.get("Origin") || "*" },
          });
        }

        const tokens = await tokenRes.json();

        // 2. 【新增步骤】Worker 替前端去拿 UserInfo
        let userInfo = null;
        try {
          const userinfoRes = await fetch(`${env.PRISM_URL}/api/oauth/userinfo`, {
            headers: { "Authorization": `Bearer ${tokens.access_token}` }
          });
          if (userinfoRes.ok) {
            userInfo = await userinfoRes.json();
          }
        } catch (e) {
          console.error("获取用户信息失败", e);
        }

        // 3. 把 Token 和 UserInfo 合并返回给前端
        const finalData = {
          ...tokens,
          userInfo: userInfo
        };

        return new Response(JSON.stringify(finalData), {
          status: 200,
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
