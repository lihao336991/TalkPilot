
下面是一份**可按顺序逐项打勾**的修复清单（按「先阻塞上架 / 再体验与合规 / 最后工程卫生」排）。你可以复制到备忘录或 issue 里用。

---

### P0 — 上架与安全（建议优先）

1. **iOS ATS**：从生产配置里移除 `NSAllowsArbitraryLoads`、各局域网 IP 的 `NSExceptionDomains`；只保留业务必需的 HTTPS 域名例外（若有）。
2. **权限文案**：统一语言（建议全英文上架包）；核对 `NSMicrophoneUsageDescription`、`NSSpeechRecognitionUsageDescription`；评估是否仍需要 `NSLocalNetworkUsageDescription`（若仅为调试可删）。
3. **EAS / 环境变量**：在 EAS **production** 中配齐所有 `EXPO_PUBLIC_*`（Supabase、Google、RevenueCat iOS/Android 等）；确认正式包不会读到占位或本地 `.env` 遗漏。
4. **Supabase 客户端**：避免生产环境静默使用 `placeholder` URL/anon key（构建失败或启动时显性校验/报错）。
5. **RevenueCat**：App Store / Play 商品与 RC 配置一致；沙盒走通购买、恢复、过期；Android 若上架则补全 **Play 公钥/SDK key** 与结算。
6. **隐私政策与条款**：确定**对外可访问**的隐私政策、用户协议 URL，并与商店后台填写一致。
7. **账号与数据（视产品而定）**：若提供注册登录，核对 Apple **账号删除**要求是否在应用内或网页可完成；隐私政策中写明收集项（语音、账户等）。

---

### P1 — 审核与运营

8. **App Store Connect**：准备截图、描述、分级、出口合规；填写**审核备注**（如何开始一次 Live、如何测付费墙）。
9. **审核账号**：若必须登录，提供**专用测试账号**与步骤说明。
10. **后台模式说明**：`UIBackgroundModes: audio` 在审核备注中简短说明用途（实时口语练习）。
11. **Google Play（若上 Android）**：数据安全问卷、内容分级、后台录音/麦克风说明与权限一致。

---

### P2 — 稳定性与成本

12. **崩溃监控**：接入 Sentry（或同类）并验证 release 符号表/source map。
13. **服务端**：Edge Functions 鉴权、Supabase **RLS**、按用户/按日的 **用量与限流**（防刷 Deepgram/LLM）。
14. **Webhook**：RevenueCat webhook 与 `revenuecat-sync` 等在生产环境密钥与 URL 正确、可重试。

---

### P3 — 代码与仓库卫生

15. **开发入口**：确认 `app/(dev)/test` 等仅在 dev client 出现，production 路由不可达或已移除。
16. **TypeScript / CI**：`legacy` 若不再参与主包，在 `tsconfig` 中 **exclude** 或拆仓库，避免 `tsc` 长期失败。
17. **依赖与插件**：`expo-build-properties`、Google Sign-In、`background-downloader` 等与当前上架目标一致；删除未使用权限/插件。

---

### P4 — 文档与发版流程

18. **发版 checklist**：在 README 或内部文档写清：EAS profile、`eas secret`、版本号策略、`appVersionSource: remote` 与商店版本对齐。
19. **密钥轮换**：若 `.env.example` / 历史提交曾暴露真实 URL，评估轮换 anon key 与相关密钥。

---