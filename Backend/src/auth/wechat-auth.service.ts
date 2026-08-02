import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { DEFAULT_REGISTRATION_BONUS, REGISTRATION_BONUS_KEY } from "../common/settings.constants";
import { PrismaTransactionClient } from "../prisma/prisma-transaction-client";
import { PrismaService } from "../prisma/prisma.service";

type Code2SessionResponse = {
  openid?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
};

type WechatSession = {
  openid: string;
  unionid?: string;
  isMock?: boolean;
};

@Injectable()
export class WechatAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async login(code: string | undefined) {
    const normalizedCode = String(code || "").trim();
    if (!normalizedCode) {
      throw new BadRequestException("Missing code");
    }

    const session = await this.resolveWechatSession(normalizedCode);
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { openid: session.openid },
        update: session.unionid ? { unionid: session.unionid } : {},
        create: {
          openid: session.openid,
          ...(session.unionid ? { unionid: session.unionid } : {}),
        },
      });
      if (user.status !== "active") {
        throw new ForbiddenException("User account is not active");
      }

      const existingAccount = await tx.creditAccount.findUnique({ where: { userId: user.id } });
      if (existingAccount) {
        return { user, account: existingAccount };
      }

      const initialCredits = await this.getInitialCredits(tx, session);
      const account = await tx.creditAccount.create({
        data: { userId: user.id, balance: initialCredits, updatedAt: now },
      });
      if (initialCredits > 0) {
        await tx.creditLedger.create({
          data: {
            userId: user.id,
            type: "adjustment",
            amount: initialCredits,
            refType: session.isMock ? "mock_login_bonus" : "registration_bonus",
            refId: user.id,
            balanceAfter: initialCredits,
          },
        });
      }

      return { user, account };
    });

    const expiresIn = this.accessTokenExpiresInSeconds();

    return {
      access_token: this.jwt.sign({ sub: result.user.id }, { expiresIn }),
      token_type: "Bearer",
      expires_in: expiresIn,
      user: result.user,
      credit_balance: result.account.balance,
    };
  }

  private accessTokenExpiresInSeconds() {
    const minutes = Number(this.config.get<string>("JWT_ACCESS_TOKEN_EXPIRE_MINUTES") ?? 30 * 24 * 60);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      return 30 * 24 * 3600;
    }
    return Math.floor(minutes * 60);
  }

  private async resolveWechatSession(code: string): Promise<WechatSession> {
    const appId = this.config.get<string>("WECHAT_APP_ID")?.trim();
    const appSecret = this.config.get<string>("WECHAT_APP_SECRET")?.trim();

    if (code.startsWith("mock") || !appId || !appSecret) {
      // Mock 登录仅由显式开关 ALLOW_MOCK_WECHAT=true 控制（与 NODE_ENV 无关），
      // 便于在未配置真实微信 AppID/Secret 的部署环境联调；默认关闭保持安全。
      const allowMock = this.config.get<string>("ALLOW_MOCK_WECHAT") === "true";
      if (!allowMock) {
        throw new ServiceUnavailableException("Wechat login is not configured");
      }

      const configuredOpenid = this.config.get<string>("MOCK_WECHAT_OPENID")?.trim();
      return {
        openid: (configuredOpenid || `mock_${code}`).slice(0, 128),
        isMock: true,
      };
    }

    const params = new URLSearchParams({
      appid: appId,
      secret: appSecret,
      js_code: code,
      grant_type: "authorization_code",
    });
    let response: Response;
    try {
      response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params}`);
    } catch {
      throw new ServiceUnavailableException("Wechat code2Session request failed");
    }

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Wechat code2Session unavailable: ${response.status}`,
      );
    }

    let data: Code2SessionResponse;
    try {
      data = (await response.json()) as Code2SessionResponse;
    } catch {
      throw new ServiceUnavailableException("Wechat code2Session returned invalid JSON");
    }

    if (data.errcode) {
      throw new UnauthorizedException(
        data.errmsg ? `Wechat login rejected: ${data.errmsg}` : "Wechat login rejected",
      );
    }

    if (!data.openid) {
      throw new UnauthorizedException("Wechat code2Session returned no openid");
    }

    return {
      openid: data.openid.slice(0, 128),
      ...(data.unionid ? { unionid: data.unionid.slice(0, 128) } : {}),
    };
  }

  private async getInitialCredits(tx: PrismaTransactionClient, session: WechatSession) {
    const mockInitialCredits = session.isMock ? this.getMockInitialCredits() : 0;
    if (mockInitialCredits > 0) {
      return mockInitialCredits;
    }

    const setting = await tx.setting.findUnique({ where: { key: REGISTRATION_BONUS_KEY } });
    const configured = Number(setting?.value);
    if (Number.isFinite(configured) && configured > 0) {
      return Math.floor(configured);
    }

    return DEFAULT_REGISTRATION_BONUS;
  }

  private getMockInitialCredits() {
    const value = Number(this.config.get<string>("MOCK_WECHAT_INITIAL_CREDITS") ?? 0);
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    return Math.floor(value);
  }
}
