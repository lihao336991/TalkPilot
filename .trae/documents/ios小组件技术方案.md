# SpeakEasy — iOS 锁屏交互技术方案

> 本文档为 SpeakEasy 核心技术方案的增强模块，聚焦 iOS Live Activity + Dynamic Island + 锁屏小组件的实现方案。建议在 MVP 核心功能（M0-M3）完成后，作为 M4 阶段的体验差异化功能实现。

---

## 一、方案概述

### 1.1 为什么要做锁屏交互

SpeakEasy 的核心使用场景是用户在**真实对话中**使用，这意味着用户的注意力应该在对话本身，而不是手机屏幕上。锁屏交互让用户无需解锁手机，余光一瞥即可获取 AI 建议和 Review 反馈，是这个产品的**最佳交互形态**。

| 维度 | App 全屏界面 | 锁屏 Live Activity |
|------|------------|-------------------|
| 注意力分配 | 用户要分心看手机屏幕 | 余光一瞥就够，注意力留在对话上 |
| 社交尴尬度 | 对话中一直盯手机，对方会不舒服 | 手机平放桌上，看锁屏很自然 |
| 操作门槛 | 需要解锁 → 打开 App | 零操作，信息主动推到锁屏 |
| 使用姿态 | 手持手机 | 手机放桌上/口袋里，偶尔瞥一眼 |
| 竞品差异 | 所有语言学习 App 都是全屏界面 | 市面上没有任何语言学习 App 做了 Live Activity |

### 1.2 iOS 提供的三层锁屏能力

| 层级 | iOS 技术 | 展示位置 | 特点 |
|------|---------|---------|------|
| **Dynamic Island** | ActivityKit | 刘海/药丸区域 | 始终可见，极紧凑，支持动画 |
| **Live Activity** | ActivityKit | 锁屏展开区域 | 信息量较大，支持实时更新 |
| **Lock Screen Widget** | WidgetKit | 锁屏小组件区域 | 静态/低频更新，适合统计信息 |

### 1.3 系统版本要求

| 能力 | 最低系统版本 | 支持设备 |
|------|------------|---------|
| Live Activity | iOS 16.1+ | iPhone 14 及以上（灵动岛），其他机型仅锁屏 |
| Dynamic Island | iOS 16.1+ | 仅 iPhone 14 Pro 及以上 |
| Lock Screen Widget | iOS 16.0+ | 所有支持 iOS 16 的 iPhone |

---

## 二、信息架构设计

### 2.1 三层信息分配

```
┌─────────────────────────────────────────────┐
│           Dynamic Island (灵动岛)              │
│                                             │
│  紧凑态:  🎧 12m                             │  ← 状态图标 + 对话时长
│  最小态:  🟢                                  │  ← 仅 Review 颜色点
│  展开态:  (长按展开)                            │
│    💬 "Want to grab coffee?"                 │  ← 对方最后一句
│    💡 "Sure, I'd love to!"                   │  ← 首条建议
│    🟢 12min · 8 turns                        │  ← 统计
├─────────────────────────────────────────────┤
│         Live Activity (锁屏展开态)              │
│                                             │
│  🎧 SpeakEasy · Office Hour       12min     │  ← 标题栏
│                                             │
│  Other said:                                │
│  "Could you explain your approach to        │
│   the research methodology?"                │  ← 对方完整话语
│                                             │
│  💡 Formal:                                  │
│  "Certainly. My approach involves..."       │  ← 建议 1
│                                             │
│  💡 Casual:                                  │
│  "Sure! So basically I..."                  │  ← 建议 2
│                                             │
│  Last review: 🟡 "researches → research"     │  ← 上一句 Review
│                                             │
│  8 turns · 3 corrections                    │  ← 底部统计
├─────────────────────────────────────────────┤
│         Lock Screen Widget (静态小组件)         │
│                                             │
│  Circular:  🟢 (Review 平均分颜色)             │  ← 圆形小组件
│  Inline:    🎧 SpeakEasy · 23min today       │  ← 行内小组件
│  Rect:      Today: 23min | 42 turns | 5 🟢   │  ← 矩形小组件
└─────────────────────────────────────────────┘
```

### 2.2 各状态下的信息展示策略

