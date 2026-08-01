import { createHash, createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

type EnvMap = Record<string, string>;

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const shouldGenerate = args.has("--generate");

const repoRoot = resolve(__dirname, "..", "..");
const backendRoot = resolve(__dirname, "..");

function parseEnvFile(path: string): EnvMap {
  if (!existsSync(path)) return {};
  const out: EnvMap = {};
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const processEnv = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);

const env: EnvMap = {
  ...parseEnvFile(join(repoRoot, ".env")),
  ...parseEnvFile(join(backendRoot, ".env")),
  ...processEnv,
};

function getEnv(key: string): string {
  return String(env[key] || "").trim();
}

function mask(value: string): string {
  if (!value) return "missing";
  if (value.length <= 8) return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function ok(label: string, details = "") {
  console.log(`OK   ${label}${details ? ` - ${details}` : ""}`);
}

function warn(label: string, details = "") {
  console.log(`WARN ${label}${details ? ` - ${details}` : ""}`);
}

function fail(label: string, details = "") {
  console.log(`FAIL ${label}${details ? ` - ${details}` : ""}`);
}

function readStorageConfig() {
  const bucket = getEnv("ASSET_STORAGE_BUCKET") || getEnv("COS_BUCKET_PRIVATE");
  const region = getEnv("ASSET_STORAGE_REGION") || getEnv("COS_REGION");
  const endpoint = (getEnv("ASSET_STORAGE_ENDPOINT") || getEnv("COS_ENDPOINT")).replace(/\/+$/, "");
  const accessKeyId = getEnv("ASSET_STORAGE_ACCESS_KEY_ID") || getEnv("COS_SECRET_ID");
  const secretAccessKey = getEnv("ASSET_STORAGE_SECRET_ACCESS_KEY") || getEnv(getEnv("COS_SECRET_REF")) || getEnv("COS_SECRET_KEY");
  const publicBaseUrl = getEnv("ASSET_PUBLIC_BASE_URL") || getEnv("COS_PUBLIC_BASE_URL");
  const expires = Number(getEnv("ASSET_UPLOAD_URL_EXPIRES_SECONDS") || getEnv("STORAGE_UPLOAD_EXPIRE_SECONDS") || 900);

  if (!bucket || !region || !endpoint || !accessKeyId || !secretAccessKey) return null;
  return { bucket, region, endpoint, accessKeyId, secretAccessKey, publicBaseUrl, expires: Number.isFinite(expires) ? expires : 900 };
}

function encodeStorageKey(storageKey: string) {
  return storageKey.split("/").map(encodeURIComponent).join("/");
}

function formatAmzDate(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

function hexHmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest("hex");
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalQueryString(query: URLSearchParams) {
  return [...query.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

function presignPutUrl(storageKey: string, storage: NonNullable<ReturnType<typeof readStorageConfig>>) {
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${storage.region}/s3/aws4_request`;
  const signedHeaders = "host";
  const { baseUrl, host, objectPath } = resolveObjectAddress(storage, storageKey);
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${storage.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(storage.expires),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  const canonical = canonicalQueryString(query);
  const canonicalRequest = ["PUT", objectPath, canonical, `host:${host}\n`, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, sha256(canonicalRequest)].join("\n");
  const dateKey = hmac(`AWS4${storage.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, storage.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hexHmac(signingKey, stringToSign);
  return `${baseUrl}${objectPath}?${canonical}&X-Amz-Signature=${signature}`;
}

function resolveObjectAddress(storage: NonNullable<ReturnType<typeof readStorageConfig>>, storageKey: string) {
  const endpoint = new URL(storage.endpoint);
  const encodedKey = encodeStorageKey(storageKey);
  if (
    endpoint.hostname === `cos.${storage.region}.myqcloud.com` &&
    (endpoint.pathname === "/" || endpoint.pathname === "")
  ) {
    const host = `${storage.bucket}.cos.${storage.region}.myqcloud.com`;
    return { baseUrl: `${endpoint.protocol}//${host}`, host, objectPath: `/${encodedKey}` };
  }

  return { baseUrl: storage.endpoint, host: endpoint.host, objectPath: `/${storage.bucket}/${encodedKey}` };
}

async function checkWechat() {
  const appId = getEnv("WECHAT_APP_ID");
  const appSecret = getEnv("WECHAT_APP_SECRET");
  if (!appId || !appSecret) {
    warn("Wechat", "WECHAT_APP_ID/WECHAT_APP_SECRET missing");
    return;
  }
  ok("Wechat env", `appId=${mask(appId)}, secret=${mask(appSecret)}`);

  const params = new URLSearchParams({ appid: appId, secret: appSecret, js_code: "smoke-invalid-code", grant_type: "authorization_code" });
  const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params}`);
  const data = await response.json().catch(() => null) as { errcode?: number; errmsg?: string } | null;
  if (!response.ok || !data) {
    fail("Wechat code2Session", `HTTP ${response.status}`);
    return;
  }
  if (data.errcode === 40029 || data.errcode === 40163) {
    ok("Wechat code2Session reachable", `expected invalid test code: ${data.errcode}`);
    return;
  }
  if (data.errcode) {
    warn("Wechat code2Session reachable", `unexpected errcode=${data.errcode}, errmsg=${data.errmsg || ""}`);
    return;
  }
  ok("Wechat code2Session reachable");
}

async function checkStorage() {
  const storage = readStorageConfig();
  if (!storage) {
    warn("Storage", "COS/ASSET storage env incomplete");
    return;
  }
  ok("Storage env", `bucket=${storage.bucket}, region=${storage.region}, endpoint=${storage.endpoint}`);
  const key = `smoke/${Date.now()}.txt`;
  const uploadUrl = presignPutUrl(key, storage);
  ok("Storage presign", `url=${uploadUrl.slice(0, 80)}...`);
  if (storage.publicBaseUrl) {
    ok("Storage public base", storage.publicBaseUrl);
  } else {
    warn("Storage public base", "ASSET_PUBLIC_BASE_URL/COS_PUBLIC_BASE_URL missing");
  }

  if (!shouldWrite) {
    warn("Storage live upload", "skipped; run with --write to PUT a small smoke object");
    return;
  }

  const response = await fetch(uploadUrl, { method: "PUT", body: "jibian smoke test", headers: { "Content-Type": "text/plain" } });
  if (response.ok) {
    ok("Storage live upload", `PUT ${key}`);
  } else {
    fail("Storage live upload", `HTTP ${response.status}: ${await response.text().catch(() => "")}`);
  }
}

async function checkProvider(name: string, required: string[], live?: () => Promise<void>) {
  const missing = required.filter((key) => !getEnv(key));
  if (missing.length) {
    warn(`${name} env`, `missing ${missing.join(", ")}`);
    return;
  }
  ok(`${name} env`, required.map((key) => `${key}=${mask(getEnv(key))}`).join(", "));
  if (!shouldGenerate || !live) {
    warn(`${name} live generation`, "skipped; run with --generate to call provider and may consume credits");
    return;
  }
  await live();
}

async function checkProviders() {
  await checkProvider("T8", ["T8_BASE_URL", "T8_API_KEY"]);
  await checkProvider("GRSAI", ["GRSAI_API_HOST", "GRSAI_API_KEY"]);
  await checkProvider("KUAI", ["KUAI_BASE_URL", "KUAI_API_KEY"]);
}

async function main() {
  console.log(`Smoke mode: write=${shouldWrite ? "on" : "off"}, generate=${shouldGenerate ? "on" : "off"}`);
  console.log(`Loaded env files: ${join(repoRoot, ".env")} ${existsSync(join(repoRoot, ".env")) ? "OK" : "missing"}; ${join(backendRoot, ".env")} ${existsSync(join(backendRoot, ".env")) ? "OK" : "missing"}`);
  await checkWechat();
  await checkStorage();
  await checkProviders();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
