# TalkPilot 工程操作技能

---

## 概述

这是 TalkPilot 项目的工程操作技能，用于处理 EAS 远程构建、OTA 更新、法务页面发布、Supabase Edge Function 部署、密钥同步、Apple Client Secret 生成等工程运维任务。

---

## 技能激活条件

当用户询问或需要执行以下操作时，应自动激活此技能：

- EAS 远程构建 (`eas build`)
- EAS Update OTA 热更新 (`eas update`)
- 隐私协议/服务条款页面更新 (`legal:build` / `legal:publish`)
- Supabase Edge Function 部署
- Supabase 密钥同步
- Apple Client Secret 生成
- Sentry Source Maps 上传
- Supabase 数据库迁移推送
- 提审前检查

---

## 操作流程

### 一、环境与 Profile 体系

| 环境 | env 文件 | 对应 EAS Profile |
|------|---------|------------------|
| 开发 | `.env.development` | `development`、`preview-devtools` |
| 生产 | `.env.production` | `preview`、`production` |

### 二、EAS 远程构建

```bash
npm run eas:build [profile] [platform]
```

- **Profile**: `development`、`preview`、`preview-devtools`、`production`
- **Platform**: `ios`、`android`、`all`

### 三、EAS Update

```bash
npm run eas:update [profile] [message]
```

- **Profile**: `development`、`preview`、`preview-devtools`、`production`

### 四、法务页面更新

1. 编辑 [`data/legal/legal.json`](file:///Users/bytedance/Desktop/money/TalkPilot/data/legal/legal.json)
2. 本地构建: `npm run legal:build`
3. 发布到 GitHub Pages: `npm run legal:publish`

### 五、Supabase Edge Functions

部署:
```bash
cd supabase/functions
./deploy.sh [development|production] [function-name|all]
```

同步 Secrets:
```bash
cd supabase/functions
./sync-secrets.sh [development|production]
```

### 六、数据库迁移

```bash
cd supabase
./db-push.sh [development|production]
```

---

## 参考文档

完整操作手册请查看:
- [`.trae/rules/project-ops.md`](file:///Users/bytedance/Desktop/money/TalkPilot/.trae/rules/project-ops.md)
- [`.trae/documents/上线检查清单.md`](file:///Users/bytedance/Desktop/money/TalkPilot/.trae/documents/上线检查清单.md)
