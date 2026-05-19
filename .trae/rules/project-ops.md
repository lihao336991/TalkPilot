# TalkPilot 工程操作 Skill

当用户需要执行 EAS 远程构建、EAS Update OTA 更新、隐私协议更新、Supabase Edge Function 部署、
密钥同步、Apple Client Secret 生成等工程运维操作时，使用本 Skill 作为操作指南。

---

## 一、环境与 profile 体系

项目有两套环境文件，通过 `APP_ENV` 区分：

| 环境 | env 文件 | 对应 EAS profile |
|------|---------|------------------|
| 开发 | `.env.development` | `development`、`preview-devtools` |
| 生产 | `.env.production` | `preview`、`production` |

EAS profile 定义在 `eas.json` 中：

| Profile | 用途 | Channel |
|---------|------|---------|
| `development` | 本地 dev client 调试 | `development` |
| `preview` | 内部预览版（生产环境变量） | `production` |
| `preview-devtools` | 带 dev menu 的内部预览版 | `preview-devtools` |
| `production` | App Store 正式版（自动递增版本号） | `production` |

---

## 二、本地开发命令

### 启动项目

```bash
# 开发环境启动（默认）
npm start

# 指定环境启动
npm run start:dev    # development
npm run start:prod   # production

# iOS / Android 原生运行
npm run ios          # development
npm run ios:prod     # production
npm run android      # development
npm run android:prod # production
```

### 类型检查

```bash
npm run typecheck    # 等价于 npx tsc --noEmit
```

### iOS Pods 更新

```bash
npm run rebuild:ios  # 等价于 cd ios && pod install
npm run pods:ios     # 同上
```

> 注意：`rebuild:ios` 只做 pod install，不会执行 `expo prebuild --clean`。如需重建原生壳，应在 Xcode 中手动操作。

---

## 三、EAS 远程构建

### 命令

```bash
npm run eas:build [profile] [platform]
# 等价于: bash scripts/eas-build.sh [profile] [platform]
```

### 参数

- **profile**：`development`（默认）、`preview`、`preview-devtools`、`production`
- **platform**：`ios`（默认）、`android`、`all`

### 常用场景

```bash
# 构建 iOS dev client
npm run eas:build development ios

# 构建内部预览版（生产环境配置）
npm run eas:build preview ios

# 构建带 dev menu 的内部预览版
npm run eas:build preview-devtools ios

# 构建生产版（提审用，autoIncrement 自动递增版本号）
npm run eas:build production ios

# 同时构建 iOS + Android
npm run eas:build production all
```

### 脚本行为 (`scripts/eas-build.sh`)

1. 根据 profile 解析对应的 `.env.{development|production}` 环境文件
2. 校验 Supabase project ref 与 `EXPO_PUBLIC_SUPABASE_URL` 是否一致
3. 设置 `EXPO_NO_DOTENV=1` 避免 Expo CLI 读取本地 `.env`
4. 执行 `npx eas build --profile <profile> --platform <platform>`

---

## 四、EAS Update（OTA 热更新）

### 命令

```bash
npm run eas:update [profile] [message]
# 等价于: bash scripts/eas-update.sh [profile] [message]
```

### 参数

- **profile**：`preview`（默认）、`development`、`preview-devtools`、`production`
- **message**：可选，更新说明（会显示在 EAS dashboard）

### 常用场景

```bash
# 内部预览版 OTA 更新
npm run eas:update preview "Fix transcript bubble layout"

# 预览版 OTA（带 dev tools）
npm run eas:update preview-devtools "Debug build update"

# 生产版 OTA（紧急修复，不经过 App Store 审核）
npm run eas:update production "Release 1.0.0 hotfix"
```

### Channel 路由

| Profile | 发布到的 Channel |
|---------|-----------------|
| `development` | `development` |
| `preview` | `production` |
| `preview-devtools` | `preview-devtools` |
| `production` | `production` |

> 注意：`preview` 和 `production` 都发布到 `production` channel，但 `production` profile 构建的 native build 才有 autoIncrement。

---

## 五、隐私协议/法务页面更新

### 数据源

所有法务内容统一管理在：`data/legal/legal.json`

### 命令

```bash
# 仅生成本地 HTML（不改远程）
npm run legal:build
# 等价于: node scripts/generate-legal-html.mjs

# 生成 HTML + 发布到 GitHub Pages
npm run legal:publish
# 等价于: node scripts/publish-legal-html.mjs
```

### 本地构建 (`legal:build`)

执行 `scripts/generate-legal-html.mjs`，从 `data/legal/legal.json` 读取内容，生成：

| 产物 | 路径 |
|------|------|
| 隐私政策 HTML | `dist/legal/privacy.html` |
| 服务条款 HTML | `dist/legal/terms.html` |
| App Review Notes MD | `.trae/documents/App Review Notes.md` |
| 生成清单 | `dist/legal/manifest.json` |

### 发布到线上 (`legal:publish`)

执行 `scripts/publish-legal-html.mjs`，完整流程：

1. 先执行 `legal:build` 生成本地 HTML
2. 自动 clone/pull `TalkPilotPages` 仓库（由 `legal.meta.hosting.repo_url` 配置）
3. 将 `dist/legal/*.html` 复制到 Pages 仓库的发布子目录
4. 自动生成 `index.html` 重定向页
5. `git commit` + `git push` 到 GitHub Pages 仓库

> 注意：需要 `legal.json` 中 `meta.hosting` 字段配置正确的 GitHub Pages 仓库 URL。GitHub Pages 仓库的域名需与 App Store Connect 中填写的隐私政策/服务条款 URL 一致。