| 对话状态 | Dynamic Island 紧凑态 | Live Activity 锁屏 | 触发时机 |
|---------|---------------------|-------------------|---------|
| **正在听对方说话** | 🎧 + 时长 | 显示 "Listening..." + 音波动画 | 检测到 other 在说话 |
| **对方说完，AI 生成中** | ✨ + 时长 | 显示对方最后一句 + "Generating..." | UtteranceEnd(other) |
| **AI 建议就绪** | 💡 + 时长 | 显示对方最后一句 + 2 条建议 | 建议生成完毕 |
| **你在说话** | 🎙️ + 时长 | 建议淡出 + "Your turn..." | 检测到 self 在说话 |
| **Review 结果** | 🟢/🟡/🔴 | 显示 Review 简要结果 | Review 返回 |
| **静默等待** | 🎧 + 时长 | 保持上一次状态 | 超过 10s 无活动 |

---

## 三、数据模型

### 3.1 ActivityAttributes 定义

```swift
// Sources/Shared/ConversationAttributes.swift

import ActivityKit
import Foundation

/// Live Activity 的数据模型
/// - 固定属性（attributes）：创建时确定，整个 Activity 生命周期不变
/// - 动态状态（ContentState）：每轮对话更新
struct ConversationAttributes: ActivityAttributes {
    
    // MARK: - 动态状态（频繁更新）
    public struct ContentState: Codable, Hashable {
        /// 对话状态
        var conversationState: ConversationState
        
        /// 对方最后说的话
        var lastOtherUtterance: String
        
        /// AI 建议列表（最多 2 条，锁屏空间有限）
        var suggestions: [SuggestionItem]
        
        /// 最近一次 Review 结果
        var lastReviewScore: ReviewScore?
        var lastReviewBrief: String?  // 如 "goed → went"
        
        /// 实时统计
        var elapsedMinutes: Int
        var turnCount: Int
        var correctionCount: Int
    }
    
    // MARK: - 固定属性（创建时确定）
    /// 场景名称
    var sceneName: String
    /// 对话开始时间
    var startTime: Date
    /// 用户订阅等级（决定是否展示建议）
    var subscriptionTier: String
}

// MARK: - 子类型

enum ConversationState: String, Codable, Hashable {
    case listening       // 正在听对方说话
    case generating      // AI 正在生成建议
    case yourTurn        // 轮到你说了（建议已就绪）
    case speaking        // 你正在说话
    case reviewing       // AI 正在 Review
    case idle            // 静默等待
}

struct SuggestionItem: Codable, Hashable {
    var style: String    // "formal" / "casual"
    var text: String
}

enum ReviewScore: String, Codable, Hashable {
    case green   // 优秀
    case yellow  // 可以更好
    case red     // 有明显错误
}
```

### 3.2 App Group 共享数据

Live Activity / Widget Extension 与主 App 运行在不同进程中，需要通过 App Group 共享数据。

```swift
// Sources/Shared/SharedDataManager.swift

import Foundation

/// App 与 Widget Extension 共享数据的桥梁
class SharedDataManager {
    static let shared = SharedDataManager()
    
    private let suiteName = "group.com.speakeasy.shared"
    private let defaults: UserDefaults
    
    init() {
        self.defaults = UserDefaults(suiteName: suiteName)!
    }
    
    // MARK: - 写入（主 App 调用）
    
    /// 更新今日统计（供锁屏小组件读取）
    func updateTodayStats(totalMinutes: Int, totalTurns: Int, totalCorrections: Int, avgScore: ReviewScore?) {
        defaults.set(totalMinutes, forKey: "today_minutes")
        defaults.set(totalTurns, forKey: "today_turns")
        defaults.set(totalCorrections, forKey: "today_corrections")
        defaults.set(avgScore?.rawValue, forKey: "today_avg_score")
        defaults.set(Date().timeIntervalSince1970, forKey: "today_updated_at")
    }
    
    /// 更新当前对话状态（供 Widget 判断是否在对话中）
    func updateConversationActive(_ active: Bool) {
        defaults.set(active, forKey: "conversation_active")
    }
    
    // MARK: - 读取（Widget Extension 调用）
    
    func getTodayMinutes() -> Int { defaults.integer(forKey: "today_minutes") }
    func getTodayTurns() -> Int { defaults.integer(forKey: "today_turns") }
    func getTodayCorrections() -> Int { defaults.integer(forKey: "today_corrections") }
    func getTodayAvgScore() -> ReviewScore? {
        guard let raw = defaults.string(forKey: "today_avg_score") else { return nil }
        return ReviewScore(rawValue: raw)
    }
    func isConversationActive() -> Bool { defaults.bool(forKey: "conversation_active") }
}
```

