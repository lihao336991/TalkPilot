# Google Translator 翻译改造计划

## Summary

- 目标：将 TalkPilot 当前所有“纯翻译”场景从通用 LLM prompt 翻译改为 Google Translate v2 API。
- 覆盖范围：
  - 对方说话后，主消息流里显示的 `other -> native` 翻译。
  - 母语救场链路 `native -> learning` 的文本翻译与后续 TTS 输入文本。
- 已确认决策：
  - 接入方式：Google Translate v2，使用 API Key。
  - 救场输出风格：严格直译，不再做 LLM 润色或 conversational 改写。
  - 主链路中 `speaker === "self"` 的 `to_learning` 自动翻译分支直接删除，仅保留 SOS 承担母语转学习语言。
- 实现原则：
  - 保留当前客户端数据流与 UI 交互，不改会话主流程。
  - 尽量保留现有 `assist-reply` Edge Function 的请求/响应兼容形状，避免旧客户端或当前前端额外联动风险。
  - `suggest` / `review` 继续走现有 LLM，不在本次范围内。

## Current State Analysis

### 现有调用链

- `src/features/live/hooks/useLiveSessionController.ts`
  - 对 `speaker === "other"` 且语言匹配学习语言时，调用 `translationService.translate({ direction: "to_native" })`。
  - 对 `speaker === "self"` 且语言不是学习语言时，当前还会调用 `translationService.translate({ direction: "to_learning" })`，但这条分支已确认不符合目标产品形态，应在本次删除。
  - 母语救场在 `processAssistTranscript()` 中调用 `assistReplyService.translateTranscript()`，随后把结果写入会话流并可选触发 TTS。
- `src/features/live/services/TranslationService.ts`
  - 当前通过 `invokeEdgeFunction({ functionName: "assist-reply" })` 请求翻译。
  - 请求体会传 `scene_hint`、`direction`、`target_language`、`learning_language`、`native_language`、`tts_mode`。
  - 返回值优先读 `translated_text`，兼容旧字段 `english_reply`。
- `src/features/live/services/AssistReplyService.ts`
  - 当前同样请求 `assist-reply`。
  - 返回结构命名仍带有 `learningReply` / `english_reply` / `hint`，语义偏“生成回复”。
- `supabase/functions/assist-reply/index.ts`
  - 当前核心逻辑是：组装 prompt -> 调 `_shared/llm.ts` -> 从文本/JSON 中提取翻译结果 -> 可选用 Deepgram 做 cloud TTS。
  - 本质仍是“LLM 翻译”，不是专用 Translator API。

### 现有语义不一致点

- 救场链路已经被产品定义为“母语识别 -> 学习语言翻译 -> 学习语言 TTS”，但代码与文案中仍有大量 “reply / generate / suggested reply” 语义残留。
- `scene_hint` 目前只对 prompt 有意义；切到 Google Translate 后，这个字段对翻译结果不再生效，但为了兼容现有调用可继续保留入参。
- `NativeAssistCard.tsx` 与部分 i18n 文案使用 `englishText`、`suggestedReply` 等命名，后续应统一为更中性的“translated text / learning translation”语义。

## Proposed Changes

### 1. Edge Function：把 `assist-reply` 的翻译核心替换为 Google Translate v2

#### 文件：`supabase/functions/assist-reply/index.ts`

- 保留：
  - Supabase 鉴权逻辑。
  - 当前请求体兼容解析能力（camelCase + snake_case）。
  - 当前响应体关键字段：`source_text`、`direction`、`target_language`、`translated_text`，以及兼容字段 `english_reply`。
- 替换：
  - 删除该函数对 `createLlmRuntime()`、`withLlmDefaults()`、`extractJsonObject()` 的依赖。
  - 改为直接调用 Google Translate v2 REST API：`https://translation.googleapis.com/language/translate/v2`。
  - 使用新的 secret：`GOOGLE_TRANSLATE_API_KEY`。
