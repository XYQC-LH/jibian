import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export const DEFAULT_GLOBAL_PRICING_MULTIPLIER = 1;
export const FINANCE_CREDIT_PER_CNY = 10;
const PRICING_MULTIPLIER_REDIS_KEY = "jibian:pricing:global_multiplier";

@Injectable()
export class PricingService {
  private readonly redisUrl: string;
  private redis: Redis | null = null;
  private pricingMultiplier = DEFAULT_GLOBAL_PRICING_MULTIPLIER;

  constructor(private readonly config: ConfigService) {
    this.redisUrl = this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379";
  }

  async getGlobalPricingMultiplier() {
    try {
      const redis = this.getRedis();
      const raw = redis ? await redis.get(PRICING_MULTIPLIER_REDIS_KEY) : null;
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        this.pricingMultiplier = parsed;
        return parsed;
      }
    } catch {
      // Redis 不可用时使用进程内最近一次设置值
    }
    return this.pricingMultiplier;
  }

  async setGlobalPricingMultiplier(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException("global_pricing_multiplier must be a positive number");
    }

    this.pricingMultiplier = value;
    try {
      const redis = this.getRedis();
      if (redis) {
        await redis.set(PRICING_MULTIPLIER_REDIS_KEY, String(value));
      }
    } catch {
      // Redis 不可用时不阻断管理端保存，进程内值仍然立即生效
    }
    return value;
  }

  applyMultiplier(baseCredits: number, multiplier: number) {
    const base = Math.max(0, Math.trunc(Number(baseCredits) || 0));
    if (base === 0) return 0;
    return Math.max(1, Math.ceil(base * multiplier));
  }

  private getRedis(): Redis | null {
    if (!this.redisUrl) {
      return null;
    }
    if (!this.redis) {
      this.redis = new Redis(this.redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });
      this.redis.on("error", () => undefined);
    }
    return this.redis;
  }
}
