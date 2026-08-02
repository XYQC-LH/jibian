import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type UserWithAccount = {
  id: string;
  nickname: string | null;
  openid: string;
  phone: string | null;
  adminNote: string | null;
  status: string;
  createdAt: Date;
  creditAccount: { balance: number } | null;
};

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

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
    await this.findUser(userId);
    const note = String(adminNote ?? "").trim().slice(0, 500);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { adminNote: note || null },
      include: { creditAccount: true },
    });
    return { success: true, data: this.mapUser(updated) };
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

  private mapUser(user: UserWithAccount) {
    return {
      id: user.id,
      username: user.nickname,
      login_account: user.openid,
      phone: user.phone,
      credits: user.creditAccount?.balance ?? 0,
      status: user.status,
      is_active: user.status === "active",
      registration_source: "wechat",
      registration_source_label: "微信小程序",
      created_at: user.createdAt.toISOString(),
      admin_note: user.adminNote ?? "",
    };
  }
}
