# TalkPilot 付费接入方案与 RevenueCat 配置说明

## Summary

* 目标：为 TalkPilot 接入首期订阅付费能力，采用 `月/年订阅 + Pro 单档权益 + RevenueCat + Supabase 权益同步`。

* 范围：本期先产出全链路方案文档，优先设计“服务端为准”的权益同步链路；客户端购买 UI 与真实支付发起可作为下一阶段实现。

* 推荐路径：`App Store Connect / Google Play` 负责真实商品，`RevenueCat` 负责聚合订阅状态与 webhook，`Supabase` 负责落库存储与业务鉴权，客户端只消费 Supabase 权益结果。

* 核心原则：购买前必须登录正式账号，不允许匿名游客直接购买；RevenueCat `appUserID` 固定使用 Supabase `user.id`，避免匿名态和正式账号权益迁移的复杂度。

## Current State Analysis

### 已有基础

* 客户端已有正式登录链路：

  * `app/login.tsx`

  * `src/shared/api/supabase.ts`

  * `src/shared/store/authStore.ts`

* 资料表已存在订阅字段和用量字段：

  * `supabase/migrations/001_init.sql` 中已有 `profiles.subscription_tier`

  * 同文件已有 `daily_minutes_used`、`daily_minutes_reset_at`

* 服务端已按订阅等级做基础限额判断：

  * `supabase/functions/deepgram-token/index.ts` 通过 `check_daily_usage` 拦截免费额度

* 客户端资料页已显示套餐字段：

  * `src/features/profile/screens/ProfileScreen.tsx`

* 当前订阅状态仅是本地和数据库的简单字段，没有真实支付来源：

  * `src/shared/api/supabase.ts` 在 `syncProfile()` 中默认把 `subscription_tier` 写成 `free`

### 当前缺口

* 没有支付 SDK，也没有任何 App Store / Google Play 商品接入。

* 没有账单域数据表，无法记录 RevenueCat customer、事件、权益有效期、来源平台。

* 没有 webhook 接口，Supabase 无法接收订阅购买、续费、退款、到期事件。

* 没有统一“业务权益判断层”，目前只有一个 `subscription_tier` 字段，无法表达：

  * 是否处于试用期

  * 到期时间

  * 原始商店平台

  * 是否已取消但仍在有效期内

* 匿名优先登录与购买结合时存在身份风险；如果允许游客购买，后续 restore/迁移会复杂很多。

## Assumptions & Decisions

### 已锁定决策

* 收费模型：采用 `月订阅 + 年订阅`，统一映射到单一 `pro` entitlement。

* 平台策略：方案先按“服务端为准”设计，但结构上兼容未来 iOS/Android 双端。

* 支付基础设施：采用 `RevenueCat`，不自建收据校验。

* 购买身份：必须登录正式账号后才允许购买。

* 首期权益档位：只做 `Pro` 单档，不启用 `unlimited`。

### 明确不做

* 本期不支持匿名购买。

* 本期不做积分包、消耗包、买断制。

* 本期不自己对接 StoreKit server API 或 Google Play Developer API。

* 本期不在客户端直接以 RevenueCat 结果作为最终鉴权来源，客户端仍以 Supabase 中的业务权益为准。

### 推荐的权益口径

* `free`

  * 沿用当前分钟限额和基础能力。

* `pro`

  * 解除或显著提高每日分钟限制。

  * 打开完整实时建议、完整 review、后续高级复盘等能力。

### 推荐的“真相源”划分

* 商店真相源：Apple / Google

* 订阅聚合真相源：RevenueCat

* 应用业务真相源：Supabase `profiles` + `billing_*` 表

* 客户端展示真相源：`useAuthStore()` 从 Supabase 拉取的权益状态

## Proposed Changes

### 1. 数据模型补全

#### 新增数据库迁移

* 新增文件：`supabase/migrations/002_billing_init.sql`

* 目的：把当前“单个 `subscription_tier` 字段”升级成可承载真实订阅状态的账单模型。

#### 推荐新增表

* `billing_customers`

  * 作用：绑定 `supabase_user_id` 与 RevenueCat customer/app user id

  * 关键字段：

    * `user_id uuid primary key references profiles(id)`

    * `revenuecat_app_user_id text not null unique`

    * `original_app_user_id text`

    * `created_at`

    * `updated_at`

