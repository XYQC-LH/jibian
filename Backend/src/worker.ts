import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrapWorker() {
  await NestFactory.createApplicationContext(AppModule);
}

void bootstrapWorker();
