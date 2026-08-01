import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Controller("config")
export class ClientConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get("client")
  client() {
    const apiBaseUrl = (this.config.get<string>("API_BASE_URL") ?? "http://localhost:3000")
      .replace(/\/$/, "");

    return {
      api_base_url: `${apiBaseUrl}/api`,
    };
  }
}
