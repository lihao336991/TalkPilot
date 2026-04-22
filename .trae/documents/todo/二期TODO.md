# TalkPilot 二期 TODO

## Cloud TTS（云端语音合成）

> **一期状态**：已预留服务端逻辑，但客户端统一传 `tts_mode: 'none'`，未实际启用。  
> **暂不启用原因**：成本考虑。Deepgram Cloud TTS 按字符计费，高频使用下变动成本显著。  
> **二期计划**：接入云端 TTS 作为 Pro 会员权益，替代本地 `expo-speech`，提升非英语语言的播放质量。需同步完成：
> - 客户端根据会员状态动态传 `tts_mode: 'cloud'`
> - 服务端扩展多语言 TTS provider（Deepgram / 备选）
> - 将会员权益写入 `FeatureAccessEnvelope`，无权限时降级本地 TTS

## Coach Tab（已在一期隐藏，`href: null`）

Coach Tab 是产品差异化的重要模块，目前为占位符状态，一期上线前已通过 `href: null` 隐藏。

### 需要实现的功能

- [ ] **场景化练习模板**：预设 Job Interview、Casual Chat、Business Meeting 等场景的口语练习流程
- [ ] **Reply Polish 钻取**：给定一段回复，AI 帮助精简并保持友好自信的语气
- [ ] **Rephrase Intent**：一键在 casual / business / interview 三种语气之间切换表达
- [ ] **Repair Moments**：处理 "Sorry, could you repeat that?" 等澄清场景的专项练习
- [ ] **表达包（Expression Packs）**：按场景分类的高频表达收藏与练习
- [ ] **Review Rubrics**：可配置的评分维度（流利度、语法、词汇、自然度）
- [ ] **练习历史与进度追踪**：记录每次 Coach 练习的得分和改进趋势

### 技术依赖

- 复用 `supabase/functions/suggest` 和 `review` 的 LLM 能力
- 需要新增 `coach_sessions` 数据表记录练习记录
- 场景选择 UI 可与 Live Tab 的场景选择共用组件

### 参考文件

- `src/features/coach/screens/CoachScreen.tsx` — 当前占位符，二期直接在此扩展
- `app/(tabs)/community.tsx` — 路由入口，取消 `href: null` 即可恢复显示
