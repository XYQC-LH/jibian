import type { Template } from "@prisma/client";
import { ModelManagementService } from "../src/admin/model-management.service";
import type { AssetsService } from "../src/assets/assets.service";
import type { PricingService } from "../src/pricing/pricing.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import type { TemplatesService } from "../src/templates/templates.service";

const templateId = "00000000-0000-4000-8000-000000000801";

const template: Template = {
  id: templateId,
  name: "Smoke Template",
  category: "smoke",
  coverAssetId: null,
  prompt: "smoke prompt",
  priceCredits: 3,
  resultCount: 1,
  sortOrder: 1,
  status: "published",
};

const taskRows = [
  { templateId },
  { templateId },
];

const sourceRuns = [
  { sourceId: "source-a", costAmount: 0.1, task: { templateId } },
  { sourceId: "source-a", costAmount: 0.3, task: { templateId } },
  { sourceId: "source-b", costAmount: 0.5, task: { templateId } },
];

class FakeModelPrisma {
  template = {
    count: async () => 1,
    findMany: async () => [template],
    findUnique: async (args: { where: { id: string } }) => args.where.id === template.id ? template : null,
  };

  task = {
    findMany: async () => taskRows,
    count: async () => taskRows.length,
  };

  asset = {
    findMany: async () => [],
    findUnique: async () => null,
  };

  sourceRun = {
    findMany: async () => sourceRuns,
  };

  async $transaction<T>(operations: Array<Promise<T>>): Promise<T[]> {
    return Promise.all(operations);
  }
}

class FakePricing {
  async getGlobalPricingMultiplier() {
    return 2;
  }

  applyMultiplier(baseCredits: number, multiplier: number) {
    return Math.ceil(baseCredits * multiplier);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const service = new ModelManagementService(
    new FakeModelPrisma() as unknown as PrismaService,
    {} as TemplatesService,
    { getPublicUrl: (storageKey: string) => `https://assets.example.com/${storageKey}` } as AssetsService,
    new FakePricing() as unknown as PricingService,
  );

  const list = await service.list({ page: 1, pageSize: 20 });
  const model = list.data.items[0];
  assert(model.base_credits_cost === 3, "model list should keep base credit cost");
  assert(model.credits_cost === 6, "model list should expose effective credit cost");
  assert(model.usage_count === 2, "model list should count task usage");

  const observations = await service.getPricingObservations();
  const observation = observations.data.items[0];
  assert(observation.base_credits_cost === 3, "pricing observation should include base credits");
  assert(observation.global_pricing_multiplier === 2, "pricing observation should include global multiplier");
  assert(observation.specs[0].matched_source_costs_cny["source-a"] === 0.2, "pricing observation should average source costs");
  assert(observation.specs[0].min_upstream_cost_cny === 0.2, "pricing observation should include min upstream cost");
  assert(observation.specs[0].max_upstream_cost_cny === 0.5, "pricing observation should include max upstream cost");

  const pricing = await service.getModelPricing(templateId);
  assert(pricing.data.pricing_observation?.model_id === templateId, "single model pricing should include observation");

  console.log(JSON.stringify({
    ok: true,
    model: {
      base_credits_cost: model.base_credits_cost,
      credits_cost: model.credits_cost,
      usage_count: model.usage_count,
    },
    observation: {
      model_id: observation.model_id,
      source_costs: observation.specs[0].matched_source_costs_cny,
      min_cost: observation.specs[0].min_upstream_cost_cny,
      max_cost: observation.specs[0].max_upstream_cost_cny,
    },
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
