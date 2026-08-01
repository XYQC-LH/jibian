import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { SourceAdapter, StandardGenerateInput, StandardGenerateOutput } from "../contracts/standard-generate.contract";

@Injectable()
export class T8GptImage2EditsAdapter implements SourceAdapter {
  readonly sourceId = "t8-gpt-image-2-edits";
  private readonly upstreamModelName = "gpt-image-2";
  private readonly defaultAspectRatio = "1:1";

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.resolveEndpoint(this.config.get<string>("T8_BASE_URL") ?? "") && this.config.get<string>("T8_API_KEY"));
  }

  async generate(input: StandardGenerateInput): Promise<StandardGenerateOutput> {
    const endpoint = this.resolveEndpoint(this.config.get<string>("T8_BASE_URL") ?? "");
    const apiKey = this.config.get<string>("T8_API_KEY") ?? "";
    if (!endpoint || !apiKey) {
      return { ok: false, errorMessage: "T8 GPT Image 2 Edits missing T8_BASE_URL or T8_API_KEY" };
    }

    const payload = {
      model: this.upstreamModelName,
      prompt: input.prompt,
      n: 1,
      response_format: "url",
      images: [input.imageUrl],
      image: input.imageUrl,
      urls: [input.imageUrl],
      aspect_ratio: this.defaultAspectRatio,
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const body = await this.readJson(response);
    if (!response.ok) {
      return { ok: false, errorMessage: this.errorMessage(body, `T8 edits request failed: ${response.status}`) };
    }

    const imageUrl = this.extractImageUrl(body);
    if (!imageUrl) {
      return { ok: false, errorMessage: "T8 edits response missing image URL" };
    }

    const asset = await this.prisma.asset.create({
      data: {
        assetType: "generated_image",
        storageKey: imageUrl,
      },
    });
    return { ok: true, assetId: asset.id };
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
    return String(first?.url || first?.image_url || record.url || "").trim();
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