---

## 四、Live Activity 生命周期管理

### 4.1 LiveActivityManager

```swift
// Sources/Services/LiveActivityManager.swift

import ActivityKit
import Foundation

class LiveActivityManager: ObservableObject {
    static let shared = LiveActivityManager()
    
    private var currentActivity: Activity<ConversationAttributes>?
    private let sharedData = SharedDataManager.shared
    
    /// 检查设备是否支持 Live Activity
    var isSupported: Bool {
        ActivityAuthorizationInfo().areActivitiesEnabled
    }
    
    // MARK: - 生命周期
    
    /// 开始对话 → 启动 Live Activity
    func startConversation(scene: String, tier: String) throws {
        guard isSupported else {
            print("Live Activity not supported on this device")
            return
        }
        
        // 如果有正在运行的 Activity，先结束
        if currentActivity != nil {
            endConversation()
        }
        
        let attributes = ConversationAttributes(
            sceneName: scene,
            startTime: Date(),
            subscriptionTier: tier
        )
        
        let initialState = ConversationAttributes.ContentState(
            conversationState: .listening,
            lastOtherUtterance: "",
            suggestions: [],
            lastReviewScore: nil,
            lastReviewBrief: nil,
            elapsedMinutes: 0,
            turnCount: 0,
            correctionCount: 0
        )
        
        let content = ActivityContent(
            state: initialState,
            staleDate: Date().addingTimeInterval(60 * 60) // 1 小时后标记为过期
        )
        
        currentActivity = try Activity.request(
            attributes: attributes,
            content: content,
            pushType: nil  // 本地更新，不走 APNS
        )
        
        sharedData.updateConversationActive(true)
    }
    
    /// 结束对话 → 关闭 Live Activity
    func endConversation() {
        Task {
            // 展示最终状态 4 秒后消失
            let finalState = ConversationAttributes.ContentState(
                conversationState: .idle,
                lastOtherUtterance: "Conversation ended",
                suggestions: [],
                lastReviewScore: nil,
                lastReviewBrief: nil,
                elapsedMinutes: currentActivity?.content.state.elapsedMinutes ?? 0,
                turnCount: currentActivity?.content.state.turnCount ?? 0,
                correctionCount: currentActivity?.content.state.correctionCount ?? 0
            )
            
            await currentActivity?.end(
                ActivityContent(state: finalState, staleDate: nil),
                dismissalPolicy: .after(Date().addingTimeInterval(4))
            )
            currentActivity = nil
            sharedData.updateConversationActive(false)
        }
    }
    
    // MARK: - 状态更新
    
    /// 对方正在说话
    func updateListening() {
        updateState { state in
            state.conversationState = .listening
        }
    }
    
    /// 对方说完，AI 开始生成建议
    func updateGenerating(otherSaid: String) {
        updateState { state in
            state.conversationState = .generating
            state.lastOtherUtterance = otherSaid
            state.suggestions = []  // 清空旧建议
            state.turnCount += 1
        }
    }
    
    /// AI 建议生成完毕
    func updateSuggestionsReady(suggestions: [SuggestionItem]) {
        updateState { state in
            state.conversationState = .yourTurn
            state.suggestions = Array(suggestions.prefix(2)) // 锁屏最多显示 2 条
        }
    }
    
    /// 用户正在说话（建议卡片淡出）
    func updateSpeaking() {
        updateState { state in
            state.conversationState = .speaking
            state.suggestions = []  // 清空建议
        }
    }
    
    /// Review 结果返回
    func updateReview(score: ReviewScore, brief: String?) {
        updateState { state in
            state.conversationState = .listening
            state.lastReviewScore = score
            state.lastReviewBrief = brief
            state.turnCount += 1
            if score == .yellow || score == .red {
                state.correctionCount += 1
            }
        }
    }
    
    /// 更新经过时间（每分钟调用一次）
    func updateElapsedTime(minutes: Int) {
        updateState { state in
            state.elapsedMinutes = minutes
        }
    }
    
    // MARK: - 内部方法
    
    private func updateState(_ modify: (inout ConversationAttributes.ContentState) -> Void) {
        guard var state = currentActivity?.content.state else { return }
        modify(&state)
        
        Task {
            await currentActivity?.update(
                ActivityContent(state: state, staleDate: nil)
            )
        }
    }
}
```

