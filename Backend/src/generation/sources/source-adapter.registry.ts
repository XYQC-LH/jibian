import { Injectable } from "@nestjs/common";
import { SourceAdapter } from "../contracts/standard-generate.contract";
import { GptImage2CKuaiCnAdapter } from "./gpt-image-2-c-kuai-cn.adapter";
import { GrsaiGptImage2Adapter } from "./grsai-gpt-image-2.adapter";
import { GrsaiGptImage2VipAdapter } from "./grsai-gpt-image-2-vip.adapter";
import { MockSourceAdapter } from "./mock-source.adapter";
import { T8GptImage2EditsAdapter } from "./t8-gpt-image-2-edits.adapter";
import { T8GptImage2GenerationsAdapter } from "./t8-gpt-image-2-generations.adapter";

@Injectable()
export class SourceAdapterRegistry {
  constructor(
    private readonly t8Generations: T8GptImage2GenerationsAdapter,
    private readonly t8Edits: T8GptImage2EditsAdapter,
    private readonly grsai: GrsaiGptImage2Adapter,
    private readonly grsaiVip: GrsaiGptImage2VipAdapter,
    private readonly kuai: GptImage2CKuaiCnAdapter,
    private readonly mock: MockSourceAdapter,
  ) {}

  getDefault(): SourceAdapter {
    return this.getAll()[0];
  }

  getAll(): SourceAdapter[] {
    const configuredSources: SourceAdapter[] = [
      this.t8Edits,
      this.t8Generations,
      this.grsai,
      this.grsaiVip,
      this.kuai,
    ].filter((source) => source.isConfigured());

    if (this.mock.isConfigured()) {
      configuredSources.push(this.mock);
    }

    return configuredSources;
  }
}
