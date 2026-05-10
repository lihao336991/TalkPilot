# Supabase Auth 配置说明（归档）

本文档用于记录 TalkPilot 首期 Supabase Auth（Apple + Google）在本地工程与 Supabase Dashboard 的最终配置项，便于后续同事/设备复现。

## 实现约定（最终）

- 默认游客态：冷启动无现成 session 时自动创建匿名 session。
- 可升级正式账号：从 `Profile` 页进入 `/login` 聚合登录弹层。
- Provider：
  - Apple（iOS）：`expo-apple-authentication` -> `supabase.auth.signInWithIdToken({ provider: 'apple' })`
  - Google（iOS）：`@react-native-google-signin/google-signin` -> `supabase.auth.signInWithIdToken({ provider: 'google' })`
- 退出策略：正式账号退出后，立即回落匿名游客 session。
- 注意：当前 Apple native 登录链路未向 Supabase 传 `nonce`（联调曾出现 `invalid nonce` / `Nonces mismatch`）。

## 代码入口

- Supabase Auth 单一入口：[supabase.ts](file:///Users/bytedance/Desktop/money/TalkPilot/src/shared/api/supabase.ts)
- iOS Apple provider：[appleAuth.ts](file:///Users/bytedance/Desktop/money/TalkPilot/src/shared/auth/providers/appleAuth.ts)
- iOS Google provider：[googleAuth.ts](file:///Users/bytedance/Desktop/money/TalkPilot/src/shared/auth/providers/googleAuth.ts)
- Auth 状态 store：[authStore.ts](file:///Users/bytedance/Desktop/money/TalkPilot/src/shared/store/authStore.ts)
- 登录弹层页面：[login.tsx](file:///Users/bytedance/Desktop/money/TalkPilot/app/login.tsx)

## 依赖安装（本机）

```bash
npx expo install expo-secure-store expo-apple-authentication @react-native-google-signin/google-signin
```

安装后建议重新生成 iOS 原生配置（项目保留了 `ios/` 原生壳）：

```bash
npm run rebuild:ios
```

## 环境变量（本地 .env）

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=
```

说明：

- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`
  - Google Cloud Console 里的 iOS OAuth Client ID
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
  - Google Cloud Console 里的 Web OAuth Client ID
  - 说明：即使只做 iOS，Supabase 校验 Google `id_token` 仍需要 Web Client ID
- `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`
  - iOS Client ID 对应的 reversed client id（形如 `com.googleusercontent.apps.xxxxx`）

## Expo 配置（app.json / app.config）

确认已开启：

- `expo-apple-authentication` plugin
- `ios.usesAppleSignIn = true`
- `@react-native-google-signin/google-signin` plugin，并配置 `iosUrlScheme`

示例：

```json
[
  "@react-native-google-signin/google-signin",
  {
    "iosUrlScheme": "com.googleusercontent.apps.xxxxx"
  }
]
```

`iosUrlScheme` 必须与 `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` 一致（同一个 reversed client id）。

## Supabase Dashboard 配置

### Anonymous

- `Authentication -> Providers -> Anonymous`
- 打开匿名登录

### Apple

#### 必填项来源（Apple Developer）

- Team ID
- Key ID
- Services ID（注意：不是 Bundle ID）
- Apple private key（`.p8`）

#### Supabase 配置要点

- `Authentication -> Providers -> Apple`
- 需要正确填入 iOS Bundle ID：`com.talkpilot.app`
  - 否则会出现：`Unacceptable audience in id_token: [com.talkpilot.app]`
- Callback URL 使用：

```txt
https://<project-ref>.supabase.co/auth/v1/callback
```

#### Apple Secret 生成脚本

项目已提供脚本（用于生成 Apple provider 所需 secret）：

```bash
npm run auth:apple-secret -- \
  --team-id <APPLE_TEAM_ID> \
  --key-id <APPLE_KEY_ID> \
  --client-id <APPLE_SERVICES_ID> \
  --private-key-path /absolute/path/to/AuthKey_XXXXXX.p8
```

也可走环境变量：

```bash
APPLE_TEAM_ID=<APPLE_TEAM_ID> \
APPLE_KEY_ID=<APPLE_KEY_ID> \
APPLE_CLIENT_ID=<APPLE_SERVICES_ID> \
APPLE_PRIVATE_KEY_PATH=/absolute/path/to/AuthKey_XXXXXX.p8 \
npm run auth:apple-secret
```

说明：

- `APPLE_CLIENT_ID` 必须填 Apple 的 `Services ID`
- 脚本输出即为 Supabase Apple provider 里要粘贴的 `Secret`
- 默认过期时间 180 天；自定义传 `--expires-in <seconds>`

### Google

#### 必填项来源（Google Cloud Console）

- iOS OAuth Client ID
- Web OAuth Client ID
- iOS reversed client id / URL scheme

#### Supabase 配置要点

- `Authentication -> Providers -> Google`
- 开启 Google provider，并填入 client id / secret（按 Supabase UI 提示）

## 手动验证清单（iOS）

1. 冷启动：无 session 时进入匿名游客态，Profile 正常展示。
2. 打开登录弹层：`/login` 能显示 Apple / Google 按钮；关闭弹层返回原页面（不额外 push 新页面）。
3. Apple 登录成功：Profile 回显已登录态；`profiles` 表存在记录（如已接入）。
4. Google 登录成功：同上。
5. 退出登录：二次确认后退出，并自动回落匿名游客态。
