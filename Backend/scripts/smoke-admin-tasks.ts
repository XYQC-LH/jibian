import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import type { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { AdminTasksService } from "../src/admin/admin-tasks.service";
import type { PrismaService } from "../src/prisma/prisma.service";

type TaskRow = {
  id: string;
  userId: string;
  templateId: string;
  status: string;
  creditCost: number;
  creditStatus: string;
  isVisible: boolean;
  adminDeletedAt: Date | null;
  idempotencyKey: string | null;
  ratio: string;
  errorMessage: string | null;
  createdAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  user: { nickname: string | null; phone: string | null };
  template: { id: string; name: string; category: string };
  sourceRuns: Array<{
    id: string;
    sourceId: string;
    status: string;
    upstreamJobId: string | null;
    latencyMs: number | null;
    costAmount: number | null;
    sourceErrorMessage: string | null;
    createdAt: Date;
  }>;
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

type SmokeState = {
  tasks: TaskRow[];
  creditAccounts: CreditAccountRow[];
  creditLedger: CreditLedgerRow[];
};

const userId = "00000000-0000-4000-8000-000000000501";
const taskId = "00000000-0000-4000-8000-000000000601";

function createTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: taskId,
    userId,
    templateId: "00000000-0000-4000-8000-000000000701",
    status: "failed",
    creditCost: 5,
    creditStatus: "refunded",
    isVisible: false,
    adminDeletedAt: null,
    idempotencyKey: "rerun-smoke",
    ratio: "1:1",
    errorMessage: "source failed",
    createdAt: new Date(Date.now() - 10_000),
    finishedAt: new Date(Date.now() - 1_000),
    durationMs: 9000,
    user: { nickname: "Smoke User", phone: "13800000000" },
    template: { id: "00000000-0000-4000-8000-000000000701", name: "Smoke Template", category: "smoke" },
    sourceRuns: [],
    ...overrides,
  };
}

function createState(balance = 10, taskOverrides: Partial<TaskRow> = {}): SmokeState {
  return {
    tasks: [createTask(taskOverrides)],
    creditAccounts: [{ userId, balance, updatedAt: new Date() }],
    creditLedger: [],
  };
}

class FakeAdminTasksPrisma {
  constructor(private readonly state: SmokeState) {}

