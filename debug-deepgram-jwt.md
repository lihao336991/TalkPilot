# Debug Session: deepgram-jwt [CLOSED]

## Bug 症状
调用 Supabase Edge Function `deepgram-token` 时持续返回 `401 {"code": 401, "message": "Invalid JWT"}`。
已尝试：refresh session、sign out + re-sign in anonymously，均无效。

## 假设列表

| # | 假设 | 状态 |
|---|------|------|
| H1 | `getValidAccessToken()` 竞态，token 为空或旧值 | ❌ 排除：dp-1 证实 token 有值 len=691 |
| H2 | `ensureValidSession()` 缓存旧值 | ❌ 排除：token 格式正确，ES256 |
| H3 | `EXPO_PUBLIC_SUPABASE_ANON_KEY` 无效 | ❌ 排除：dp-1 证实 len=208，HS256，值正确 |
| H4 | 网关默认 JWT 验证不兼容 ES256 auth token | ✅ **确认根因** |
| H5 | URL 有误 | ❌ 排除：dp-1 URL 正确，curl 可达 |

## 证据

### dp-1 运行时日志
- accessToken: `eyJhbGciOiJFUzI1NiIs...` (len=691) — ES256 算法
- supabaseAnonKey: `eyJhbGciOiJIUzI1NiIs...` (len=208) — HS256 算法
- URL: `https://joweqhgtueqfeasweigh.supabase.co/functions/v1/deepgram-token`

### dp-2 运行时日志
- response status: 401
- response body: `{"code":401,"message":"Invalid JWT"}`

### curl 交叉验证
- 用 anon key 作为 Bearer → 返回 `{"error":"Unauthorized"}` (函数自己的 401)
- 说明函数已部署，网关接受 HS256 token 但拒绝 ES256 auth token

## 根因
Supabase Edge Functions 网关默认启用 JWT 验证，使用项目 JWT secret (HS256) 校验 Authorization 头。
但 Supabase Auth 新版本为匿名用户签发的 access token 使用 ES256 算法，导致网关校验失败返回 `Invalid JWT`。

## 修复方案
以 `--no-verify-jwt` 标志重新部署所有 Edge Functions，由函数内部通过 `supabase.auth.getUser()` 自行验证用户身份。

```bash
npx supabase functions deploy deepgram-token --no-verify-jwt --project-ref joweqhgtueqfeasweigh
npx supabase functions deploy suggest --no-verify-jwt --project-ref joweqhgtueqfeasweigh
npx supabase functions deploy review --no-verify-jwt --project-ref joweqhgtueqfeasweigh
```

已执行，三个函数均部署成功。

## 清理
- 已移除 DeepgramTokenService.ts 中的 dp-1 / dp-2 调试插桩
- debug-deepgram-jwt.md 保留作为问题记录
