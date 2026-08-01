import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  SourceAdapter,
  StandardGenerateInput,
  StandardGenerateOutput,
} from "../contracts/standard-generate.contract";

@Injectable()
export class MockSourceAdapter implements SourceAdapter {
  readonly sourceId = "mock";

  constructor(private readonly prisma: PrismaService) {}

  isConfigured(): boolean {
    return process.env.ALLOW_MOCK_SOURCE === "true";
  }

  async generate(input: StandardGenerateInput): Promise<StandardGenerateOutput> {
    const asset = await this.prisma.asset.create({
      data: {
        assetType: "generated_image",
        storageKey: `mock/generated/${Date.now()}.webp`,
      },
    });

    return {
      ok: true,
      assetId: asset.id,
    };
  }
}
