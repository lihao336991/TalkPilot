# TalkPilot Coach 与 Scene Recommendation 方案

## 1. 目标

本文档用于定义 TalkPilot 后续的两类推荐能力：

- `Scene Recommendation`
  - 解决“下一场练什么”
- `Coach Recommendation`
  - 解决“现在最该补什么”

这份方案的目标不是直接上一个“黑盒 AI 推荐系统”，而是先给 TalkPilot 建立一套：

- 可解释
- 可控
- 可逐步演进
- 与双语言模型一致

的推荐框架。

## 2. 核心原则

### 2.1 推荐不是独立产品，而是双语言训练系统的延伸

TalkPilot 当前已经确定产品核心为双语言模型：

- `母语 / nativeLanguage`
- `学习语言 / learningLanguage`

所以推荐系统也必须遵守同样规则：

- 推荐理由、解释、标签、操作文案走 `母语`
- 实际练习内容、示例句、建议回复、目标表达走 `学习语言`

### 2.2 先做“规则推荐”，不先做“全 AI 决策”

第一版不建议直接让 LLM 负责从海量内容中做黑盒排序。

原因：

- 冷启动不可控
- 难解释为什么推荐
- 调优成本高
- 会把内容系统和推荐系统耦合死

第一版建议采用：

- `结构化内容库`
- `本地或轻量服务端规则打分`
- `LLM 仅做局部润色或个性化补充`

### 2.3 推荐要回答两个不同问题

#### Scene Recommendation

回答的是：

- “我下一场应该练什么真实场景？”

#### Coach Recommendation

回答的是：

- “我现在最应该补什么表达能力或短板？”

这两类推荐虽然共享同一套用户画像，但输出形态和评价逻辑不同，不能混成一类。

## 3. 产品定位

### 3.1 Scene Recommendation 的产品职责

Scene Recommendation 负责：

- 给用户推荐下一场最值得练的场景
- 降低“我不知道该练什么”的启动阻力
- 让 Live 入口从一个“空白练习器”升级成一个“带方向的训练入口”

它应该更接近：

- 训练场景入口
- 推荐的练习任务

而不是：

- 一段泛泛建议文案

### 3.2 Coach Recommendation 的产品职责

Coach Recommendation 负责：

- 告诉用户“你当前最值得补的能力是什么”
- 让 Coach 页从占位页变成“有学习路径感的能力面板”
- 将 review / suggest / assist 产生的数据沉淀成“下一步练什么”

它更接近：

- 学习路径建议
- 技能补强模块

而不是：

- 单纯的资讯流

## 4. 推荐输出形态

## 4.1 Scene Recommendation 输出

推荐结果建议为 `3-5` 张场景卡片。

每张卡至少包含：

- 母语标题
- 母语一句场景说明
- 学习语言示例句 1 条
- 难度标签
- 推荐理由
- 启动按钮

示例：

- 标题：咖啡店点单
- 说明：适合练习点单、询问和确认
- 示例句：`Could I get a latte with oat milk?`
- 推荐理由：你最近日常场景练习较少

### 4.2 Coach Recommendation 输出

推荐结果建议为 `2-4` 个能力模块。

每个模块至少包含：

- 母语标题
- 母语问题说明
- 学习语言示例句或替换表达
- 推荐原因
- 入口动作

示例：

- 标题：把回复说得更完整
- 说明：你最近的回答常常太短，容易把对话停住
- 示例句：`That sounds great. I'd love to join because ...`
- 推荐原因：最近 review 多次出现“表达不完整”

## 5. 双语言规则

## 5.1 Scene Recommendation 的语言规则

- 卡片标题：母语
- 卡片说明：母语
- 推荐理由：母语
- 示例开场句：学习语言
- 练习目标句：学习语言
- 启动练习按钮文案：母语

## 5.2 Coach Recommendation 的语言规则

- 模块标题：母语
- 问题解释：母语
- 为什么推荐：母语
- 错误示例、正确说法、替换表达：学习语言
- 练习任务说明：优先母语解释 + 学习语言例句

## 6. 第一版推荐输入

第一版建议只依赖以下几个输入信号：

- `learningLanguage`
- `nativeLanguage`
- onboarding 目标
- onboarding 自评水平
- onboarding 自评困难点
- 最近练过哪些场景
- 最近 review 的主要错误类型
- 最近 suggest 使用频率
- 最近 assist 使用频率
- 最近练习时长与完成率

