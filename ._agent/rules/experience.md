# 经验记录

- 2026-04-22：在 `pnpm` 严格依赖布局下，`@sentry/react-native` 的 iOS `Upload Debug Symbols to Sentry` 脚本会直接从项目根执行 `require.resolve('@sentry/cli/package.json')`。如果 `@sentry/cli` 只是其传递依赖而未提升到应用顶层依赖，Xcode Debug/Release 构建都可能在脚本阶段提前失败。当前项目应将 `@sentry/cli` 显式声明到根 `package.json`，不要只依赖传递安装结果。
- 2026-04-22：Supabase Edge Functions 中的 LLM 调用不要开启 `response_format: { type: "json_object" }`。当前项目使用的 provider 兼容层对 `json_object` 支持不稳定，容易出现空响应、字段缺失或 502。统一改为普通文本输出，并在服务端通过 `extractJsonObject()`、标签解析或文本清洗做容错；后续新增或修改 `review`、`suggest`、`assist-reply`、`session-recap` 等函数时都遵守这条规则。
