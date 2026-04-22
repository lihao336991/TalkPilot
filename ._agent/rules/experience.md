# 经验记录

- 2026-04-22：在 `pnpm` 严格依赖布局下，`@sentry/react-native` 的 iOS `Upload Debug Symbols to Sentry` 脚本会直接从项目根执行 `require.resolve('@sentry/cli/package.json')`。如果 `@sentry/cli` 只是其传递依赖而未提升到应用顶层依赖，Xcode Debug/Release 构建都可能在脚本阶段提前失败。当前项目应将 `@sentry/cli` 显式声明到根 `package.json`，不要只依赖传递安装结果。
