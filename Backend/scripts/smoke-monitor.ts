import type { Queue } from "bullmq";
import { AdminMonitorController } from "../src/admin/admin-monitor.controller";
import type { PrismaService } from "../src/prisma/prisma.service";

class FakeQueue {
  async getJobCounts() {
    return { waiting: 1, delayed: 2, active: 3, paused: 0 };
  }

  async getGlobalConcurrency() {
    return 4;
  }

  async setGlobalConcurrency() {
    return;
  }
}

class FakePrisma {
  setting = {
    upsert: async () => ({}),
  };

  async $queryRawUnsafe() {
    return [{ count: 2 }];
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const controller = new AdminMonitorController(
    new FakeQueue() as unknown as Queue,
    new FakePrisma() as unknown as PrismaService,
  );

  const snapshot = await controller.snapshot();
  const data = snapshot.data;
  assert(data.containers.queue_size === 6, "monitor should include queue size");
  assert(data.system.db_connections === 2, "monitor should include database connections");
  assert(typeof data.network.bytes_sent_mb === "number", "monitor should include network sent MB");
  assert(typeof data.network.bytes_recv_mb === "number", "monitor should include network received MB");
  assert(typeof data.network.active_connections === "number", "monitor should include active connections");
  assert(typeof data.disk.read_bytes_mb === "number", "monitor should include disk read MB");
  assert(typeof data.disk.write_bytes_mb === "number", "monitor should include disk write MB");
  assert(typeof data.processes.current_process_cpu === "number", "monitor should include current process CPU");

  const trend = await controller.recent();
  assert(trend.data.length === 2, "recent monitor endpoint should return trend points");
  assert(trend.data[1].queue_size === 6, "trend point should include queue size");

  console.log(JSON.stringify({
    ok: true,
    queue_size: data.containers.queue_size,
    db_connections: data.system.db_connections,
    network: {
      bytes_sent_mb: data.network.bytes_sent_mb,
      bytes_recv_mb: data.network.bytes_recv_mb,
      active_connections: data.network.active_connections,
      total_connections: data.network.total_connections,
    },
    disk: {
      read_bytes_mb: data.disk.read_bytes_mb,
      write_bytes_mb: data.disk.write_bytes_mb,
    },
    current_process_cpu: data.processes.current_process_cpu,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
