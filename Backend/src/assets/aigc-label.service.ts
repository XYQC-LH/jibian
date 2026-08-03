import { Injectable, Logger } from "@nestjs/common";
import type * as SharpLib from "sharp";

const sharp = require("sharp") as {
  (input?: SharpLib.SharpInput | SharpLib.SharpInput[], options?: SharpLib.SharpOptions): SharpLib.Sharp;
  (options?: SharpLib.SharpOptions): SharpLib.Sharp;
};

export interface AigcLabelContext {
  taskId: string;
  assetId: string;
}

export interface AigcLabelResult {
  buffer: Buffer;
  contentType: string;
  explicitLabel: boolean;
  implicitLabel: boolean;
}

const LABEL_TEXT = "AI生成";
const PRODUCER = "jibian";

@Injectable()
export class AigcLabelService {
  private readonly logger = new Logger(AigcLabelService.name);

  async applyLabels(
    imageBuffer: Buffer,
    contentType: string,
    context: AigcLabelContext,
  ): Promise<AigcLabelResult> {
    let processedBuffer = imageBuffer;
    let explicitLabel = false;
    let implicitLabel = false;

    try {
      processedBuffer = await this.applyExplicitLabel(processedBuffer);
      explicitLabel = true;
    } catch (error) {
      this.logger.error(`Failed to apply explicit AIGC label: ${this.formatError(error)}`);
      throw error;
    }

    try {
      processedBuffer = await this.applyImplicitLabel(processedBuffer, context);
      implicitLabel = true;
    } catch (error) {
      this.logger.error(`Failed to apply implicit AIGC label: ${this.formatError(error)}`);
      throw error;
    }

    return {
      buffer: processedBuffer,
      contentType,
      explicitLabel,
      implicitLabel,
    };
  }

  private async applyExplicitLabel(imageBuffer: Buffer): Promise<Buffer> {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (!width || !height) {
      throw new Error("Unable to read image dimensions");
    }

    const shortestSide = Math.min(width, height);
    const fontHeight = Math.max(12, Math.round(shortestSide * 0.05));
    const overlay = this.buildTextOverlaySvg(fontHeight);

    return image
      .composite([{ input: overlay, gravity: "southeast" }])
      .toBuffer();
  }

  private buildTextOverlaySvg(fontHeight: number): Buffer {
    const padding = Math.round(fontHeight * 0.25);
    const textWidth = Math.round(fontHeight * LABEL_TEXT.length * 0.65);
    const boxWidth = textWidth + padding * 2;
    const boxHeight = fontHeight + padding * 2;

    const svg = `<svg width="${boxWidth}" height="${boxHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${boxWidth}" height="${boxHeight}" fill="rgba(0,0,0,0.4)" />
  <text x="${padding}" y="${fontHeight + padding * 0.2}" font-family="sans-serif" font-size="${fontHeight}" font-weight="bold" fill="#ffffff">${LABEL_TEXT}</text>
</svg>`;

    return Buffer.from(svg, "utf-8");
  }

  private async applyImplicitLabel(
    imageBuffer: Buffer,
    context: AigcLabelContext,
  ): Promise<Buffer> {
    const produceId = `task:${context.taskId};asset:${context.assetId}`;
    const aigcMetadata = {
      AIGC: {
        Label: "1",
        ContentProducer: PRODUCER,
        ProduceID: produceId,
        ReservedCode1: "",
        ContentPropagator: PRODUCER,
        PropagateID: produceId,
        ReservedCode2: "",
      },
    };

    return sharp(imageBuffer)
      .withXmp(this.buildXmpPacket(JSON.stringify(aigcMetadata)))
      .toBuffer();
  }

  private buildXmpPacket(aigcJson: string): string {
    const escapedAigcJson = this.escapeXmlAttribute(aigcJson);

    return `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:TC260="http://ns.tc260.org.cn/AIGC/1.0/" TC260:AIGC="${escapedAigcJson}" />
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
  }

  private escapeXmlAttribute(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
