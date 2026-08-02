import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { SourceAdapter, StandardGenerateInput, StandardGenerateOutput } from "../contracts/standard-generate.contract";

@Injectable()
export class GptImage2CKuaiCnAdapter implements SourceAdapter {
  readonly sourceId = "gpt-image-2-c-kuai-cn";
  private readonly upstreamModelName = "gpt-image-2-c";
  private readonly defaultSize = "1024x1024";

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.resolveEndpoint(this.config.get<string>("KUAI_BASE_URL") ?? "https://api.kuai.host") && this.config.get<string>("KUAI_API_KEY"));
  }

  async generate(input: StandardGenerateInput): Promise<StandardGenerateOutput> {
    const endpoint = this.resolveEndpoint(this.config.get<string>("KUAI_BASE_URL") ?? "https://api.kuai.host");
    const apiKey = this.config.get<string>("KUAI_API_KEY") ?? "";
    if (!endpoint || !apiKey) {
      return { ok: false, errorMessage: "Kuai GPT Image 2 C missing KUAI_API_KEY" };
    }

    const payload = {
      model: this.upstreamModelName,
      prompt: input.prompt,
      size: this.resolveSize(input.ratio),
      n: 1,
      image: [input.imageUrl],
      watermark: false,
      prompt_extend: false,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: input.signal,
    });

    const body = await this.readJson(response);
    if (!response.ok) {
      return { ok: false, errorMessage: this.errorMessage(body, `Kuai request failed: ${response.status}`) };
    }

    const imageUrl = this.extractImageUrl(body);
    if (!imageUrl) {
      return { ok: false, errorMessage: "Kuai response missing image URL" };
    }

    const asset = await this.prisma.asset.create({
      data: {
        assetType: "generated_image",
        storageKey: imageUrl,
      },
    });
    return { ok: true, assetId: asset.id };
  }

  private resolveSize(ratio: StandardGenerateInput["ratio"]) {
    const sizes: Record<StandardGenerateInput["ratio"], string> = {
      auto: this.defaultSize,
      "1:1": this.defaultSize,
      "3:4": "768x1024",
      "4:3": "1024x768",
      "9:16": "576x1024",
      "16:9": "1024x576",
    };
    return sizes[ratio] ?? this.defaultSize;
  }

  private resolveEndpoint(baseUrl: string) {
    const normalized = baseUrl.trim().replace(/\/+$/, "");
    if (!normalized) return "";
    if (normalized.endsWith("/v1/images/generations")) return normalized;
    if (normalized.endsWith("/v1")) return `${normalized}/images/generations`;
    return `${normalized}/v1/images/generations`;
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }

  private extractImageUrl(body: unknown): string {
    if (!body || typeof body !== "object") return "";
    const record = body as Record<string, unknown>;
    const data = Array.isArray(record.data) ? record.data : [];
    const first = data[0] as Record<string, unknown> | undefined;
    const output = Array.isArray(record.output) ? record.output : [];
    const outputFirst = output[0] as Record<string, unknown> | undefined;
    return String(first?.url || first?.image_url || outputFirst?.url || record.url || "").trim();
  }

  private errorMessage(body: unknown, fallback: string): string {
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      const error = record.error;
      if (error && typeof error === "object") {
        return String((error as Record<string, unknown>).message || (error as Record<string, unknown>).code || fallback);
      }
      return String(record.message || record.error || fallback);
    }
    return String(body || fallback);
  }
}
