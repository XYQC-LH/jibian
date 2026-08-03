import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createDecipheriv, createSign, createVerify, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import type { IncomingHttpHeaders } from "node:http";

const DEFAULT_NOTIFY_MAX_SKEW_SECONDS = 5 * 60;

export type WechatPayConfig = Readonly<{
  appId: string;
  mchId: string;
  merchantSerialNo: string;
  privateKey: string;
  apiV3Key: string;
  notifyUrl: string;
  apiBaseUrl: string;
  platformCert: string;
  platformSerialNo: string;
}>;

export type WechatPayNotifyBody = {
  id?: string;
  event_type?: string;
  resource?: {
    associated_data?: string;
    nonce?: string;
    ciphertext?: string;
  };
};

@Injectable()
export class WechatPayClient {
  constructor(private readonly config: ConfigService) {}

  hasPaymentConfig() {
    return this.config.get<string>("WECHAT_PAY_ENABLED") === "true" && this.hasCoreConfig("WECHAT_PAY_NOTIFY_URL");
  }

  hasPapayConfig() {
    return (
      this.config.get<string>("WECHAT_PAPAY_ENABLED") === "true" &&
      this.hasCoreConfig("WECHAT_PAPAY_CONTRACT_NOTIFY_URL") &&
      Boolean(this.readEnv("WECHAT_PAPAY_SERVICE_ID") && this.readEnv("WECHAT_PAPAY_TRANSACTION_NOTIFY_URL"))
    );
  }

  requirePaymentConfig(): WechatPayConfig {
    if (!this.hasPaymentConfig()) {
      throw new ServiceUnavailableException("Wechat payment is not enabled");
    }
    return this.buildConfig(this.readEnv("WECHAT_PAY_NOTIFY_URL"), this.readEnv("WECHAT_PAY_API_BASE_URL"));
  }

  requirePapayConfig(): WechatPayConfig {
    if (!this.hasPapayConfig()) {
      throw new ServiceUnavailableException("Wechat membership subscription is not enabled");
    }
    return this.buildConfig(
      this.readEnv("WECHAT_PAPAY_TRANSACTION_NOTIFY_URL"),
      this.readEnv("WECHAT_PAPAY_API_BASE_URL") || this.readEnv("WECHAT_PAY_API_BASE_URL"),
    );
  }

  createClientPayParams(cfg: WechatPayConfig, prepayId: string) {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.nonce();
    const packageValue = `prepay_id=${prepayId}`;
    const paySign = this.rsaSign(cfg.privateKey, `${cfg.appId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`);
    return {
      timeStamp,
      nonceStr,
      package: packageValue,
      signType: "RSA",
      paySign,
    };
  }

