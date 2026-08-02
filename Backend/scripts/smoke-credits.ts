import { BadRequestException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CreditsService } from "../src/credits/credits.service";

type RedeemCodeRow = {
  id: string;
  code: string;
  amount: number;
  status: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
};

type CreditAccountRow = {
  userId: string;
  balance: number;
  updatedAt: Date;
};

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

class FakeCreditsPrisma {
  lockCalls = 0;
  readonly redeemCodes: RedeemCodeRow[] = [];
  readonly creditAccounts: CreditAccountRow[] = [];
  readonly ledgerRows: CreditLedgerRow[] = [];

  $transaction = async <T>(callback: (tx: FakeCreditsPrisma) => Promise<T>) => callback(this);

  $executeRaw = async () => {
    this.lockCalls += 1;
    return 1;
  };

  redeemCode = {
    findUnique: async (args: { where: { code: string } }) =>
      this.redeemCodes.find((row) => row.code === args.where.code) ?? null,
    updateMany: async (args: {
      where: { id: string; usedCount: { lt: number } };
      data: { usedCount: { increment: number } };
    }) => {
      const row = this.redeemCodes.find((item) => item.id === args.where.id);
      if (!row || row.usedCount >= args.where.usedCount.lt) {
        return { count: 0 };
      }
      row.usedCount += args.data.usedCount.increment;
      return { count: 1 };
    },
  };

  creditAccount = {
    findUnique: async (args: { where: { userId: string } }) =>
      this.creditAccounts.find((row) => row.userId === args.where.userId) ?? null,
    upsert: async (args: {
      where: { userId: string };
      update: { balance: number; updatedAt: Date };
      create: CreditAccountRow;
    }) => {
      const existing = this.creditAccounts.find((row) => row.userId === args.where.userId);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }
      this.creditAccounts.push(args.create);
      return args.create;
    },
  };

  creditLedger = {
    findFirst: async (args: { where: { userId: string; refType: string; refId: string } }) =>
      this.ledgerRows.find((row) => (
        row.userId === args.where.userId &&
        row.refType === args.where.refType &&
        row.refId === args.where.refId
      )) ?? null,
    create: async (args: { data: Omit<CreditLedgerRow, "id" | "createdAt"> }) => {
      const row = { id: randomUUID(), createdAt: new Date(), ...args.data };
      this.ledgerRows.push(row);
      return row;
    },
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
  const prisma = new FakeCreditsPrisma();
  const service = new CreditsService(prisma as never);
  const codeId = randomUUID();
  prisma.redeemCodes.push({
    id: codeId,
    code: "JIBIAN2026",
    amount: 30,
    status: "active",
    maxUses: 1,
    usedCount: 0,
    expiresAt: null,
  });

  const first = await service.redeem("user-a", " JIBIAN2026 ");
  assert(first.balance === 30, "first redeem should add credits");
  assert(prisma.redeemCodes[0].usedCount === 1, "redeem should increment usage count atomically");
  assert(prisma.lockCalls === 1, "redeem should acquire transaction advisory lock");

  await expectBadRequest(
    () => service.redeem("user-a", "JIBIAN2026"),
    "already used",
  );
  await expectBadRequest(
    () => service.redeem("user-b", "JIBIAN2026"),
    "exhausted",
  );

  console.log(JSON.stringify({
    ok: true,
    balance: first.balance,
    used_count: prisma.redeemCodes[0].usedCount,
    lock_calls: prisma.lockCalls,
    ledger_rows: prisma.ledgerRows.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
