import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { join } from "node:path";
import { AccountDeletionModule } from "./account-deletion/account-deletion.module";
import { AdminAuthModule } from "./auth/admin-auth.module";
import { AdminModule } from "./admin/admin.module";
import { AssetsModule } from "./assets/assets.module";
import { CreditsModule } from "./credits/credits.module";
import { FavoritesModule } from "./favorites/favorites.module";
import { ModerationModule } from "./moderation/content-moderation.module";
import { PrismaModule } from "./prisma/prisma.module";
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
    AccountDeletionModule,
    AdminAuthModule,
    AdminModule,
    UsersModule,
    AssetsModule,
    TemplatesModule,
    TasksModule,
    CreditsModule,
    UserCreationsModule,
    FavoritesModule,
    ModerationModule,
  ],
})
export class AppModule {}
