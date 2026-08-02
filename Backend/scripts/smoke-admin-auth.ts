import { ConfigService } from "@nestjs/config";
import { compare } from "bcryptjs";
import { randomUUID } from "node:crypto";
import { AdminAuthService } from "../src/auth/admin-auth.service";
import { AdminGuard } from "../src/auth/admin.guard";

type AdminUserRow = {
  id: string;
  username: string;
  passwordHash: string;
  envSyncedAt: Date;
};

class FakeAdminPrisma {
  readonly adminUsers: AdminUserRow[] = [];

  adminUser = {
    upsert: async (args: {
      where: { username: string };
      update: { passwordHash: string; envSyncedAt: Date };
      create: { username: string; passwordHash: string; envSyncedAt: Date };
    }) => {
      const existing = this.adminUsers.find((row) => row.username === args.where.username);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }

      const created = { id: randomUUID(), ...args.create };
      this.adminUsers.push(created);
      return created;
    },
    findFirst: async (args: { where: { id: string; username: string }; select?: { id?: boolean; username?: boolean } }) =>
      this.adminUsers.find((row) => row.id === args.where.id && row.username === args.where.username) ?? null,
    deleteMany: async (args: { where: { username: { not: string } } }) => {
      const keepUsername = args.where.username.not;
      const before = this.adminUsers.length;
      for (let index = this.adminUsers.length - 1; index >= 0; index--) {
        if (this.adminUsers[index].username !== keepUsername) {
          this.adminUsers.splice(index, 1);
        }
      }
      return { count: before - this.adminUsers.length };
    },
  };

  $transaction = async <T>(operations: Array<Promise<T>>) => Promise.all(operations);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createHttpContext(request: { headers: { cookie?: string } }) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  };
}

async function expectRejected(action: () => Promise<unknown>, message: string) {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(message);
}

async function main() {
  const prisma = new FakeAdminPrisma();
  prisma.adminUsers.push({
    id: randomUUID(),
    username: "old-admin",
    passwordHash: "old-hash",
    envSyncedAt: new Date(0),
  });

  const service = new AdminAuthService(
    new ConfigService({ ADMIN_USERNAME: " new-admin ", ADMIN_PASSWORD: "new-password" }),
    prisma as never,
  );
  await service.onModuleInit();

  assert(prisma.adminUsers.length === 1, "ENV sync should keep exactly one admin user");
  assert(prisma.adminUsers[0].username === "new-admin", "ENV sync should trim and keep the configured username");
  assert(await compare("new-password", prisma.adminUsers[0].passwordHash), "ENV sync should hash configured password");

  const currentRequest: { headers: { cookie: string }; admin?: { id: string; username: string } } = {
    headers: { cookie: "jibian_admin_session=current-token" },
  };
  const currentGuard = new AdminGuard(
    {
      verifyAsync: async () => ({ sub: prisma.adminUsers[0].id, username: "new-admin" }),
    } as never,
    new ConfigService({ ADMIN_SESSION_SECRET: "secret" }),
    prisma as never,
  );
  assert(await currentGuard.canActivate(createHttpContext(currentRequest) as never), "current admin session should pass");
  assert(currentRequest.admin?.username === "new-admin", "guard should attach current admin");

  const staleGuard = new AdminGuard(
    {
      verifyAsync: async () => ({ sub: randomUUID(), username: "old-admin" }),
    } as never,
    new ConfigService({ ADMIN_SESSION_SECRET: "secret" }),
    prisma as never,
  );
  await expectRejected(
    () => staleGuard.canActivate(createHttpContext({ headers: { cookie: "jibian_admin_session=stale-token" } }) as never),
    "stale admin session should be rejected",
  );

  console.log(JSON.stringify({
    ok: true,
    admin_count: prisma.adminUsers.length,
    username: prisma.adminUsers[0].username,
    guard_checked: true,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
