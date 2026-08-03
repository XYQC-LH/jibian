import { Body, Controller, Post } from "@nestjs/common";
import { WechatAuthService } from "./wechat-auth.service";

type WechatLoginBody = {
  code?: string;
  invite_code?: string;
};

@Controller("auth")
export class WechatAuthController {
  constructor(private readonly wechatAuth: WechatAuthService) {}

  @Post("wechat-login")
  login(@Body() body: WechatLoginBody) {
    return this.wechatAuth.login(body?.code, body?.invite_code);
  }
}
