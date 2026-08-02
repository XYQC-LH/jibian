import { ConfigService } from "@nestjs/config";
import { NotFoundException } from "@nestjs/common";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AssetUrlService } from "../src/assets/asset-url.service";
import { AssetDownloadController } from "../src/assets/asset-download.controller";
import type { AssetsService } from "../src/assets/assets.service";
import type { PrismaService } from "../src/prisma/prisma.service";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const backendRoot = resolve(__dirname, "..");
  const requiredSeedAssets = [
    "close-up-face.webp",
    "street-casual-girl.webp",
    "gufeng-warrior.webp",
    "jimeng-feed-10.webp",
    "jimeng-feed-4.webp",
    "jimeng-feed-5.webp",
    "jimeng-feed-6.webp",
    "jimeng-feed-7.webp",
    "jimeng-feed-8.webp",
    "jimeng-feed-9.webp",
    "jimeng-feed-11.webp",
    "jimeng-feed-12.webp",
  ];

  const missingAssets = requiredSeedAssets.filter((name) => (
    !existsSync(join(backendRoot, "assets", "design", name))
  ));
  assert(missingAssets.length === 0, `missing bundled seed assets: ${missingAssets.join(", ")}`);

  const dockerfile = readFileSync(join(backendRoot, "Dockerfile"), "utf8");
  assert(
    dockerfile.includes("COPY --from=build /app/assets ./assets"),
    "Dockerfile must copy bundled seed assets into the runner image",
  );

  const urls = new AssetUrlService(new ConfigService({
    API_BASE_URL: "https://api.jibian.art/api",
    COS_BUCKET_PRIVATE: "jibian-private",
    COS_REGION: "ap-guangzhou",
    COS_ENDPOINT: "https://cos.ap-guangzhou.myqcloud.com",
    COS_SECRET_ID: "secret-id",
    COS_SECRET_KEY: "secret-key",
    ASSET_UPLOAD_URL_EXPIRES_SECONDS: "900",
    ASSET_READ_URL_EXPIRES_SECONDS: "86400",
  }));
  const seedUrl = urls.getPublicUrl("assets/design/close-up-face.webp");
  assert(
    seedUrl === "https://api.jibian.art/api/assets/mock/assets/design/close-up-face.webp",
    `seed asset should resolve through backend bundled proxy, got ${seedUrl}`,
  );

  const uploadedUrl = urls.getPublicUrl("generated/user-a/output.png");
  const uploadUrl = urls.createUploadUrl("input_image/user-a/source.png");
  assert(
    uploadedUrl.includes("X-Amz-Signature="),
    "uploaded/private assets should still resolve to signed COS URLs when no public base is configured",
  );
  assert(
    uploadedUrl.includes("X-Amz-Expires=86400"),
    "private read URLs should use the longer read expiry rather than the short upload expiry",
  );
  assert(
    uploadUrl.includes("X-Amz-Expires=900"),
    "upload URLs should use the shorter upload expiry",
  );

  const ownRedirect = await captureDownloadRedirect({
    id: "asset-owned",
    ownerUserId: "user-a",
    storageKey: "generated/user-a/output.png",
  }, "user-a", urls);
  assert(ownRedirect.includes("X-Amz-Signature="), "asset owner should be able to download owned asset");

  await expectRejects(
    () => captureDownloadRedirect({
      id: "asset-owned",
      ownerUserId: "user-a",
      storageKey: "generated/user-a/output.png",
    }, "user-b", urls),
    (error) => error instanceof NotFoundException,
    "other users should not be able to download private assets",
  );

  const publicRedirect = await captureDownloadRedirect({
    id: "asset-seed",
    ownerUserId: null,
    storageKey: "assets/design/close-up-face.webp",
  }, "user-b", urls);
  assert(publicRedirect.includes("/api/assets/mock/assets/design/close-up-face.webp"), "bundled public seed assets should remain downloadable");

  console.log(JSON.stringify({
    ok: true,
    bundled_seed_assets: requiredSeedAssets.length,
    seed_url: seedUrl,
    private_asset_signed: uploadedUrl.includes("X-Amz-Signature="),
    private_asset_read_expires_seconds: 86400,
    private_asset_upload_expires_seconds: 900,
    download_auth: {
      owner_allowed: Boolean(ownRedirect),
      other_user_blocked: true,
      public_seed_allowed: Boolean(publicRedirect),
    },
  }, null, 2));
}

type SmokeAsset = {
  id: string;
  ownerUserId: string | null;
  storageKey: string;
};

async function captureDownloadRedirect(asset: SmokeAsset, userId: string, urls: AssetUrlService) {
  const controller = new AssetDownloadController(
    {
      asset: {
        findUnique: async () => asset,
      },
    } as unknown as PrismaService,
    {
      getPublicUrl: (storageKey: string) => urls.getPublicUrl(storageKey),
    } as unknown as AssetsService,
  );
  let redirectUrl = "";
  await controller.download(userId, asset.id, {
    redirect: (_status: number, url: string) => {
      redirectUrl = url;
    },
  } as never);
  return redirectUrl;
}

async function expectRejects(action: () => Promise<unknown>, isExpectedError: (error: unknown) => boolean, message: string) {
  try {
    await action();
  } catch (error: unknown) {
    assert(isExpectedError(error), message);
    return;
  }
  throw new Error(message);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
