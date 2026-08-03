import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { join } from "node:path";
import { AccountDeletionModule } from "./account-deletion/account-deletion.module";
import { AdminAuthModule } from "./auth/admin-auth.module";
import { AdminModule } from "./admin/admin.module";
import { AssetsModule } from "./assets/assets.module";
import { ClientConfigModule } from "./client-config/client-config.module";
import { CreditsModule } from "./credits/credits.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { InvitesModule } from "./invites/invites.module";
import { MembershipsModule } from "./memberships/memberships.module";
import { ModerationModule } from "./moderation/content-moderation.module";
import { OperationModule } from "./operation/operation.module";
import { PaymentsModule } from "./payments/payments.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TemplateIngestModule } from "./template-ingest/template-ingest.module";
import { TemplatesModule } from "./templates/templates.module";
import { TasksModule } from "./tasks/tasks.module";
import { UserCreationsModule } from "./user-creations/user-creations.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, "..", ".env"),
        join(__dirname, "..", "..", ".env"),
      ],
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>("REDIS_URL") ?? "redis://localhost:6379",
        },
      }),
    }),
    PrismaModule,
    ClientConfigModule,
    AccountDeletionModule,
    AdminAuthModule,
    AdminModule,
    UsersModule,
    AssetsModule,
    TemplateIngestModule,
    TemplatesModule,
    TasksModule,
    CreditsModule,
    PaymentsModule,
    MembershipsModule,
    UserCreationsModule,
    FavoritesModule,
    InvitesModule,
    ModerationModule,
    OperationModule,
  ],
})
export class AppModule {}
