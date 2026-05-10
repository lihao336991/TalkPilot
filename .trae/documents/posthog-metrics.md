# PostHog 接入与核心指标埋点（TalkPilot）

更新时间：2026-05-04

目标：
- 用 PostHog 监控核心业务链路的漏斗与关键指标：Live 会话、Copilot（suggest/review）、翻译、复盘、付费。
- 埋点尽量“低噪音、可聚合、可对账”，避免把文本内容或敏感信息发出去。

---

## 1) 配置方式（客户端）

### 1.1 环境变量

在 `.env.production` / `.env.development`（或 EAS secrets）里配置：

```bash
EXPO_PUBLIC_POSTHOG_API_KEY=
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# 可选：允许 dev 环境打点（默认 false，避免污染数据）
EXPO_PUBLIC_POSTHOG_DEV_ENABLED=false

# 可选：强制关闭（优先级最高）
EXPO_PUBLIC_POSTHOG_DISABLED=false
```

说明：
- `EXPO_PUBLIC_*` 会进入客户端包体，PostHog 的 project key 属于“公开 key”，可放在这里。
- `EXPO_PUBLIC_POSTHOG_HOST` 如果你用 EU/自建 PostHog，替换为对应 host。

### 1.2 初始化与识别

入口：
- 初始化：`app/_layout.tsx` -> `analytics.init()`
- identify：`app/_layout.tsx` 监听 `userId/authMode/subscription`，调用 `analytics.identify(userId, ...)`
- screen view：`app/_layout.tsx` 监听导航 state，调用 `analytics.screen(route.name)`

埋点封装：
- `src/shared/analytics/analytics.ts`

---

## 2) 事件定义（当前已接入）

### 2.1 App / 导航
- `app_boot`：启动后初始化完成
- `screen_view`：页面曝光（只上报 route name）

### 2.2 认证
- `auth_session_applied`：Session 写入 store（包含 auth_mode / subscription_tier / subscription_status）

### 2.3 Live 会话
- `live_start_attempted`：点击开始会话（含 scene/coplay）
- `live_start_blocked`：因额度等原因无法开始
- `live_start_blocked_opened_paywall`：被拦截后跳转 Paywall
- `live_start_requires_enrollment`：需要先做声纹采样/注册
- `live_start_cancelled`：取消开始流程
- `live_start_failed`：开始失败（只记录 error name/message 片段）
- `live_session_end_requested`：用户主动结束
- `live_session_ended`：会话结束落地
- `copilot_toggled`：会话内 Copilot 开关

### 2.4 Suggest / Review / Recap（LLM）
- `llm_suggest_requested` / `llm_suggest_succeeded` / `llm_suggest_failed`
- `llm_review_requested` / `llm_review_succeeded` / `llm_review_failed`
- `llm_session_recap_requested` / `llm_session_recap_succeeded` / `llm_session_recap_failed`

说明：
- `*_succeeded` 会带 `llm_provider/llm_model/llm_route_mode`（来自响应 header）。
- 不上传用户文本内容，不上传 sessionId。

### 2.5 翻译（Azure）
- `translation_requested` / `translation_succeeded` / `translation_failed`

### 2.6 付费（RevenueCat）
- `billing_revenuecat_configure_started` / `billing_revenuecat_configure_completed`
- `billing_paywall_present_attempted`
- `billing_purchase_started` / `billing_purchase_succeeded` / `billing_purchase_failed` / `billing_purchase_cancelled`
- `billing_restore_started` / `billing_restore_succeeded` / `billing_restore_failed` / `billing_restore_cancelled`

### 2.7 权限/门禁
- `feature_access_denied`
- `feature_access_redirect_login`
- `feature_access_redirect_paywall`

---

## 3) 推荐仪表盘与漏斗（PostHog 配置建议）

### 3.1 Core Funnel（建议）
1. `live_start_attempted`
2. `live_session_ended`
3. `llm_suggest_succeeded`（可选）
4. `llm_review_succeeded`（可选）
5. `llm_session_recap_succeeded`（可选）

切片维度：
- `subscription_tier`（free/pro）
- `learning_language`
- `auth_mode`

### 3.2 核心 KPI（建议）
- Live 使用：日活会话数（count of `live_start_attempted` / unique users）
- 留存代理：`live_session_ended` 的 unique users / DAU
- Copilot 使用：`copilot_toggled enabled=true` 的占比
- LLM 成功率：`*_succeeded / *_requested`
- 翻译成功率：`translation_succeeded / translation_requested`
- 付费：`billing_purchase_succeeded`，以及购买后 `webhook_synced` 的达成率

---

## 4) 数据与隐私原则（强约束）

- 不上传原始 transcript / user utterance / suggestion 文本。
- 不上传 access token、密钥、URL query 等敏感信息。
- error message 只截断记录，避免把服务端响应体透传到埋点系统。

