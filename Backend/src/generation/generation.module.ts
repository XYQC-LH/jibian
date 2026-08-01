import { Module } from "@nestjs/common";
import { GptImage2CKuaiCnAdapter } from "./sources/gpt-image-2-c-kuai-cn.adapter";
import { GrsaiGptImage2Adapter } from "./sources/grsai-gpt-image-2.adapter";
import { GrsaiGptImage2VipAdapter } from "./sources/grsai-gpt-image-2-vip.adapter";
import { MockSourceAdapter } from "./sources/mock-source.adapter";
import { SourceAdapterRegistry } from "./sources/source-adapter.registry";
import { T8GptImage2EditsAdapter } from "./sources/t8-gpt-image-2-edits.adapter";
import { T8GptImage2GenerationsAdapter } from "./sources/t8-gpt-image-2-generations.adapter";

@Module({
  providers: [
    MockSourceAdapter,
    T8GptImage2GenerationsAdapter,
    T8GptImage2EditsAdapter,
    GrsaiGptImage2Adapter,
    GrsaiGptImage2VipAdapter,
    GptImage2CKuaiCnAdapter,
    SourceAdapterRegistry,
  ],
  exports: [SourceAdapterRegistry],
})
export class GenerationModule {}
