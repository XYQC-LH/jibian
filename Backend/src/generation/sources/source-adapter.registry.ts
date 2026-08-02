import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { SourceAdapter } from "../contracts/standard-generate.contract";
import { GptImage2CKuaiCnAdapter } from "./gpt-image-2-c-kuai-cn.adapter";
import { GrsaiGptImage2Adapter } from "./grsai-gpt-image-2.adapter";
import { GrsaiGptImage2VipAdapter } from "./grsai-gpt-image-2-vip.adapter";
import { MockSourceAdapter } from "./mock-source.adapter";
import { T8GptImage2EditsAdapter } from "./t8-gpt-image-2-edits.adapter";
import { T8GptImage2GenerationsAdapter } from "./t8-gpt-image-2-generations.adapter";

const RUNTIME_KEY = (sourceId: string) => `jibian:dispatch:runtime:${sourceId}`;
const RUNTIME_DEFAULTS = { is_enabled: true, weight: 1, priority: 0 };

type RuntimeConfig = typeof RUNTIME_DEFAULTS;

@Injectable()
export class SourceAdapterRegistry {
  private readonly redis: Redis | null = null;

  constructor(
    private readonly t8Generations: T8GptImage2GenerationsAdapter,
    private readonly t8Edits: T8GptImage2EditsAdapter,
    private readonly grsai: GrsaiGptImage2Adapter,
    private readonly grsaiVip: GrsaiGptImage2VipAdapter,
    private readonly kuai: GptImage2CKuaiCnAdapter,
    private readonly mock: MockSourceAdapter,
    private readonly config: ConfigService,
  ) {
    const url = this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    try {
      const client = new Redis(url, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      client.on("error", () => undefined);
      this.redis = client;
    } catch {
      this.redis = null;
    }
  }

  getDefault(): SourceAdapter {
    return this.getAll()[0];
  }

  getAll(): SourceAdapter[] {
    const configuredSources: SourceAdapter[] = [
      this.t8Edits,
      this.t8Generations,
      this.grsai,
      this.grsaiVip,
      this.kuai,
    ].filter((source) => source.isConfigured());

    if (this.mock.isConfigured()) {
      configuredSources.push(this.mock);
    }

    return configuredSources;
  }

  async getRunnable(): Promise<SourceAdapter[]> {
    const entries = await Promise.all(
      this.getAll().map(async (source, index) => ({
        source,
        index,
        runtime: await this.readRuntime(source.sourceId),
      })),
    );

    return entries
      .filter((entry) => entry.runtime.is_enabled && entry.runtime.weight > 0)
      .sort((left, right) => (
        left.runtime.priority - right.runtime.priority || left.index - right.index
      ))
      .map((entry) => entry.source);
  }

  private async readRuntime(sourceId: string): Promise<RuntimeConfig> {
    if (!this.redis) {
      return { ...RUNTIME_DEFAULTS };
    }

    try {
      const raw = await this.redis.get(RUNTIME_KEY(sourceId));
      if (!raw) {
        return { ...RUNTIME_DEFAULTS };
      }
      return { ...RUNTIME_DEFAULTS, ...(JSON.parse(raw) as Partial<RuntimeConfig>) };
    } catch {
      return { ...RUNTIME_DEFAULTS };
    }
  }
}
