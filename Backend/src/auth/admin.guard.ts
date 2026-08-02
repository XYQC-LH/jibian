import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { isProductionRuntime } from "../common/runtime-env";
import { PrismaService } from "../prisma/prisma.service";

export const ADMIN_SESSION_COOKIE = "jibian_admin_session";

export type AdminSessionPayload = {
  sub: string;
  username: string;
};

declare global {
  namespace Express {
    interface Request {
      admin?: { id: string; username: string };
    }
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.readSessionToken(request);
    if (!token) {
      throw new UnauthorizedException("Not authenticated");
    }

    try {
      const secret = this.sessionSecret();
      const payload = await this.jwt.verifyAsync<AdminSessionPayload>(token, { secret });
      const admin = await this.prisma.adminUser.findFirst({
        where: { id: payload.sub, username: payload.username },
        select: { id: true, username: true },
      });
      if (!admin) {
        throw new UnauthorizedException("Session expired");
      }
      request.admin = { id: admin.id, username: admin.username };
      return true;
    } catch {
      throw new UnauthorizedException("Session expired");
    }
  }

  private sessionSecret() {
    const secret = this.config.get<string>("ADMIN_SESSION_SECRET")?.trim();
    if (secret) {
      return secret;
    }
    if (isProductionRuntime(this.config)) {
      throw new UnauthorizedException("Admin session secret is not configured");
    }
    return "jibian-dev-session-secret-change-me";
  }

  private readSessionToken(request: Request): string | null {
    const header = request.headers.cookie;
    if (!header) {
      return null;
    }
    const match = header
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`));
    if (!match) {
      return null;
    }
    return decodeURIComponent(match.slice(ADMIN_SESSION_COOKIE.length + 1));
  }
}