### 4.2 与 AudioEngine 的集成点

在现有的 `handleUtteranceEnd` 回调中增加 Live Activity 更新：

```typescript
// React Native 侧：通过 NativeModule 桥接调用 Swift
import { NativeModules } from 'react-native';
const { LiveActivityBridge } = NativeModules;

async function handleUtteranceEnd(speaker: string, text: string) {
  // 1. 存储这轮对话（现有逻辑不变）
  await supabase.from('turns').insert({
    session_id: currentSessionId,
    speaker,
    text,
    turn_id: `turn_${Date.now()}`,
  });

  if (speaker === 'other') {
    // 2a. 更新 Live Activity：对方说完
    LiveActivityBridge.updateGenerating(text);
    
    // 2b. 获取建议（现有逻辑不变）
    const suggestions = await suggestionService.fetchSuggestions(
      currentSessionId, text, currentScene
    );
    
    // 2c. 更新 Live Activity：建议就绪
    LiveActivityBridge.updateSuggestionsReady(suggestions);
    
  } else if (speaker === 'self') {
    // 3a. 更新 Live Activity：用户正在说话
    LiveActivityBridge.updateSpeaking();
    
    // 3b. 获取 Review（现有逻辑不变）
    const review = await reviewService.fetchReview(
      currentSessionId, text, currentScene
    );
    
    // 3c. 更新 Live Activity：Review 结果
    LiveActivityBridge.updateReview(review.overall_score, review.issues?.[0]?.corrected);
  }
}
```

---

## 五、Live Activity UI 实现

### 5.1 锁屏展开态（主要信息展示）

```swift
// Sources/Widgets/ConversationLiveActivity.swift

import SwiftUI
import WidgetKit
import ActivityKit

struct ConversationLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ConversationAttributes.self) { context in
            // ======= 锁屏展开态 =======
            LockScreenView(context: context)
                .activityBackgroundTint(.black.opacity(0.8))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            // ======= 灵动岛 =======
            DynamicIsland {
                // 展开态 - 顶部左侧
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 4) {
                        stateIcon(context.state.conversationState)
                            .font(.caption)
                        Text(context.attributes.sceneName)
                            .font(.caption2)
                            .lineLimit(1)
                    }
                }
                // 展开态 - 顶部右侧
                DynamicIslandExpandedRegion(.trailing) {
                    Text("\(context.state.elapsedMinutes)m")
                        .font(.caption.monospacedDigit())
                        .foregroundColor(.secondary)
                }
                // 展开态 - 中央
                DynamicIslandExpandedRegion(.center) {
                    if !context.state.lastOtherUtterance.isEmpty {
                        Text(context.state.lastOtherUtterance)
                            .font(.caption)
                            .lineLimit(2)
                            .foregroundColor(.secondary)
                    }
                }
                // 展开态 - 底部
                DynamicIslandExpandedRegion(.bottom) {
                    if let suggestion = context.state.suggestions.first {
                        HStack(spacing: 4) {
                            Image(systemName: "lightbulb.fill")
                                .foregroundColor(.yellow)
                                .font(.caption2)
                            Text(suggestion.text)
                                .font(.caption)
                                .lineLimit(2)
                        }
                    } else if let score = context.state.lastReviewScore {
                        HStack(spacing: 4) {
                            scoreCircle(score, size: 8)
                            if let brief = context.state.lastReviewBrief {
                                Text(brief)
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
            // 紧凑态 - 左侧
            compactLeading: {
                stateIcon(context.state.conversationState)
                    .font(.caption)
            }
            // 紧凑态 - 右侧
            compactTrailing: {
                HStack(spacing: 3) {
                    if let score = context.state.lastReviewScore {
                        scoreCircle(score, size: 8)
                    }
                    Text("\(context.state.elapsedMinutes)m")
                        .font(.caption.monospacedDigit())
                }
            }
            // 最小态（多个 Live Activity 同时运行时）
            minimal: {
                stateIcon(context.state.conversationState)
                    .font(.caption)
            }
        }
    }
}

// MARK: - 锁屏展开态视图

struct LockScreenView: View {
    let context: ActivityViewContext<ConversationAttributes>
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // 顶部栏：场景 + 时长
            HStack {
                Image(systemName: "waveform")
                    .foregroundColor(.blue)
                Text(context.attributes.sceneName)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text("\(context.state.elapsedMinutes) min")
                    .font(.caption.monospacedDigit())
                    .foregroundColor(.secondary)
            }
            
            // 对方说的话
            if !context.state.lastOtherUtterance.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Other said:")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    Text(context.state.lastOtherUtterance)
                        .font(.subheadline)
                        .lineLimit(3)
                }
            }
            
            // AI 建议
            if !context.state.suggestions.isEmpty {
                ForEach(Array(context.state.suggestions.enumerated()), id: \.offset) { index, suggestion in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: "lightbulb.fill")
                            .foregroundColor(.yellow)
                            .font(.caption)
                            .padding(.top, 2)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(suggestion.style.capitalized)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                            Text(suggestion.text)
                                .font(.subheadline)
                                .lineLimit(2)
                        }
                    }
                }
            }
            
            // 状态提示
            if context.state.conversationState == .generating {
                HStack(spacing: 4) {
                    ProgressView()
                        .scaleEffect(0.6)
                    Text("Generating suggestions...")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            // 底部：Review + 统计
            HStack {
                if let score = context.state.lastReviewScore {
                    HStack(spacing: 4) {
                        scoreCircle(score, size: 10)
                        if let brief = context.state.lastReviewBrief {
                            Text(brief)
                                .font(.caption2)
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
                Spacer()
                Text("\(context.state.turnCount) turns")
                    .font(.caption2)
                    .foregroundColor(.secondary)
                if context.state.correctionCount > 0 {
                    Text("· \(context.state.correctionCount) fixes")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(16)
    }
}

// MARK: - 通用组件

func stateIcon(_ state: ConversationState) -> some View {
    Group {
        switch state {
        case .listening:
            Image(systemName: "ear.fill").foregroundColor(.blue)
        case .generating:
            Image(systemName: "sparkles").foregroundColor(.purple)
        case .yourTurn:
            Image(systemName: "lightbulb.fill").foregroundColor(.yellow)
        case .speaking:
            Image(systemName: "mic.fill").foregroundColor(.green)
        case .reviewing:
            Image(systemName: "checkmark.circle.fill").foregroundColor(.orange)
        case .idle:
            Image(systemName: "waveform").foregroundColor(.gray)
        }
    }
}

func scoreCircle(_ score: ReviewScore, size: CGFloat) -> some View {
    Circle()
        .fill(colorForScore(score))
        .frame(width: size, height: size)
}

func colorForScore(_ score: ReviewScore) -> Color {
    switch score {
    case .green: return .green
    case .yellow: return .yellow
    case .red: return .red
    }
}
```

