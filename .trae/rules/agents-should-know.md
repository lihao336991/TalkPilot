# TalkPilot 全局上下文与协作约定

## 文档定位

- 这个文件是 **TalkPilot 项目的长期上下文入口**
- 未来所有 AI 会话都应优先阅读本文件，再开始分析、修改、调试项目
- 每次完成重要实现、修复关键问题、确认新的项目约定后，都应继续补充和更新本文件
- 更新原则是 **保留长期有效信息**，不要只记录一次性操作日志

## 项目概况

- 项目名称：TalkPilot
- 当前形态：React Native / Expo 客户端项目
- 项目来源：基于同级 `TwilightTales` 工程复制并清理出的新应用骨架
- 主要目标：承载一个“实时英语对话辅助”产品的客户端体验
- 路由入口：`expo-router/entry`

## 技术栈

- Expo SDK：`~54.0.33`
- React：`19.1.0`
- React Native：`0.81.5`
- iOS 最低版本：`17.0`
- 路由：`expo-router`
- 动画：`react-native-reanimated`
- 安全区：`react-native-safe-area-context`
- 图标：`@expo/vector-icons`
- 样式：`nativewind + tailwindcss`
- 原生壳：保留当前项目的 Expo prebuild iOS Swift 壳结构

## 当前项目结构重点

- `app/`：Expo Router 路由入口，保持薄路由文件
- `app/(tabs)/`：底部 Tab 页面容器
- `app/(dev)/test.tsx`：开发联调页
- `src/features/live/`：实时对话首页壳
- `src/features/history/`：会话记录壳
- `src/features/coach/`：表达建议 / 场景练习壳
- `src/features/profile/`：个人中心壳
- `src/features/navigation/`：自定义 TabBar、Tab 顶部头部与滚动骨架
- `src/shared/`：共享 hooks、API、仓储与常量
- `src/storage/`：本地缓存与持久化能力

## 当前产品壳状态

- 底部导航继续使用自定义 TabBar，不使用系统默认样式
- 当前保留 4 个一级 tab：`Live`、`History`、`Coach`、`Profile`
- 首页当前是实时英语对话辅助产品的占位壳，包含实时会话、快捷场景、能力概览模块
- `History` / `Coach` / `Profile` 已提供占位结构，后续可继续替换为真实业务
- 当前保留 `ios/` 原生壳，工程名、scheme、bundle identifier 已切换为 `TalkPilot`

## 用户偏好与工作方式

- 这是客户端工程，用户通常会自己在 Xcode 中编译构建
- 默认不要在中间流程里频繁自动跑完整构建，以提高效率
- 优先通过静态检查、类型检查、局部验证来确认修改是否正确
- 如果确实需要运行命令验证，优先选择轻量命令，例如 `npx tsc --noEmit`

## 关键实现约定

### 路由与页面

- 底部导航使用 `expo-router` 的 Tabs 承载
- `app/` 下的文件尽量只做页面注册、参数透传和简单布局壳
- 自定义底部导航 UI 由 `src/features/navigation/components/CustomTabBar.tsx` 控制
- 可滚动 Tab 页面优先复用 `src/features/navigation/components/TabScrollScreen.tsx`
- 需要新增业务页面时，优先在 `src/features/` 下按业务域分目录组织

### 目录分层

- `src/features/`：按业务域组织页面、组件、hooks、store、services
- `src/shared/`：只放跨业务复用能力，不放单个页面专属实现
- `src/storage/`：只放本地缓存、SQLite、AsyncStorage 持久化适配
- 工程化脚本统一优先放到 `scripts/`
- 大体积原始数据与脚本生成产物优先放到 `data/`

### LLM 约定

- 实时会话相关的 LLM 能力由 Supabase Edge Functions `supabase/functions/review` 与 `supabase/functions/suggest` 提供
- 两个函数共享 `supabase/functions/_shared/llm.ts` 的 provider 配置，默认 provider 为 `minimax`，默认模型为 `minimax-2.5`
- 当前支持 `openai`、`deepseek`、`minimax` 三类 OpenAI-compatible provider，通过 `LLM_PROVIDER` 与 `LLM_MODEL` 环境变量切换
- `review` / `suggest` 的请求体兼容 camelCase 与 snake_case 字段，避免客户端与 Edge Function 命名不一致导致调用失败

### 原生壳约定

- 当前工程保留了 Expo prebuild 生成的 `ios/` 目录，便于直接在 Xcode 中继续演进
- iOS deployment target 保持为 `17.0`
- 如需重新生成原生壳，优先使用 `npm run rebuild:ios`
- 如果后续修改应用标识，需同时更新 `app.json` 与 `ios/` 工程配置

## 后续维护约定

- 任何会长期影响后续会话的信息，都应该写进本文件
- 新增页面结构、依赖升级、架构变更、验证方式变化，都应更新本文件
- 后续 AI 在结束任务前，应自查“这次是否产生了值得长期保留的上下文”
