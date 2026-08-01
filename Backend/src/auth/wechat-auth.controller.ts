import { Body, Controller, Post } from "@nestjs/common";
import { WechatAuthService } from "./wechat-auth.service";

@Controller("auth")
export class WechatAuthController {
  constructor(private readonly wechatAuth: WechatAuthService) {}

  @Post("wechat-login")
  login(@Body("code") code: string) {
    return this.wechatAuth.login(code);
  }
}