---

## 六、锁屏小组件（静态统计）

### 6.1 WidgetKit 实现

```swift
// Sources/Widgets/SpeakEasyWidget.swift

import SwiftUI
import WidgetKit

// MARK: - Timeline Provider

struct SpeakEasyWidgetProvider: TimelineProvider {
    let sharedData = SharedDataManager.shared
    
    func placeholder(in context: Context) -> SpeakEasyEntry {
        SpeakEasyEntry(date: Date(), minutes: 0, turns: 0, corrections: 0, avgScore: nil, isActive: false)
    }
    
    func getSnapshot(in context: Context, completion: @escaping (SpeakEasyEntry) -> Void) {
        let entry = SpeakEasyEntry(
            date: Date(),
            minutes: sharedData.getTodayMinutes(),
            turns: sharedData.getTodayTurns(),
            corrections: sharedData.getTodayCorrections(),
            avgScore: sharedData.getTodayAvgScore(),
            isActive: sharedData.isConversationActive()
        )
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<SpeakEasyEntry>) -> Void) {
        let entry = SpeakEasyEntry(
            date: Date(),
            minutes: sharedData.getTodayMinutes(),
            turns: sharedData.getTodayTurns(),
            corrections: sharedData.getTodayCorrections(),
            avgScore: sharedData.getTodayAvgScore(),
            isActive: sharedData.isConversationActive()
        )
        // 每 15 分钟刷新一次
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

struct SpeakEasyEntry: TimelineEntry {
    let date: Date
    let minutes: Int
    let turns: Int
    let corrections: Int
    let avgScore: ReviewScore?
    let isActive: Bool
}

// MARK: - 圆形小组件（锁屏）

struct CircularWidgetView: View {
    let entry: SpeakEasyEntry
    
    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            if entry.isActive {
                // 对话中：显示动态图标
                Image(systemName: "waveform")
                    .font(.title3)
            } else if let score = entry.avgScore {
                // 今日有数据：显示平均分颜色
                VStack(spacing: 1) {
                    scoreCircle(score, size: 12)
                    Text("\(entry.minutes)m")
                        .font(.system(size: 9).monospacedDigit())
                }
            } else {
                // 无数据：显示 App 图标
                Image(systemName: "bubble.left.and.text.bubble.right")
                    .font(.caption)
            }
        }
    }
}

// MARK: - 矩形小组件（锁屏）

struct RectangularWidgetView: View {
    let entry: SpeakEasyEntry
    
    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                if entry.isActive {
                    HStack(spacing: 4) {
                        Image(systemName: "waveform")
                        Text("In conversation...")
                            .font(.caption2)
                    }
                } else {
                    Text("Today")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                    HStack(spacing: 8) {
                        Label("\(entry.minutes)m", systemImage: "clock")
                        Label("\(entry.turns)", systemImage: "bubble.left.and.bubble.right")
                        if entry.corrections > 0 {
                            Label("\(entry.corrections)", systemImage: "pencil.line")
                        }
                    }
                    .font(.caption2)
                }
            }
            Spacer()
            if let score = entry.avgScore {
                scoreCircle(score, size: 14)
            }
        }
    }
}

// MARK: - 行内小组件（锁屏）

struct InlineWidgetView: View {
    let entry: SpeakEasyEntry
    
    var body: some View {
        if entry.isActive {
            Label("In conversation...", systemImage: "waveform")
        } else {
            Label("SpeakEasy · \(entry.minutes)min today", systemImage: "bubble.left.and.text.bubble.right")
        }
    }
}

// MARK: - Widget 注册

@main
struct SpeakEasyWidgets: WidgetBundle {
    var body: some Widget {
        // Live Activity
        ConversationLiveActivity()
        
        // 锁屏小组件
        SpeakEasyLockScreenWidget()
    }
}

struct SpeakEasyLockScreenWidget: Widget {
    let kind = "SpeakEasyLockScreenWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SpeakEasyWidgetProvider()) { entry in
            switch entry.widgetFamily {
            case .accessoryCircular:
                CircularWidgetView(entry: entry)
            case .accessoryRectangular:
                RectangularWidgetView(entry: entry)
            case .accessoryInline:
                InlineWidgetView(entry: entry)
            default:
                EmptyView()
            }
        }
        .configurationDisplayName("SpeakEasy")
        .description("Track your English conversations")
        .supportedFamilies([
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}
```

