# TalkPilot MVP 实现计划

## 一、概要

基于产品文档和技术方案，为 TalkPilot 制定分阶段的 MVP 实现计划。当前项目已有 Expo + React Native 骨架（4 个 Tab 占位壳、自定义 TabBar、Supabase 客户端、zustand 状态管理、nativewind 样式），需要在此基础上实现三大 P0 核心功能：**实时对话引擎**、**AI 实时回复建议**、**即时语言 Review**。

***

## 二、当前状态分析

### 已有能力

| 类别   | 已有内容                                                      |
| ---- | --------------------------------------------------------- |
| 路由框架 | expo-router, 4 个 tab（Live / History / Coach / Profile）占位壳 |
| 导航组件 | CustomTabBar, TabScrollScreen, TabScreenHeader            |
| 状态管理 | zustand 已安装，尚未创建业务 store                                  |
| 后端连接 | @supabase/supabase-js 已初始化（`src/shared/api/supabase.ts`）  |
| 本地存储 | AppCache 工具类、react-native-mmkv、expo-sqlite                |
| 样式体系 | nativewind + tailwindcss，暗色卡片风格已建立                        |
| 原生壳  | iOS prebuild 保留，已声明麦克风权限（`NSMicrophoneUsageDescription`）  |
| 环境变量 | `.env` 中已有 Supabase URL/Key                               |

### 需要新增

| 类别                      | 说明                                                              |
| ----------------------- | --------------------------------------------------------------- |
| 音频采集                    | 使用 `react-native-live-audio-stream` 进行流式 PCM 音频采集，支持逐词实时转录 |
| ASR 引擎                  | Deepgram WebSocket 直连（Pro）/ whisper.rn 端侧（Free）                 |
| LLM 服务                  | 通过 Supabase Edge Function 调用 OpenAI GPT-4o-mini                 |
| 实时对话 UI                 | 对话气泡流、建议卡片、Review 指示条                                           |
| Zustand stores          | conversationStore、suggestionStore、reviewStore、sessionStore      |
| Supabase Edge Functions | deepgram-token、suggest、review、end-session                       |
| 数据库表                    | profiles、sessions、turns、suggestions、reviews、vocabulary          |

***

## 三、分阶段实现计划

### Phase 0：基础设施搭建（第 1 周前半）

> 目标：让项目具备音频采集、Supabase 后端通信、核心状态管理的基础能力。

#### 0.1 新增依赖安装

```
需要安装的包：
- react-native-live-audio-stream  # 流式 PCM 音频采集，每 ~100ms 回调音频 buffer，直接送入 Deepgram WebSocket
- expo-av                        # TTS 朗读建议（播放功能）
```

> **已确认决策**：音频采集直接使用 `react-native-live-audio-stream` 走流式方案。理由：
> 1. 保证"逐词实时转录"核心体验（对方说话时文字同步出现）
> 2. 满足端到端延迟 < 2s 的技术指标
> 3. 支持 Deepgram interim_results 中间结果展示
> 4. 不使用 expo-av 的切段方案（延迟 3-4s，超标且体验降级为"整句蹦出"）

#### 0.2 Supabase 数据库初始化

* 在 Supabase Dashboard 或通过 `supabase` CLI 执行建表 SQL

* 表结构按技术方案第六章执行：`profiles`, `sessions`, `turns`, `suggestions`, `reviews`, `vocabulary`

* 开启 RLS 策略

* 创建 `check_daily_usage` 函数

**文件变更**：

* 新建 `supabase/` 目录（项目根目录），包含 `migrations/001_init.sql` 和 `config.toml`

#### 0.3 环境变量扩展

`.env` 中追加：

```
EXPO_PUBLIC_DEEPGRAM_WS_URL=wss://api.deepgram.com/v1/listen
```

> 注意：Deepgram API Key 和 OpenAI API Key 不放在客户端，只存在于 Supabase Edge Function 环境变量中。

#### 0.4 核心 Zustand Stores 创建

| Store 文件               | 路径                         | 职责                                     |
| ---------------------- | -------------------------- | -------------------------------------- |
| `conversationStore.ts` | `src/features/live/store/` | 管理当前对话的 turns 列表、session 状态、当前 speaker |
| `suggestionStore.ts`   | `src/features/live/store/` | 管理 AI 回复建议的流式数据和最终结果                   |
| `reviewStore.ts`       | `src/features/live/store/` | 管理当前句的 Review 评分和问题列表                  |
| `sessionStore.ts`      | `src/features/live/store/` | 管理会话的创建、结束、场景配置                        |

