import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";

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
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.readSessionToken(request);
    if (!token) {
      throw new UnauthorizedException("Not authenticated");
    }

    try {
      const secret =
        this.config.get<string>("ADMIN_SESSION_SECRET") ??
        "jibian-dev-session-secret-change-me";
      const payload = await this.jwt.verifyAsync<AdminSessionPayload>(token, { secret });
      request.admin = { id: payload.sub, username: payload.username };
      return true;
    } catch {
      throw new UnauthorizedException("Session expired");
    }
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
