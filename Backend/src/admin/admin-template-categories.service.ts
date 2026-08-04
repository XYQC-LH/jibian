import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface TemplateCategoryInput {
  name?: string;
  display_name?: string;
  icon?: string;
}

const categorySelect = {
  id: true,
  name: true,
  displayName: true,
  icon: true,
  sortOrder: true,
};

type TemplateCategoryRow = {
  id: string;
  name: string;
  displayName: string;
  icon: string | null;
  sortOrder: number;
  createdAt?: Date | null;
};

@Injectable()
export class AdminTemplateCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const existing = await this.prisma.templateCategory.count();
    if (existing === 0) {
      await this.seedFromTemplates();
    }

    const categories = await this.prisma.templateCategory.findMany({
      select: categorySelect,
      orderBy: [{ sortOrder: "asc" }],
    });

    return {
      success: true,
      data: {
        items: categories.map((category) => this.serialize(category)),
        total: categories.length,
      },
    };
  }

  private async seedFromTemplates() {
    const distinct = await this.prisma.template.findMany({
      where: { category: { not: "" } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    if (distinct.length === 0) {
      return;
    }

    await this.prisma.templateCategory.createMany({
      data: distinct.map((item, index) => ({
        name: item.category,
        displayName: item.category,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
  }

  async create(input: TemplateCategoryInput) {
    const name = String(input.name || "").trim();
    const displayName = String(input.display_name || "").trim();
    if (!name) {
      throw new BadRequestException("name is required");
    }

    const existing = await this.prisma.templateCategory.findUnique({ where: { name } });
    if (existing) {
      throw new BadRequestException("Category already exists");
    }

    const maxOrder = await this.prisma.templateCategory.aggregate({
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;

    const created = await this.prisma.templateCategory.create({
      data: {
        name,
        displayName: displayName || name,
        icon: String(input.icon || "").trim() || null,
        sortOrder: nextOrder,
      },
      select: categorySelect,
    });

    return { success: true, data: this.serialize(created) };
  }

  async update(id: string, input: TemplateCategoryInput) {
    const existing = await this.prisma.templateCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Category not found");
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const name = String(input.name).trim();
      if (!name) {
        throw new BadRequestException("name cannot be empty");
      }
      const conflict = await this.prisma.templateCategory.findFirst({
        where: { name, id: { not: id } },
      });
      if (conflict) {
        throw new BadRequestException("Category already exists");
      }
      data.name = name;
    }
    if (input.display_name !== undefined) {
      const displayName = String(input.display_name).trim();
      data.displayName = displayName || String(input.name || existing.name).trim();
    }
    if (input.icon !== undefined) {
      data.icon = String(input.icon).trim() || null;
    }

    const updated = await this.prisma.templateCategory.update({
      where: { id },
      data,
      select: categorySelect,
    });

    return { success: true, data: this.serialize(updated) };
  }

  async remove(id: string) {
    const existing = await this.prisma.templateCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("Category not found");
    }

    await this.prisma.templateCategory.delete({ where: { id } });
    return { success: true, data: { deleted: true } };
  }

  async reorder(items: Array<{ id: string; order: number }>) {
    let updatedCount = 0;
    for (const item of Array.isArray(items) ? items : []) {
      const id = String(item.id || "").trim();
      const order = Number(item.order);
      if (!id || !Number.isFinite(order)) continue;
      const result = await this.prisma.templateCategory.updateMany({
        where: { id },
        data: { sortOrder: Math.max(0, Math.trunc(order)) },
      });
      updatedCount += result.count;
    }
    return { success: true, data: { updated: updatedCount } };
  }

  private serialize(category: TemplateCategoryRow) {
    return {
      id: category.id,
      name: category.name,
      display_name: category.displayName,
      icon: category.icon,
      sort_order: category.sortOrder,
      created_at: category.createdAt ? category.createdAt.toISOString() : null,
    };
  }
}
