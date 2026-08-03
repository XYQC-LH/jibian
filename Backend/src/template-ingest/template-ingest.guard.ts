import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { timingSafeEqual } from "node:crypto";

const templateIngestApiKeyEnv = "TEMPLATE_INGEST_API_KEY";
const templateIngestKeyHeader = "x-template-ingest-key";

@Injectable()
export class TemplateIngestGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedKey = this.config.get<string>(templateIngestApiKeyEnv)?.trim();
    if (!expectedKey) {
      throw new ServiceUnavailableException("Template ingest key is not configured");
    }

    const request = context.switchToHttp().getRequest<Request>();
    const providedKey = this.readIngestKey(request);
    if (!providedKey) {
      throw new UnauthorizedException("Missing template ingest key");
    }
    if (!this.keysMatch(providedKey, expectedKey)) {
      throw new UnauthorizedException("Invalid template ingest key");
    }

    return true;
  }

  private readIngestKey(request: Request) {
    const header = request.headers[templateIngestKeyHeader];
    if (Array.isArray(header)) {
      return header[0]?.trim() || "";
    }
    if (typeof header === "string") {
      return header.trim();
    }
    return "";
  }

  private keysMatch(providedKey: string, expectedKey: string) {
    const provided = Buffer.from(providedKey);
    const expected = Buffer.from(expectedKey);
    if (provided.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(provided, expected);
  }
}
