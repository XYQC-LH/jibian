import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { ContentModerationService } from "../src/moderation/content-moderation.service";
import { PrismaService } from "../src/prisma/prisma.service";

async function main() {
  const prisma = {
    reviewRecord: {
      create: async () => undefined,
    },
  } as unknown as PrismaService;
  const moderation = new ContentModerationService(prisma, new ConfigService(process.env));
  const imageUrl = process.env.SMOKE_MODERATION_IMAGE_URL || "https://gw.alipayobjects.com/zos/rmsportal/ODTLcjxAfvqbxHnVXCYX.png";
  const taskId = randomUUID();

  const input = await moderation.reviewInputImage(taskId, imageUrl);
  const output = await moderation.reviewOutputImage(taskId, imageUrl);

  console.log(JSON.stringify({
    ok: input.passed && output.passed,
    input,
    output,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
