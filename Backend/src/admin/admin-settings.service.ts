import { BadRequestException, Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

const REGISTRATION_BONUS_KEY = "registration_bonus_credits";
const XIANYU_INTERNAL_API_KEY = "xianyu_internal_api_key";
const DEFAULT_REGISTRATION_BONUS = 100;

export type XianyuInternalApiKeyPayload = {
  configured: boolean;
  value: string;
  masked_value: string;
  source: string;
  length: number;
};

@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getXianyuInternalApiKey() {
    const value = await this.readSetting(XIANYU_INTERNAL_API_KEY);
    return { success: true, data: this.buildXianyuPayload(value) };
  }

  async updateXianyuInternalApiKey(input: { value?: string }) {
    const value = String(input.value ?? "").trim();
    if (value.length < 16) {
      throw new BadRequestException("xianyu internal api key must be at least 16 characters");
    }
    await this.writeSetting(XIANYU_INTERNAL_API_KEY, value);
    return { success: true, data: this.buildXianyuPayload(value) };
  }

  async generateXianyuInternalApiKey() {
    const value = randomBytes(16).toString("hex");
    await this.writeSetting(XIANYU_INTERNAL_API_KEY, value);
    return { success: true, data: this.buildXianyuPayload(value) };
  }

  private buildXianyuPayload(value: string): XianyuInternalApiKeyPayload {
    if (!value) {
      return {
        configured: false,
        value: "",
        masked_value: "",
        source: "unset",
        length: 0,
      };
    }
    return {
      configured: true,
      value,
      masked_value: this.maskSecret(value),
      source: "system_setting",
      length: value.length,
    };
  }

  private maskSecret(value: string): string {
    if (value.length <= 8) {
      return "*".repeat(value.length);
    }
    return `${value.slice(0, 4)}${"*".repeat(8)}${value.slice(-4)}`;
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
}
