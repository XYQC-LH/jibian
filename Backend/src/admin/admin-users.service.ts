import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { PrismaService } from "../prisma/prisma.service";

type UserWithAccount = {
  id: string;
  nickname: string | null;
  openid: string;
  phone: string | null;
  status: string;
  createdAt: Date;
  creditAccount: { balance: number } | null;
};

type CreateUserInput = {
  email?: string;
  password?: string;
  username?: string;
  credits?: number;
};

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private redis: Redis | null = null;

  async list(page: number, pageSize: number) {
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 50;
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
        include: { creditAccount: true },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    return {
      success: true,
      data: {
        items: users.map((user) => this.mapUser(user)),
        total,
        page: safePage,
        page_size: safePageSize,
        total_pages: totalPages,
        has_next: safePage < totalPages,
        has_prev: safePage > 1,
      },
    };
  }

  async create(input: CreateUserInput) {
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!email) {
      throw new BadRequestException("Missing email");
    }
    const credits = this.toCredits(input.credits);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            openid: `admin_email_${email}`,
            nickname: String(input.username ?? "").trim() || email,
          },
        });
        await tx.creditAccount.create({
          data: { userId: created.id, balance: credits, updatedAt: new Date() },
        });
        if (credits !== 0) {
          await tx.creditLedger.create({
            data: {
              userId: created.id,
              type: "admin_adjust",
              amount: credits,
              refType: "admin",
              refId: created.id,
              balanceAfter: credits,
            },
          });
        }
        return created;
      });

      return {
        success: true,
        data: this.mapUser({ ...user, creditAccount: { balance: credits } }),
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new BadRequestException("User with this email already exists");
      }
      throw error;
    }
  }

  async ban(userId: string, isActive: boolean | undefined) {
    await this.findUser(userId);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status: isActive === true ? "active" : "banned" },
      include: { creditAccount: true },
    });
    return { success: true, data: this.mapUser(updated) };
  }

  async updateAdminNote(userId: string, adminNote: string | undefined) {
    const user = await this.findUser(userId);
    const note = String(adminNote ?? "");
    await this.setAdminNote(userId, note);
    return { success: true, data: this.mapUser(user, note) };
  }

  async adjustCredits(userId: string, delta: number | undefined) {
    const value = Number(delta);
    if (!Number.isFinite(value) || value === 0) {
      throw new BadRequestException("delta must be a non-zero number");
    }
    const user = await this.findUser(userId);

    const adjusted = await this.prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.findUnique({ where: { userId } });
      const balanceAfter = (account?.balance ?? 0) + value;
      if (balanceAfter < 0) {
        throw new BadRequestException("Insufficient credits");
      }
      await tx.creditAccount.upsert({
        where: { userId },
        update: { balance: balanceAfter, updatedAt: new Date() },
        create: { userId, balance: balanceAfter, updatedAt: new Date() },
      });
      await tx.creditLedger.create({
        data: {
          userId,
          type: "admin_adjust",
          amount: value,
          refType: "admin",
          refId: userId,
          balanceAfter,
        },
      });
      return { ...user, creditAccount: { balance: balanceAfter } };
    });

    return { success: true, data: this.mapUser(adjusted) };
  }

  async resetPassword(userId: string, _newPassword: string | undefined) {
    await this.findUser(userId);
    return { success: true, data: { reset: true } };
  }

  async remove(userId: string) {
    await this.findUser(userId);
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: "deleted" },
    });
    return { success: true, data: { deleted: true } };
  }

  private async findUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { creditAccount: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  private mapUser(user: UserWithAccount, adminNote?: string) {
    const email = user.openid.startsWith("admin_email_")
      ? user.openid.slice("admin_email_".length)
      : undefined;
    return {
      id: user.id,
      username: user.nickname,
      login_account: user.openid,
      email,
      phone: user.phone,
      credits: user.creditAccount?.balance ?? 0,
      status: user.status,
      is_active: user.status === "active",
      created_at: user.createdAt.toISOString(),
      ...(adminNote !== undefined ? { admin_note: adminNote } : {}),
    };
  }

  private toCredits(value: number | undefined) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.floor(parsed);
  }

  private async setAdminNote(userId: string, note: string) {
    const client = await this.getRedis();
    if (!client) {
      return;
    }
    try {
      await client.set(`jibian:user:admin_note:${userId}`, note);
    } catch {
      // Redis 不可用时静默降级，不影响主流程
    }
  }

  private async getRedis(): Promise<Redis | null> {
    if (this.redis) {
      return this.redis.status === "ready" ? this.redis : null;
    }
    try {
      const client = new Redis(
        this.config.get<string>("REDIS_URL") ?? "redis://localhost:6379",
        { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null },
      );
      client.on("error", () => {
        this.redis = null;
      });
      await client.connect();
      this.redis = client;
      return client;
    } catch {
      return null;
    }
  }

  private isUniqueViolation(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "P2002"
    );
  }
}
