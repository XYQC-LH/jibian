import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { WechatAuthService } from "../src/auth/wechat-auth.service";
import { PrismaService } from "../src/prisma/prisma.service";

type UserRow = {
  id: string;
  openid: string;
  unionid: string | null;
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
};

class FakeAuthPrisma {
  readonly users: UserRow[] = [];
  readonly creditAccounts: CreditAccountRow[] = [];
  readonly ledgerRows: CreditLedgerRow[] = [];

  constructor(private readonly registrationBonus: string | null) {}

  user = {
    upsert: async (args: {
      where: { openid: string };
      update: Partial<UserRow>;
      create: { openid: string; unionid?: string };
    }) => {
      const existing = this.users.find((row) => row.openid === args.where.openid);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }

      const created: UserRow = {
        id: randomUUID(),
        openid: args.create.openid,
        unionid: args.create.unionid ?? null,
        status: "active",
      };
      this.users.push(created);
      return created;
    },
  };

  creditAccount = {
    findUnique: async (args: { where: { userId: string } }) =>
      this.creditAccounts.find((row) => row.userId === args.where.userId) ?? null,
    create: async (args: { data: CreditAccountRow }) => {
      this.creditAccounts.push(args.data);
      return args.data;
    },
  };

  creditLedger = {
    create: async (args: { data: Omit<CreditLedgerRow, "id"> }) => {
      const row = { id: randomUUID(), ...args.data };
      this.ledgerRows.push(row);
      return row;
    },
  };

  setting = {
    findUnique: async (args: { where: { key: string } }) => (
      this.registrationBonus === null ? null : { key: args.where.key, value: this.registrationBonus }
    ),
  };

  async $transaction<T>(operation: (tx: this) => Promise<T>) {
    return operation(this);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const prisma = new FakeAuthPrisma("88");
  let signedExpiresIn: unknown = null;
  const service = new WechatAuthService(
    prisma as unknown as PrismaService,
    new ConfigService({
      ALLOW_MOCK_WECHAT: "true",
      MOCK_WECHAT_INITIAL_CREDITS: "0",
      JWT_ACCESS_TOKEN_EXPIRE_MINUTES: "60",
    }),
    {
      sign: (_payload: unknown, options: { expiresIn?: unknown }) => {
        signedExpiresIn = options.expiresIn;
        return "smoke-token";
      },
    } as never,
  );

  const first = await service.login("mock-auth-smoke");
  const second = await service.login("mock-auth-smoke");

  assert(first.credit_balance === 88, `new user should receive configured registration bonus, got ${first.credit_balance}`);
  assert(second.credit_balance === 88, "existing user should keep the same account balance");
  assert(prisma.creditAccounts.length === 1, "repeat login should not create duplicate credit accounts");
  assert(prisma.ledgerRows.length === 1, "repeat login should not create duplicate bonus ledger");
  assert(prisma.ledgerRows[0].refType === "mock_login_bonus", "mock login bonus should stay traceable");
  assert(first.expires_in === 3600, "configured token expiry should be returned in seconds");
  assert(signedExpiresIn === 3600, "configured token expiry should be used when signing JWT");

  const defaultPrisma = new FakeAuthPrisma(null);
  const defaultService = new WechatAuthService(
    defaultPrisma as unknown as PrismaService,
    new ConfigService({ ALLOW_MOCK_WECHAT: "true", MOCK_WECHAT_INITIAL_CREDITS: "0" }),
    { sign: () => "smoke-token" } as never,
  );
  const defaultLogin = await defaultService.login("mock-default-bonus");
  assert(defaultLogin.credit_balance === 100, "missing setting should fall back to default bonus");

  console.log(JSON.stringify({
    ok: true,
    configured_bonus_balance: first.credit_balance,
    default_bonus_balance: defaultLogin.credit_balance,
    ledger_rows: prisma.ledgerRows.length,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