* `billing_subscriptions`

  * 作用：保存当前有效订阅快照，供业务快速查询

  * 关键字段：

    * `id uuid primary key`

    * `user_id uuid not null references profiles(id)`

    * `provider text not null default 'revenuecat'`

    * `platform text`

    * `product_id text`

    * `entitlement_id text`

    * `status text not null`

    * `is_active boolean not null default false`

    * `will_renew boolean`

    * `period_type text`

    * `expires_at timestamptz`

    * `grace_period_expires_at timestamptz`

    * `trial_ends_at timestamptz`

    * `raw_payload jsonb not null default '{}'::jsonb`

    * `created_at`

    * `updated_at`

* `billing_webhook_events`

  * 作用：做 webhook 幂等、审计和排障

  * 关键字段：

    * `event_id text primary key`

    * `event_type text not null`

    * `app_user_id text`

    * `received_at timestamptz not null default now()`

    * `processed_at timestamptz`

    * `status text not null default 'received'`

    * `payload jsonb not null`

    * `error_message text`

#### 推荐补充 `profiles` 字段

* 修改表：`profiles`

* 推荐新增字段：

  * `subscription_provider text`

  * `subscription_status text`

  * `subscription_expires_at timestamptz`

  * `revenuecat_app_user_id text`

* 保留已有字段：

  * `subscription_tier`

* 原因：`profiles` 继续承担“客户端快速读取”职责，但更细节的账单信息进入 `billing_*` 表。

#### 推荐新增 SQL 能力

* 新增函数：`apply_billing_entitlement(...)`

  * 作用：统一把 webhook 事件转换为 `profiles` 和 `billing_subscriptions` 的业务状态更新。

* 调整函数：`check_daily_usage(p_user_id uuid)`

  * 现状：按 `free/pro/unlimited` 算分钟。

  * 调整：保留现有逻辑，但把 `pro` 的分钟策略显式写成首期付费口径，例如：

    * `free = 10 分钟`

    * `pro = 120 分钟` 或 `pro = 99999`

### 2. 服务端账单同步链路

#### 新增 Edge Function

* 新增目录：`supabase/functions/revenuecat-webhook/index.ts`

* 作用：

  * 接收 RevenueCat webhook

  * 校验鉴权头或签名

  * 按 `event.id` 做幂等

  * 根据 `app_user_id` 找到 Supabase 用户

  * 更新 `billing_webhook_events`

  * 写入 `billing_subscriptions`

  * 回写 `profiles.subscription_tier = 'pro' | 'free'`

#### 推荐处理的事件类型

* 首期至少支持：

  * `INITIAL_PURCHASE`

  * `RENEWAL`

  * `CANCELLATION`

  * `UNCANCELLATION`

  * `EXPIRATION`

  * `BILLING_ISSUE`

  * `PRODUCT_CHANGE`

  * `TRANSFER`

* 事件映射原则：

  * entitlement `pro` active => `profiles.subscription_tier = 'pro'`

  * entitlement inactive / expired / refunded => `profiles.subscription_tier = 'free'`

#### 新增共享逻辑

* 新增文件：`supabase/functions/_shared/billing.ts`

* 内容：

  * RevenueCat payload 类型定义

  * event -> entitlement 状态映射

  * webhook 幂等工具

  * `appUserID` 规范工具

#### 环境变量

* 在 Supabase Edge Functions secrets 中新增：

  * `REVENUECAT_WEBHOOK_AUTH`

  * `REVENUECAT_SECRET_API_KEY`（用于服务端主动向 RevenueCat 拉当前 customer 做 reconcile）

  * `REVENUECAT_PROJECT_ID`（可选，用于日志或后续 API 查询）

  * `REVENUECAT_PUBLIC_SDK_KEY_IOS`（后续客户端用）

  * `REVENUECAT_PUBLIC_SDK_KEY_ANDROID`（后续客户端用）

### 3. 身份绑定与资料同步

#### 修改客户端认证同步逻辑

* 修改文件：`src/shared/api/supabase.ts`

* 调整点：

  * `syncProfile()` 不再每次无条件 upsert `subscription_tier: 'free'`

  * 改为：

    * 只在 profile 缺失时初始化 `free`

    * 已存在 profile 时仅读取数据库当前值

  * 增加读取字段：

    * `subscription_tier`

    * `subscription_status`

    * `subscription_expires_at`

    * `revenuecat_app_user_id`

* 原因：避免用户已经购买后，客户端登录又把权益覆盖回 `free`

#### 修改客户端鉴权状态

* 修改文件：`src/shared/store/authStore.ts`

* 调整点：

  * 在现有 `subscriptionTier` 基础上，补充：

    * `subscriptionStatus`

    * `subscriptionExpiresAt`

    * `canManageSubscription`

  * 保持首期最小可用，不强行扩展过多账单细节到 UI

