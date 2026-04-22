# TalkPilot 账单巡检 Checklist

## 当前结论

- 当前真正需要盯账单的，先只看两项：
  - `Deepgram`
  - `LLM`
- 其它服务当前先按“已接入但暂时不是实际付费重点”处理，不放进日常巡检主清单。

## 1. Deepgram

- 当前用途：
  - 实时转写
  - 英文云端 TTS
- 重点风险：
  - 余额或免费额度耗尽
  - 自动充值 / 付款方式失效
  - 调用量异常上涨

### 每周检查

- 看余额或套餐状态是否正常
- 看最近 7 天转写分钟数是否异常上涨
- 看 TTS 调用是否异常上涨
- 看是否有报错、拒绝服务、额度不足提示

### 每月检查

- 记录本月总费用
- 对比上月费用变化
- 判断增长是否来自真实用户增长，还是来自异常调用

## 2. LLM

- 当前用途：
  - `review`
  - `suggest`
  - `assist-reply`
- 注意：
  - 实际看哪个平台付费，取决于线上 `LLM_PROVIDER`
- 重点风险：
  - 调用量异常上涨
  - 某个 provider 欠费停用
  - 备用 provider 没在用但还在持续花钱

### 每周检查

- 确认线上当前使用的 provider 是哪个
- 看最近 7 天请求量和费用走势
- 看错误率是否升高
- 看是否有多余 provider 仍在计费

### 每月检查

- 记录本月总费用
- 对比上月费用变化
- 判断增长是否来自真实用户增长，还是来自 prompt / 重试 / 滥调用

## 3 Supabase

暂时免费。免费服务：

- Unlimited API requests
- 50,000 monthly active users
- 500 MB database size -- 最有可能先打满的资源，注意关注
- Shared CPU • 500 MB RAM
- 5 GB egress
- 5 GB cached egress
- 1 GB file storage

## 当前最值得注意的代码风险

- `review` 当前配额限制是 bypass 状态
- `suggest` 当前配额限制也是 bypass 状态
- `assist-reply` 当前没有看到同级别的显式额度控制
- 这三项都可能让 `LLM` 费用上涨得比预期快

## 最小巡检节奏

### 每周一次

- 检查 `Deepgram` 余额、分钟数、TTS 调用
- 检查 `LLM` 当前 provider、费用走势、错误率

### 每月一次

- 记录 `Deepgram` 月费用
- 记录 `LLM` 月费用
- 简单写一句环比结论：
  - 正常
  - 偏高
  - 需要处理

## 最小记录模板

```md
日期：

Deepgram

- 余额 / 套餐：
- 本周或本月费用：
- 是否异常：
- 处理动作：

LLM

- 当前线上 provider：
- 本周或本月费用：
- 是否异常：
- 处理动作：

结论：

- 正常 / 关注 / 处理
```

## 备注

- `Supabase`、`RevenueCat`、`Apple Developer`、`EAS`、`Sentry` 目前先不作为日常主巡检项。
- 如果后面其中某项开始真实持续付费，再补回本文档即可。
