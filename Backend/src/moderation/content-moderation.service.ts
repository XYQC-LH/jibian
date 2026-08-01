import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import GreenClient, { ImageModerationRequest } from "@alicloud/green20220302";
import { Config as OpenApiConfig } from "@alicloud/openapi-core/dist/utils";
import { PrismaService } from "../prisma/prisma.service";

export type ModerationStage = "input" | "output";

export type ModerationResult = {
  passed: boolean;
  policyHits: string[];
  reason: string | null;
};

type AliyunImageBody = {
  Code?: number | string;
  code?: number | string;
  Msg?: string;
  Message?: string;
  msg?: string;
  message?: string;
  Data?: AliyunImageData;
  data?: AliyunImageData;
};

type AliyunImageData = {
  RiskLevel?: string;
  riskLevel?: string;
  risk_level?: string;
  Result?: Array<{ Label?: string; label?: string; Score?: number; score?: number }>;
  result?: Array<{ Label?: string; label?: string; Score?: number; score?: number }>;
};

@Injectable()
export class ContentModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async reviewInputImage(taskId: string, imageUrl: string): Promise<ModerationResult> {
    return this.reviewTaskImage("input", taskId, imageUrl);
  }

  async reviewOutputImage(taskId: string, imageUrl: string): Promise<ModerationResult> {
    return this.reviewTaskImage("output", taskId, imageUrl);
  }

  private async reviewTaskImage(stage: ModerationStage, taskId: string, imageUrl: string) {
    const result = await this.evaluateImageUrl(imageUrl);
    await this.prisma.reviewRecord.create({
      data: {
        targetType: stage === "input" ? "input_asset" : "task_result",
        targetId: taskId,
        reviewStage: stage,
        status: result.passed ? "approved" : "rejected",
        policyHit: result.policyHits.length > 0 ? result.policyHits : undefined,
        reason: result.reason,
      },
    });
    return result;
  }

  private async evaluateImageUrl(imageUrl: string): Promise<ModerationResult> {
    if (this.config.get<string>("MODERATION_ENABLED") === "false") {
      return { passed: true, policyHits: [], reason: null };
    }

    if (!/^https?:\/\//i.test(imageUrl)) {
      return { passed: false, policyHits: ["invalid_image_url"], reason: "图片 URL 非法" };
    }

    if (!this.hasAliyunConfig()) {
      if (this.config.get<string>("NODE_ENV") === "production") {
        return { passed: false, policyHits: ["missing_access_key"], reason: "阿里云内容安全未配置 AccessKey" };
      }
      return { passed: true, policyHits: ["moderation_skipped_dev"], reason: null };
    }

    return this.reviewByAliyun(imageUrl);
  }

  private hasAliyunConfig() {
    return Boolean(this.readEnv("ALIBABA_CLOUD_ACCESS_KEY_ID") && this.readEnv("ALIBABA_CLOUD_ACCESS_KEY_SECRET"));
  }

  private async reviewByAliyun(imageUrl: string): Promise<ModerationResult> {
    let client: GreenClient;
    try {
      client = new GreenClient(
        new OpenApiConfig({
          accessKeyId: this.readEnv("ALIBABA_CLOUD_ACCESS_KEY_ID"),
          accessKeySecret: this.readEnv("ALIBABA_CLOUD_ACCESS_KEY_SECRET"),
          regionId: this.aliyunRegion(),
          endpoint: this.aliyunEndpoint(),
        }),
      );
    } catch (error: unknown) {
      return { passed: false, policyHits: ["sdk_init_error"], reason: `阿里云内容安全初始化失败: ${this.toMessage(error)}` };
    }

    try {
      const request = new ImageModerationRequest({
        service: this.aliyunImageService(),
        serviceParameters: JSON.stringify({ imageUrl, dataId: this.dataId() }),
      });
      const response = await client.imageModeration(request);
      return this.parseAliyunImageResponse((response as { body?: AliyunImageBody }).body);
    } catch (error: unknown) {
      return { passed: false, policyHits: ["aliyun_image_error"], reason: `阿里云图片审核调用失败: ${this.toMessage(error)}` };
    }
  }

  private parseAliyunImageResponse(body: AliyunImageBody | undefined): ModerationResult {
    const code = body?.Code ?? body?.code;
    const message = body?.Msg ?? body?.Message ?? body?.msg ?? body?.message;
    if (code !== undefined && String(code) !== "200" && String(code) !== "0") {
      return { passed: false, policyHits: ["aliyun_image_error"], reason: `阿里云图片审核失败: ${message ?? code}` };
    }

    const data = body?.Data ?? body?.data ?? {};
    const riskLevel = String(data.RiskLevel ?? data.riskLevel ?? data.risk_level ?? "").trim().toLowerCase();
    if (!riskLevel) {
      return { passed: false, policyHits: ["missing_risk_level"], reason: "阿里云图片审核未返回风险等级" };
    }

    if (this.blockRiskLevels().has(riskLevel)) {
      const labels = (data.Result ?? data.result ?? [])
        .map((item) => item.Label ?? item.label)
        .filter(Boolean)
        .join("、");
      return {
        passed: false,
        policyHits: [`image_risk_${riskLevel}`],
        reason: `图片命中风险: ${riskLevel}${labels ? ` (${labels})` : ""}`,
      };
    }

    return { passed: true, policyHits: [], reason: null };
  }

  private blockRiskLevels() {
    const configured = this.config.get<string>("MODERATION_ALIYUN_BLOCK_RISK_LEVELS") ?? "high,medium";
    const levels = configured.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
    return new Set(levels.length > 0 ? levels : ["high", "medium"]);
  }

  private aliyunRegion() {
    return this.readEnv("MODERATION_ALIYUN_REGION") || "cn-shanghai";
  }

  private aliyunEndpoint() {
    const configured = this.readEnv("MODERATION_ALIYUN_CIP_ENDPOINT");
    if (configured) return configured.replace(/^https?:\/\//, "");
    return `green-cip.${this.aliyunRegion()}.aliyuncs.com`;
  }

  private aliyunImageService() {
    return this.readEnv("MODERATION_ALIYUN_IMAGE_SERVICE") || "baselineCheck";
  }

  private dataId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  private readEnv(key: string) {
    return this.config.get<string>(key)?.trim() || "";
  }

  private toMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