- 具体实现：
  - 解析 `direction`、`target_language`、`learning_language`、`native_language`，继续沿用当前 target 解析优先级。
  - 增加语言码归一化函数，把 BCP-47 标签映射成 Google Translate 更稳定接受的格式：
    - `zh-CN -> zh-CN`
    - `pt-BR -> pt`
    - 其他如 `en` / `es` / `ja` / `ko` / `fr` / `de` 保持 primary tag。
  - 请求体采用 `q=<sourceText>`、`target=<normalizedTarget>`、`format=text`。
  - 不显式传 `source`，让 Google 自动检测源语言，避免主链路与救场链路额外维护 source 判定分支。
  - 用 `translatedText` 作为标准输出，必要时做一次 HTML entity decode，防止 Google 返回 `&#39;` 之类实体。
  - `tts_mode` 继续解析但默认不做 cloud TTS；本次客户端全部传 `none`，因此可保留字段兼容但不再走 LLM prompt。
  - `hint` 固定返回 `null`，因为严格直译方案不再生成解释性 hint。
  - `english_reply` 仅在目标语言为英语时继续回填，作为兼容字段。
- 错误处理：
  - 缺少 `GOOGLE_TRANSLATE_API_KEY` 时返回 500。
  - Google 非 2xx 时透传其 status/body 到 502，延续当前前端错误处理模式。
  - 空翻译结果时返回 502，错误语义改为 “Failed to translate text”。

#### 文件：`supabase/functions/_shared/googleTranslate.ts`（新增）

- 抽一个轻量 helper，封装：
  - 目标语言归一化。
  - Google v2 请求。
  - HTML entity decode。
- 目的：
  - 避免 `assist-reply/index.ts` 继续膨胀。
  - 后续如果再新增独立 `translate` function 或别的翻译入口，可直接复用。

### 2. 客户端服务：把“生成回复”语义收口成“翻译”

#### 文件：`src/features/live/services/TranslationService.ts`

- 保持服务仍用于“主消息流翻译”，但其职责收敛为 `other -> native`。
- 请求目标继续是 `assist-reply`，但将其视为“翻译代理”而非 LLM reply。
- 清理与翻译无关的响应依赖：
  - 仍优先读取 `translated_text`。
  - `english_reply` 仅保留为兼容 fallback。
  - `hint`、`sceneHint` 在客户端不新增任何依赖。
- 注释需更新为“Google translator-backed translation”，避免后续阅读误判。

#### 文件：`src/features/live/services/AssistReplyService.ts`

- 保持服务名不变以减少外部联动，但内部语义改成“assist translation”：
  - `translateTranscript()` 继续存在。
  - `AssistReplyResult.learningReply` 保留或改名为 `learningTranslation`，二选一中选择“改名”以匹配严格直译语义。
- 决策：
  - 本次直接把返回字段本地命名改为 `learningTranslation`，并同步修改调用方，避免继续传播“reply”误导。
  - 接口读取层仍兼容 `translated_text` 与 `english_reply`。
  - `hint` 仍保留可选字段，但在新后端下预期恒为 `null`。

### 3. 救场 UI 与状态文案：从“生成回复”改为“翻译结果”

#### 文件：`src/features/live/hooks/useLiveSessionController.ts`

- 删除主链路 `speaker === "self"` 时的 `translationService.translate({ direction: "to_learning" })` 分支：
  - 自己说母语不再在普通主消息流里自动挂学习语言翻译。
  - 这类需求只保留 SOS 母语救场承载。
- 保持救场主流程不变：
  - 母语 transcript -> 请求翻译 -> 写入会话流 -> 可选朗读学习语言。
- 调整内部命名与占位文本：
  - 占位文案从 “Translating and generating learning-language reply...” 改为纯翻译语义。
  - debug step 描述从 “Generating learning-language reply...” 改为 “Translating to learning language...”。
  - 错误提示从 “Failed to generate a learning-language reply...” 改为 “Failed to translate to the learning language...”。
- 同步适配 `AssistReplyService` 的结果字段改名。

#### 文件：`src/features/live/components/NativeAssistCard.tsx`

- 将 `englishText` 重命名为更中性的 `translatedText` 或 `learningText`，本次采用 `translatedText`。
- 标题文案从 `Suggested reply` 改为 `Translation` / `Learning-language translation` 对应的 i18n key。
- 保留当前视觉结构，不改版式。

#### 文件：`src/shared/i18n/locales/en.ts`
#### 文件：`src/shared/i18n/locales/zh-CN.ts`