这些数据已经足够支撑第一版推荐，不需要一开始就做复杂画像系统。

## 7. 用户画像模型

建议建立一个轻量用户画像结构：

```ts
type LearningProfile = {
  nativeLanguage: string;
  learningLanguage: string;
  level: "beginner" | "intermediate" | "advanced";
  goals: Array<"work" | "daily" | "travel" | "interview" | "social">;
  painPoints: Array<
    | "dont_know_what_to_say"
    | "grammar_unstable"
    | "sounds_unnatural"
    | "too_slow_to_reply"
  >;
  recentScenes: string[];
  recentWeaknesses: string[];
  assistDependencyScore: number;
  recentPracticeMinutes: number;
};
```

说明：

- 第一版可以先不把所有字段都长期持久化
- 可以先在本地或轻量服务端由多个来源组合出一个“临时画像”

## 8. Scene 内容库设计

第一版 Scene 不建议动态生成，建议先建立结构化模板库。

示例结构：

```ts
type SceneTemplate = {
  id: string;
  category: "daily" | "work" | "travel" | "social" | "interview";
  difficulty: "beginner" | "intermediate" | "advanced";
  supportedLearningLanguages: string[];
  goalTags: string[];
  skillTags: string[];
  nativeTitleKey: string;
  nativeDescriptionKey: string;
  learningExamples: string[];
  starterPrompts: string[];
  relatedCoachModules: string[];
};
```

建议第一版内容覆盖：

- Daily
  - 自我介绍
  - 咖啡店点单
  - 问路
  - 超市结账
- Work
  - 会议里表达意见
  - 项目进度更新
  - 约一个 follow-up
- Interview
  - 自我介绍
  - 回答动机问题
  - 说明过往经历
- Social
  - 朋友聚会闲聊
  - 邀请与回应
- Travel
  - 酒店入住
  - 机场问询

## 9. Coach 模块内容库设计

Coach 模块也建议先结构化。

```ts
type CoachModule = {
  id: string;
  type:
    | "reply_expansion"
    | "repair_phrase"
    | "tone_shift"
    | "grammar_fix"
    | "naturalness_upgrade"
    | "confidence_booster";
  supportedLearningLanguages: string[];
  weaknessTags: string[];
  goalTags: string[];
  nativeTitleKey: string;
  nativeDescriptionKey: string;
  learningExamples: string[];
  drills: string[];
  relatedScenes: string[];
};
```

建议第一版模块包括：

- 回复展开能力
- 常见救场句
- 更自然表达
- 常见语法问题
- 正式 / 日常语气切换
- 回答太慢时的过渡表达

## 10. 推荐规则设计

## 10.1 Scene Recommendation 打分维度

每个 scene 可按以下维度打分：

- 学习语言匹配
- 用户目标匹配
- 当前水平匹配
- 最近短板匹配
- 最近是否练得太少
- 最近是否重复过多

示例伪代码：

```ts
score =
  languageMatch * 100 +
  goalMatch * 40 +
  levelMatch * 30 +
  weaknessMatch * 30 +
  freshnessBonus * 20 -
  repetitionPenalty * 25;
```

### 10.2 Coach Recommendation 打分维度

每个 coach module 可按以下维度打分：

- 学习语言支持
- 最近 review 弱点匹配
- 最近 assist 依赖程度
- 用户目标匹配
- 最近 suggest 使用情况
- 近期是否已经练过该能力

示例伪代码：

```ts
score =
  languageMatch * 100 +
  weaknessMatch * 50 +
  assistNeedMatch * 25 +
  goalMatch * 20 -
  repetitionPenalty * 30;
```

## 11. 推荐理由生成策略

第一版不要用自由生成长文案。

建议先做结构化 reason code：

```ts
type RecommendationReason =
  | "goal_match"
  | "weakness_match"
  | "under_practiced_scene"
  | "high_assist_dependency"
  | "good_next_step_for_level";
```

然后用本地母语文案模板渲染：

- 你最近在这个目标场景练习较少
- 最近多次出现类似表达问题，适合针对练一下
- 这个模块适合你当前水平的下一步提升

这样比直接让模型现场编理由更稳定。

## 12. Onboarding 怎么接

为了让推荐系统冷启动不空，建议 onboarding 增加以下 3 组关键信号：

### 12.1 学习目标

- 工作
- 日常交流
- 旅行
- 面试
- 社交

### 12.2 当前水平

- 初学
- 中级
- 高级

