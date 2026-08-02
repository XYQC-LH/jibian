import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { SourceAdapter, StandardGenerateInput, StandardGenerateOutput } from "../contracts/standard-generate.contract";

@Injectable()
export class GrsaiGptImage2VipAdapter implements SourceAdapter {
  readonly sourceId = "grsai-gpt-image-2-vip";
  private readonly upstreamModelName = "gpt-image-2-vip";
  private readonly defaultAspectRatio = "1024x1024";

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.normalizeBaseUrl(this.config.get<string>("GRSAI_API_HOST") ?? "") && this.config.get<string>("GRSAI_API_KEY"));
  }

  async generate(input: StandardGenerateInput): Promise<StandardGenerateOutput> {
    const baseUrl = this.normalizeBaseUrl(this.config.get<string>("GRSAI_API_HOST") ?? "");
    const apiKey = this.config.get<string>("GRSAI_API_KEY") ?? "";
    if (!baseUrl || !apiKey) {
      return { ok: false, errorMessage: "GRSAI GPT Image 2 VIP missing GRSAI_API_HOST or GRSAI_API_KEY" };
    }

    const payload = {
      model: this.upstreamModelName,
      prompt: input.prompt,
      aspectRatio: this.resolveAspectRatio(input.ratio),
      images: [input.imageUrl],
      replyType: "async",
      webHook: "-1",
    };

    const submit = await fetch(`${baseUrl}/v1/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: input.signal,
    });
    const submitBody = await this.readJson(submit);
    this.throwIfAborted(input.signal);
    if (!submit.ok) {
      return { ok: false, errorMessage: this.errorMessage(submitBody, `GRSAI VIP request failed: ${submit.status}`) };
    }

    const immediateUrl = this.extractResultUrl(submitBody);
    if (immediateUrl) {
      return this.createAsset(immediateUrl);
    }

    const upstreamJobId = this.extractJobId(submitBody);
    if (!upstreamJobId) {
      return { ok: false, errorMessage: "GRSAI VIP response missing task id" };
    }

    for (let index = 0; index < 120; index += 1) {
      this.throwIfAborted(input.signal);
      await this.sleep(Math.min(1000 * 2 ** Math.min(index, 3), 8000), input.signal);
      const poll = await fetch(`${baseUrl}/v1/api/result?id=${encodeURIComponent(upstreamJobId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: input.signal,
      });
      const pollBody = await this.readJson(poll);
      this.throwIfAborted(input.signal);
      if (!poll.ok) {
        return { ok: false, errorMessage: this.errorMessage(pollBody, `GRSAI VIP poll failed: ${poll.status}`) };
      }
      const status = this.extractStatus(pollBody);
      if (status === "failed" || status === "violation") {
        return { ok: false, errorMessage: this.errorMessage(pollBody, "GRSAI VIP generation failed"), upstreamJobId };
      }
      const imageUrl = this.extractResultUrl(pollBody);
      if (status === "succeeded" && imageUrl) {
        return this.createAsset(imageUrl, upstreamJobId);
      }
    }

    return { ok: false, errorMessage: "GRSAI VIP polling timeout", upstreamJobId };
  }

  private resolveAspectRatio(ratio: StandardGenerateInput["ratio"]) {
    const sizes: Record<StandardGenerateInput["ratio"], string> = {
      auto: this.defaultAspectRatio,
      "1:1": this.defaultAspectRatio,
      "3:4": "768x1024",
      "4:3": "1024x768",
      "9:16": "576x1024",
      "16:9": "1024x576",
    };
    return sizes[ratio] ?? this.defaultAspectRatio;
  }

  private normalizeBaseUrl(value: string) {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    return trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
  }

  private async createAsset(storageKey: string, upstreamJobId?: string): Promise<StandardGenerateOutput> {
    const asset = await this.prisma.asset.create({ data: { assetType: "generated_image", storageKey } });
    return { ok: true, assetId: asset.id, upstreamJobId };
  }

  private async readJson(response: Response): Promise<unknown> {
    try { return await response.json(); } catch { return await response.text(); }
  }

  private extractStatus(body: unknown) {
    return body && typeof body === "object" ? String((body as Record<string, unknown>).status || "").toLowerCase() : "";
  }

  private extractJobId(body: unknown) {
    return body && typeof body === "object" ? String((body as Record<string, unknown>).id || "").trim() : "";
  }

  private extractResultUrl(body: unknown) {
    if (!body || typeof body !== "object") return "";
    const results = (body as Record<string, unknown>).results;
    const first = Array.isArray(results) ? results[0] as Record<string, unknown> | undefined : undefined;
    return String(first?.url || "").trim();
  }

  private errorMessage(body: unknown, fallback: string) {
    if (!body || typeof body !== "object") return String(body || fallback);
    const record = body as Record<string, unknown>;
    return String(record.error || record.message || fallback);
  }

  private sleep(ms: number, signal?: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error("Generation request aborted"));
        return;
      }

      const timeoutId = setTimeout(() => {
        cleanup();
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timeoutId);
        cleanup();
        reject(new Error("Generation request aborted"));
      };
      const cleanup = () => signal?.removeEventListener("abort", onAbort);
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  private throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
      throw new Error("Generation request aborted");
    }
  }
}