#### 0.5 Supabase Auth 集成（简化版）

* MVP 阶段先实现匿名登录（`supabase.auth.signInAnonymously()`），跳过注册登录 UI

* 后续 Phase 再补充 Google/Apple 登录

* 在 `app/_layout.tsx` 中初始化 auth 状态

**文件变更**：

* 修改 `src/shared/api/supabase.ts`：添加 auth 初始化和 session 监听

* 新建 `src/shared/store/authStore.ts`：管理用户认证状态和订阅等级

***

### Phase 1：实时对话引擎（第 1 周后半 \~ 第 2 周）

> 目标：用户点击"开始对话"按钮后，App 开始实时录音 → ASR 转录 → 对话气泡流展示。

#### 1.1 音频采集服务

**新建文件**：`src/features/live/services/AudioEngine.ts`

核心逻辑：
- 使用 `react-native-live-audio-stream` 进行实时 PCM 音频采集
- 配置：sampleRate=16000, channels=1, bitsPerSample=16, bufferSize=4096
- 注册 `onAudioData` 回调，每次收到 PCM buffer 后立即通过 WebSocket 发送给 Deepgram
- 管理录音的生命周期（开始/暂停/停止）
- 处理麦克风权限请求

> 流式方案数据流：`麦克风 → live-audio-stream 回调 PCM chunk (~100ms) → WebSocket 发送 → Deepgram 实时返回逐词 transcript`

#### 1.2 ASR 路由服务

**新建文件**：`src/features/live/services/ASRRouter.ts`

* 根据用户订阅类型（暂时固定为 free）选择 ASR 引擎

* Free 用户：端侧 Whisper（whisper.rn）—— 但考虑到 `whisper.rn` 需要额外 native module 和模型下载，MVP 可先统一使用 Deepgram 做验证

* Pro 用户：Groq Whisper API 或 Deepgram Streaming

> **MVP 简化决策**：初始版本统一使用 Deepgram WebSocket Streaming API，因为它同时提供 diarization（说话人分离）能力，一个连接解决 ASR + Speaker 两个问题。端侧 Whisper 作为后续成本优化再接入。

#### 1.3 Deepgram Token 获取

**新建 Edge Function**：`supabase/functions/deepgram-token/index.ts`

* 验证 Supabase Auth token

* 检查用量限制

* 生成 Deepgram 临时 API Key（10 分钟有效）

* 返回给客户端

**新建客户端服务**：`src/features/live/services/DeepgramTokenService.ts`

* 调用 Edge Function 获取临时 token

* 本地缓存 token，过期前刷新

#### 1.4 Deepgram Streaming 连接

**新建文件**：`src/features/live/services/DeepgramStreamingService.ts`

* 建立 WebSocket 连接到 Deepgram

* 参数：`model=nova-2, language=en, smart_format=true, interim_results=true, utterance_end_ms=1500, vad_events=true, diarize=true`

* 处理 `Results` 事件：提取 transcript、speaker 标签

* 处理 `UtteranceEnd` 事件：触发建议生成或 Review

* 管理连接生命周期

#### 1.5 说话人标定

* 首次对话时引导用户说一句话（如 "Hello, this is me"）

* 将对应的 Deepgram speaker ID 记为 self

* 存储到 `conversationStore` 和用户 profile 中

#### 1.6 对话界面重构

**重构文件**：`src/features/live/screens/LiveScreen.tsx`

当前是占位壳，需要改造为实际的对话界面。界面分两个状态：

**待机状态**（尚未开始对话）：

* 保留当前的场景选择 chips

* 显示大的"开始对话"按钮

* 显示今日剩余时长

**对话状态**（对话进行中）：

* 上方：滚动对话流（TranscriptBubble 组件）

* 下方：AI 建议区域（SuggestionCard 组件，Phase 2 实现）

* 底部工具栏：暂停/继续、结束对话

**新建组件**：

