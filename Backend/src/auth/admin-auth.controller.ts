import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { compare } from "bcryptjs";
import type { Request, Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { ADMIN_SESSION_COOKIE, AdminGuard } from "./admin.guard";

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

@Controller("v1/auth/admin")
export class AdminAuthController {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Post("login")
  async login(
    @Body("username") username: string | undefined,
    @Body("password") password: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!username || !password) {
      throw new UnauthorizedException("Invalid username or password");
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { username } });
    if (!admin) {
      throw new UnauthorizedException("Invalid username or password");
    }

    const passwordMatches = await compare(password, admin.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid username or password");
    }

    const token = this.signSession(admin.id, admin.username);
    this.setSessionCookie(res, token);

    return {
      success: true,
      data: {
        user: { id: admin.id, username: admin.username },
        expires_in: Math.floor(SESSION_DURATION_MS / 1000),
      },
    };
  }

  @Get("me")
  @UseGuards(AdminGuard)
  me(@Req() req: Request) {
    const admin = req.admin as { id: string; username: string };
    return {
      success: true,
      data: { id: admin.id, username: admin.username },
    };
  }

  @Post("refresh")
  @UseGuards(AdminGuard)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const admin = req.admin as { id: string; username: string };
    const token = this.signSession(admin.id, admin.username);
    this.setSessionCookie(res, token);
    return { success: true, data: { refreshed: true } };
  }

  @Post("logout")
  @UseGuards(AdminGuard)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ADMIN_SESSION_COOKIE, this.cookieOptions());
    return { success: true, data: { logged_out: true } };
  }

  private signSession(id: string, username: string): string {
    const secret =
      this.config.get<string>("ADMIN_SESSION_SECRET") ??
      "jibian-dev-session-secret-change-me";
    return this.jwt.sign({ sub: id, username }, { secret, expiresIn: SESSION_DURATION_MS / 1000 });
  }

  private setSessionCookie(res: Response, token: string) {
    res.cookie(ADMIN_SESSION_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: SESSION_DURATION_MS,
    });
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    };
  }
}