  task = {
    count: async (args: { where?: Partial<TaskRow> }) =>
      this.state.tasks.filter((row) => this.matches(row, args.where ?? {})).length,
    findMany: async (args: { where?: Partial<TaskRow>; skip?: number; take?: number }) => {
      const rows = this.state.tasks.filter((row) => this.matches(row, args.where ?? {}));
      return rows.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? rows.length)).map((row) => ({ ...row }));
    },
    findUnique: async (args: { where: { id: string }; include?: unknown }) => {
      const task = this.state.tasks.find((row) => row.id === args.where.id);
      return task ? { ...task } : null;
    },
    update: async (args: { where: { id: string }; data: Partial<TaskRow>; include?: unknown }) => {
      const task = this.required(this.state.tasks.find((row) => row.id === args.where.id), "task");
      Object.assign(task, args.data);
      return { ...task };
    },
    updateMany: async (args: { where: Partial<TaskRow>; data: Partial<TaskRow> }) => {
      let count = 0;
      for (const task of this.state.tasks) {
        if (this.matches(task, args.where)) {
          Object.assign(task, args.data);
          count += 1;
        }
      }
      return { count };
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
    findMany: async () => [],
  };

  reviewRecord = {
    findMany: async () => [],
  };

  userCreation = {
    updateMany: async () => ({ count: 0 }),
  };

  async $transaction<T>(operation: ((tx: this) => Promise<T>) | Array<Promise<T>>): Promise<T | T[]> {
    if (Array.isArray(operation)) {
      return Promise.all(operation);
    }
    return operation(this);
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
  failNextAdd = false;

  async add(_name: string, data: { taskId: string }, options: { jobId?: string }) {
    if (this.failNextAdd) {
      this.failNextAdd = false;
      throw new Error("queue down");
    }
    this.jobs.push(options.jobId ?? data.taskId);
    return { id: options.jobId ?? data.taskId };
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectRejects(action: () => Promise<unknown>, errorType: new (...args: never[]) => Error, message: string) {
  try {
    await action();
  } catch (error: unknown) {
    assert(error instanceof errorType, message);
    return error;
  }
  throw new Error(message);
}

async function main() {
  const successState = createState(10);
  const successQueue = new FakeQueue();
  const successService = new AdminTasksService(
    new FakeAdminTasksPrisma(successState) as unknown as PrismaService,
    successQueue as unknown as Queue,
  );
  const success = await successService.rerun(taskId);
  assert(success.data.status === "running", "rerun should reset the task to running");
  assert(success.data.credits_consumed === 5, "rerun should report charged credits");
  assert(successState.creditAccounts[0].balance === 5, "rerun should charge credits again after prior refund");
  assert(successState.creditLedger.length === 1, "rerun should create one charge ledger");
  assert(successState.creditLedger[0].amount === -5, "rerun charge ledger should be negative");
  assert(successQueue.jobs.length === 1, "rerun should enqueue one generation job");

  const deletedState = createState(10, { isVisible: true });
  const deletedQueue = new FakeQueue();
  const deletedService = new AdminTasksService(
    new FakeAdminTasksPrisma(deletedState) as unknown as PrismaService,
    deletedQueue as unknown as Queue,
  );
  const deleted = await deletedService.remove(taskId);
  assert(deleted.data.deleted === true, "remove should report deleted");
  assert(deletedState.tasks[0].isVisible === false, "remove should hide task result");
  assert(deletedState.tasks[0].adminDeletedAt instanceof Date, "remove should mark adminDeletedAt");
  const deletedList = await deletedService.list({ page: 1, pageSize: 20 });
  assert(deletedList.data.total === 0, "admin-deleted task should be hidden from task list");
  assert(deletedList.data.items.length === 0, "admin-deleted task should not be returned");

  const queueFailureState = createState(10);
  const queueFailureQueue = new FakeQueue();
  queueFailureQueue.failNextAdd = true;
  const queueFailureService = new AdminTasksService(
    new FakeAdminTasksPrisma(queueFailureState) as unknown as PrismaService,
    queueFailureQueue as unknown as Queue,
  );
  await expectRejects(
    () => queueFailureService.rerun(taskId),
    ServiceUnavailableException,
    "queue failure should surface as ServiceUnavailableException",
  );
  assert(queueFailureState.tasks[0].status === "failed", "queue failure should mark task failed");
  assert(queueFailureState.tasks[0].creditStatus === "refunded", "queue failure should refund rerun charge");
  assert(queueFailureState.creditAccounts[0].balance === 10, "queue failure should restore user balance");
  assert(queueFailureState.creditLedger.map((row) => row.amount).join(",") === "-5,5", "queue failure should write charge and refund ledgers");

  const insufficientState = createState(3);
  const insufficientQueue = new FakeQueue();
  const insufficientService = new AdminTasksService(
    new FakeAdminTasksPrisma(insufficientState) as unknown as PrismaService,
    insufficientQueue as unknown as Queue,
  );
  await expectRejects(
    () => insufficientService.rerun(taskId),
    BadRequestException,
    "insufficient balance should reject rerun",
  );
  assert(insufficientState.tasks[0].status === "failed", "insufficient balance should not reset task");
  assert(insufficientState.creditAccounts[0].balance === 3, "insufficient balance should not change balance");
  assert(insufficientState.creditLedger.length === 0, "insufficient balance should not write ledger");
  assert(insufficientQueue.jobs.length === 0, "insufficient balance should not enqueue");

  console.log(JSON.stringify({
    ok: true,
    success: {
      task_status: successState.tasks[0].status,
      credit_status: successState.tasks[0].creditStatus,
      balance: successState.creditAccounts[0].balance,
      ledger: successState.creditLedger.map((row) => row.amount),
      jobs: successQueue.jobs.length,
    },
    deletion: {
      hidden_from_list: deletedList.data.total === 0,
      admin_deleted_at: deletedState.tasks[0].adminDeletedAt?.toISOString(),
    },
    queue_failure: {
      task_status: queueFailureState.tasks[0].status,
      credit_status: queueFailureState.tasks[0].creditStatus,
      balance: queueFailureState.creditAccounts[0].balance,
      ledger: queueFailureState.creditLedger.map((row) => row.amount),
    },
    insufficient_balance: {
      task_status: insufficientState.tasks[0].status,
      balance: insufficientState.creditAccounts[0].balance,
      ledger: insufficientState.creditLedger.length,
      jobs: insufficientQueue.jobs.length,
    },
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
