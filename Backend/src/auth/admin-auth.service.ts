import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { hash } from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminAuthService implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.syncAdminFromEnv();
  }

  private async syncAdminFromEnv() {
    const username = this.config.get<string>("ADMIN_USERNAME");
    const password = this.config.get<string>("ADMIN_PASSWORD");

    if (!username || !password) {
      if (process.env.NODE_ENV === "production") {
        throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required in production");
      }
      return;
    }

    const passwordHash = await hash(password, 12);
    await this.prisma.adminUser.upsert({
      where: { username },
      update: {
        passwordHash,
        envSyncedAt: new Date(),
      },
      create: {
        username,
        passwordHash,
        envSyncedAt: new Date(),
      },
    });
  }
}
