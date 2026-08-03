# 即变 AI 生成标识后端化方案

更新时间：2026年08月03日  
适用范围：微信小程序生成结果图、下载/保存/分享结果、管理员排障和合规审计。

## 结论

即变向公众提供 AI 人物图片生成/编辑服务，生成结果属于人工智能生成合成内容。标识能力必须后端化，不能只依赖前端展示或下载页提示。

第一版应采用“内容显式标识 + 文件元数据隐式标识”的组合：

- 内容显式标识：在结果图文件本体右下角或其他边/角位置写入清晰可见的“AI生成”或“人工智能生成合成”文字。
- 文件元数据隐式标识：在结果图文件元数据中写入字段名或关键词包含 `AIGC` 的 JSON 字符串，记录生成合成属性、服务提供者、内容编号等信息。
- 数字水印：属于内容隐式标识的一种增强方式，可用于取证增强，但不能替代文件元数据隐式标识。
- 会员权益：可以去除品牌水印，但不应承诺“去 AI 生成标识”。如确需提供无显式标识版本，必须走用户协议、责任提示和日志留存流程，且仍保留隐式标识。

## 官方口径

主要依据：

- 《人工智能生成合成内容标识办法》。
- `GB 45438-2025《网络安全技术 人工智能生成合成内容标识方法》`。

《人工智能生成合成内容标识办法》自 2025 年 9 月 1 日起施行，明确标识包括显式标识和隐式标识。显式标识是在生成合成内容或交互场景界面中添加、用户可明显感知的文字、声音、图形等标识；隐式标识是通过技术措施添加到文件数据中、不易被用户明显感知的标识。

图片内容的显式标识按照强制性国家标准 `GB 45438-2025《网络安全技术 人工智能生成合成内容标识方法》` 执行：

- 应采用文字提示。
- 应同时包含人工智能要素和生成合成要素，例如“AI生成”“人工智能生成”“人工智能生成合成”。
- 应位于图片的边或角。
- 字型应清晰可辨。
- 文字高度不应低于画面最短边长度的 5%。

文件元数据隐式标识按照 `GB 45438-2025` 执行：

- 应包含生成合成标签、生成合成服务提供者、内容制作编号、内容传播服务提供者、内容传播编号。
- 文件元数据隐式标识格式应包含 `AIGC` 字段或关键词。
- 人工智能生成合成内容文件中应仅保留一份文件元数据隐式标识。

建议的元数据值：

```json
{
  "AIGC": {
    "Label": "1",
    "ContentProducer": "jibian",
    "ProduceID": "task:<taskId>;asset:<assetId>",
    "ReservedCode1": "<signature-or-hash>",
    "ContentPropagator": "jibian",
    "PropagateID": "task:<taskId>;asset:<assetId>",
    "ReservedCode2": ""
  }
}
```

其中 `Label = "1"` 表示“属于人工智能生成合成内容”。`ReservedCode1` 可存储基于内容编号、服务提供者和文件摘要生成的 HMAC，用于后续校验标识完整性。

## 当前项目判断

当前生成链路是：

1. `TasksProcessor` 调用模型源 adapter 生成图片。
2. adapter 创建 `assetType = generated_image` 的资产记录，`storageKey` 暂存第三方图片 URL 或 mock key。
3. `AssetsService.materializeRemoteAsset` 下载第三方结果并上传到对象存储。
4. 输出审核通过后，`markSucceeded` 将 `tasks.result_asset_id` 指向结果资产，并创建 `user_creation`。

因此最小后端化切点应放在 `AssetsService.materializeRemoteAsset` 下载结果之后、上传对象存储之前。这样可以保证小程序预览、保存、分享、下载、管理员查看拿到的都是同一份已标识文件。

当前代码状态：

