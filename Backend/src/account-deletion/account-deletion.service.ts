import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AccountDeletionService {
  constructor(private readonly prisma: PrismaService) {}

  async requestDeletion(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.favorite.deleteMany({ where: { userId: user.id } });
      await tx.userCreation.updateMany({
        where: { userId: user.id, status: "active" },
        data: { status: "deleted", deletedAt: new Date() },
      });

      return tx.user.update({
        where: { id: user.id },
        data: {
          openid: `deleted_${user.id}`,
          unionid: null,
          nickname: null,
          avatarUrl: null,
          phone: null,
          phoneBound: false,
          status: "deleted",
        },
        select: { status: true },
      });
    });

    return { ok: true, status: updated.status };
  }
}
