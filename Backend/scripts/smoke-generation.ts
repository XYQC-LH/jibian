import type { Job, Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import type { AssetsService } from "../src/assets/assets.service";
import type { StandardGenerateInput, StandardGenerateOutput } from "../src/generation/contracts/standard-generate.contract";
import type { SourceAdapterRegistry } from "../src/generation/sources/source-adapter.registry";
import type { ContentModerationService } from "../src/moderation/content-moderation.service";
import type { PricingService } from "../src/pricing/pricing.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { TasksProcessor } from "../src/tasks/tasks.processor";
import { TasksService } from "../src/tasks/tasks.service";

type UserRow = { id: string };
type TemplateRow = {
  id: string;
  name: string;
  category: string;
  prompt: string;
  priceCredits: number;
  resultCount: number;
  status: string;
};
type AssetRow = {
  id: string;
  ownerUserId: string | null;
  assetType: string;
  storageKey: string;
  createdAt: Date;
};
type TaskRow = {
  id: string;
  userId: string;
  templateId: string;
  inputAssetId: string;
  resultAssetId: string | null;
  idempotencyKey: string | null;
  ratio: string;
  status: string;
  expectedResultCount: number;
  creditCost: number;
  creditStatus: string;
  isVisible: boolean;
  errorMessage: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
};
type SourceRunRow = {
  id: string;
  taskId: string;
  sourceId: string;
  status: string;
  upstreamJobId: string | null;
  latencyMs: number | null;
  costAmount: number | null;
  sourceErrorMessage: string | null;
  createdAt: Date;
};
type CreditAccountRow = { userId: string; balance: number; updatedAt: Date };
type CreditLedgerRow = {
  id: string;
  userId: string;
  type: string;
  amount: number;
  refType: string;
  refId: string;
  balanceAfter: number;
  createdAt: Date;
};
type UserCreationRow = {
  id: string;
  userId: string;
  taskId: string;
  coverAssetId: string;
  createdAt: Date;
};
type AnchorRow = {
  id: string;
  resultCount: number;
  anchorDurationSeconds: number;
  createdAt: Date;
  updatedAt: Date;
};
type SettingRow = {
  key: string;
  value: string;
};

type SmokeState = {
  users: UserRow[];
  templates: TemplateRow[];
  assets: AssetRow[];
  tasks: TaskRow[];
  sourceRuns: SourceRunRow[];
  creditAccounts: CreditAccountRow[];
  creditLedger: CreditLedgerRow[];
  userCreations: UserCreationRow[];
  anchors: AnchorRow[];
  settings: SettingRow[];
};

const userId = "00000000-0000-4000-8000-000000000101";
const templateId = "00000000-0000-4000-8000-000000000001";
const inputAssetId = "00000000-0000-4000-8000-000000000201";

function createInitialState(): SmokeState {
  return {
    users: [{ id: userId }],
    templates: [{
      id: templateId,
      name: "Smoke Template",
      category: "smoke",
      prompt: "turn this image into a cinematic avatar",
      priceCredits: 3,
      resultCount: 1,
      status: "published",
    }],
    assets: [{
      id: inputAssetId,
      ownerUserId: userId,
      assetType: "input_image",
      storageKey: "input_image/smoke/source.webp",
      createdAt: new Date(),
    }],
    tasks: [],
    sourceRuns: [],
    creditAccounts: [{ userId, balance: 10, updatedAt: new Date() }],
    creditLedger: [],
    userCreations: [],
    anchors: [],
    settings: [],
  };
}

class FakePrisma {
  failNextTaskCreateWithUnique = false;
  skipNextTaskFindFirst = false;

  constructor(private readonly state: SmokeState) {}

  template = {
    findFirst: async (args: { where: { id: string; status?: string } }) =>
      this.state.templates.find((row) => row.id === args.where.id && (!args.where.status || row.status === args.where.status)) ?? null,
  };

  asset = {
    findFirst: async (args: { where: Partial<AssetRow> }) =>
      this.state.assets.find((row) => this.matches(row, args.where)) ?? null,
    findUnique: async (args: { where: { id: string } }) =>
      this.state.assets.find((row) => row.id === args.where.id) ?? null,
    create: async (args: { data: Partial<AssetRow> & Pick<AssetRow, "assetType" | "storageKey"> }) => {
      const row: AssetRow = {
        id: args.data.id ?? randomUUID(),
        ownerUserId: args.data.ownerUserId ?? null,
        assetType: args.data.assetType,
        storageKey: args.data.storageKey,
        createdAt: new Date(),
      };
      this.state.assets.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: Partial<AssetRow> }) => {
      const row = this.required(this.state.assets.find((item) => item.id === args.where.id), "asset");
      Object.assign(row, args.data);
      return row;
    },
  };

  creditAccount = {
    findUnique: async (args: { where: { userId: string } }) =>
      this.state.creditAccounts.find((row) => row.userId === args.where.userId) ?? null,
    upsert: async (args: {
      where: { userId: string };
      update: { balance: number; updatedAt: Date };
      create: { userId: string; balance: number; updatedAt: Date };
    }) => {
      const existing = this.state.creditAccounts.find((row) => row.userId === args.where.userId);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      this.state.creditAccounts.push(args.create);
      return args.create;
    },
  };

  creditLedger = {
    create: async (args: { data: Omit<CreditLedgerRow, "id" | "createdAt"> }) => {
      const row = { id: randomUUID(), createdAt: new Date(), ...args.data };
      this.state.creditLedger.push(row);
      return row;
    },
  };

  task = {
    findFirst: async (args: { where: Partial<TaskRow> }) => {
      if (this.skipNextTaskFindFirst) {
        this.skipNextTaskFindFirst = false;
        return null;
      }
      return this.state.tasks.find((row) => this.matches(row, args.where)) ?? null;
    },
    findUnique: async (args: { where: { id: string }; include?: { template?: boolean; inputAsset?: boolean; resultAsset?: boolean } }) => {
      const task = this.state.tasks.find((row) => row.id === args.where.id);
      if (!task) return null;
      return this.withTaskIncludes(task, args.include);
    },
    create: async (args: { data: Partial<TaskRow> & Pick<TaskRow, "userId" | "templateId" | "inputAssetId"> }) => {
      if (this.failNextTaskCreateWithUnique) {
        this.failNextTaskCreateWithUnique = false;
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      }

      const now = new Date();
      const row: TaskRow = {
        id: args.data.id ?? randomUUID(),
        userId: args.data.userId,
        templateId: args.data.templateId,
        inputAssetId: args.data.inputAssetId,
        resultAssetId: args.data.resultAssetId ?? null,
        idempotencyKey: args.data.idempotencyKey ?? null,
        ratio: args.data.ratio ?? "1:1",
        status: args.data.status ?? "running",
        expectedResultCount: args.data.expectedResultCount ?? 1,
        creditCost: args.data.creditCost ?? 0,
        creditStatus: args.data.creditStatus ?? "charged",
        isVisible: args.data.isVisible ?? false,
        errorMessage: args.data.errorMessage ?? null,
        createdAt: now,
        finishedAt: null,
        durationMs: null,
      };
      this.state.tasks.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: Partial<TaskRow> }) => {
      const row = this.required(this.state.tasks.find((item) => item.id === args.where.id), "task");
      Object.assign(row, args.data);
      return row;
    },
    updateMany: async (args: { where: Partial<TaskRow>; data: Partial<TaskRow> }) => {
      let count = 0;
      for (const row of this.state.tasks) {
        if (this.matches(row, args.where)) {
          Object.assign(row, args.data);
          count += 1;
        }
      }
      return { count };
    },
  };

  sourceRun = {
    create: async (args: { data: Pick<SourceRunRow, "taskId" | "sourceId" | "status"> }) => {
      const row: SourceRunRow = {
        id: randomUUID(),
        taskId: args.data.taskId,
        sourceId: args.data.sourceId,
        status: args.data.status,
        upstreamJobId: null,
        latencyMs: null,
        costAmount: null,
        sourceErrorMessage: null,
        createdAt: new Date(),
      };
      this.state.sourceRuns.push(row);
      return row;
    },
    update: async (args: { where: { id: string }; data: Partial<SourceRunRow> }) => {
      const row = this.required(this.state.sourceRuns.find((item) => item.id === args.where.id), "sourceRun");
      Object.assign(row, args.data);
      return row;
    },
    updateMany: async (args: { where: Partial<SourceRunRow>; data: Partial<SourceRunRow> }) => {
      let count = 0;
      for (const row of this.state.sourceRuns) {
        if (this.matches(row, args.where)) {
          Object.assign(row, args.data);
          count += 1;
        }
      }
      return { count };
    },
  };

  userCreation = {
    create: async (args: { data: Pick<UserCreationRow, "userId" | "taskId" | "coverAssetId"> }) => {
      const row = { id: randomUUID(), createdAt: new Date(), ...args.data };
      this.state.userCreations.push(row);
      return row;
    },
  };

  generationTimeAnchor = {
    upsert: async (args: {
      where: { resultCount: number };
      update: { anchorDurationSeconds: number; updatedAt: Date };
      create: { resultCount: number; anchorDurationSeconds: number; updatedAt: Date };
    }) => {
      const existing = this.state.anchors.find((row) => row.resultCount === args.where.resultCount);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      const row = { id: randomUUID(), createdAt: new Date(), ...args.create };
      this.state.anchors.push(row);
      return row;
    },
  };

  setting = {
    findUnique: async (args: { where: { key: string } }) =>
      this.state.settings.find((row) => row.key === args.where.key) ?? null,
  };

  async $transaction<T>(operation: ((tx: this) => Promise<T>) | Array<Promise<T>>): Promise<T | T[]> {
    if (Array.isArray(operation)) {
      return Promise.all(operation);
    }
    return operation(this);
  }

  private withTaskIncludes(task: TaskRow, include: { template?: boolean; inputAsset?: boolean; resultAsset?: boolean } | undefined) {
    return {
      ...task,
      ...(include?.template ? { template: this.required(this.state.templates.find((row) => row.id === task.templateId), "template") } : {}),
      ...(include?.inputAsset ? { inputAsset: this.required(this.state.assets.find((row) => row.id === task.inputAssetId), "inputAsset") } : {}),
      ...(include?.resultAsset ? { resultAsset: task.resultAssetId ? this.state.assets.find((row) => row.id === task.resultAssetId) ?? null : null } : {}),
    };
  }

  private matches<T extends Record<string, unknown>>(row: T, where: Partial<T>) {
    return Object.entries(where).every(([key, value]) => value === undefined || row[key] === value);
  }

  private required<T>(value: T | undefined, label: string): T {
    if (!value) {
      throw new Error(`Missing ${label}`);
    }
    return value;
  }
}