#### 推荐新增 repository

* 新增文件：`src/shared/repositories/billingRepository.ts`

* 用途：

  * 读取当前权益摘要

  * 轮询或手动刷新权益

  * 封装后续 `restore purchases`、`customer info sync` 请求入口

### 4. 业务鉴权收口

#### Deepgram 配额控制

* 修改文件：`supabase/functions/deepgram-token/index.ts`

* 调整点：

  * 继续使用 `check_daily_usage`

  * 错误返回由简单 `"Daily usage limit reached"` 升级为结构化响应：

    * `code`

    * `tier`

    * `minutes_remaining`

    * `upgrade_required`

* 作用：客户端未来可直接弹“升级 Pro”提示，而不是只看到错误文案

#### 客户端会话状态

* 修改文件：`src/features/live/store/sessionStore.ts`

* 调整点：

  * `dailyMinutesLimit` 不要继续写死 `30`

  * 改为来自服务端权益数据

  * 预留“达到免费限额”的展示状态

#### 会员展示入口

* 修改文件：`src/features/profile/screens/ProfileScreen.tsx`

* 作用：

  * 从“只显示 `Plan` 文本”升级为“会员状态摘要卡”

  * 未登录时可显示会员介绍，但购买按钮必须先走登录

  * 已登录用户后续可从此进入订阅页/管理页

### 5. 客户端付费接入的下一阶段预留

> 这一段不是本期立即编码目标，但方案要先定好，避免服务端设计返工。

#### 计划新增依赖

* 修改文件：`package.json`

* 新增依赖：`react-native-purchases`

* 原因：

  * Expo SDK 54 + 已 prebuild 原生壳，适合接 RevenueCat RN SDK

  * 后续 iOS/Android 可复用一套客户端购买逻辑

#### 计划新增客户端服务

* 新增文件：`src/features/billing/services/RevenueCatService.ts`

* 作用：

  * `configure(apiKey, appUserId)`

  * 获取 `offerings`

  * 发起购买

  * 恢复购买

  * 同步 customer info

#### 计划新增客户端页面

* 新增文件：

  * `app/paywall.tsx`

  * `src/features/billing/screens/PaywallScreen.tsx`

* 入口建议：

  * `Profile`

  * 免费额度耗尽弹层

  * 某些 Pro 能力入口的门禁提示

## 推荐实施顺序

### Phase A：服务端优先

1. 新建 `002_billing_init.sql`
2. 建 `revenuecat-webhook` Edge Function
3. 修复 `src/shared/api/supabase.ts` 中会把权益重置成 `free` 的风险
4. 把 `deepgram-token` 返回升级为结构化业务错误

### Phase B：客户端会员感知

1. `authStore` 增加权益摘要字段
2. `ProfileScreen` 展示真实会员状态
3. `sessionStore` 不再写死分钟上限

### Phase C：客户端购买链路

1. 接 `react-native-purchases`
2. 登录后用 `user.id` 做 RevenueCat `appUserID`
3. 新增 paywall 页面
4. 购买成功后拉取 Supabase 最新权益并刷新 UI

## Verification Steps

### 方案验证

* 验证登录态下 `syncProfile()` 不会把已购用户覆盖回 `free`

* 验证 RevenueCat webhook 同一个事件重复推送时不会重复写入

* 验证购买、续费、取消、过期后 `profiles.subscription_tier` 与 `billing_subscriptions.is_active` 一致

* 验证免费用户超过额度时，`deepgram-token` 返回可被客户端识别的升级信号

* 验证未登录用户无法进入真实购买流程

### 联调用例

* 用例 1：新注册正式账号，无订阅，应为 `free`

* 用例 2：RevenueCat 沙盒首购成功，应同步为 `pro`

* 用例 3：到期或手动取消后，应在有效期结束后回落为 `free`

* 用例 4：重复推送同一 webhook event，应保持幂等

* 用例 5：切换设备登录同一 Supabase 账号，应自动读到同一权益

## RevenueCat 配置说明

> 下面是你需要自己在控制台完成的配置项。我按“首期只做 Pro 单档、后续再接客户端购买”来写，尽量避免多余动作。

### 一、App Store Connect 侧

#### 你需要创建的内容

* App 的 `Auto-Renewable Subscription`

* 两个商品：

  * `talkpilot_pro_monthly`

  * `talkpilot_pro_yearly`

* 一个订阅组：

  * `TalkPilot Pro`

#### 推荐配置

