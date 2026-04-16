# P0 鉴权

- 把业务权限真正收口到会员状态上
- 也就是把“已经能付费”变成“付费真的有区别”
- 你项目里最适合优先接的应该是：
  - Live 的使用额度
  - 高级 review / suggestion 能力
  - 某些 Pro-only 入口的门禁提示
- 原则：
  - 本地 RevenueCat 用来立即提权
  - Supabase 用来冷启动恢复和服务端业务判断
  - 不要让功能门禁分散在很多页面里各自判断

# P0 运维

- 把支付链路的可观测性补齐
- 这一步很重要，不然后面一进 TestFlight 你会很痛苦
- 最少要补这些日志/状态：
  - 购买成功
  - 恢复购买
  - reconcile 成功/失败
  - webhook 成功/失败
  - 当前 subscriptionTier / subscriptionStatus / subscriptionSyncState
- 你现在已经有请求 adaptor 了，接下来只需要把 billing 关键节点再统一打点即可

  # P1 体验

- 做一轮会员体验打磨
- 建议优先补：
  - 购买成功后的明确反馈
  - syncing 时更友好的文案
  - Restore 成功/失败的明确提示
  - 已订阅用户进入 Paywall 时的更自然状态
  - Customer Center 返回后的页面刷新
- 这部分不复杂，但会显著减少“明明买了却感觉没生效”的困惑

  # P1 法务与配置

- 把上架前必须项补齐
- 包括：
  - Terms
  - Privacy
  - App Store 订阅文案
  - 价格、续费说明、恢复购买文案
  - App Review 需要的说明材料
- 你现在页面壳已经有了，主要是把正式文案和链接替换进去

  # P1 验证

- 做一套真机联调 checklist
- 我建议你固定一份最小回归清单：
  - Apple 登录
  - 首购
  - 恢复购买
  - 退出登录再登录
  - 杀进程重开
  - 会员门禁是否变化
  - Customer Center 是否正常
  - Supabase profile 是否更新
- 这份清单后面每次改 billing 都能复用

  # P2 商业化

- 等闭环稳定后，再考虑“卖得更好”
- 比如：
  - 限额触发 paywall 的时机优化
  - 首次登录后的升级引导
  - 年付默认高亮
  - Pro 权益解释更清楚
  - 订阅转化埋点
