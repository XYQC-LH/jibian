import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isProductionRuntime } from "../common/runtime-env";
import { PrismaService } from "../prisma/prisma.service";

type WechatAccessTokenResponse = {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
};

type WechatPhoneResponse = {
  errcode?: number;
  errmsg?: string;
  phone_info?: {
    phoneNumber?: string;
    purePhoneNumber?: string;
    countryCode?: string;
  };
};

@Injectable()
export class UsersService {
  private wechatAccessToken: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getMe(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        phone: true,
        phoneBound: true,
        status: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async bindPhone(userId: string | undefined, input: { phone?: string; code?: string }) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }
    const phone = input.code
      ? await this.resolveWechatPhone(input.code)
      : this.resolvePlainPhone(input.phone);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { phone, phoneBound: true },
    });

    return { phone, phone_bound: true };
  }

  private resolvePlainPhone(phone: string | undefined) {
    if (isProductionRuntime(this.config) && this.config.get<string>("ALLOW_MOCK_WECHAT") !== "true") {
      throw new BadRequestException("Missing Wechat phone code");
    }
    if (!phone || !/^\d{11}$/.test(phone)) {
      throw new BadRequestException("Invalid phone");
    }
    return phone;
  }

  private async resolveWechatPhone(code: string) {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) {
      throw new BadRequestException("Missing Wechat phone code");
    }

    const accessToken = await this.getWechatAccessToken();
    const response = await fetch(
      `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode }),
      },
    );
    const data = (await response.json().catch(() => null)) as WechatPhoneResponse | null;
    if (!response.ok || !data) {
      throw new ServiceUnavailableException("Wechat phone request failed");
    }
    if (data.errcode) {
      throw new BadRequestException(data.errmsg ? `Wechat phone rejected: ${data.errmsg}` : "Wechat phone rejected");
    }

    const phone = String(data.phone_info?.purePhoneNumber || data.phone_info?.phoneNumber || "").trim();
    if (!/^\d{11}$/.test(phone)) {
      throw new ServiceUnavailableException("Wechat phone response missing valid phone");
    }
    return phone;
  }

  private async getWechatAccessToken() {
    if (this.wechatAccessToken && this.wechatAccessToken.expiresAt > Date.now() + 60_000) {
      return this.wechatAccessToken.value;
    }

    const appId = this.config.get<string>("WECHAT_APP_ID")?.trim();
    const appSecret = this.config.get<string>("WECHAT_APP_SECRET")?.trim();
    if (!appId || !appSecret) {
      throw new ServiceUnavailableException("Wechat login is not configured");
    }

    const params = new URLSearchParams({
      grant_type: "client_credential",
      appid: appId,
      secret: appSecret,
    });
    const response = await fetch(`https://api.weixin.qq.com/cgi-bin/token?${params}`);
    const data = (await response.json().catch(() => null)) as WechatAccessTokenResponse | null;
    if (!response.ok || !data) {
      throw new ServiceUnavailableException("Wechat access token request failed");
    }
    if (data.errcode || !data.access_token) {
      throw new ServiceUnavailableException(data.errmsg ? `Wechat access token rejected: ${data.errmsg}` : "Wechat access token rejected");
    }

    this.wechatAccessToken = {
      value: data.access_token,
      expiresAt: Date.now() + Math.max(60, data.expires_in ?? 7200) * 1000,
    };
    return this.wechatAccessToken.value;
  }
}