### 修改法务内容流程

1. 编辑 `data/legal/legal.json`（section 的 title/body）
2. 运行 `npm run legal:build` 查看本地生成结果
3. 确认无误后，运行 `npm run legal:publish` 发布到线上
4. 如果 App Store 审核需要新 URL，确认 `legal.json` 中 `meta.hosting` 的 URL 已更新

---

## 六、Supabase Edge Functions 运维

### 部署 Edge Function

```bash
cd supabase/functions

# 部署单个函数
./deploy.sh development suggest
./deploy.sh production review

# 部署所有函数
./deploy.sh production all
```

当前可部署的函数清单：
- `assist-reply` — 翻译+TTS 回复
- `deepgram-token` — Deepgram 临时 token
- `delete-account` — 账号删除
- `revenuecat-sync-customer` — RevenueCat 客户同步
- `revenuecat-webhook` — RevenueCat webhook 处理
- `review` — 语言 Review
- `session-recap` — 会话复盘
- `suggest` — 回复建议

### 同步 Secrets

```bash
cd supabase/functions

# 同步开发环境 secrets
./sync-secrets.sh development

# 同步生产环境 secrets（需要二次确认）
./sync-secrets.sh production
```

脚本会自动：
1. 从 `.env.{development|production}` 加载所有环境变量
2. 过滤掉 `SUPABASE_` 前缀的变量（Supabase 内置变量）
3. 以 `TALKPILOT_` 前缀重新导出 Supabase 相关变量
4. 执行 `npx supabase secrets set` 推送到 Edge Functions 环境

> 注意：更换 `TRANSLATION_PROVIDER` 或 `LLM_PROVIDER` 后，需要重新 sync secrets 并重新部署 `assist-reply`。

---

## 七、Apple Client Secret 生成

### 命令

```bash
npm run auth:apple-secret -- \
  --team-id <TEAM_ID> \
  --key-id <KEY_ID> \
  --client-id <SERVICES_ID> \
  --private-key-path <AuthKey.p8>
```

或使用环境变量：

```bash
export APPLE_TEAM_ID="..."
export APPLE_KEY_ID="..."
export APPLE_CLIENT_ID="..."
export APPLE_PRIVATE_KEY_PATH="./AuthKey_XXXXXX.p8"
npm run auth:apple-secret
```

### 用途

生成的 JWT 用作 Supabase Auth 中 Apple provider 的 **Secret**，需粘贴到：
Supabase Dashboard → Auth → Providers → Apple → Secret

> 默认有效期 180 天，可通过 `--expires-in <seconds>` 或 `APPLE_EXPIRES_IN_SECONDS` 调整。

---

## 八、Sentry Source Maps 上传

```bash
npm run sentry:upload-sourcemaps
# 等价于: sentry-expo-upload-sourcemaps dist
```

在 EAS Build 完成后、提交审核前运行。

---

## 九、提审前检查流程

参考 `.trae/todo.md` 的 P0-P4 清单，核心检查项：

### P0 — 必做
1. `npx tsc --noEmit` 通过
2. 生产包 ATS 配置已清理（`NSAllowsArbitraryLoads` 等）
3. 生产环境变量全部配齐（`eas.json` production profile）
4. 真机走通：匿名启动 → 正式登录 → 退出 → 回落匿名
5. 真机走通：订阅购买、恢复购买、Customer Center
6. 真机走通：Live 会话主链路（转写、suggest、review、挂断、历史）
7. Paywall、Terms、Privacy URL 与商店后台一致
8. App Review Notes 已填入商店后台

### P1 — 强烈建议
1. 正式包不可访问 `/(dev)` 路由
2. Sentry release 环境已收到错误
3. PostHog 生产环境事件字段符合隐私约束
4. Edge Functions、RevenueCat webhook 都指向生产环境
5. App Store 截图、描述、关键词、分级已填写

---

## 十、Supabase CLI 管理

### DB 迁移推送

```bash
cd supabase

# 推送到开发环境数据库
./db-push.sh development

# 推送到生产环境数据库（需要二次确认）
./db-push.sh production
```

脚本会执行 `supabase link` + `supabase db push`，将 `supabase/migrations/` 下的迁移文件同步到远程数据库。需要 `.env` 中配置 `SUPABASE_DB_PASSWORD`。

### 本地启动 Supabase

```bash
npx supabase start     # 启动本地 Supabase 实例
npx supabase stop      # 停止
npx supabase status    # 查看状态
```

### Edge Function 本地测试

```bash
npx supabase functions serve --no-verify-jwt
```

---

## 十一、常用操作速查

| 操作 | 命令 |
|------|------|
| 类型检查 | `npm run typecheck` |
| iOS Pods 更新 | `npm run rebuild:ios` |
| 构建 iOS dev client | `npm run eas:build development ios` |
| 构建生产版 | `npm run eas:build production ios` |
| 生产版 OTA 热更新 | `npm run eas:update production "msg"` |
| 生成本地法务页面 | `npm run legal:build` |
| 发布法务页面到线上 | `npm run legal:publish` |
| 推送生产 DB 迁移 | `cd supabase && ./db-push.sh production` |
| 部署生产 Edge Function | `cd supabase/functions && ./deploy.sh production <name>` |
| 同步生产 Secrets | `cd supabase/functions && ./sync-secrets.sh production` |
| Apple Client Secret | `npm run auth:apple-secret -- --team-id ...` |
| Sentry sourcemap 上传 | `npm run sentry:upload-sourcemaps` |