  async queryPaymentOrder(outTradeNo: string) {
    const cfg = this.requirePaymentConfig();
    const path = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(outTradeNo)}?mchid=${encodeURIComponent(cfg.mchId)}`;
    return this.fetch(cfg, "GET", path, "");
  }

  async fetch<T>(cfg: WechatPayConfig, method: "GET" | "POST", path: string, body: string): Promise<T> {
    const response = await fetch(`${cfg.apiBaseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: this.authorizationHeader(cfg, method, path, body),
      },
      ...(body ? { body } : {}),
    });
    const payload = await this.readJson(response);
    if (!response.ok) {
      const message = this.errorMessage(payload, `Wechat Pay request failed: ${response.status}`);
      throw new ServiceUnavailableException(message);
    }
    return payload as T;
  }

  verifySignature(cfg: WechatPayConfig, headers: IncomingHttpHeaders, rawBody: string) {
    const timestamp = this.headerValue(headers, "wechatpay-timestamp");
    const nonce = this.headerValue(headers, "wechatpay-nonce");
    const signature = this.headerValue(headers, "wechatpay-signature");
    const serial = this.headerValue(headers, "wechatpay-serial");

    if (!timestamp || !nonce || !signature) {
      throw new BadRequestException("Invalid Wechat Pay signature headers");
    }
    if (cfg.platformSerialNo && serial && cfg.platformSerialNo !== serial) {
      throw new BadRequestException("Wechat Pay platform serial mismatch");
    }
    this.assertFreshWechatPayTimestamp(timestamp);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${timestamp}\n${nonce}\n${rawBody}\n`);
    verifier.end();
    if (!verifier.verify(cfg.platformCert, signature, "base64")) {
      throw new BadRequestException("Invalid Wechat Pay signature");
    }
  }

  decryptNotifyResource<T>(cfg: WechatPayConfig, body: WechatPayNotifyBody): T {
    const resource = body?.resource;
    if (!resource?.ciphertext || !resource.nonce) {
      throw new BadRequestException("Invalid Wechat Pay notification");
    }

    const encrypted = Buffer.from(resource.ciphertext, "base64");
    const authTag = encrypted.subarray(encrypted.length - 16);
    const data = encrypted.subarray(0, encrypted.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(cfg.apiV3Key, "utf8"), Buffer.from(resource.nonce, "utf8"));
    if (resource.associated_data) {
      decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
    }
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    return JSON.parse(decrypted) as T;
  }

  readEnv(key: string) {
    return this.config.get<string>(key)?.trim() || "";
  }

  nonce() {
    return randomBytes(16).toString("hex");
  }

  createId(prefix: string) {
    return `${prefix}${Date.now()}${randomBytes(4).toString("hex").toUpperCase()}`;
  }

  private hasCoreConfig(notifyUrlKey: string) {
    return Boolean(
      (this.readEnv("WECHAT_PAY_APP_ID") || this.readEnv("WECHAT_APP_ID")) &&
      this.readEnv("WECHAT_PAY_MCH_ID") &&
      this.readEnv("WECHAT_PAY_MCH_SERIAL_NO") &&
      (this.readEnv("WECHAT_PAY_PRIVATE_KEY") || this.readEnv("WECHAT_PAY_PRIVATE_KEY_PATH")) &&
      (this.readEnv("WECHAT_PAY_PLATFORM_CERT") || this.readEnv("WECHAT_PAY_PLATFORM_CERT_PATH")) &&
      this.readEnv("WECHAT_PAY_API_V3_KEY") &&
      this.readEnv(notifyUrlKey)
    );
  }

  private buildConfig(notifyUrl: string, apiBaseUrl?: string): WechatPayConfig {
    return {
      appId: this.readEnv("WECHAT_PAY_APP_ID") || this.readEnv("WECHAT_APP_ID"),
      mchId: this.readEnv("WECHAT_PAY_MCH_ID"),
      merchantSerialNo: this.readEnv("WECHAT_PAY_MCH_SERIAL_NO"),
      privateKey: this.readPrivateKey(),
      apiV3Key: this.readEnv("WECHAT_PAY_API_V3_KEY"),
      notifyUrl,
      apiBaseUrl: apiBaseUrl || "https://api.mch.weixin.qq.com",
      platformCert: this.readPlatformCert(),
      platformSerialNo: this.readEnv("WECHAT_PAY_PLATFORM_SERIAL_NO"),
    };
  }

  private authorizationHeader(cfg: WechatPayConfig, method: string, path: string, body: string) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = this.nonce();
    const signature = this.rsaSign(cfg.privateKey, `${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`);
    return [
      "WECHATPAY2-SHA256-RSA2048",
      `mchid="${cfg.mchId}"`,
      `nonce_str="${nonceStr}"`,
      `signature="${signature}"`,
      `timestamp="${timestamp}"`,
      `serial_no="${cfg.merchantSerialNo}"`,
    ].join(",");
  }

  private rsaSign(privateKey: string, message: string) {
    const sign = createSign("RSA-SHA256");
    sign.update(message);
    sign.end();
    return sign.sign(privateKey, "base64");
  }

  private readPrivateKey() {
    const inline = this.readEnv("WECHAT_PAY_PRIVATE_KEY");
    if (inline) {
      return inline.replace(/\\n/g, "\n");
    }
    const filePath = this.readEnv("WECHAT_PAY_PRIVATE_KEY_PATH");
    if (filePath) {
      return readFileSync(filePath, "utf8");
    }
    return "";
  }

  private readPlatformCert() {
    const inline = this.readEnv("WECHAT_PAY_PLATFORM_CERT");
    if (inline) {
      return inline.replace(/\\n/g, "\n");
    }
    const filePath = this.readEnv("WECHAT_PAY_PLATFORM_CERT_PATH");
    if (filePath) {
      return readFileSync(filePath, "utf8");
    }
    return "";
  }

  private headerValue(headers: IncomingHttpHeaders, key: string) {
    const value = headers[key];
    return Array.isArray(value) ? value[0] : value;
  }

  private assertFreshWechatPayTimestamp(timestamp: string) {
    const timestampSeconds = Number(timestamp);
    if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
      throw new BadRequestException("Invalid Wechat Pay timestamp");
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestampSeconds) > this.notifyMaxSkewSeconds()) {
      throw new BadRequestException("Wechat Pay notification timestamp expired");
    }
  }

  private notifyMaxSkewSeconds() {
    const configured = Number(this.readEnv("WECHAT_PAY_NOTIFY_MAX_SKEW_SECONDS"));
    if (!Number.isFinite(configured) || configured <= 0) {
      return DEFAULT_NOTIFY_MAX_SKEW_SECONDS;
    }
    return Math.floor(configured);
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return await response.text();
    }
  }

  private errorMessage(body: unknown, fallback: string) {
    if (body && typeof body === "object") {
      const record = body as Record<string, unknown>;
      return String(record.message || record.code || fallback);
    }
    return String(body || fallback);
  }
}