---

## 七、React Native 桥接

### 7.1 Native Module 桥接

由于 ActivityKit 是纯 Swift API，需要通过 Native Module 桥接到 React Native 层。

```swift
// ios/SpeakEasy/LiveActivityBridge.swift

import Foundation
import ActivityKit

@objc(LiveActivityBridge)
class LiveActivityBridge: NSObject {
    private let manager = LiveActivityManager.shared
    
    @objc static func requiresMainQueueSetup() -> Bool { false }
    
    @objc func startConversation(_ scene: String, tier: String,
                                  resolver: @escaping RCTPromiseResolveBlock,
                                  rejecter: @escaping RCTPromiseRejectBlock) {
        do {
            try manager.startConversation(scene: scene, tier: tier)
            resolver(true)
        } catch {
            rejecter("LA_ERROR", error.localizedDescription, error)
        }
    }
    
    @objc func endConversation(_ resolver: @escaping RCTPromiseResolveBlock,
                                rejecter: @escaping RCTPromiseRejectBlock) {
        manager.endConversation()
        resolver(true)
    }
    
    @objc func updateGenerating(_ otherSaid: String) {
        manager.updateGenerating(otherSaid: otherSaid)
    }
    
    @objc func updateSuggestionsReady(_ suggestionsJSON: String) {
        guard let data = suggestionsJSON.data(using: .utf8),
              let suggestions = try? JSONDecoder().decode([SuggestionItem].self, from: data)
        else { return }
        manager.updateSuggestionsReady(suggestions: suggestions)
    }
    
    @objc func updateSpeaking() {
        manager.updateSpeaking()
    }
    
    @objc func updateReview(_ score: String, brief: String?) {
        guard let reviewScore = ReviewScore(rawValue: score) else { return }
        manager.updateReview(score: reviewScore, brief: brief)
    }
    
    @objc func updateElapsedTime(_ minutes: Int) {
        manager.updateElapsedTime(minutes: minutes)
    }
}
```