| 组件                        | 路径                              | 说明                              |
| ------------------------- | ------------------------------- | ------------------------------- |
| `TranscriptBubble.tsx`    | `src/features/live/components/` | 对话气泡，区分 self（右侧蓝色）和 other（左侧灰色） |
| `ConversationFlow.tsx`    | `src/features/live/components/` | 对话流列表容器，FlatList 自动滚动到底部        |
| `ConversationToolbar.tsx` | `src/features/live/components/` | 底部操作栏（暂停/结束）                    |
| `StartSessionCard.tsx`    | `src/features/live/components/` | 待机状态的开始对话卡片                     |
| `SpeakerCalibration.tsx`  | `src/features/live/components/` | 说话人标定引导弹窗                       |

***

### Phase 2：AI 实时回复建议（第 3 周）

> 目标：对方说完后 2 秒内展示 2 条不同风格的回复建议。

#### 2.1 建议生成 Edge Function

**新建 Edge Function**：`supabase/functions/suggest/index.ts`

* 从 DB 读取最近 10 轮上下文

* 构建 Prompt（含场景信息）

* 调用 GPT-4o-mini Streaming API

* 流式返回 SSE 给客户端

#### 2.2 客户端建议服务

**新建文件**：`src/features/live/services/SuggestionService.ts`

* 在 `onUtteranceEnd(speaker='other')` 时触发

* 向 Edge Function 发起 HTTP POST（SSE 模式）

* 流式读取并增量更新 `suggestionStore`

* 解析完整 JSON 后展示卡片

#### 2.3 建议卡片 UI

**新建组件**：`src/features/live/components/SuggestionCard.tsx`

* 从底部滑入动画（react-native-reanimated）

* 半透明背景，不遮挡对话流

* 显示 2 条建议（Formal / Casual 风格标签）

* 支持点击展开/收起

* 用户开始说话时自动收起淡出

**新建组件**：`src/features/live/components/SuggestionPanel.tsx`

* 建议区域容器，管理建议的显示/隐藏状态

* 监听 `suggestionStore` 状态变化

***

### Phase 3：即时语言 Review（第 4 周）

> 目标：用户说完一句话后，即时展示轻量级语言质量反馈。

#### 3.1 Review Edge Function

**新建 Edge Function**：`supabase/functions/review/index.ts`

* 接收用户语句 + session\_id + 场景

* 短句（< 4 词）跳过

* 从 DB 读取最近 6 轮上下文

* 调用 GPT-4o-mini（非流式，需完整 JSON）

* 返回 `{ overall_score, issues, better_expression, praise }`

* 异步存储 review 结果

#### 3.2 客户端 Review 服务

**新建文件**：`src/features/live/services/ReviewService.ts`

* 在 `onUtteranceEnd(speaker='self')` 时触发

* 向 Edge Function 发起 HTTP POST

* 更新 `reviewStore`

#### 3.3 Review 指示条 UI

**新建组件**：`src/features/live/components/ReviewIndicator.tsx`

按产品文档的三层反馈设计：

* **L1**：句子下方颜色指示条（绿/黄/红），常驻直到下一句

* **L2**：点击颜色条后弹出详细纠正卡片（错误标注 + 正确形式）

* **L3**：详细内容自动存入对话复盘（Phase 4 实现）

**新建组件**：`src/features/live/components/ReviewDetailCard.tsx`

* 弹窗形式展示具体错误

* 显示 `issues`（original → corrected + 中文解释）

* 显示 `better_expression`

* 显示 `praise`

***

### Phase 4：完整闭环（第 5-6 周）

> 目标：补全用户流程——会话管理、对话复盘、历史记录。

#### 4.1 会话生命周期管理

**新建文件**：`src/features/live/services/SessionManager.ts`

* 创建会话：在 Supabase 创建 `sessions` 记录

* 实时存储：每轮 turn 实时 insert 到 `turns` 表

* 结束会话：更新 `sessions.ended_at` 和 `duration_seconds`

* 用量统计：更新 `profiles.daily_minutes_used`

#### 4.2 结束对话 Edge Function

**新建 Edge Function**：`supabase/functions/end-session/index.ts`

* 汇总本次对话数据

* 生成对话复盘报告摘要（调用 LLM）

* 提取新词汇加入 `vocabulary` 表

* 返回报告数据

#### 4.3 对话复盘页面

**新建路由**：`app/report/[id].tsx`（Stack 页面，非 Tab）

