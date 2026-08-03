import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { WechatPayClient } from "./wechat-pay.client";

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, WechatPayClient],
  exports: [PaymentsService, WechatPayClient],
})
export class PaymentsModule {}