class FakeQueue {
  readonly jobs: string[] = [];

  async add(_name: string, data: { taskId: string }, options: { jobId?: string }) {
    this.jobs.push(options.jobId ?? data.taskId);
    return { id: options.jobId ?? data.taskId };
  }
}

class FakeAssets {
  constructor(private readonly prisma: FakePrisma) {}

  getPublicUrl(storageKey: string) {
    return storageKey.startsWith("http") ? storageKey : `https://assets.example.com/${storageKey}`;
  }

  async assertUploaded(_storageKey: string) {
    return;
  }

  async materializeRemoteAsset(assetId: string, ownerUserId: string, signal?: AbortSignal) {
    if (signal?.aborted) {
      throw new Error("Generation request aborted");
    }
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) return null;
    if (!asset.storageKey.startsWith("http")) return asset;
    if (signal?.aborted) {
      throw new Error("Generation request aborted");
    }
    return this.prisma.asset.update({
      where: { id: asset.id },
      data: {
        ownerUserId,
        storageKey: `generated_image/${ownerUserId}/${asset.id}.webp`,
      },
    });
  }
}

class FakeModeration {
  readonly reviewedStages: string[] = [];

  async reviewInputImage() {
    this.reviewedStages.push("input");
    return { passed: true, policyHits: [], reason: null };
  }

