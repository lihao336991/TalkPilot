import { createLocale } from "./createLocale";

export const ja = createLocale({
  app: {
    defaultHeaderSubtitle: "リアルタイム言語コパイロット",
    notFoundTitle: "この画面は存在しません。",
    notFoundAction: "ホームに戻る",
    notFoundScreenTitle: "おっと",
  },
  navigation: {
    tabs: {
      live: "ライブ",
      history: "履歴",
      coach: "コーチ",
      profile: "プロフィール",
    },
  },
  common: {
    actions: {
      cancel: "キャンセル",
      close: "閉じる",
      continue: "続ける",
      retry: "再試行",
      tryAgain: "もう一度試す",
      settings: "設定",
      useSystem: "システムに従う",
      goToProfile: "プロフィールへ",
      stayHere: "ここに残る",
      logIn: "ログイン",
      logOut: "ログアウト",
      skip: "スキップ",
      next: "次へ",
      getStarted: "始める",
      gotIt: "了解",
      startRecording: "録音を開始",
      startConversation: "会話を開始",
      generateReply: "返信を生成",
      restorePurchases: "購入を復元",
      manageSubscription: "サブスクリプション管理",
      upgradeToPro: "Pro にアップグレード",
      viewPlans: "プランを見る",
    },
    labels: {
      native: "母語",
      unavailable: "利用不可",
      notSignedIn: "未ログイン",
      emailUnavailable: "メール利用不可",
      app: "アプリ",
      account: "アカウント",
      guest: "ゲスト",
      aiPowered: "AI 搭載",
      realTime: "リアルタイム",
    },
    languageName: {
      en: "英語",
      "zh-CN": "簡体字中国語",
      es: "スペイン語",
      ja: "日本語",
      ko: "韓国語",
      fr: "フランス語",
      de: "ドイツ語",
      "pt-BR": "ポルトガル語（ブラジル）",
    },
    status: {
      loginRequired: "ログインが必要です",
      syncing: "同期中...",
      synced: "同期済み",
      signingOut: "ログアウト中...",
    },
  },
  auth: {
    login: {
      closeAccessibilityLabel: "ログインを閉じる",
      title: "アカウントで続行",
      subtitle:
        "Apple または Google でログインして、この端末で進捗を同期します。",
      fallbackError: "ログインに失敗しました。しばらくしてからもう一度お試しください。",
      appleButton: "Apple で続行",
      googleButton: "Google で続行",
      appleLoading: "Apple ログインを完了しています...",
      legalHint:
        "続行すると、この端末で Apple または Google アカウントを使用することに同意したものとみなされます。",
      unsupportedTitle: "現在は iOS のみ",
      unsupportedBody:
        "この初回リリースでは、Apple と Google のログインは iOS ビルドでのみ有効です。",
      errors: {
        appleUnsupportedPlatform: "Apple ログインは現在 iOS のみ対応しています。",
        appleUnavailable: "この端末では Apple ログインを利用できません。",
        appleMissingToken: "Apple ログインで identity token が返されませんでした。",
        appleCancelled: "Apple ログインはキャンセルされました。",
        googleUnsupportedPlatform: "Google ログインは現在 iOS のみ対応しています。",
        googleMissingToken: "Google ログインで ID token が返されませんでした。",
        googleCancelled: "Google ログインはキャンセルされました。",
      },
    },
  },
  settings: {
    title: "設定",
    subtitle: "母語と学習したい言語を選択します。",
    section: {
      appLanguage: "母語",
      learningLanguage: "学習言語",
      legal: "法務とプライバシー",
      debug: "デバッグ",
    },
    appLanguage: {
      description:
        "画面表示、通知、母語での補助入力にも使用されます。",
      followSystemTitle: "システムに従う",
      followSystemDescription:
        "端末の言語を自動で使用します。現在: {{language}}",
    },
    learningLanguage: {
      description: "TalkPilot で練習したい言語を保存します。",
      supportNote: "母語と学習言語を同じにすることはできません。",
    },
    legal: {
      termsDescription:
        "製品規約、サブスクリプション、利用可能な範囲を確認します。",
    },
  },
  profile: {
    headerEyebrow: "アカウント",
    headerTitle: "プロフィール",
    talkPilotMember: "TalkPilot メンバー",
    guestAccount: "ゲストアカウント",
    signOutFailed: "ログアウトに失敗しました。",
    signOutConfirmTitle: "ログアウトしますか？",
    signOutConfirmMessage:
      "ゲストモードに戻ります。いつでも再度ログインできます。",
    membershipBody: {
      free:
        "無料版ではライブ会話を1日10分利用できます。AIレビューと返信提案は無制限です。",
    },
    limits: {
      reviewFree: "無制限",
      suggestFree: "無制限",
    },
    detail: {
      status: "状態",
      sync: "同期",
      billing: "請求",
      expires: "有効期限",
      email: "メール",
    },
    preferences: {
      title: "環境設定",
      body: "母語と学習したい言語を調整します。",
      appLanguage: "母語",
      learningLanguage: "学習言語",
    },
    feedback: {
      title: "フィードバック",
      body: "問題、アイデア、気になった体験を共有してください。",
    },
  },
  billing: {
    paywall: {
      benefits: {
        review: "すべてのプランでAIレビューを無制限に利用",
        suggest: "すべてのプランでAI返信提案を無制限に利用",
      },
    },
  },
});