```objc
// ios/SpeakEasy/LiveActivityBridge.m

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(LiveActivityBridge, NSObject)

RCT_EXTERN_METHOD(startConversation:(NSString *)scene
                  tier:(NSString *)tier
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(endConversation:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(updateGenerating:(NSString *)otherSaid)
RCT_EXTERN_METHOD(updateSuggestionsReady:(NSString *)suggestionsJSON)
RCT_EXTERN_METHOD(updateSpeaking)
RCT_EXTERN_METHOD(updateReview:(NSString *)score brief:(NSString *)brief)
RCT_EXTERN_METHOD(updateElapsedTime:(NSInteger)minutes)

@end
```

### 7.2 TypeScript 封装

```typescript
// app/src/services/LiveActivityService.ts

import { NativeModules, Platform } from 'react-native';

const { LiveActivityBridge } = NativeModules;

class LiveActivityService {
  private supported: boolean;

  constructor() {
    // Live Activity 仅 iOS 支持
    this.supported = Platform.OS === 'ios' && !!LiveActivityBridge;
  }

  async startConversation(scene: string, tier: string): Promise<void> {
    if (!this.supported) return;
    try {
      await LiveActivityBridge.startConversation(scene, tier);
    } catch (e) {
      console.warn('Failed to start Live Activity:', e);
      // 非致命错误，不影响核心功能
    }
  }

  endConversation(): void {
    if (!this.supported) return;
    LiveActivityBridge.endConversation();
  }

  updateGenerating(otherSaid: string): void {
    if (!this.supported) return;
    LiveActivityBridge.updateGenerating(otherSaid);
  }

  updateSuggestionsReady(suggestions: Array<{style: string; text: string}>): void {
    if (!this.supported) return;
    LiveActivityBridge.updateSuggestionsReady(JSON.stringify(suggestions));
  }

  updateSpeaking(): void {
    if (!this.supported) return;
    LiveActivityBridge.updateSpeaking();
  }

  updateReview(score: 'green' | 'yellow' | 'red', brief?: string): void {
    if (!this.supported) return;
    LiveActivityBridge.updateReview(score, brief || null);
  }

  updateElapsedTime(minutes: number): void {
    if (!this.supported) return;
    LiveActivityBridge.updateElapsedTime(minutes);
  }
}

export const liveActivity = new LiveActivityService();
```

---

## 八、Expo 集成方案

### 8.1 Config Plugin 方式（推荐，无需 eject）

Expo 支持通过 Config Plugin 添加 Widget Extension target，无需完全 eject。

```javascript
// plugins/withLiveActivity.js

const { withXcodeProject, withInfoPlist, withEntitlementsPlist } = require('@expo/config-plugins');

const withLiveActivity = (config) => {
  // 1. 添加 Info.plist 配置：支持 Live Activity
  config = withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
    return config;
  });

  // 2. 添加 App Group entitlement
  config = withEntitlementsPlist(config, (config) => {
    config.modResults['com.apple.security.application-groups'] = [
      'group.com.speakeasy.shared',
    ];
    return config;
  });

  // 3. 添加 Widget Extension target（需要自定义 Xcode project 修改）
  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    // Widget Extension 的文件需要预先放在 ios/SpeakEasyWidgets/ 目录
    // Config Plugin 将它们添加为新的 target
    // 具体实现参考 expo-apple-targets 社区库
    return config;
  });

  return config;
};

module.exports = withLiveActivity;
```

```json
// app.json 中注册 plugin
{
  "expo": {
    "plugins": [
      "./plugins/withLiveActivity"
    ]
  }
}
```

### 8.2 替代方案：expo-apple-targets

社区库 `expo-apple-targets` 专门解决 Expo 项目添加 Widget Extension 的问题：

```bash
npx expo install expo-apple-targets
```

```
ios/
├── SpeakEasyWidgets/                # Widget Extension 源码
│   ├── ConversationLiveActivity.swift
│   ├── SpeakEasyWidget.swift
│   ├── Info.plist
│   └── SpeakEasyWidgets.entitlements
├── Shared/                          # App 和 Widget 共享代码
│   ├── ConversationAttributes.swift
│   └── SharedDataManager.swift
└── SpeakEasy/                       # 主 App
    ├── LiveActivityBridge.swift
    └── LiveActivityBridge.m
```