  async reviewOutputImage() {
    this.reviewedStages.push("output");
    return { passed: true, policyHits: [], reason: null };
  }
}

class FakePricing {
  multiplier = 1;

  async getGlobalPricingMultiplier() {
    return this.multiplier;
  }

  applyMultiplier(baseCredits: number, multiplier: number) {
    const base = Math.max(0, Math.trunc(Number(baseCredits) || 0));
    if (base === 0) return 0;
    return Math.max(1, Math.ceil(base * multiplier));
  }
}

function createSourceRegistry(prisma: FakePrisma, shouldSucceed: boolean) {
  return {
    getRunnable: async () => [
      {
        sourceId: "source-a",
        isConfigured: () => true,
        generate: async (): Promise<StandardGenerateOutput> => ({
          ok: false,
          errorMessage: "source-a failed",
          upstreamJobId: "upstream-a",
        }),
      },
      {
        sourceId: "source-b",
        isConfigured: () => true,
        generate: async (_input: StandardGenerateInput): Promise<StandardGenerateOutput> => {
          if (!shouldSucceed) {
            return { ok: false, errorMessage: "source-b failed", upstreamJobId: "upstream-b" };
          }
          const asset = await prisma.asset.create({
            data: {
              assetType: "generated_image",
              storageKey: "https://upstream.example.com/generated.webp",
            },
          });
          return { ok: true, assetId: asset.id, upstreamJobId: "upstream-b", costAmount: 0.12 };
        },
      },
    ],
  };
}

