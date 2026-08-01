import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Controller("config")
export class ClientConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get("client")
  client() {
    const publicBaseUrl = (this.config.get<string>("API_BASE_URL") ?? "https://api.jibian.art")
      .replace(/\/+$/, "")
      .replace(/\/api$/, "");

    return {
      api_base_url: `${publicBaseUrl}/api`,
    };
  }
}