- 更新 `live.nativeAssist` 下的文案语义：
  - `generating` 改成翻译语义。
  - `ready` 改成翻译完成语义。
  - `suggestedReply` 改成翻译结果语义。
- 如现有 key 名已明显误导，可在本次同时重命名 key；若改 key 波及较大，则先只改 value，优先稳妥。
- 决策：
  - 本次优先只改 value，不改 i18n key 名，减少联动面；组件层展示语义变正确即可。

### 4. 长期维护文档：补充翻译架构变更

#### 文件：`.trae/rules/agents-should-know.md`

- 更新实时转写/翻译约定：
  - 主消息流翻译与救场翻译不再依赖通用 LLM。
  - 当前统一由 `assist-reply` Edge Function 代理 Google Translate v2。
  - `suggest` / `review` 仍使用 LLM。

#### 文件：`.trae/rules/experience.md`

- 如实施过程中确认 Google Translate v2 对 BCP-47 语言标签存在兼容性边界（例如 `pt-BR` 需降级为 `pt`），把这条经验补入文档，避免后续再次踩坑。

## Assumptions & Decisions

- 决定不新建公开的 `translate` Edge Function，而是复用现有 `assist-reply` endpoint：
  - 原因：当前仓库仅有两个客户端入口依赖它，且都属于翻译链路。
  - 这样可以保留现有请求路径与鉴权方式，降低前后端同步改动和旧版本兼容风险。
- 决定不在本次保留“Google 翻译 + LLM 二次润色”双阶段链路：
  - 用户已明确要求救场使用严格直译。
  - 对方消息翻译本质也是理解型辅助，直译更稳定可预期。
- 决定删除主链路中 `self -> learning` 的自动翻译：
  - 用户确认这不应属于主链路能力。
  - 母语转学习语言统一收敛到 SOS 救场链路，避免两条入口语义重叠。
- 决定不改动 `suggest` / `review` / cloud TTS 之外的 LLM 基础设施：
  - `_shared/llm.ts` 仍被其他函数使用。
  - 本次只把 `assist-reply` 从其依赖中移除。
- 决定继续接受 `scene_hint` 入参但在 Google 翻译实现中忽略：
  - 这是为了兼容当前客户端请求形状。
  - 后续如要进一步收敛接口，再单独清理。
- 决定由 Supabase secret 管理 Google Key，而不是在 Expo 客户端直连 Google：
  - 避免泄露 API Key。
  - 继续复用现有鉴权、日志与错误封装链路。

## Verification Steps

### 代码层验证

- 对刚修改的 TS/TSX 文件运行诊断，确保没有新增类型或 lint 问题。
- 重点检查：
  - `src/features/live/services/TranslationService.ts`
  - `src/features/live/services/AssistReplyService.ts`
  - `src/features/live/hooks/useLiveSessionController.ts`
  - `src/features/live/components/NativeAssistCard.tsx`
  - `src/shared/i18n/locales/en.ts`
  - `src/shared/i18n/locales/zh-CN.ts`

### Edge Function 验证

- 在本地环境文件中补充 `GOOGLE_TRANSLATE_API_KEY`。
- 运行 `supabase/functions/sync-secrets.sh development` 将 secret 推到 Supabase。
- 仅部署受影响函数：
  - `supabase/functions/deploy.sh development assist-reply`

### 功能验证

- 场景 1：对方说学习语言
  - 触发 `translationService.translate({ direction: "to_native" })`
  - 气泡下方应显示母语翻译。
- 场景 2：自己说母语
  - 主链路普通 turn 不再自动触发 `self -> learning` 翻译。
  - 气泡下方不应再出现这类自动翻译结果。
- 场景 3：母语救场
  - 录入母语后，应生成严格直译的学习语言文本。
  - 若选择朗读，TTS 应朗读该翻译文本，而不是 LLM 改写版本。
- 场景 4：错误路径
  - 缺失/错误的 Google Key 时，前端应走现有错误提示，不应卡死在 loading。

### 回归关注点

- `suggest` / `review` 功能不应受影响。
- 主链路的低置信度门控逻辑不应受影响；翻译仍可在低置信度下触发。
- 当前只计划做轻量静态验证与定向功能验证，不做完整 iOS 编译构建，符合本项目工作流约定。
