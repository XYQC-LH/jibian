import { BadRequestException } from "@nestjs/common";
import { AdminSettingsService } from "../src/admin/admin-settings.service";

type SettingRow = {
  key: string;
  value: string;
};

class FakeSettingsPrisma {
  readonly rows: SettingRow[] = [];

  setting = {
    findUnique: async (args: { where: { key: string } }) =>
      this.rows.find((row) => row.key === args.where.key) ?? null,
    findMany: async (args: { where: { key: { in: string[] } } }) =>
      this.rows.filter((row) => args.where.key.in.includes(row.key)),
    upsert: async (args: { where: { key: string }; update: { value: string }; create: SettingRow }) => {
      const existing = this.rows.find((row) => row.key === args.where.key);
      if (existing) {
        existing.value = args.update.value;
        return existing;
      }
      this.rows.push(args.create);
      return args.create;
    },
  };

  $transaction = async <T>(operations: Array<Promise<T>>) => Promise.all(operations);
}

class FakeGenerationQueue {
  globalConcurrency: number | null = null;
  setCalls = 0;

  setGlobalConcurrency = async (concurrency: number) => {
    this.globalConcurrency = concurrency;
    this.setCalls += 1;
    return 1;
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectBadRequest(action: () => Promise<unknown>, includes: string) {
  try {
    await action();
  } catch (error) {
    assert(error instanceof BadRequestException, `expected BadRequestException for ${includes}`);
    assert(String(error.message).includes(includes), `expected message to include ${includes}`);
    return;
  }
  throw new Error(`expected action to fail with ${includes}`);
}

async function main() {
  const prisma = new FakeSettingsPrisma();
  const queue = new FakeGenerationQueue();
  const service = new AdminSettingsService(prisma as never, queue as never);

  const defaults = await service.getSystemConfig();
  assert(defaults.data.max_concurrent_tasks === 10, "default max_concurrent_tasks should be 10");
  assert(defaults.data.task_timeout === 300, "default task_timeout should be 300");
  assert(defaults.data.cleanup_interval === 3600, "default cleanup_interval should be 3600");

  const updated = await service.updateSystemConfig({
    max_concurrent_tasks: 4,
    task_timeout: 600,
    cleanup_interval: 1800,
  });
  assert(updated.data.max_concurrent_tasks === 4, "updated max_concurrent_tasks should persist");
  assert(updated.data.task_timeout === 600, "updated task_timeout should persist");
  assert(updated.data.cleanup_interval === 1800, "updated cleanup_interval should persist");
  assert(prisma.rows.length === 3, "only provided fields should be written");
  assert(queue.globalConcurrency === 4, "max_concurrent_tasks should update BullMQ global concurrency");
  assert(queue.setCalls === 1, "global concurrency should be updated once for explicit max_concurrent_tasks changes");

  await expectBadRequest(
    () => service.updateSystemConfig({ task_timeout: 0 }),
    "task_timeout",
  );
  await expectBadRequest(
    () => service.updateSystemConfig({ unsupported: true }),
    "No supported",
  );

  console.log(JSON.stringify({
    ok: true,
    defaults: defaults.data,
    updated: updated.data,
    written_settings: prisma.rows.length,
    queue_concurrency: queue.globalConcurrency,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
