import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

interface TemplateSeedItem {
  id: string;
  name: string;
  category: string;
  price: number;
  cover: string;
  description: string;
}

const templateSeedItems: TemplateSeedItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "清透珠光写真",
    category: "写真",
    price: 6,
    cover: "assets/design/close-up-face.webp",
    description: "把普通自拍变成清透、有珠光质感的人像写真。",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "男友感街拍",
    category: "风格",
    price: 5,
    cover: "assets/design/street-casual-girl.webp",
    description: "换成自然街拍氛围，适合朋友圈和小红书封面。",
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "古风氛围照",
    category: "角色",
    price: 6,
    cover: "assets/design/gufeng-warrior.webp",
    description: "一张照片变成带故事感的古风人物照。",
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "私房写真",
    category: "写真",
    price: 6,
    cover: "assets/design/jimeng-feed-10.webp",
    description: "偏柔和、私密、氛围感强的人像写真效果。",
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    name: "日系清新",
    category: "风格",
    price: 5,
    cover: "assets/design/jimeng-feed-4.webp",
    description: "让自拍呈现更轻盈、干净的日系生活感。",
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    name: "复古胶片",
    category: "风格",
    price: 4,
    cover: "assets/design/jimeng-feed-5.webp",
    description: "套上复古胶片色调，让照片更有故事感。",
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    name: "梦幻光晕",
    category: "场景",
    price: 4,
    cover: "assets/design/jimeng-feed-6.webp",
    description: "加上柔光和光晕氛围，适合甜美头像和封面。",
  },
  {
    id: "00000000-0000-4000-8000-000000000008",
    name: "电影质感",
    category: "写真",
    price: 5,
    cover: "assets/design/jimeng-feed-7.webp",
    description: "把人物照变成更有镜头感的电影截图效果。",
  },
  {
    id: "00000000-0000-4000-8000-000000000009",
    name: "森系人像",
    category: "头像",
    price: 4,
    cover: "assets/design/jimeng-feed-8.webp",
    description: "自然、轻氧、适合社交头像的森系人像。",
  },
  {
    id: "00000000-0000-4000-8000-000000000010",
    name: "城市夜景",
    category: "场景",
    price: 4,
    cover: "assets/design/jimeng-feed-9.webp",
    description: "把照片带入夜景街区，适合朋友圈氛围图。",
  },
  {
    id: "00000000-0000-4000-8000-000000000011",
    name: "光影人像",
    category: "头像",
    price: 5,
    cover: "assets/design/jimeng-feed-11.webp",
    description: "强化面部光影和质感，变成更精致的社交主图。",
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    name: "暗调质感",
    category: "节日",
    price: 4,
    cover: "assets/design/jimeng-feed-12.webp",
    description: "偏暗调、强质感的人像效果，适合个性化展示。",
  },
];

const localTemplateIdsByUuid = new Map([
  ["00000000-0000-4000-8000-000000000001", "pearl-portrait"],
  ["00000000-0000-4000-8000-000000000002", "street-boyfriend"],
  ["00000000-0000-4000-8000-000000000003", "gufeng-mood"],
  ["00000000-0000-4000-8000-000000000004", "private-photo"],
  ["00000000-0000-4000-8000-000000000005", "japanese-clean"],
  ["00000000-0000-4000-8000-000000000006", "vintage-film"],
  ["00000000-0000-4000-8000-000000000007", "dream-glow"],
  ["00000000-0000-4000-8000-000000000008", "cinematic-portrait"],
  ["00000000-0000-4000-8000-000000000009", "forest-avatar"],
  ["00000000-0000-4000-8000-000000000010", "city-night"],
  ["00000000-0000-4000-8000-000000000011", "light-shadow"],
  ["00000000-0000-4000-8000-000000000012", "dark-texture"],
]);

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword) {
    throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD are required");
  }

  await prisma.adminUser.upsert({
    where: { username: adminUsername },
    update: {
      passwordHash: await hash(adminPassword, 12),
      envSyncedAt: now,
    },
    create: {
      username: adminUsername,
      passwordHash: await hash(adminPassword, 12),
      envSyncedAt: now,
    },
  });

  const cover = await prisma.asset.upsert({
    where: { storageKey: "seed/templates/portrait-cover.webp" },
    update: {},
    create: {
      assetType: "template_cover",
      storageKey: "seed/templates/portrait-cover.webp",
    },
  });

  await prisma.template.upsert({
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: {
      name: "即变人物写真",
      category: "portrait",
      coverAssetId: cover.id,
      prompt: "将用户上传的人物照片转换为克制、自然、可发布的人物写真风格图片。",
      priceCredits: 12,
      resultCount: 1,
      sortOrder: 1,
      status: "published",
    },
    create: {
      id: "00000000-0000-0000-0000-000000000101",
      name: "即变人物写真",
      category: "portrait",
      coverAssetId: cover.id,
      prompt: "将用户上传的人物照片转换为克制、自然、可发布的人物写真风格图片。",
      priceCredits: 12,
      resultCount: 1,
      sortOrder: 1,
      status: "published",
    },
  });

  for (const [index, item] of templateSeedItems.entries()) {
    const coverAsset = await prisma.asset.upsert({
      where: { storageKey: item.cover },
      update: { assetType: "template_cover" },
      create: {
        assetType: "template_cover",
        storageKey: item.cover,
      },
    });

    await prisma.template.upsert({
      where: { id: item.id },
      update: {
        name: item.name,
        category: item.category,
        prompt: item.description,
        priceCredits: item.price,
        resultCount: 1,
        sortOrder: index,
        status: "published",
        coverAssetId: coverAsset.id,
      },
      create: {
        id: item.id,
        name: item.name,
        category: item.category,
        prompt: item.description,
        priceCredits: item.price,
        resultCount: 1,
        sortOrder: index,
        status: "published",
        coverAssetId: coverAsset.id,
      },
    });
  }

  console.log(
    `Seeded ${templateSeedItems.length} local templates: ${[...localTemplateIdsByUuid.values()].join(", ")}`,
  );

  await prisma.generationTimeAnchor.upsert({
    where: { resultCount: 1 },
    update: { anchorDurationSeconds: 30, updatedAt: now },
    create: { resultCount: 1, anchorDurationSeconds: 30, updatedAt: now },
  });

  await prisma.redeemCode.upsert({
    where: { code: "JIBIAN2026" },
    update: { amount: 30, status: "active", maxUses: 100 },
    create: { code: "JIBIAN2026", amount: 30, status: "active", maxUses: 100 },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
