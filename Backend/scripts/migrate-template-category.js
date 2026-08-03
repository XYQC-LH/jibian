const https = require("https");

const API = "https://api.jibian.art";
const fs = require("fs");
const loginBody = fs.readFileSync(process.env.TEMP + "\\login.json", "utf8");

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(`${API}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let raw = "";
      res.on("data", (c) => raw += c);
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// 旧 category -> 新分类 name
const MAPPING = {
  "变美营业": "💄 变美营业",
  "场景": "🌆 朋友圈大片",
  "风格": "🍓 小红书感",
  "换个头像": "✨ 换个头像",
  "角色": "🪄 角色入戏",
  "角色入戏": "🪄 角色入戏",
  "节日": "📷 今日出片",
  "今日出片": "📷 今日出片",
  "头像": "✨ 换个头像"
};

(async () => {
  const login = await request("POST", "/api/v1/auth/admin/login", JSON.parse(loginBody));
  const token = login.data && login.data.access_token;
  if (!token) { console.log("登录失败:", JSON.stringify(login)); return; }
  console.log("登录成功");

  const tplRes = await request("GET", "/api/v1/admin/templates", null, token);
  const templates = tplRes.data && tplRes.data.data;
  if (!Array.isArray(templates)) { console.log("模板列表失败:", JSON.stringify(tplRes).slice(0, 200)); return; }

  console.log("模板总数:", templates.length);
  let updated = 0;

  for (const t of templates) {
    const target = MAPPING[t.category];
    if (!target || target === t.category) {
      console.log(`跳过: ${t.name} (category=${t.category})`);
      continue;
    }
    const result = await request("PATCH", `/api/v1/admin/templates/${t.id}`, { category: target }, token);
    const ok = result && result.success;
    console.log(`${ok ? "更新" : "失败"}: ${t.name} ${t.category} -> ${target} ${ok ? "" : JSON.stringify(result).slice(0, 120)}`);
    if (ok) updated++;
  }

  console.log(`完成: 更新 ${updated} 个模板`);
})();
