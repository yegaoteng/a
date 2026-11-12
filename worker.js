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
        
        // 【关键修改】现在必须要有 client_id
        if (!body.code || !body.redirect_uri || !body.client_id) {
          return new Response(JSON.stringify({ error: "Missing code, redirect_uri, or client_id" }), { 
            status: 400, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
          });
        }

        // 【关键修改】从 JSON 映射中动态获取 client_secret
        const secretsMap = JSON.parse(env.CLIENT_SECRETS || "{}");
        const clientSecret = secretsMap[body.client_id];

        if (!clientSecret) {
          return new Response(JSON.stringify({ error: "Unknown Client ID" }), { 
            status: 400, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }
          });
        }

        const params = new URLSearchParams({
          grant_type: "authorization_code",
          code: body.code,
          redirect_uri: body.redirect_uri,
          client_id: body.client_id,
          client_secret: clientSecret, // 使用动态匹配到的密钥
        });

        if (body.code_verifier) {
          params.append("code_verifier", body.code_verifier);
        }

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

        let userInfo = null;
        try {
          const userinfoRes = await fetch(`${env.PRISM_URL}/api/oauth/userinfo`, {
            headers: { "Authorization": `Bearer ${tokens.access_token}` }
          });
          if (userinfoRes.ok) userInfo = await userinfoRes.json();
        } catch (e) {}

        const finalData = { ...tokens, userInfo: userInfo };

        return new Response(JSON.stringify(finalData), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": request.headers.get("Origin") || "*" },
        });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
};
