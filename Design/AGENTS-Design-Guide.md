# Design 目录 Agent 操作规范

适用范围：本目录下的 Pencil 设计稿与设计规范，尤其是 `jibian.pen`。

目标：让任何 agent 都能安全、可验证地操作 `.pen` 文件，避免图片丢失、布局损坏、乱码和误改整张画板。

## 核心结论

- `.pen` 可以从概念上理解为 JSON-like 的结构化设计文档，但不要把它当普通 JSON 文件读取、解析或手动改写。
- 操作 `.pen` 必须通过 Pencil MCP，不要用 `Get-Content`、`jq`、Python、文本替换或普通文件编辑器直接改 `.pen`。
- 图片不是独立的 `image` 节点。Pencil 里图片通常是 `frame` 或 `rectangle` 节点的 `fill`，也可以通过 `Generate(nodeId, "ai" | "stock", prompt)` 写入图片填充。
- 每次写入前先定位节点，每次写入后必须截图和布局扫描验证。

## 必须使用的 Pencil MCP 工具

优先顺序：

1. `get_editor_state({ include_schema: true })`
   - 第一次进入任务必须调用。
   - 用来确认当前 `.pen` 文件、顶层画板、选中节点和 schema。
2. `snapshot_layout({ filePath, parentId, maxDepth, problemsOnly })`
   - 用来定位节点 ID、尺寸、坐标和裁切问题。
   - 修改前用 `problemsOnly: false` 查看结构；修改后用 `problemsOnly: true` 验证。
3. `get_screenshot({ filePath, nodeId })`
   - 用来确认真实视觉结果。
   - 只截目标画板或目标区域，避免无意义的大范围截图。
4. `get_variables({ filePath })`
   - 修改颜色、字体、间距前先读取已有 tokens。
   - 优先复用已有变量，不随意发明新变量。
5. `get_guidelines(...)`
   - UI 设计或视觉修改前加载相关 guide，例如 `Mobile App`。
6. `batch_design({ filePath, input })`
   - 唯一推荐的写入入口。
   - 只写 Pencil 支持的 JS 操作：`Update`、`Insert`、`Replace`、`Move`、`Delete`、`SetVariables`、`Generate`、`FindEmptySpace`。

## 标准工作流

### 只读诊断

1. 调用 `get_editor_state({ include_schema: true })`。
2. 调用 `snapshot_layout` 定位目标节点。
3. 调用 `get_screenshot` 确认视觉问题。
4. 只根据事实判断问题，不猜测节点含义。

### 修改设计

1. 明确目标节点 ID 和修改范围。
2. 如涉及 UI/视觉，先加载相关 `get_guidelines`。
3. 使用一次或少量 `batch_design` 做最小范围修改。
4. 调用 `get_screenshot` 验证视觉。
5. 调用 `snapshot_layout({ problemsOnly: true })` 检查是否产生裁切、塌陷或溢出。
6. 如果异步图片生成未立即出现，等待后再次截图，不要立刻重建整屏。

## batch_design 规则

- 每个新增节点都必须有清晰的 `name`。
- 不要手动设置 `id`，Pencil 会自动生成。
- 不要在 `batch_design` 里写无关注释，保持脚本短小。
- 每次只改明确目标节点，禁止为了修一个元素重建整张画板。
- 更新已有节点用 `Update(id, props)`，不要删除后重建，除非节点结构已经不可修复。
- 插入根级新画板前必须使用 `FindEmptySpace`，避免覆盖已有画板。
- 根节点只放画板、组件或主要容器，不要把零散文字、按钮、图标直接插到 document 根。

## Pencil Schema 重点限制

- 只有 `frame` 和 `group` 可以有 `children`。
- `layout`、`padding` 只能用于 `frame`。
- 文本必须设置 `fill`，否则不可见。
- 文本换行必须设置 `textGrowth: "fixed-width"` 或 `textGrowth: "fixed-width-height"`。
- `width` / `height` 不支持百分比、`100%`、`calc(...)`、`vh`。
- 不支持 CSS 的 `margin`、`position: fixed`、`z-index`、`alignItems: "stretch"`。
- 父级用了 flex layout 时，普通子节点的 `x` / `y` 会被忽略。
- 图片没有 `image` 节点类型，要用节点 `fill` 或 `Generate`。

## 图片和背景恢复规范

当截图出现灰白棋盘格，通常表示背景图片或填充丢失，而不是布局塌陷。正确处理方式：

