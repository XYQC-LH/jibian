import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.readBearerToken(request);
    if (!token) {
      throw new UnauthorizedException("Not authenticated");
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { status: true },
      });
      if (!user) {
        throw new UnauthorizedException("Invalid token");
      }
      if (user.status !== "active") {
        throw new ForbiddenException("User account is not active");
      }
      request.userId = payload.sub;
      return true;
    } catch (error: unknown) {
      if (error instanceof ForbiddenException || error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid token");
    }
  }

  private readBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) {
      return null;
    }
    const match = /^Bearer\s+(.+)$/.exec(header);
    if (!match) {
      return null;
    }
    const token = match[1].trim();
    return token || null;
  }
}
