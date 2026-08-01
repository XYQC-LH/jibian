import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AssetsService } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UserCreationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assets: AssetsService,
  ) {}

  async listForUser(userId: string | undefined) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const creations = await this.prisma.userCreation.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { coverAsset: true },
    });

    return creations.map((creation) => this.serializeCreation(creation));
  }

  async getForUser(userId: string | undefined, id: string) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const creation = await this.prisma.userCreation.findFirst({
      where: { id, userId },
      include: { coverAsset: true },
    });

    if (!creation) {
      throw new NotFoundException("User creation not found");
    }

    return this.serializeCreation(creation);
  }

  async deleteForUser(userId: string | undefined, id: string) {
    if (!userId) {
      throw new BadRequestException("Missing x-user-id header");
    }

    const creation = await this.prisma.userCreation.findFirst({
      where: { id, userId },
    });

    if (!creation) {
      throw new NotFoundException("User creation not found");
    }

    await this.prisma.userCreation.delete({ where: { id } });

    return { ok: true };
  }

  private serializeCreation(creation: {
    id: string;
    taskId: string;
    title: string | null;
    coverAssetId: string;
    coverAsset: { storageKey: string };
    createdAt: Date;
  }) {
    return {
      id: creation.id,
      task_id: creation.taskId,
      title: creation.title,
      cover_asset_id: creation.coverAssetId,
      cover_storage_key: creation.coverAsset.storageKey,
      cover_url: this.assets.getPublicUrl(creation.coverAsset.storageKey),
      created_at: creation.createdAt,
    };
  }
}