1. 用 `snapshot_layout` 确认背景节点仍存在。
2. 不要重建整屏。
3. 给底层背景节点加稳定的 gradient 或 mesh gradient 兜底，颜色优先引用 `设计规范.md` 的品牌 tokens。
4. 给图片层节点重新设置可见 fill。
5. 如需真实图片，用 `Generate` 写入图片填充。
6. 截图验证不再出现棋盘格。

示例：恢复首页顶部背景时，只更新顶部两个背景层。

```js
Update("DuXMC", {
  name: "Hero Background Fallback",
  fill: {
    type: "gradient",
    gradientType: "linear",
    rotation: 180,
    colors: [
      { color: "$accent-indigo", position: 0 },
      { color: "$accent-primary", position: 0.48 },
      { color: "$accent-pink", position: 1 }
    ]
  },
  opacity: 1
})

Update("p8yFp", {
  name: "Hero Image Fill",
  opacity: 0.92,
  fill: {
    type: "mesh_gradient",
    columns: 3,
    rows: 3,
    colors: [
      "$accent-soft", "#FFFFFF", "$accent-soft",
      "$accent-indigo", "$accent-primary", "$accent-pink",
      "#FFFFFF", "$accent-soft", "#FFFFFF"
    ],
    points: [
      [0, 0], [0.5, 0.02], [1, 0],
      [0.04, 0.5], [0.54, 0.42], [0.98, 0.52],
      [0, 1], [0.5, 0.96], [1, 1]
    ]
  }
})

Generate(
  "p8yFp",
  "ai",
  "Dreamy premium mini program home header background, soft purple to pink Apple HIG atmosphere, translucent pastel mountains, fluffy clouds, floating glossy bubbles, subtle indigo depth, clean app launch visual, no people, no text, no logo, no UI elements"
)
```

说明：

- `DuXMC` 是兜底背景层，保证图片异步生成失败时也不会显示透明棋盘格。
- `p8yFp` 是图片/氛围层。
- 如果目标 `.pen` 尚未注册 `accent-primary`、`accent-indigo`、`accent-pink`、`accent-soft` 等变量，先按 `设计规范.md` 第 7 节执行 `SetVariables`，不要退回散落硬编码色值。
- 如果节点 ID 后续变化，必须先用 `snapshot_layout` 重新定位，不要硬套旧 ID。

## 视觉设计约束

本项目设计基调以 `设计规范.md` 为准：

- Apple HIG 风味：克制、清晰、谦让、层次、连续圆角。
- 主色和状态色优先复用已有 tokens。
- 任何视觉改动必须先对照 `设计规范.md` 第 3 节 Design Tokens 和第 7 节 Pencil 落地映射；新增颜色、字号、间距、圆角前必须确认规范里没有可复用 token。
- UI 让位于内容，不要给每个元素套独立卡片。
- 避免过度渐变、过度阴影、过度圆角同时出现。
- 加载状态优先骨架屏，不使用全页白屏加居中 Spinner。
- 中文文本优先保持现有文案风格，不擅自重写品牌语气。

## 禁止事项

- 禁止直接编辑 `.pen` 文件文本内容。
- 禁止用批量替换修改 `.pen`。
- 禁止读取 `.pen` 后自行拼 JSON 再写回。
- 禁止把图片当成 `image` 节点插入。
- 禁止未截图验证就宣称修复完成。
- 禁止为修一个局部问题重建整张画板。
- 禁止删除、移动或重排与当前任务无关的节点。
- 禁止擅自改动 `设计规范.md` 中的设计原则、tokens 和品牌设定。

## 验收清单

每次修改 `.pen` 后必须确认：

- 目标视觉问题已在截图中消失。
- `snapshot_layout({ problemsOnly: true })` 没有出现新的布局问题。
- 没有透明棋盘格、空白背景、不可见文字。
- 文案、按钮、卡片、导航等非目标区域未被误改。
- 如使用 `Generate`，图片没有文字、Logo、人物或不符合业务的内容，除非任务明确要求。
- 如存在修改前已有的布局提示，需要明确说明它与本次修改无关。

## Windows 与编码规范

- 文档类文件使用 UTF-8 无 BOM。
- Markdown 使用 LF 换行。
- Shell 读取文本时显式指定 UTF-8，例如 PowerShell 的 `Get-Content -Encoding UTF8`。
- 不要使用会触发 Windows 编码混乱的默认编码读写链路。
