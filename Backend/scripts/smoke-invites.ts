import { randomUUID } from "node:crypto";
import { INVITE_REWARD_CREDITS, InvitesService } from "../src/invites/invites.service";
import { PrismaService } from "../src/prisma/prisma.service";

type UserRow = {
  id: string;
  inviteCode: string | null;
  nickname: string | null;
  phone: string | null;
};

type InviteRelationRow = {
  id: string;
  inviterId: string;
  inviteeId: string;
  status: string;
  rewardCredits: number;
  rewardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TaskRow = {
  id: string;
  userId: string;
  status: string;
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

class FakeInvitesPrisma {
  readonly users: UserRow[] = [];
  readonly inviteRelations: InviteRelationRow[] = [];
  readonly tasks: TaskRow[] = [];
  readonly creditAccounts: CreditAccountRow[] = [];
  readonly creditLedgerRows: CreditLedgerRow[] = [];

  user = {
    findUnique: async (args: { where: { id?: string; inviteCode?: string } }) =>
      this.users.find((row) => (
        (args.where.id ? row.id === args.where.id : true) &&
        (args.where.inviteCode ? row.inviteCode === args.where.inviteCode : true)
      )) ?? null,
    updateMany: async (args: {
      where: { id: string; inviteCode: null };
      data: { inviteCode: string };
    }) => {
      if (this.users.some((row) => row.inviteCode === args.data.inviteCode)) {
        throw Object.assign(new Error("unique invite code"), { code: "P2002" });
      }
      const row = this.users.find((item) => item.id === args.where.id && item.inviteCode === null);
      if (!row) {
        return { count: 0 };
      }
      row.inviteCode = args.data.inviteCode;
      return { count: 1 };
    },
  };

  inviteRelation = {
    count: async (args?: { where?: Partial<InviteRelationRow> & { createdAt?: { gte?: Date }; rewardedAt?: { gte?: Date } } }) =>
      this.inviteRelations.filter((row) => this.matchesRelation(row, args?.where)).length,
    aggregate: async (args: { where?: Partial<InviteRelationRow> & { rewardedAt?: { gte?: Date } }; _sum: { rewardCredits: true } }) => ({
      _sum: {
        rewardCredits: this.inviteRelations
          .filter((row) => this.matchesRelation(row, args.where))
          .reduce((sum, row) => sum + row.rewardCredits, 0),
      },
    }),
    findUnique: async (args: { where: { inviteeId: string }; select?: { id?: boolean } }) => {
      const row = this.inviteRelations.find((item) => item.inviteeId === args.where.inviteeId) ?? null;
      if (row && args.select?.id) {
        return { id: row.id };
      }
      return row;
    },
    create: async (args: { data: { inviterId: string; inviteeId: string; rewardCredits: number; updatedAt: Date } }) => {
      if (this.inviteRelations.some((row) => row.inviteeId === args.data.inviteeId)) {
        throw Object.assign(new Error("unique invitee"), { code: "P2002" });
      }
      const now = new Date();
      const row: InviteRelationRow = {
        id: randomUUID(),
        inviterId: args.data.inviterId,
        inviteeId: args.data.inviteeId,
        status: "bound",
        rewardCredits: args.data.rewardCredits,
        rewardedAt: null,
        createdAt: now,
        updatedAt: args.data.updatedAt,
      };
      this.inviteRelations.push(row);
      return row;
    },
    updateMany: async (args: {
      where: { id: string; status: string };
      data: { status: string; rewardedAt: Date; updatedAt: Date };
    }) => {
      const row = this.inviteRelations.find((item) => (
        item.id === args.where.id && item.status === args.where.status
      ));
      if (!row) {
        return { count: 0 };
      }
      Object.assign(row, args.data);
      return { count: 1 };
    },
  };

  task = {
    count: async (args: { where: { userId: string; status: string; id?: { not: string } } }) =>
      this.tasks.filter((row) => (
        row.userId === args.where.userId &&
        row.status === args.where.status &&
        (!args.where.id?.not || row.id !== args.where.id.not)
      )).length,
  };

  creditAccount = {
    upsert: async (args: {
      where: { userId: string };
      update: { balance: { increment: number }; updatedAt: Date };
      create: CreditAccountRow;
    }) => {
      const existing = this.creditAccounts.find((row) => row.userId === args.where.userId);
      if (existing) {
        existing.balance += args.update.balance.increment;
        existing.updatedAt = args.update.updatedAt;
        return existing;
      }
      this.creditAccounts.push(args.create);
      return args.create;
    },
  };

  creditLedger = {
    create: async (args: { data: Omit<CreditLedgerRow, "id" | "createdAt"> }) => {
      const row = { id: randomUUID(), createdAt: new Date(), ...args.data };
      this.creditLedgerRows.push(row);
      return row;
    },
  };

  async $transaction<T>(operation: (tx: this) => Promise<T>) {
    return operation(this);
  }

  private matchesRelation(
    row: InviteRelationRow,
    where?: Partial<InviteRelationRow> & { createdAt?: { gte?: Date }; rewardedAt?: { gte?: Date } },
  ) {
    if (!where) return true;
    if (where.inviterId && row.inviterId !== where.inviterId) return false;
    if (where.inviteeId && row.inviteeId !== where.inviteeId) return false;
    if (where.status && row.status !== where.status) return false;
    if (where.createdAt?.gte && row.createdAt < where.createdAt.gte) return false;
    if (where.rewardedAt?.gte && (!row.rewardedAt || row.rewardedAt < where.rewardedAt.gte)) return false;
    return true;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createUser(prisma: FakeInvitesPrisma, inviteCode: string | null = null) {
  const user = {
    id: randomUUID(),
    inviteCode,
    nickname: null,
    phone: null,
  };
  prisma.users.push(user);
  return user;
}

async function main() {
  const prisma = new FakeInvitesPrisma();
  const service = new InvitesService(prisma as unknown as PrismaService);

  const inviter = createUser(prisma);
  const invitee = createUser(prisma);
  const inviteCode = await service.ensureInviteCode(inviter.id);
  assert(/^JB[A-Z2-9]{8}$/.test(inviteCode), `unexpected invite code format: ${inviteCode}`);

  const invalid = await service.tryBindByCode(invitee.id, "JBUNKNOWN0");
  assert(invalid.status === "invalid", "unknown invite code should be invalid");

  const selfInvite = await service.tryBindByCode(inviter.id, inviteCode);
  assert(selfInvite.status === "ignored" && selfInvite.reason === "self_invite", "self invite should be ignored");

  const bound = await service.tryBindByCode(invitee.id, inviteCode);
  assert(bound.status === "bound", "invitee should bind inviter code");
  assert(prisma.inviteRelations.length === 1, "bind should create one invite relation");

  const duplicate = await service.tryBindByCode(invitee.id, inviteCode);
  assert(duplicate.status === "ignored", "duplicate binding should be ignored");

  const lateInvitee = createUser(prisma);
  prisma.tasks.push({ id: randomUUID(), userId: lateInvitee.id, status: "succeeded" });
  const lateBind = await service.tryBindByCode(lateInvitee.id, inviteCode);
  assert(lateBind.status === "ignored" && lateBind.reason === "not_eligible", "successful users should not bind inviter");

  const taskId = randomUUID();
  prisma.tasks.push({ id: taskId, userId: invitee.id, status: "succeeded" });
  const reward = await service.rewardFirstSuccessfulTask(prisma as never, invitee.id, taskId);
  assert(reward.rewarded, "first successful task should reward invite relation");
  assert(prisma.creditAccounts.find((row) => row.userId === inviter.id)?.balance === INVITE_REWARD_CREDITS, "inviter should receive reward");
  assert(prisma.creditAccounts.find((row) => row.userId === invitee.id)?.balance === INVITE_REWARD_CREDITS, "invitee should receive reward");
  assert(prisma.creditLedgerRows.length === 2, "reward should write two credit ledger rows");
  assert(prisma.inviteRelations[0].status === "rewarded", "relation should be marked rewarded");

  const secondTaskId = randomUUID();
  prisma.tasks.push({ id: secondTaskId, userId: invitee.id, status: "succeeded" });
  const secondReward = await service.rewardFirstSuccessfulTask(prisma as never, invitee.id, secondTaskId);
  assert(!secondReward.rewarded, "later successful tasks should not reward again");
  assert(prisma.creditLedgerRows.length === 2, "repeat reward should not create extra ledger rows");

  const stats = await service.getMine(inviter.id);
  assert(stats.invite_count === 1, "stats should count invites");
  assert(stats.rewarded_count === 1, "stats should count rewarded invites");
  assert(stats.credits_earned === INVITE_REWARD_CREDITS, "stats should sum inviter credits earned");

  console.log(JSON.stringify({
    ok: true,
    invite_code: inviteCode,
    relation_status: prisma.inviteRelations[0].status,
    inviter_balance: prisma.creditAccounts.find((row) => row.userId === inviter.id)?.balance,
    invitee_balance: prisma.creditAccounts.find((row) => row.userId === invitee.id)?.balance,
    ledger_rows: prisma.creditLedgerRows.length,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
