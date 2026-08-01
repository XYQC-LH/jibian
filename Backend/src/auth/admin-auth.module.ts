import { Global, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AdminAuthService } from "./admin-auth.service";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminGuard } from "./admin.guard";
import { UserAuthGuard } from "./user-auth.guard";
import { WechatAuthController } from "./wechat-auth.controller";
import { WechatAuthService } from "./wechat-auth.service";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET") ?? "jibian-dev-user-jwt-secret-change-me",
      }),
    }),
  ],
  controllers: [AdminAuthController, WechatAuthController],
  providers: [AdminAuthService, AdminGuard, UserAuthGuard, WechatAuthService],
  exports: [AdminAuthService, AdminGuard, UserAuthGuard, JwtModule, WechatAuthService],
})
export class AdminAuthModule {}
