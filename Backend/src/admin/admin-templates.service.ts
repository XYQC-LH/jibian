import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatistics() {
    const [total, published, totalUsage] = await Promise.all([
      this.prisma.template.count(),
      this.prisma.template.count({ where: { status: "published" } }),
      this.prisma.task.count(),
    ]);

    return {
      success: true,
      data: {
        total,
        published,
        offline: Math.max(0, total - published),
        total_usage: totalUsage,
      },
    };
  }
}
