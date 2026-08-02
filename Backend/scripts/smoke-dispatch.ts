import {
  aggregateSourceStats,
  classifySourceError,
  mapTaskRequestItem,
  taskErrorCode,
  type TaskRequestSource,
} from "../src/admin/admin-dispatch.service";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const task: TaskRequestSource = {
  id: "00000000-0000-4000-8000-000000000901",
  userId: "00000000-0000-4000-8000-000000000902",
  templateId: "00000000-0000-4000-8000-000000000903",
  inputAssetId: "00000000-0000-4000-8000-000000000904",
  expectedResultCount: 1,
  isVisible: false,
  status: "failed",
  creditCost: 3,
  creditStatus: "refunded",
  errorMessage: "upstream request timed out",
  createdAt: new Date("2026-08-02T00:00:00.000Z"),
  finishedAt: new Date("2026-08-02T00:00:10.000Z"),
  durationMs: 10000,
  ratio: "1:1",
  idempotencyKey: "dispatch-smoke",
  user: { nickname: "Smoke User", phone: "13800000000" },
  template: { id: "00000000-0000-4000-8000-000000000903", name: "Smoke Template", category: "smoke" },
  sourceRuns: [{
    id: "00000000-0000-4000-8000-000000000905",
    sourceId: "source-a",
    status: "failed",
    upstreamJobId: "upstream-a",
    latencyMs: 10000,
    costAmount: null,
    sourceErrorMessage: "429 rate limit",
    createdAt: new Date("2026-08-02T00:00:01.000Z"),
  }],
};

const item = mapTaskRequestItem(task);
assert(classifySourceError("401 unauthorized api key") === "auth", "auth errors should be classified");
assert(taskErrorCode(task) === "timeout", "task-level error should drive task error code");
assert(item.trace_id === task.id, "dispatch item should expose trace_id");
assert(item.error_code === "timeout", "dispatch item should expose classified error_code");

const sourceStats = aggregateSourceStats(
  [
    { sourceId: "source-a", status: "failed" },
    { sourceId: "source-a", status: "success" },
    { sourceId: "source-b", status: "success" },
  ],
  "model-a",
);
assert(sourceStats.find((row) => row.source_id === "source-a")?.success_rate === 50, "source success rate should be aggregated");

console.log(JSON.stringify({
  ok: true,
  item: {
    trace_id: item.trace_id,
    error_code: item.error_code,
    credits_refunded: item.credits_cost === 0,
  },
  source_stats: sourceStats,
}, null, 2));
