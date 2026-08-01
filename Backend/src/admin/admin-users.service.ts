import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

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
        items: users.map((user) => ({
          id: user.id,
          username: user.nickname,
          login_account: user.openid,
          phone: user.phone,
          credits: user.creditAccount?.balance ?? 0,
          status: user.status,
          created_at: user.createdAt.toISOString(),
        })),
        total,
        page: safePage,
        page_size: safePageSize,
        total_pages: totalPages,
        has_next: safePage < totalPages,
        has_prev: safePage > 1,
      },
    };
  }
}
