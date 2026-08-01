import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";

export type ModerationResult = {
  passed: boolean;
  policyHits: string[];
  reason: string | null;
};

const LOCAL_BLOCKLIST = [
  "色情",
  "淫秽",
  "裸体",
  "性交易",
  "暴力",
  "凶杀",
  "血腥",
  "恐怖袭击",
  "毒品",
  "冰毒",
  "海洛因",
  "枪支",
  "军火",
  "赌博",
  "邪教",
  "颠覆国家",
  "分裂主义",
];

@Injectable()
export class ContentModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async reviewText(
    targetType: string,
    targetId: string,
    stage: string,
    text: string,
  ): Promise<ModerationResult> {
    return this.review(targetType, targetId, stage, { text });
  }

  async reviewImageUrl(
    targetType: string,
    targetId: string,
    stage: string,
    imageUrl: string,
  ): Promise<ModerationResult> {
    return this.review(targetType, targetId, stage, { imageUrl });
  }

  private async review(
    targetType: string,
    targetId: string,
    stage: string,
    payload: { text?: string; imageUrl?: string },
  ): Promise<ModerationResult> {
    // MODERATION_ENABLED=false 时整体跳过审核，直接视为通过（仍留审计记录）
    if (this.config.get<string>("MODERATION_ENABLED") === "false") {
      const skipped: ModerationResult = { passed: true, policyHits: [], reason: null };
      await this.record(targetType, targetId, stage, skipped);
      return skipped;
    }

    const local = this.localReview(payload);
    if (!local.passed) {
      await this.record(targetType, targetId, stage, local);
      return local;
    }

    const remote = await this.remoteReview(payload);
    if (remote) {
      await this.record(targetType, targetId, stage, remote);
      return remote;
    }

    const passed: ModerationResult = { passed: true, policyHits: [], reason: null };
    await this.record(targetType, targetId, stage, passed);
    return passed;
  }

  private localReview(payload: { text?: string; imageUrl?: string }): ModerationResult {
    const target = payload.text ?? payload.imageUrl ?? "";
    const hits = LOCAL_BLOCKLIST.filter((word) => target.includes(word));
    if (hits.length > 0) {
      return { passed: false, policyHits: hits, reason: `命中敏感词: ${hits.join("、")}` };
    }

    if (payload.imageUrl !== undefined && !/^https?:\/\//i.test(payload.imageUrl)) {
      return { passed: false, policyHits: ["invalid_image_url"], reason: "图片 URL 非法" };
    }

    return { passed: true, policyHits: [], reason: null };
  }

  private async remoteReview(
    payload: { text?: string; imageUrl?: string },
  ): Promise<ModerationResult | null> {
    const apiUrl = this.config.get<string>("MODERATION_API_URL");
    if (!apiUrl) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.get<string>("MODERATION_API_KEY") ?? ""}`,
        },
        body: JSON.stringify({ text: payload.text, image_url: payload.imageUrl }),
        signal: controller.signal,
      });
      if (!response.ok) {
        // fail-closed：远程服务异常按不通过处理，避免漏审
        return {
          passed: false,
          policyHits: ["remote_review_error"],
          reason: `远程审核服务异常: HTTP ${response.status}`,
        };
      }
      const data = (await response.json()) as {
        passed?: boolean;
        hits?: string[];
        reason?: string;
        safe?: boolean;
      };
      // fail-closed：响应缺少 passed/safe 字段时按不通过处理
      return {
        passed: data.passed ?? data.safe ?? false,
        policyHits: data.hits ?? [],
        reason: data.reason ?? null,
      };
    } catch {
      // fail-closed：超时/网络异常按不通过处理，避免漏审
      return { passed: false, policyHits: ["remote_review_error"], reason: "远程审核服务不可用" };
    } finally {
      clearTimeout(timer);
    }
  }

  private async record(
    targetType: string,
    targetId: string,
    stage: string,
    result: ModerationResult,
  ) {
    await this.prisma.reviewRecord.create({
      data: {
        targetType,
        targetId,
        reviewStage: stage,
        status: result.passed ? "passed" : "blocked",
        policyHit: result.policyHits.length > 0 ? result.policyHits : undefined,
        reason: result.reason,
      },
    });
  }
}
