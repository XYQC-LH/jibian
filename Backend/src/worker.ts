import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrapWorker() {
  process.env.WORKER_ENABLED = process.env.WORKER_ENABLED ?? "true";
  await NestFactory.createApplicationContext(AppModule);
}

void bootstrapWorker();