**新建组件**：`src/features/history/screens/ReportScreen.tsx`

展示内容：

* 对话全文（带时间戳和 speaker 标识）

* 错误汇总（所有 review 中的 issues）

* 新词收录

* 本次亮点（praise 汇总）

#### 4.4 历史记录页面改造

**改造文件**：`src/features/history/screens/HistoryScreen.tsx`

* 从 Supabase 查询 `sessions` 列表

* 展示每次对话的摘要（时长、turn 数、评分分布）

* 点击进入对话复盘页面

#### 4.5 场景预设功能

**新建组件**：`src/features/live/components/SceneSelector.tsx`

* 预设场景列表（校园学术、日常生活、职场工作、社交娱乐）

* 自由对话模式（默认）

* 选择后存入 `sessionStore`，传递给 LLM prompt

***

### Phase 5：体验打磨与上线准备（第 7-8 周）

#### 5.1 UI 动效打磨

* 建议卡片进入/退出动画

* 对话气泡出现动画

* Review 指示条动画

* 录音状态呼吸灯效果

#### 5.2 异常处理

* 网络断开重连逻辑

* ASR 连接超时处理

* Edge Function 调用失败降级

* 麦克风权限被拒处理

#### 5.3 隐私合规

* 首次使用隐私协议弹窗

* 麦克风权限请求引导

* 对话数据删除功能

#### 5.4 App Store 准备

* 应用图标和截图

* 隐私政策页面

* App Store 描述文案

***

## 四、目录结构规划

```
src/
├── features/
│   ├── live/                          # 实时对话核心功能
│   │   ├── components/
│   │   │   ├── ConversationFlow.tsx    # 对话流列表
│   │   │   ├── TranscriptBubble.tsx    # 对话气泡
│   │   │   ├── SuggestionPanel.tsx     # 建议区域容器
│   │   │   ├── SuggestionCard.tsx      # 建议卡片
│   │   │   ├── ReviewIndicator.tsx     # Review 颜色条
│   │   │   ├── ReviewDetailCard.tsx    # Review 详情弹窗
│   │   │   ├── ConversationToolbar.tsx # 底部操作栏
│   │   │   ├── StartSessionCard.tsx    # 开始对话卡片
│   │   │   ├── SpeakerCalibration.tsx  # 说话人标定
│   │   │   └── SceneSelector.tsx       # 场景选择器
│   │   ├── screens/
│   │   │   └── LiveScreen.tsx          # 实时对话主页面（改造）
│   │   ├── services/
│   │   │   ├── AudioEngine.ts          # 音频采集引擎
│   │   │   ├── ASRRouter.ts            # ASR 路由（端侧/云端切换）
│   │   │   ├── DeepgramStreamingService.ts  # Deepgram 流式连接
│   │   │   ├── DeepgramTokenService.ts # Deepgram Token 获取
│   │   │   ├── SuggestionService.ts    # AI 建议获取
│   │   │   ├── ReviewService.ts        # 语言 Review 获取
│   │   │   └── SessionManager.ts       # 会话生命周期管理
│   │   └── store/
│   │       ├── conversationStore.ts    # 对话 turns 状态
│   │       ├── suggestionStore.ts      # AI 建议状态
│   │       ├── reviewStore.ts          # Review 状态
│   │       └── sessionStore.ts         # 会话配置与状态
│   ├── history/
│   │   └── screens/
│   │       ├── HistoryScreen.tsx       # 历史记录（改造）
│   │       └── ReportScreen.tsx        # 对话复盘报告（新增）
│   ├── coach/                         # P1，暂不动
│   ├── profile/                       # 后续补充设置功能
│   └── navigation/                    # 现有导航组件不变
├── shared/
│   ├── api/
│   │   └── supabase.ts               # 已有，小幅修改
│   ├── store/
│   │   └── authStore.ts              # 新增：认证状态
│   └── ...
└── storage/                           # 已有缓存能力
```

```
supabase/                              # 项目根目录新增
├── functions/
│   ├── deepgram-token/index.ts
│   ├── suggest/index.ts
│   ├── review/index.ts
│   └── end-session/index.ts
├── migrations/
│   └── 001_init.sql
└── config.toml
```

***

## 五、关键技术决策汇总

