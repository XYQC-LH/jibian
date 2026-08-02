import { InjectQueue } from "@nestjs/bullmq";
import { BadRequestException, Injectable, OnModuleInit, Optional, ServiceUnavailableException } from "@nestjs/common";
import type { Queue } from "bullmq";
import {
  DEFAULT_REGISTRATION_BONUS,
  DEFAULT_TASK_TIMEOUT_SECONDS,
  REGISTRATION_BONUS_KEY,
} from "../common/settings.constants";
import { PrismaService } from "../prisma/prisma.service";

const systemConfigDefaults = {
  max_concurrent_tasks: 10,
  task_timeout: DEFAULT_TASK_TIMEOUT_SECONDS,
  cleanup_interval: 3600,
  redis_memory_limit: "256mb",
  database_connections: 20,
  file_storage_limit: "1gb",
};

type SystemConfigKey = keyof typeof systemConfigDefaults;

const numericSystemConfigKeys = new Set<SystemConfigKey>([
  "max_concurrent_tasks",
  "task_timeout",
  "cleanup_interval",
  "database_connections",
]);

@Injectable()
export class AdminSettingsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @InjectQueue("generation") private readonly generationQueue?: Queue,
  ) {}

  async onModuleInit() {
    const config = await this.readSystemConfig();
    await this.applyGenerationConcurrency(config.max_concurrent_tasks, false);
  }

  async getRegistrationBonus() {
    const credits = this.parseCredits(await this.readSetting(REGISTRATION_BONUS_KEY));
    return { success: true, data: { registration_bonus_credits: credits } };
  }

  async updateRegistrationBonus(input: { registration_bonus_credits?: number }) {
    const raw = String(input.registration_bonus_credits ?? "").trim();
    const credits = Number(raw);
    if (!Number.isFinite(credits) || credits <= 0) {
      throw new BadRequestException("registration_bonus_credits must be a positive integer");
    }
    const value = Math.trunc(credits);
    await this.writeSetting(REGISTRATION_BONUS_KEY, String(value));
    return { success: true, data: { registration_bonus_credits: value } };
  }

  async getSystemConfig() {
    return { success: true, data: await this.readSystemConfig() };
  }

  async updateSystemConfig(input: Record<string, unknown>) {
    const updates: Partial<Record<SystemConfigKey, string>> = {};

    for (const key of Object.keys(systemConfigDefaults) as SystemConfigKey[]) {
      if (input[key] === undefined) continue;
      updates[key] = this.normalizeSystemConfigValue(key, input[key]);
    }

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException("No supported system config fields provided");
    }

    await this.prisma.$transaction(
      Object.entries(updates).map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key: this.systemConfigSettingKey(key as SystemConfigKey) },
          update: { value },
          create: { key: this.systemConfigSettingKey(key as SystemConfigKey), value },
        }),
      ),
    );

    const config = await this.readSystemConfig();
    if (updates.max_concurrent_tasks !== undefined) {
      await this.applyGenerationConcurrency(config.max_concurrent_tasks, true);
    }

    return { success: true, data: config };
  }

  private parseCredits(raw: string): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_REGISTRATION_BONUS;
    }
    return Math.trunc(parsed);
  }

  private async readSetting(key: string): Promise<string> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? "";
  }

  private async writeSetting(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  private async readSystemConfig() {
    const keys = Object.keys(systemConfigDefaults) as SystemConfigKey[];
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: keys.map((key) => this.systemConfigSettingKey(key)) } },
    });
    const byKey = new Map(rows.map((row) => [row.key, row.value]));

    return keys.reduce((config, key) => {
      const raw = byKey.get(this.systemConfigSettingKey(key));
      const fallback = systemConfigDefaults[key];
      return {
        ...config,
        [key]: numericSystemConfigKeys.has(key)
          ? this.parsePositiveInt(raw, fallback as number)
          : (raw && raw.trim() ? raw.trim() : fallback),
      };
    }, {} as typeof systemConfigDefaults);
  }

  private normalizeSystemConfigValue(key: SystemConfigKey, value: unknown) {
    if (numericSystemConfigKeys.has(key)) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new BadRequestException(`${key} must be a positive integer`);
      }
      return String(Math.trunc(parsed));
    }

    const text = String(value ?? "").trim();
    if (!text) {
      throw new BadRequestException(`${key} cannot be empty`);
    }
    return text;
  }

  private parsePositiveInt(raw: string | undefined, fallback: number) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return Math.trunc(parsed);
  }

  private systemConfigSettingKey(key: SystemConfigKey) {
    return `system.${key}`;
  }

  private async applyGenerationConcurrency(concurrency: number, failOnError: boolean) {
    if (!this.generationQueue) {
      return;
    }

    try {
      await this.generationQueue.setGlobalConcurrency(concurrency);
    } catch (error: unknown) {
      if (failOnError) {
        throw new ServiceUnavailableException(
          error instanceof Error ? error.message : "Failed to update generation queue concurrency",
        );
      }
    }
  }
}
