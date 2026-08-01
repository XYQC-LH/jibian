import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        phone: true,
        phoneBound: true,
        status: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    return user;
  }

  async bindPhone(userId: string | undefined, phone: string) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }
    if (!phone || !/^\d{11}$/.test(phone)) {
      throw new BadRequestException("Invalid phone");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { phone, phoneBound: true },
    });

    return { phone, phone_bound: true };
  }
}
