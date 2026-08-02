import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { SourceAdapter, StandardGenerateInput } from "../src/generation/contracts/standard-generate.contract";
import { GptImage2CKuaiCnAdapter } from "../src/generation/sources/gpt-image-2-c-kuai-cn.adapter";
import { GrsaiGptImage2Adapter } from "../src/generation/sources/grsai-gpt-image-2.adapter";
import { GrsaiGptImage2VipAdapter } from "../src/generation/sources/grsai-gpt-image-2-vip.adapter";
import { T8GptImage2EditsAdapter } from "../src/generation/sources/t8-gpt-image-2-edits.adapter";
import { T8GptImage2GenerationsAdapter } from "../src/generation/sources/t8-gpt-image-2-generations.adapter";
import type { PrismaService } from "../src/prisma/prisma.service";

type EnvMap = Record<string, string>;
type AssetRow = { id: string; assetType: string; storageKey: string };

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

const env = {
  ...parseEnvFile(join(repoRoot, ".env")),
  ...parseEnvFile(join(backendRoot, ".env")),
  ...Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  ),
};

class FakeAssetPrisma {
  readonly assets: AssetRow[] = [];

  asset = {
    create: async (args: { data: { assetType: string; storageKey: string } }) => {
      const row = { id: randomUUID(), ...args.data };
      this.assets.push(row);
      return row;
    },
  };
}

function selectedSourceIds() {
  return String(env.SMOKE_GENERATION_SOURCES || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sourceAllowed(source: SourceAdapter) {
  const selected = selectedSourceIds();
  return selected.length === 0 || selected.includes(source.sourceId);
}

function liveInput(): StandardGenerateInput {
  return {
    prompt: env.SMOKE_GENERATION_PROMPT || "Generate a clean studio portrait style image for integration testing.",
    imageUrl: env.SMOKE_GENERATION_IMAGE_URL || "https://gw.alipayobjects.com/zos/rmsportal/ODTLcjxAfvqbxHnVXCYX.png",
    ratio: (env.SMOKE_GENERATION_RATIO as StandardGenerateInput["ratio"]) || "1:1",
  };
}

function timeoutMs() {
  const parsed = Number(env.SMOKE_GENERATION_TIMEOUT_MS || 180000);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 180000;
}

async function runSource(source: SourceAdapter, input: StandardGenerateInput, prisma: FakeAssetPrisma) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const output = await source.generate({ ...input, signal: controller.signal });
    if (!output.ok) {
      return {
        source_id: source.sourceId,
        ok: false,
        latency_ms: Date.now() - startedAt,
        upstream_job_id: output.upstreamJobId ?? null,
        error_message: output.errorMessage,
      };
    }
    const asset = prisma.assets.find((row) => row.id === output.assetId);
    return {
      source_id: source.sourceId,
      ok: true,
      latency_ms: Date.now() - startedAt,
      upstream_job_id: output.upstreamJobId ?? null,
      asset_id: output.assetId,
      image_url: asset?.storageKey ?? null,
      cost_amount: output.costAmount ?? null,
    };
  } catch (error: unknown) {
    return {
      source_id: source.sourceId,
      ok: false,
      latency_ms: Date.now() - startedAt,
      upstream_job_id: null,
      error_message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const config = new ConfigService(env);
  const prisma = new FakeAssetPrisma();
  const sources: SourceAdapter[] = [
    new T8GptImage2EditsAdapter(prisma as unknown as PrismaService, config),
    new T8GptImage2GenerationsAdapter(prisma as unknown as PrismaService, config),
    new GrsaiGptImage2Adapter(prisma as unknown as PrismaService, config),
    new GrsaiGptImage2VipAdapter(prisma as unknown as PrismaService, config),
    new GptImage2CKuaiCnAdapter(prisma as unknown as PrismaService, config),
  ].filter((source) => sourceAllowed(source) && source.isConfigured());

  if (sources.length === 0) {
    throw new Error("No configured generation source found for live smoke");
  }

  const input = liveInput();
  const results = [];
  for (const source of sources) {
    const result = await runSource(source, input, prisma);
    results.push(result);
    if (result.ok && env.SMOKE_GENERATION_REQUIRE_ALL !== "true") {
      break;
    }
  }

  const successCount = results.filter((result) => result.ok).length;
  if (successCount === 0) {
    console.log(JSON.stringify({ ok: false, input, results }, null, 2));
    process.exitCode = 1;
    return;
  }

  if (env.SMOKE_GENERATION_REQUIRE_ALL === "true" && successCount !== sources.length) {
    console.log(JSON.stringify({ ok: false, input, results }, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify({ ok: true, input, results }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
