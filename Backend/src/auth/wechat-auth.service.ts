import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
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

      const existingAccount = await tx.creditAccount.findUnique({ where: { userId: user.id } });
      if (existingAccount) {
        return { user, account: existingAccount };
      }

      const initialCredits = session.isMock ? this.getMockInitialCredits() : 0;
      const account = await tx.creditAccount.create({
        data: { userId: user.id, balance: initialCredits, updatedAt: now },
      });
      if (initialCredits > 0) {
        await tx.creditLedger.create({
          data: {
            userId: user.id,
            type: "adjustment",
            amount: initialCredits,
            refType: "mock_login_bonus",
            refId: user.id,
            balanceAfter: initialCredits,
          },
        });
      }

      return { user, account };
    });

    return {
      access_token: this.jwt.sign({ sub: result.user.id }, { expiresIn: "30d" }),
      token_type: "Bearer",
      expires_in: 30 * 24 * 3600,
      user: result.user,
      credit_balance: result.account.balance,
    };
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

  private getMockInitialCredits() {
    const value = Number(this.config.get<string>("MOCK_WECHAT_INITIAL_CREDITS") ?? 0);
    if (!Number.isFinite(value) || value <= 0) {
      return 0;
    }

    return Math.floor(value);
  }
}
