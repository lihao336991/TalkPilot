# Supabase Auth 登录首期归档

## 状态

- 状态：已完成并完成联调验收。
- 范围：TalkPilot 客户端首期账号体系接入。
- Provider：`Apple Sign-In`（iOS）、`Google Sign-In`（iOS）。
- 认证底座：`Supabase Auth`。
- 产品策略：保留游客态，正式账号退出后自动回落匿名 session。

## 最终结果

- App 冷启动无现成 session 时，自动创建匿名游客 session，不阻塞主流程。
- 用户可从 `Profile` 页进入 `/login` 聚合登录弹层。
- 登录弹层内聚合 Apple / Google 登录入口。
- Apple / Google 登录成功后，客户端切换为正式账号 session，并同步 `profiles` 表。
- 正式账号退出后，立即重新建立匿名 session，保证 App 继续可用。
- `Profile` 页只保留 auth 信息回显与登录/退登入口，不再承载 demo 级占位内容。

## 最终交互约定

- `Profile` 页作为账号中心，展示当前账号状态、邮箱、provider、plan。
- 登录入口通过 `app/login.tsx` 透明 modal + 底部弹层承载。
- 关闭登录弹层时必须 `router.back()`，不能再 `replace('/(tabs)/profile')`，否则会额外压入一层 account 页面。
- 退登必须二次确认。
- 退登中的 loading 文案统一为 `Signing out...`。

## 最终代码落点

- `src/shared/api/supabase.ts`
  - Supabase client 初始化
  - session 恢复与刷新
  - 匿名登录兜底
  - Apple / Google 登录
  - 正式退出后回落游客态
- `src/shared/auth/supabaseStorage.ts`
  - 移动端 session 持久化 storage adapter
- `src/shared/store/authStore.ts`
  - `authMode`
  - `provider`
  - `displayName`
  - `userEmail`
  - `subscriptionTier`
- `src/shared/auth/providers/appleAuth.ts`
  - iOS Apple 原生登录
- `src/shared/auth/providers/googleAuth.ts`
  - iOS Google 原生登录
- `app/login.tsx`
  - 透明 modal 登录弹层
- `src/shared/auth/components/AuthActionPanel.tsx`
  - Apple / Google 聚合登录面板
- `src/features/profile/screens/ProfileScreen.tsx`
  - 账号中心页

## 核心实现决策

- 采用 `supabase.auth.signInWithIdToken(...)` 完成 Apple / Google 与 Supabase 会话对接。
- 首期继续维持“游客优先”，不做强制受保护路由。
- 游客升级正式账号时，先退出当前匿名 session，再建立正式 session。
- 本期不做匿名账号与正式账号的数据绑定或迁移。
- Google 采用 iOS native SDK + `idToken` 方案，不走浏览器 OAuth 回跳。
- Apple native 登录链路当前未向 Supabase 传 `nonce`。
  - 原因：联调过程中出现 `invalid nonce` / `Nonces mismatch`。
  - 当前策略：先保证首期业务闭环跑通。

## 已落地的状态模型

- `authMode`
  - `anonymous`
  - `authenticated`
- `provider`
  - `anonymous`
  - `apple`
  - `google`
  - `null`

## 已解决的联调问题

- Apple `Unacceptable audience in id_token`
  - 原因：Supabase Apple Provider 中未正确配置 iOS Bundle ID。
  - 结论：需在 Supabase Apple 配置中补齐 `com.talkpilot.app`。
- Apple `invalid nonce` / `Nonces mismatch`
  - 现状：当前实现已移除 native Apple 登录链路中的 `nonce` 传递。
- Google iOS 登录仅配置 `iosClientId` 仍不足
  - 结论：Supabase 校验 Google `id_token` 时仍需要 `webClientId`。
- 登录弹层关闭后又 push 出一个 account 页面
  - 原因：关闭弹层后错误使用 `router.replace('/(tabs)/profile')`。
  - 修复：改为优先 `router.back()`。
- `getSnapshot should be cached`
  - 原因：`useAuthStore` selector 返回新对象导致无限更新。
  - 修复：改为使用标量 selector 分别订阅字段。

## 验收结果

- Apple 登录：已跑通。
- Google 登录：已跑通。
- 登录成功后 Profile 信息回显：已跑通。
- 手动退出登录：已跑通。
- 退出后回落匿名 session：已跑通。
- 登录弹层关闭与返回逻辑：已修正。

## 范围外

- 不接邮箱密码、Magic Link、验证码登录。
- 不做 Apple / Google 多 provider 账号合并。
- 不做匿名账号数据迁移。
- 不覆盖 Android。