function createTimeoutSourceRegistry() {
  return {
    getRunnable: async () => [
      {
        sourceId: "slow-source",
        isConfigured: () => true,
        generate: async (input: StandardGenerateInput): Promise<StandardGenerateOutput> => {
          return new Promise((resolve, reject) => {
            if (input.signal?.aborted) {
              reject(new Error("Generation request aborted"));
              return;
            }

            const timeoutId = setTimeout(() => {
              cleanup();
              resolve({ ok: false, errorMessage: "slow source unexpectedly completed" });
            }, 5000);
            const onAbort = () => {
              clearTimeout(timeoutId);
              cleanup();
              reject(new Error("Generation request aborted"));
            };
            const cleanup = () => input.signal?.removeEventListener("abort", onAbort);
            input.signal?.addEventListener("abort", onAbort, { once: true });
          });
        },
      },
    ],
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const state = createInitialState();
  const prisma = new FakePrisma(state);
  const queue = new FakeQueue();
  const assets = new FakeAssets(prisma);
  const moderation = new FakeModeration();
  const pricing = new FakePricing();
  const tasks = new TasksService(
    prisma as unknown as PrismaService,
    assets as unknown as AssetsService,
    pricing as unknown as PricingService,
    queue as unknown as Queue,
  );

  const created = await tasks.create(userId, {
    template_id: "pearl-portrait",
    input_asset_id: inputAssetId,
    ratio: "3:4",
    idempotency_key: "smoke-success",
  });
  const duplicate = await tasks.create(userId, {
    template_id: "pearl-portrait",
    input_asset_id: inputAssetId,
    ratio: "3:4",
    idempotency_key: "smoke-success",
  });

  assert(created.task_id === duplicate.task_id, "idempotency should return the existing task");
  assert(queue.jobs.length === 1, "duplicate create should not enqueue a second job");
  assert(state.creditAccounts[0].balance === 7, "task creation should charge credits once");

  prisma.skipNextTaskFindFirst = true;
  prisma.failNextTaskCreateWithUnique = true;
  const racedDuplicate = await tasks.create(userId, {
    template_id: "pearl-portrait",
    input_asset_id: inputAssetId,
    ratio: "3:4",
    idempotency_key: "smoke-success",
  });
  assert(racedDuplicate.task_id === created.task_id, "idempotency race should return the existing task");
  assert(queue.jobs.length === 1, "idempotency race should not enqueue a second job");
  assert(state.creditAccounts[0].balance === 7, "idempotency race should not charge credits again");

  const invites = {
    rewardFirstSuccessfulTask: async () => ({ rewarded: false }),
  };

  const successProcessor = new TasksProcessor(
    prisma as unknown as PrismaService,
    createSourceRegistry(prisma, true) as unknown as SourceAdapterRegistry,
    assets as unknown as AssetsService,
    moderation as unknown as ContentModerationService,
    invites as never,
  );
  await successProcessor.process({ data: { taskId: created.task_id } } as Job<{ taskId: string }>);

  const successTask = state.tasks.find((task) => task.id === created.task_id);
  assert(successTask?.status === "succeeded", "task should succeed after fallback source succeeds");
  assert(successTask.resultAssetId, "successful task should store a result asset");
  assert(successTask.isVisible, "successful task should be visible to the user");
  assert(state.sourceRuns.map((run) => run.status).join(",") === "failed,success", "source fallback should record failed then success runs");
  assert(state.userCreations.length === 1, "successful task should create a user creation");
  assert(moderation.reviewedStages.join(",") === "input,output", "task should run input and output moderation");
  assert(!state.assets.find((asset) => asset.id === successTask.resultAssetId)?.storageKey.startsWith("http"), "remote result should be materialized");

  const failing = await tasks.create(userId, {
    template_id: "pearl-portrait",
    input_asset_id: inputAssetId,
    ratio: "1:1",
    idempotency_key: "smoke-failure",
  });
  const failProcessor = new TasksProcessor(
    prisma as unknown as PrismaService,
    createSourceRegistry(prisma, false) as unknown as SourceAdapterRegistry,
    assets as unknown as AssetsService,
    new FakeModeration() as unknown as ContentModerationService,
    invites as never,
  );
  await failProcessor.process({ data: { taskId: failing.task_id } } as Job<{ taskId: string }>);

  const failedTask = state.tasks.find((task) => task.id === failing.task_id);
  assert(failedTask?.status === "failed", "task should fail only after all sources fail");
  assert(failedTask.creditStatus === "refunded", "failed task should refund credits");
  assert(state.creditAccounts[0].balance === 7, "failed task refund should restore the charged credits");

  state.settings.push({ key: "system.task_timeout", value: "1" });
  const timedOut = await tasks.create(userId, {
    template_id: "pearl-portrait",
    input_asset_id: inputAssetId,
    ratio: "1:1",
    idempotency_key: "smoke-timeout",
  });
  const timeoutProcessor = new TasksProcessor(
    prisma as unknown as PrismaService,
    createTimeoutSourceRegistry() as unknown as SourceAdapterRegistry,
    assets as unknown as AssetsService,
    new FakeModeration() as unknown as ContentModerationService,
    invites as never,
  );
  await timeoutProcessor.process({ data: { taskId: timedOut.task_id } } as Job<{ taskId: string }>);

  const timedOutTask = state.tasks.find((task) => task.id === timedOut.task_id);
  const timedOutRun = state.sourceRuns.find((run) => run.taskId === timedOut.task_id);
  assert(timedOutTask?.status === "failed", "timed out task should fail");
  assert(timedOutTask.creditStatus === "refunded", "timed out task should refund credits");
  assert(timedOutTask.errorMessage === "Generation task timed out", "timed out task should keep a timeout error");
  assert(timedOutRun?.status === "failed", "timed out source run should fail");
  assert(timedOutRun.sourceErrorMessage === "Generation task timed out", "timed out source run should keep a timeout error");
  assert(state.creditAccounts[0].balance === 7, "timeout refund should restore the charged credits");

  pricing.multiplier = 2;
  const priced = await tasks.create(userId, {
    template_id: "pearl-portrait",
    input_asset_id: inputAssetId,
    ratio: "1:1",
    idempotency_key: "smoke-priced",
  });
  const pricedTask = state.tasks.find((task) => task.id === priced.task_id);
  assert(pricedTask?.creditCost === 6, "global pricing multiplier should affect charged task credits");
  assert(Number(state.creditAccounts[0].balance) === 1, "pricing multiplier should deduct the effective credit cost");

  console.log(JSON.stringify({
    ok: true,
    tasks: state.tasks.map((task) => ({
      id: task.id,
      status: task.status,
      credit_status: task.creditStatus,
      result_asset_id: task.resultAssetId,
      ratio: task.ratio,
    })),
    source_runs: state.sourceRuns.map((run) => ({
      source_id: run.sourceId,
      status: run.status,
      upstream_job_id: run.upstreamJobId,
    })),
    balance: state.creditAccounts[0].balance,
    ledger: state.creditLedger.map((row) => ({ type: row.type, amount: row.amount, balance_after: row.balanceAfter })),
    user_creations: state.userCreations.length,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