* 同一订阅组里只放 `monthly/yearly`

* Review note 里说明：

  * 这是实时英语对话辅助产品

  * 订阅解锁更多分钟和高级 AI 功能

* 准备好：

  * 隐私政策 URL

  * 服务条款 URL

### 二、RevenueCat 侧

#### 1. 创建项目

* 创建 `TalkPilot`

* 连接 iOS App

* 后续 Android 可在同一项目追加

#### 2. 创建 Entitlement

* 新建 entitlement：

  * `pro`

#### 3. 导入 Products

* 导入：

  * `talkpilot_pro_monthly`

  * `talkpilot_pro_yearly`

#### 4. 绑定到 Entitlement

* 把两个 product 都挂到 `pro` entitlement

#### 5. 配置 Offering

* 创建 default offering，例如：

  * `default`

* 在 offering 中放一个 package：

  * `$rc_monthly`

  * `$rc_annual`

#### 6. Webhook

* 打开 RevenueCat webhook

* 指向 Supabase Edge Function 地址：

```text
https://<your-project-ref>.supabase.co/functions/v1/revenuecat-webhook
```

* 建议使用固定鉴权头，例如：

  * Header: `Authorization`

  * Value: `Bearer <REVENUECAT_WEBHOOK_AUTH>`

### 三、Supabase 侧

#### 1. 数据库迁移

* 执行新增的 `002_billing_init.sql`

#### 2. Edge Function secrets

* 需要设置：

```bash
supabase secrets set \
  REVENUECAT_WEBHOOK_AUTH=your_secret \
  REVENUECAT_SECRET_API_KEY=your_revenuecat_secret_key \
  REVENUECAT_PUBLIC_SDK_KEY_IOS=your_ios_sdk_key \
  REVENUECAT_PUBLIC_SDK_KEY_ANDROID=your_android_sdk_key
```

#### 2.1 客户端环境变量（Expo）

> 客户端需要使用 `EXPO_PUBLIC_` 前缀读取 RevenueCat 公钥（SDK Key）。
> 下面两个变量放在本地 `.env`（或 EAS secret）里即可：

```bash
EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_IOS=your_ios_sdk_key
EXPO_PUBLIC_REVENUECAT_PUBLIC_SDK_KEY_ANDROID=your_android_sdk_key
```

#### 3. 部署 billing functions

* 需要部署：

```bash
supabase functions deploy revenuecat-webhook
supabase functions deploy revenuecat-sync-customer
```

### 四、客户端接入时的关键规则

#### 用户标识规则

* 必须在正式登录后才配置 RevenueCat

* `appUserID` 固定使用：

```text
supabase.auth.user().id
```

* 不要使用匿名 RevenueCat user 再去 alias

* 不要在游客态发起购买

#### 购买后同步规则

* 客户端购买成功后，不直接信任本地 SDK entitlement 做最终业务放行

* 正确顺序：

  1. RevenueCat SDK 完成购买
  2. RevenueCat 触发 webhook
  3. Supabase 更新 `profiles.subscription_tier`
  4. 客户端主动 refresh profile
  5. UI 根据 Supabase 结果解锁能力

### 五、沙盒联调顺序

1. 在 App Store Connect 建商品
2. 在 RevenueCat 建 entitlement 和 offering
3. 配好 webhook 到 Supabase
4. 本地用 Apple sandbox 账号购买
5. 在 Supabase 查：

   * `billing_webhook_events`

   * `billing_subscriptions`

   * `profiles`
6. 再验证客户端是否读到 `pro`

## 风险与注意事项

* 当前 `src/shared/api/supabase.ts` 会在 `syncProfile()` 中写死 `subscription_tier: 'free'`，这是接付费前必须先修掉的第一风险点。

* 购买前必须登录虽然牺牲一点转化，但会显著降低恢复购买、跨设备同步、匿名迁移的复杂度，适合当前项目阶段。

* 只做 `Pro` 单档时，数据库里仍可暂时保留 `unlimited` 枚举，但业务实现和 UI 不要暴露它，避免口径不一致。

* 如果未来要做“免费试用”，优先直接使用商店试用和 RevenueCat 的 `period_type` 表达，不要自己手搓试用状态。

## 交付结果

* 该方案确定了首期推荐架构、服务端优先的落地顺序、真实文件改动点、数据库模型、webhook 同步策略，以及你需要手动完成的 RevenueCat / App Store / Supabase 配置流程。

* 你确认后，下一步可以直接按 `Phase A -> Phase B -> Phase C` 进入实施，无需再做额外技术选型。
