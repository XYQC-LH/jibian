import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { isProductionRuntime } from "./common/runtime-env";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  app.enableCors({
    origin: resolveCorsOrigin(config),
    credentials: true,
  });
  app.setGlobalPrefix("api", { exclude: ["health"] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = Number(config.get<number>("API_PORT") ?? config.get<number>("PORT") ?? 3000);
  await app.listen(port);
}

function resolveCorsOrigin(config: ConfigService) {
  const origins = String(config.get<string>("FRONTEND_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length > 0) {
    return origins;
  }
  return isProductionRuntime(config) ? false : true;
}

void bootstrap();
