import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

type EnvMap = Record<string, string>;
type CliOptions = Record<string, string | boolean>;

type CategoryItem = {
  id: string;
  name: string;
  display_name: string;
  sort_order: number;
};

type CategoriesResponse = {
  success: boolean;
  data: {
    items: CategoryItem[];
    total: number;
  };
};

type UploadUrlResponse = {
  success: boolean;
  data: {
    asset_id: string;
    storage_key: string;
    upload_url: string;
    public_url: string;
  };
};

type CreateTemplateResponse = {
  success: boolean;
  data: {
    id: string;
    name: string;
    category: string;
    cover_asset_id: string;
    price_credits: number;
    result_count: number;
    sort_order: number;
    status: string;
  };
};

const backendRoot = resolve(__dirname, "..");
const repoRoot = resolve(backendRoot, "..");
const args = parseArgs(process.argv.slice(2));
const env: EnvMap = {
  ...parseEnvFile(join(repoRoot, ".env")),
  ...parseEnvFile(join(backendRoot, ".env")),
  ...Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ),
};

const testCoverPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

async function main() {
  if (args.help) {
    printHelp();
    return;
  }

  const apiKey = stringArg("key") || getEnv("TEMPLATE_INGEST_API_KEY");
  assert(apiKey, "Missing TEMPLATE_INGEST_API_KEY. Set it in Backend/.env or pass --key=<value>.");

  const baseUrl = resolveBaseUrl();
  const contentType = "image/png";
  console.log(`Template ingest smoke: ${baseUrl}`);

  const categories = await requestJson<CategoriesResponse>(`${baseUrl}/categories`, {
    headers: authHeaders(apiKey),
  });
  assert(categories.success, "Category request did not return success=true.");
  assert(categories.data.items.length > 0, "No template categories found. Create a category in admin first.");

  const category = stringArg("category") || categories.data.items[0].name;
  assert(
    categories.data.items.some((item) => item.name === category),
    `Category "${category}" does not exist in /categories response.`,
  );

  const upload = await requestJson<UploadUrlResponse>(`${baseUrl}/covers/upload-url`, {
    method: "POST",
    headers: jsonHeaders(apiKey),
    body: JSON.stringify({ content_type: contentType }),
  });
  assert(upload.success, "Cover upload-url request did not return success=true.");

  await uploadCover(upload.data.upload_url, testCoverPng, contentType);

  const templateName = buildTemplateName();
  const priceCredits = intArg("price", 0);
  const resultCount = intArg("result-count", 1);
  const prompt = stringArg("prompt") || "将用户上传的人物照片转换为清透自然的本地接口测试写真。";

  const created = await requestJson<CreateTemplateResponse>(`${baseUrl}/templates`, {
    method: "POST",
    headers: jsonHeaders(apiKey),
    body: JSON.stringify({
      name: templateName,
      category,
      cover_asset_id: upload.data.asset_id,
      prompt,
      price_credits: priceCredits,
      result_count: resultCount,
      external_id: `local-smoke-${Date.now()}`,
    }),
  });
  assert(created.success, "Create template request did not return success=true.");

  console.log(JSON.stringify({
    ok: true,
    category,
    cover_asset_id: upload.data.asset_id,
    template: {
      id: created.data.id,
      name: created.data.name,
      status: created.data.status,
      sort_order: created.data.sort_order,
      price_credits: created.data.price_credits,
      result_count: created.data.result_count,
    },
  }, null, 2));
}

function parseArgs(argv: string[]): CliOptions {
  const out: CliOptions = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const raw = arg.slice(2);
    const eq = raw.indexOf("=");
    if (eq === -1) {
      out[raw] = true;
      continue;
    }
    out[raw.slice(0, eq)] = raw.slice(eq + 1);
  }
  return out;
}

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

function getEnv(key: string) {
  return String(env[key] || "").trim();
}

function stringArg(key: string) {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function intArg(key: string, fallback: number) {
  const raw = stringArg(key);
  if (!raw) return fallback;
  const value = Number(raw);
  assert(Number.isInteger(value), `--${key} must be an integer.`);
  return value;
}

function resolveBaseUrl() {
  const configured = stringArg("base-url") || getEnv("TEMPLATE_INGEST_BASE_URL");
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  const port = getEnv("API_PORT") || getEnv("PORT") || "8000";
  return `http://localhost:${port}/api/v1/template-ingest`;
}

function buildTemplateName() {
  const configured = stringArg("name");
  if (configured) {
    return configured.slice(0, 80);
  }

  return `Local Ingest Smoke ${new Date().toISOString().replace(/\.\d{3}Z$/, "Z")}`.slice(0, 80);
}

function authHeaders(apiKey: string): Record<string, string> {
  return { "X-Template-Ingest-Key": apiKey };
}

function jsonHeaders(apiKey: string): Record<string, string> {
  return {
    ...authHeaders(apiKey),
    "Content-Type": "application/json",
  };
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  let response: globalThis.Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    throw new Error(`Request failed: ${url}. Is the backend running? ${formatError(error)}`);
  }

  const text = await response.text();
  const payload = text ? parseJson(text) : null;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}: ${formatPayload(payload ?? text)}`);
  }

  return payload as T;
}

async function uploadCover(uploadUrl: string, body: Buffer, contentType: string) {
  if (uploadUrl.startsWith("mock://")) {
    console.log(`Cover upload skipped for mock url: ${uploadUrl}`);
    return;
  }

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: body as unknown as BodyInit,
  });
  if (!response.ok) {
    throw new Error(`Cover upload failed: HTTP ${response.status} ${await response.text().catch(() => "")}`);
  }
  console.log(`Cover uploaded: HTTP ${response.status}`);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function formatPayload(payload: unknown) {
  return typeof payload === "string" ? payload : JSON.stringify(payload);
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function printHelp() {
  console.log(`
Usage:
  npm run smoke:template-ingest
  npm run smoke:template-ingest -- --category=写真 --price=6
  npm run smoke:template-ingest -- --base-url=http://localhost:8000/api/v1/template-ingest

Options:
  --base-url       Template ingest base URL. Defaults to local backend.
  --key            API key. Defaults to TEMPLATE_INGEST_API_KEY from env files.
  --category       Existing template category name. Defaults to the first category.
  --name           Template name. Defaults to a timestamped smoke name.
  --prompt         Template prompt. Defaults to a local smoke prompt.
  --price          price_credits. Defaults to 0.
  --result-count   result_count. Defaults to 1.
`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
