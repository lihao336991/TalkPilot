# History 功能迭代计划

## 概要

将当前"仅展示会话列表壳"的 History 页面，升级为一个有价值的学习回顾入口。包含三个核心能力：
1. **AI 会话标题** — 每次会话结束后自动生成一句话摘要标题
2. **会话详情页** — 点击卡片进入，回溯完整对话记录（self / other），附带实时 review 批注
3. **离线复盘模块** — 从历史 reviews 中提炼语言亮点与待改进点，作为会话详情页内的一个 section

---

## 当前状态分析

### 已有基础
| 层面 | 现状 |
|------|------|
| DB `sessions` 表 | 有 `scene_preset`, `scene_description`, `duration_seconds`, `status` 等字段，**无 `title` / `summary` 列** |
| DB `turns` 表 | 完整记录了每条发言（`speaker`, `text`, `confidence`, `created_at`） |
| DB `reviews` 表 | 每条 self turn 的 LLM 纠错结果（`overall_score`, `issues`, `better_expression`, `praise`） |
| HistoryScreen | 只读 sessions 列表，不读 turns / reviews，卡片不可点击 |
| 路由 | 无 `session-detail` 路由 |
| Edge Functions | `review` / `suggest` / `assist-reply` 已存在，共享 `_shared/llm.ts` |
| i18n | `history.*` key 已覆盖列表页文案，无详情/复盘相关 key |

### 需要新增
- `sessions` 表新增 `title` 列（text, nullable）
- 新建 Edge Function `session-recap`（生成标题 + 离线复盘）
- 新建路由 `app/session-detail.tsx`
- 新建页面 `src/features/history/screens/SessionDetailScreen.tsx`
- 新建 service `src/features/history/services/historyService.ts`
- 扩展 i18n keys

---

## 具体变更

### 变更 1：数据库 — 新增 `title` 和 `recap` 列

**文件**: `supabase/migrations/006_session_title_recap.sql`（新建）

```sql
-- 会话 AI 标题
ALTER TABLE sessions ADD COLUMN title text;

-- 离线复盘 JSON（结构化数据）
ALTER TABLE sessions ADD COLUMN recap jsonb;
```

**设计决策**：
- `title`：由 LLM 生成的一句话摘要，如 "讨论周末计划与电影推荐"
- `recap`：结构化 JSON，存储复盘分析结果。格式：
  ```json
  {
    "highlights": [
      { "text": "...", "explanation": "..." }
    ],
    "improvements": [
      { "type": "grammar|vocabulary|naturalness", "original": "...", "corrected": "...", "explanation": "..." }
    ],
    "overallComment": "..."
  }
  ```
- 放在 `sessions` 表而非独立表，因为 1:1 关系，避免多余 JOIN
- RLS 不需要额外策略，复用已有的 `sessions_update_own` policy（但 Edge Function 使用 service_role_key 写入，不受 RLS 限制）

### 变更 2：Edge Function — `session-recap`

**文件**: `supabase/functions/session-recap/index.ts`（新建）

**职责**: 接收 `session_id`，读取该会话全部 turns + reviews，一次 LLM 调用生成标题 + 结构化复盘。

**接口设计**:
```
POST /functions/v1/session-recap
Authorization: Bearer <user_jwt>
Body: { "session_id": "xxx" }

Response 200:
{
  "title": "讨论周末计划与电影推荐",
  "recap": {
    "highlights": [...],
    "improvements": [...],
    "overallComment": "..."
  }
}
```

**关键逻辑**:
1. 认证用户
2. 检查 `sessions` 表确认该 session 属于当前用户且 status = 'ended'
3. 如果 `title` 已存在，直接返回缓存结果（避免重复生成）
4. 读取该 session 的全部 turns（按 created_at 升序）+ 全部 reviews
5. 拼装 prompt，要求 LLM 输出 JSON：
   - `title`：一句话描述对话主题（使用 native_language）
   - `highlights`：用户表达中的亮点词汇/句型（1-3 条）
   - `improvements`：从 reviews 中提炼的共性问题（1-3 条）
   - `overallComment`：一段鼓励性总结（使用 native_language）
6. 使用 service_role_key 将 `title` 和 `recap` 写回 `sessions` 表
7. 返回结果给客户端

**LLM 调用**: 复用 `_shared/llm.ts` 的 `createLlmRuntime()` + `withLlmDefaults()`

**双语策略**:
- `title` 和 `overallComment` 使用用户的 native_language（从 profiles 表读取）
- `highlights` 中的 `text` 保持 learning_language，`explanation` 使用 native_language
- `improvements` 同 review 的已有策略

### 变更 3：客户端 — 会话结束后触发 recap 生成

**文件**: `src/features/live/hooks/useLiveSessionController.ts`（修改）

在 `handleEnd` 中，`sessionManager.endSession()` 成功后，异步（不阻塞 UI）调用 `session-recap` Edge Function：

```typescript
// 在 endSession 成功后，火-and-forget 触发 recap 生成
if (currentSessionId) {
  historyService.generateRecap(currentSessionId).catch(console.warn);
}
```

不阻塞结束流程，不影响用户体验。如果调用失败，用户进入详情页时可手动触发重试。

### 变更 4：客户端 — History Service

