import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { hash } from "bcryptjs";
import { isProductionRuntime } from "../common/runtime-env";
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
    const username = this.config.get<string>("ADMIN_USERNAME")?.trim();
    const password = this.config.get<string>("ADMIN_PASSWORD");

    if (!username || !password) {
      if (isProductionRuntime(this.config)) {
        throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required in production");
      }
      return;
    }

    const passwordHash = await hash(password, 12);
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.adminUser.upsert({
        where: { username },
        update: {
          passwordHash,
          envSyncedAt: now,
        },
        create: {
          username,
          passwordHash,
          envSyncedAt: now,
        },
      }),
      this.prisma.adminUser.deleteMany({
        where: { username: { not: username } },
      }),
    ]);
  }
}
