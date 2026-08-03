import { createHash, createHmac } from "node:crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isProductionRuntime } from "../common/runtime-env";

type StorageConfig = {
  bucket: string;
  publicBucket?: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl?: string;
};

@Injectable()
export class AssetUrlService {
  constructor(private readonly config: ConfigService) {}

  createUploadUrl(storageKey: string) {
    const storageConfig = this.getStorageConfig();
    if (!storageConfig) {
      if (isProductionRuntime(this.config)) {
        throw new ServiceUnavailableException("Storage is not configured");
      }

      return `mock://upload/${storageKey}`;
    }

    return this.createS3PresignedPutUrl(storageKey, storageConfig);
  }

  createPublicUploadUrl(storageKey: string) {
    const storageConfig = this.getStorageConfig();
    if (!storageConfig) {
      if (isProductionRuntime(this.config)) {
        throw new ServiceUnavailableException("Storage is not configured");
      }

      return `mock://upload/${storageKey}`;
    }

    return this.createS3PresignedPutUrl(storageKey, storageConfig, storageConfig.publicBucket);
  }

  getPublicUrl(storageKey: string) {
    if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) {
      return storageKey;
    }

    if (this.isBundledSeedAssetKey(storageKey)) {
      return `${this.getApiBaseUrl()}/api/assets/mock/${this.encodeStorageKey(storageKey)}`;
    }

    const storageConfig = this.getStorageConfig();

    // Public-bucket assets (written via createPublicUploadUrl) resolve to the
    // public bucket's static URL. Keeps read path symmetric with the upload path.
    if (storageConfig?.publicBucket && this.isPublicAssetKey(storageKey)) {
      const { baseUrl, objectPath } = this.resolveObjectAddress(
        storageConfig,
        storageKey,
        storageConfig.publicBucket,
      );
      return `${baseUrl}${objectPath}`;
    }

    const publicBaseUrl = storageConfig?.publicBaseUrl
      ?? this.readEnv("ASSET_PUBLIC_BASE_URL")
      ?? this.readEnv("COS_PUBLIC_BASE_URL");

    if (storageConfig && !publicBaseUrl) {
      return this.createS3PresignedGetUrl(storageKey, storageConfig);
    }

    if (!publicBaseUrl) {
      if (isProductionRuntime(this.config)) {
        throw new ServiceUnavailableException("Storage is not configured");
      }

      return `${this.getApiBaseUrl()}/api/assets/mock/${this.encodeStorageKey(storageKey)}`;
    }