- 已有 `Backend/src/assets/aigc-label.service.ts`，负责绘制“AI生成”显式标识并写入 `AIGC` 文件元数据。
- 已在 `Backend/src/assets/assets.service.ts` 的 `materializeRemoteAsset` 上传前调用标识服务，只处理 `generated_image`。
- 已在 `Backend/src/tasks/tasks.processor.ts` 传入 `taskId` 和 `assetId`，用于生成 `ProduceID` / `PropagateID`。
- 已将打标失败改为不静默放行，避免生成成功但产物未带标识。
- 尚未落库记录每张资产的标识处理审计结果，建议作为下一阶段补齐。

## 实现方案

### 第一阶段：合规 MVP

后端保留 `AigcLabelService`，只处理 `generated_image`：

- 输入：原始图片 `Buffer`、`contentType`、`taskId`、`assetId`、服务提供者编码。
- 输出：已写入显式标识和隐式标识的图片 `Buffer`、规范化后的 `contentType`。
- 显式标识：用图片处理库在右下角绘制“AI生成”，文字高度按图片最短边 5% 计算，带半透明底色或描边，确保清晰可辨。
- 隐式标识：写入 `AIGC` 元数据 JSON；`ProduceID` 和 `PropagateID` 使用 `taskId + assetId`，避免直接暴露用户 ID。
- 输出格式：MVP 建议统一生成图片结果为 JPEG 或 PNG，降低多格式元数据写入差异。人物照片优先 JPEG，若后续有透明图再支持 PNG。

已落地点：

- `Backend/src/assets/aigc-label.service.ts`：新增标识服务。
- `Backend/src/assets/assets.module.ts`：注册标识服务。
- `Backend/src/assets/assets.service.ts`：`materializeRemoteAsset` 增加标识上下文参数，在上传前调用标识服务。
- `Backend/src/tasks/tasks.processor.ts`：传入 `taskId`、`assetId` 等上下文。

下一阶段改造点：

- `Backend/prisma/schema.prisma`：建议新增资产标识审计字段或独立表，记录标识版本、显式标识状态、隐式标识状态、处理时间和失败原因。

建议审计字段：

```prisma
model AssetAigcLabel {
  assetId       String   @id @map("asset_id") @db.Uuid
  labelVersion  String   @map("label_version") @db.VarChar(32)
  explicitLabel Boolean  @map("explicit_label")
  implicitLabel Boolean  @map("implicit_label")
  producer      String   @db.VarChar(64)
  produceId     String   @map("produce_id") @db.VarChar(160)
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz

  asset Asset @relation(fields: [assetId], references: [id])

  @@map("asset_aigc_labels")
}
```

### 第二阶段：权益和导出策略

- 小程序“无水印”文案改为“无品牌水印”或“高清下载，保留 AI 生成标识”。
- 免费/会员都保留 AI 显式标识；会员只移除营销品牌水印。
- 若未来开放“无显式 AI 标识版本”，必须单独开关、单独权益、单独用户确认，并留存提供对象、任务、资产、时间、IP/设备等日志不少于 6 个月。
- 所有下载、分享、保存接口都必须返回已后端标识的资产，不提供原始第三方结果 URL。

### 第三阶段：增强暗水印

- 在元数据隐式标识稳定后，再考虑抗裁剪、抗压缩的数字水印。
- 数字水印应作为取证增强，不作为用户可感知的主提示，也不替代 `AIGC` 元数据。
- 管理端可增加“标识校验”动作，用于抽检文件是否仍包含显式标识和隐式标识。

## 验收标准

- 任意成功生成的 `generated_image` 文件，打开图片即可看到边/角位置的“AI生成”或等价提示。
- 下载/保存到相册后的文件仍包含显式标识。
- 抽检文件元数据能读取到唯一 `AIGC` 隐式标识。
- `AIGC.Label` 为 `"1"`，`ContentProducer` 和 `ContentPropagator` 为即变服务编码。
- `ProduceID` 和 `PropagateID` 能反查到内部 task/asset。
- 管理端任务详情或数据库能追踪每张结果图的标识处理状态。
- 前端不再自行决定是否加 AI 标识，只展示后端结果。