---

## 九、项目文件结构变更

相对于现有技术方案，需要新增以下文件：

```
speakeasy/
├── app/
│   ├── src/
│   │   ├── services/
│   │   │   ├── LiveActivityService.ts    # [新增] TS 封装层
│   │   │   └── ... (现有文件不变)
│   │   └── ...
│   ├── ios/
│   │   ├── SpeakEasy/
│   │   │   ├── LiveActivityBridge.swift  # [新增] Native Module 实现
│   │   │   └── LiveActivityBridge.m      # [新增] ObjC 桥接头
│   │   ├── SpeakEasyWidgets/             # [新增] Widget Extension
│   │   │   ├── ConversationLiveActivity.swift
│   │   │   ├── SpeakEasyWidget.swift
│   │   │   ├── Info.plist
│   │   │   └── SpeakEasyWidgets.entitlements
│   │   └── Shared/                       # [新增] 共享代码
│   │       ├── ConversationAttributes.swift
│   │       └── SharedDataManager.swift
│   ├── plugins/
│   │   └── withLiveActivity.js           # [新增] Expo Config Plugin
│   └── app.json                          # [修改] 添加 plugin 注册
└── ...
```

---

## 十、限制与注意事项

### 10.1 系统限制

| 限制 | 说明 | 应对 |
|------|------|------|
| Live Activity 最多运行 8 小时 | 系统自动结束超时的 Activity | 接近 8 小时时提醒用户，或自动重启 |
| 锁屏展开态高度有限 | 大约 160pt，内容不能太多 | 最多显示 2 条建议，超长文本截断 |
| 更新频率限制 | 系统可能合并短时间内的多次更新 | 做 debounce，避免每个 interim result 都更新 |
| Dynamic Island 仅 iPhone 14 Pro+ | 旧设备没有灵动岛 | 优雅降级，锁屏 Live Activity 仍然可用 |
| Widget Extension 内存限制 30MB | Widget 不能做复杂计算 | Widget 只做展示，所有逻辑在主 App |

### 10.2 设计注意事项

| 要点 | 说明 |
|------|------|
| 深色模式适配 | 锁屏通常是深色背景，所有文字和图标需要在深色背景下清晰可读 |
| 文字长度处理 | 对方的话可能很长，需要严格 lineLimit 控制，超出部分截断加省略号 |
| 无障碍支持 | Review 颜色不能仅靠颜色区分（色盲用户），需要同时有文字或图标辅助 |
| 首次引导 | 用户可能不知道添加锁屏小组件，App 内提供引导教程 |

---

## 十一、开发排期

| 任务 | 预估工时 | 依赖 |
|------|---------|------|
| ConversationAttributes 数据模型 | 0.5 天 | 无 |
| SharedDataManager 共享数据层 | 0.5 天 | 无 |
| LiveActivityManager 生命周期管理 | 1 天 | 数据模型 |
| Live Activity UI（锁屏 + 灵动岛） | 2 天 | 数据模型 |
| 锁屏小组件 UI | 1 天 | SharedDataManager |
| Native Module 桥接（Swift ↔ RN） | 1 天 | LiveActivityManager |
| TypeScript 封装 + 集成到现有流程 | 1 天 | Native Module |
| Expo Config Plugin 配置 | 1 天 | 所有 Swift 代码 |
| 测试 + 调试 + 深色模式适配 | 1-2 天 | 全部 |
| **总计** | **8-10 天** | — |

**建议排期**：在 MVP M3 完成（核心功能跑通）后，用 M4 的 2 周时间实现。先完成 Live Activity（核心价值最大），锁屏小组件可以后续补充。

---

## 十二、效果预期

| 指标 | 预期影响 |
|------|---------|
| App Store 截图差异化 | 灵动岛 + 锁屏 Live Activity 截图，竞品没有，视觉冲击力强 |
| 对话时长提升 | 用户不用一直举着手机，更愿意长时间使用 |
| 社交场景渗透率 | 降低使用时的社交尴尬感，更多场景下愿意开着 App |
| DAU 留存提升 | 锁屏小组件每天可见，提醒用户使用 |
| Pro 转化率 | 锁屏展示 AI 建议时 Free 用户看到次数限制提示，转化触点更自然 |