| #  | 决策            | 选择                                              | 理由                                                  |
| -- | ------------- | ----------------------------------------------- | --------------------------------------------------- |
| 1  | MVP 阶段 ASR 方案 | Deepgram Streaming（所有用户统一）                      | 同时解决 ASR + diarization，开发效率最高；端侧 Whisper 后续作为成本优化接入 |
| 2 | 音频采集方案 | react-native-live-audio-stream 流式采集 | 保证逐词实时转录体验、端到端延迟 < 2s、支持 interim_results |
| 3  | 说话人分离         | Deepgram 内置 diarize + 用户首次标定                    | 零额外代码，加一个参数即可                                       |
| 4  | MVP 认证方案      | Supabase 匿名登录                                   | 快速验证核心功能，后续再补登录 UI                                  |
| 5  | 状态管理          | Zustand（已安装）                                    | 项目已选型，轻量，适合实时数据流                                    |
| 6  | 后端架构          | Supabase Edge Functions（Serverless）             | 零运维，按技术方案设计                                         |
| 7  | LLM 模型        | GPT-4o-mini                                     | 按技术方案，性价比最高                                         |
| 8  | 建议生成通信        | HTTP POST + SSE 流式返回                            | 比 WebSocket 简单，Edge Function 原生支持                   |
| 9  | Review 通信     | HTTP POST 非流式                                   | Review 需要完整 JSON 结构                                 |
| 10 | 对话数据存储        | 实时 insert turns 到 Supabase                      | 保证数据不丢失，复盘时有完整记录                                    |

***

## 六、实施优先级与依赖关系

```
Phase 0（基础设施）
    ├── 0.2 数据库建表
    ├── 0.3 环境变量
    ├── 0.4 Zustand Stores
    └── 0.5 Auth 集成
         ↓
Phase 1（对话引擎）—— 最核心，需最先完成
    ├── 1.1 音频采集
    ├── 1.3 Deepgram Token Edge Function
    ├── 1.4 Deepgram Streaming 连接
    ├── 1.5 说话人标定
    └── 1.6 对话 UI
         ↓
Phase 2（回复建议）—— 依赖 Phase 1 的 UtteranceEnd 事件
    ├── 2.1 Suggest Edge Function
    ├── 2.2 SuggestionService
    └── 2.3 Suggestion UI
         ↓ （可与 Phase 2 并行）
Phase 3（即时 Review）—— 同样依赖 Phase 1 的 UtteranceEnd 事件
    ├── 3.1 Review Edge Function
    ├── 3.2 ReviewService
    └── 3.3 Review UI
         ↓
Phase 4（完整闭环）
    ├── 4.1 SessionManager
    ├── 4.2 End-session Edge Function
    ├── 4.3 复盘页面
    ├── 4.4 历史记录改造
    └── 4.5 场景预设
         ↓
Phase 5（打磨上线）
```

> **Phase 2 和 Phase 3 可以并行开发**，因为它们都只依赖 Phase 1 的 UtteranceEnd 事件触发点，互相之间没有依赖。

***

## 七、验证策略

由于用户偏好在 Xcode 中自行构建，验证策略以静态检查和局部验证为主：

1. **每个 Phase 完成后**：运行 `npx tsc --noEmit` 确保类型正确
2. **Edge Functions**：可通过 `supabase functions serve` 本地测试
3. **核心服务**：编写简单的集成测试或利用 `app/(dev)/test.tsx` 页面进行手动联调
4. **端到端验证**：在 `app/(dev)/test.tsx` 中创建调试入口，测试 ASR 连接、建议生成、Review 功能

***

## 八、风险项与缓解

| 风险                     | 缓解措施                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| react-native-live-audio-stream 与 Expo prebuild 兼容性 | 该库支持 RN 0.60+，需 prebuild 后手动验证 iOS 工程能正常链接；必要时在 app.json plugins 中配置 |
| Deepgram diarize 准确率不够 | MVP 先用，如果体验差再加耳机双通道方案（需 native module）                               |
| Edge Function 冷启动延迟    | Supabase Edge Function 基于 Deno Deploy，冷启动 < 200ms，可接受                |
| 实时场景下的网络抖动             | 客户端做 WebSocket 重连逻辑 + 本地缓存未发送的 turn                                  |
| App Store 审核录音权限       | Info.plist 已声明用途说明，需补充隐私政策页面                                         |