**文件**: `src/features/history/services/historyService.ts`（新建）

集中管理 History 模块的所有 Supabase 数据获取逻辑：

```typescript
// 核心方法
loadSessions()           // 获取会话列表（已有逻辑从 HistoryScreen 抽出）
loadSessionDetail(id)    // 获取单个 session + turns + reviews
generateRecap(id)        // 调用 session-recap Edge Function
```

### 变更 5：路由 — 会话详情页

**文件**: `app/session-detail.tsx`（新建）

薄路由壳，接收 `id` 参数，渲染 `SessionDetailScreen`：

```typescript
import SessionDetailScreen from '@/features/history/screens/SessionDetailScreen';
export default SessionDetailScreen;
```

从 HistoryScreen 通过 `router.push({ pathname: '/session-detail', params: { id: session.id } })` 导航。

### 变更 6：UI — SessionDetailScreen

**文件**: `src/features/history/screens/SessionDetailScreen.tsx`（新建）

**布局设计（自上而下）**:

1. **顶部导航栏**
   - 返回按钮 + AI 标题（大字）
   - 副标题行：场景标签 · 时长 · 日期

2. **对话记录 Section**
   - 按时间顺序展示 turns
   - `self` 靠右气泡，深色背景 accent
   - `other` 靠左气泡，浅色背景
   - 如果 turn 有对应的 review（通过 turn_id 关联），在气泡下方显示评分徽章（green/yellow/red）
   - 点击有 review 的气泡可展开看 issues / better_expression

3. **复盘 Section**（从 `session.recap` 读取）
   - "Language Highlights" 卡片组：展示亮点词汇/句型
   - "Areas to Improve" 卡片组：展示待改进项
   - "Overall" 总结段落
   - 如果 recap 尚未生成，显示"正在分析..."状态 + 手动刷新按钮

**数据获取**: 页面 mount 时并发加载：
- `sessions` 表（含 title, recap）
- `turns` 表（该 session 全部 turns）
- `reviews` 表（该 session 全部 reviews，用于关联到 turns）

### 变更 7：UI — HistoryScreen 升级

**文件**: `src/features/history/screens/HistoryScreen.tsx`（修改）

- 卡片标题优先显示 `session.title`（AI 标题），fallback 到 `formatSceneLabel()`
- 卡片添加 `onPress` → `router.push('/session-detail', { id: session.id })`
- 查询字段增加 `title`、`recap`
- 如果 session 有 recap，卡片底部可选显示一个"已复盘"小标签

### 变更 8：i18n 扩展

**文件**: `src/shared/i18n/locales/en.ts` + `zh-CN.ts`（修改）

新增 keys（在 `history` 命名空间下扩展）：

```typescript
history: {
  // ... 已有 keys 保持不变 ...
  detail: {
    conversation: "Conversation",
    recap: "Session Recap",
    recapGenerating: "Analyzing your session…",
    recapRetry: "Generate Recap",
    recapEmpty: "Not enough conversation data to generate a recap.",
    highlights: "Language Highlights",
    improvements: "Areas to Improve",
    overallComment: "Overall",
    reviewBadge: {
      green: "Great",
      yellow: "Good",
      red: "Needs work",
    },
    noTurns: "No conversation recorded in this session.",
  },
  card: {
    recapped: "Reviewed",
  },
},
```

---

## 假设与决策

| 决策 | 理由 |
|------|------|
| `title` 和 `recap` 存在 `sessions` 表而非独立表 | 1:1 关系，减少 JOIN，查询简单 |
| 一次 LLM 调用同时生成 title + recap | 减少网络开销和 token 消耗，上下文一致 |
| recap 在会话结束时 fire-and-forget 触发 | 不阻塞结束流程；详情页有兜底重试 |
| 对话气泡不做实时播放 | 这是离线回顾，只展示文本 |
| review 关联 turn 通过 `turn_id` 字段 | reviews 表已有 `user_utterance`，但更精确的方式是通过 turns 表的 `turn_id` 与 reviews 做"同 session + 相同 utterance" 匹配 |
| recap 结果缓存在 DB | 相同 session 只生成一次，避免重复 LLM 调用 |

---

## 执行顺序

1. **DB migration** — 新增 `title` + `recap` 列
2. **Edge Function `session-recap`** — 后端 LLM 复盘生成
3. **`historyService.ts`** — 客户端数据获取层
4. **`SessionDetailScreen.tsx`** + 路由 — 详情页 UI
5. **`HistoryScreen.tsx` 升级** — 列表页增加标题展示 + 点击跳转
6. **`useLiveSessionController.ts`** — 会话结束时触发 recap
7. **i18n 扩展** — 中英文文案
8. **静态检查验证** — `npx tsc --noEmit`

---

## 验证步骤

1. `npx tsc --noEmit` 通过
2. History 列表卡片可展示 AI 标题（有 title 时）；无 title 时 fallback 到场景标签
3. 点击卡片可进入详情页，对话记录正确按时间排列
4. 自己说的话靠右，对方说的话靠左
5. 有 review 的 turn 显示评分标记
6. 复盘 section 正确展示 highlights / improvements / overall
7. 会话结束后自动触发 recap 生成（通过网络日志确认）
8. recap 未生成时，详情页有加载态和手动触发按钮