    return `${publicBaseUrl.replace(/\/$/, "")}/${this.encodeStorageKey(storageKey)}`;
  }

  private isPublicAssetKey(storageKey: string) {
    // Mirrors the asset types uploaded to the public bucket via createPublicUploadUrl
    // (admin template covers, operation home banners). Keeps read path symmetric.
    return (
      storageKey.startsWith("template_cover/") ||
      storageKey.startsWith("operation_banner/")
    );
  }

  private isBundledSeedAssetKey(storageKey: string) {
    return storageKey.startsWith("assets/design/");
  }

  getMockAssetStorageKey(path: string) {
    return path
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  }

  private getStorageConfig(): StorageConfig | null {
    const bucket = this.readEnv("ASSET_STORAGE_BUCKET") ?? this.readEnv("COS_BUCKET_PRIVATE");
    const publicBucket = this.readEnv("COS_BUCKET_PUBLIC");
    const region = this.readEnv("ASSET_STORAGE_REGION") ?? this.readEnv("COS_REGION");
    const endpoint = this.readEnv("ASSET_STORAGE_ENDPOINT") ?? this.readEnv("COS_ENDPOINT");
    const accessKeyId = this.readEnv("ASSET_STORAGE_ACCESS_KEY_ID") ?? this.readEnv("COS_SECRET_ID");
    const secretAccessKey = this.readEnv("ASSET_STORAGE_SECRET_ACCESS_KEY")
      ?? this.resolveSecretRef()
      ?? this.readEnv("COS_SECRET_KEY");

    if (!bucket || !region || !endpoint || !accessKeyId || !secretAccessKey) {
      return null;
    }

    return {
      bucket,
      ...(publicBucket ? { publicBucket } : {}),
      region,
      endpoint: endpoint.replace(/\/$/, ""),
      accessKeyId,
      secretAccessKey,
      publicBaseUrl: this.readEnv("ASSET_PUBLIC_BASE_URL") ?? this.readEnv("COS_PUBLIC_BASE_URL"),
    };
  }

  private createS3PresignedPutUrl(
    storageKey: string,
    storageConfig: StorageConfig,
    bucketOverride?: string,
  ) {
    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${storageConfig.region}/s3/aws4_request`;
    const signedHeaders = "host";
    const { baseUrl, host, objectPath } = this.resolveObjectAddress(
      storageConfig,
      storageKey,
      bucketOverride,
    );
    const query = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${storageConfig.accessKeyId}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(this.getUploadUrlExpiresSeconds()),
      "X-Amz-SignedHeaders": signedHeaders,
    });
    const canonicalQueryString = this.toCanonicalQueryString(query);
    const canonicalRequest = [
      "PUT",
      objectPath,
      canonicalQueryString,
      `host:${host}\n`,
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join("\n");
    const signingKey = this.getSignatureKey(storageConfig.secretAccessKey, dateStamp, storageConfig.region, "s3");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    return `${baseUrl}${objectPath}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  private createS3PresignedGetUrl(storageKey: string, storageConfig: StorageConfig) {
    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${storageConfig.region}/s3/aws4_request`;
    const signedHeaders = "host";
    const { baseUrl, host, objectPath } = this.resolveObjectAddress(storageConfig, storageKey);
    const query = new URLSearchParams({
      "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
      "X-Amz-Credential": `${storageConfig.accessKeyId}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(this.getReadUrlExpiresSeconds()),
      "X-Amz-SignedHeaders": signedHeaders,
    });
    const canonicalQueryString = this.toCanonicalQueryString(query);
    const canonicalRequest = [
      "GET",
      objectPath,
      canonicalQueryString,
      `host:${host}\n`,
      signedHeaders,
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      this.sha256(canonicalRequest),
    ].join("\n");
    const signingKey = this.getSignatureKey(storageConfig.secretAccessKey, dateStamp, storageConfig.region, "s3");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    return `${baseUrl}${objectPath}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  private resolveObjectAddress(
    storageConfig: StorageConfig,
    storageKey: string,
    bucketOverride?: string,
  ) {
    const endpoint = new URL(storageConfig.endpoint);
    const bucket = bucketOverride ?? storageConfig.bucket;
    const encodedKey = this.encodeStorageKey(storageKey);
    if (
      endpoint.hostname === `cos.${storageConfig.region}.myqcloud.com` &&
      (endpoint.pathname === "/" || endpoint.pathname === "")
    ) {
      const host = `${bucket}.cos.${storageConfig.region}.myqcloud.com`;
      return {
        baseUrl: `${endpoint.protocol}//${host}`,
        host,
        objectPath: `/${encodedKey}`,
      };
    }

    return {
      baseUrl: storageConfig.endpoint,
      host: endpoint.host,
      objectPath: `/${bucket}/${encodedKey}`,
    };
  }

  private getUploadUrlExpiresSeconds() {
    const configured = Number(
      this.readEnv("ASSET_UPLOAD_URL_EXPIRES_SECONDS")
        ?? this.readEnv("STORAGE_UPLOAD_EXPIRE_SECONDS")
        ?? 900,
    );
    if (!Number.isFinite(configured) || configured <= 0) {
      return 900;
    }

    return Math.floor(configured);
  }

  private getReadUrlExpiresSeconds() {
    const configured = Number(
      this.readEnv("ASSET_READ_URL_EXPIRES_SECONDS")
        ?? this.readEnv("STORAGE_READ_EXPIRE_SECONDS")
        ?? 86400,
    );
    if (!Number.isFinite(configured) || configured <= 0) {
      return 86400;
    }

    return Math.floor(configured);
  }

  private readEnv(key: string) {
    const value = this.config.get<string>(key);
    return value && value.trim() ? value.trim() : undefined;
  }

  private getApiBaseUrl() {
    return (
      this.readEnv("API_PUBLIC_BASE_URL")
      ?? this.readEnv("BACKEND_PUBLIC_BASE_URL")
      ?? this.readEnv("API_BASE_URL")
      ?? `http://localhost:${this.readEnv("API_PORT") ?? this.readEnv("PORT") ?? "3000"}`
    ).replace(/\/api$/, "").replace(/\/$/, "");
  }

  private resolveSecretRef() {
    const ref = this.readEnv("COS_SECRET_REF");
    if (!ref) {
      return undefined;
    }

    return this.readEnv(ref);
  }

  private encodeStorageKey(storageKey: string) {
    return storageKey.split("/").map(encodeURIComponent).join("/");
  }

  private toCanonicalQueryString(query: URLSearchParams) {
    return [...query.entries()]
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&");
  }

  private formatAmzDate(date: Date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  }

  private sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private getSignatureKey(secretAccessKey: string, dateStamp: string, region: string, service: string) {
    const dateKey = createHmac("sha256", `AWS4${secretAccessKey}`).update(dateStamp).digest();
    const regionKey = createHmac("sha256", dateKey).update(region).digest();
    const serviceKey = createHmac("sha256", regionKey).update(service).digest();
    return createHmac("sha256", serviceKey).update("aws4_request").digest();
  }
}