### 12.3 主要困难点

- 不知道说什么
- 语法不稳
- 说得不自然
- 听懂了但回不上来

这些数据足以支撑第一版冷启动推荐。

## 13. 冷启动与热启动策略

### 13.1 冷启动

如果用户没有历史数据：

- Scene Recommendation 主要依赖：
  - learningLanguage
  - onboarding goals
  - level
  - painPoints
- Coach Recommendation 主要依赖：
  - painPoints
  - level
  - goals

### 13.2 热启动

如果用户已有最近练习记录：

- 优先让历史行为逐步接管 onboarding
- review / suggest / assist 行为数据权重上升

## 14. 技术落地建议

## 14.1 数据层

建议新增两类内容源：

- `sceneCatalog`
- `coachModuleCatalog`

建议第一版放在本地：

- `src/features/live/content/sceneCatalog.ts`
- `src/features/coach/content/coachModuleCatalog.ts`

原因：

- 内容量不大
- 开发和调整速度快
- 不需要先引入 CMS

## 14.2 服务层

建议新增两个 service：

- `SceneRecommendationService`
- `CoachRecommendationService`

职责：

- 读取语言偏好
- 读取 onboarding 与近期行为
- 做过滤和排序
- 返回推荐结果

## 14.3 Hook 层

建议新增一个统一 hook：

```ts
type RecommendationResult = {
  recommendedScenes: SceneTemplate[];
  recommendedCoachModules: CoachModule[];
  refreshRecommendations: () => Promise<void>;
};
```

建议位置：

- `src/features/recommendation/hooks/useRecommendations.ts`

## 14.4 UI 接入

### Live 页

新增：

- `Recommended Scenes` 区块

位置建议：

- 待机态 `StartSessionCard` 下方
- 当前场景 chips 上方或下方

### Coach 页

新增：

- `Recommended for you`
- `Continue practicing`

第一版至少先有：

- 顶部 `Recommended for you`

## 15. 与现有功能的协同

### 15.1 与 Suggest 的关系

Suggest 解决的是：

- 当前这句话怎么回

Recommendation 解决的是：

- 下一场练什么
- 当前最该补什么能力

两者不是替代关系，而是不同时间尺度的学习支持。

### 15.2 与 Review 的关系

Review 提供：

- 句级错误信号

Recommendation 利用：

- 一段时间内 review 累积出的弱点分布

也就是说：

- review 是信号源
- recommendation 是策略层

### 15.3 与 Assist 的关系

Assist 使用频率越高，越能说明用户在某类场景里“回不上来”。

所以 assist 可以作为推荐的重要信号：

- 高频 assist
  - 推荐救场表达模块
  - 推荐更简单或更高频的 scene

## 16. 第一版 MVP 范围

第一版推荐系统建议只做：

1. `sceneCatalog`
2. `coachModuleCatalog`
3. onboarding 补 3 个画像字段
4. `SceneRecommendationService`
5. `CoachRecommendationService`
6. Live 页展示 3 个推荐 scene
7. Coach 页展示 3 个推荐模块

不建议第一版就做：

- 复杂 LLM 排序
- 后台管理系统
- 多设备画像同步
- 在线实验系统

## 17. 第二阶段演进

当第一版跑通后，可以逐步加入：

### 17.1 LLM 润色

LLM 只负责：

- 推荐理由润色
- 示例句多样化
- 开场建议生成

不要先负责全量排序。

### 17.2 用户画像持久化

后续可以引入：

- 最近错误类型统计
- 最近 scene 命中率
- 模块完成率
- 进步趋势

### 17.3 服务端推荐

当内容库、画像和业务都稳定后，再考虑把推荐逻辑移动到：

- Edge Function
- 或独立 recommendation service

## 18. 一句话总结

如果用一句话定义这套方案：

- `Scene Recommendation` 解决“下一场练什么”
- `Coach Recommendation` 解决“现在最该补什么”
- 推荐理由走母语
- 练习内容走学习语言
- 第一版先做结构化内容 + 规则推荐，不先做黑盒 AI

## 19. 下一步实现顺序建议

后续真正开始落代码时，建议按这个顺序：

1. 定义 `sceneCatalog`
2. 定义 `coachModuleCatalog`
3. 给 onboarding 增加目标 / 水平 / 困难点
4. 写 recommendation service
5. 先接 Live 页推荐区
6. 再接 Coach 页推荐区
7. 最后再考虑是否用 LLM 润色推荐理由
