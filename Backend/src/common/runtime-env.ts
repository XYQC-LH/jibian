import { ConfigService } from "@nestjs/config";

export function isProductionRuntime(config?: ConfigService) {
  const appEnv = config?.get<string>("APP_ENV") ?? process.env.APP_ENV;
  const nodeEnv = config?.get<string>("NODE_ENV") ?? process.env.NODE_ENV;
  return [appEnv, nodeEnv].some((value) => String(value ?? "").trim() === "production");
}
