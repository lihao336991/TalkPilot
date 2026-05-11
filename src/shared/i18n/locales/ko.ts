import { createLocale } from "./createLocale";

export const ko = createLocale({
  app: {
    defaultHeaderSubtitle: "실시간 언어 코파일럿",
    notFoundTitle: "이 화면은 존재하지 않습니다.",
    notFoundAction: "홈으로 돌아가기",
    notFoundScreenTitle: "앗",
  },
  navigation: {
    tabs: {
      live: "라이브",
      history: "기록",
      coach: "코치",
      profile: "프로필",
    },
  },
  common: {
    actions: {
      cancel: "취소",
      close: "닫기",
      continue: "계속",
      retry: "다시 시도",
      tryAgain: "다시 해보기",
      settings: "설정",
      useSystem: "시스템 따르기",
      goToProfile: "프로필로 이동",
      stayHere: "여기에 머무르기",
      logIn: "로그인",
      logOut: "로그아웃",
      skip: "건너뛰기",
      next: "다음",
      getStarted: "시작하기",
      gotIt: "알겠습니다",
      startRecording: "녹음 시작",
      startConversation: "대화 시작",
      generateReply: "답변 생성",
      restorePurchases: "구매 복원",
      manageSubscription: "구독 관리",
      upgradeToPro: "Pro로 업그레이드",
      viewPlans: "요금제 보기",
    },
    labels: {
      native: "모국어",
      unavailable: "사용 불가",
      notSignedIn: "로그인 안 됨",
      emailUnavailable: "이메일 사용 불가",
      app: "앱",
      account: "계정",
      guest: "게스트",
      aiPowered: "AI 기반",
      realTime: "실시간",
    },
    languageName: {
      en: "영어",
      "zh-CN": "중국어 간체",
      es: "스페인어",
      ja: "일본어",
      ko: "한국어",
      fr: "프랑스어",
      de: "독일어",
      "pt-BR": "포르투갈어(브라질)",
    },
    status: {
      loginRequired: "로그인이 필요합니다",
      syncing: "동기화 중...",
      synced: "동기화됨",
      signingOut: "로그아웃 중...",
    },
  },
  auth: {
    login: {
      closeAccessibilityLabel: "로그인 닫기",
      title: "계정으로 계속하기",
      subtitle:
        "Apple 또는 Google로 로그인하여 이 기기에서 진행 상황을 동기화하세요.",
      fallbackError: "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      appleButton: "Apple로 계속하기",
      googleButton: "Google로 계속하기",
      appleLoading: "Apple 로그인 완료 중...",
      legalHint:
        "계속하면 이 기기에서 Apple 또는 Google 계정을 사용하는 데 동의하게 됩니다.",
      unsupportedTitle: "현재 iOS만 지원",
      unsupportedBody:
        "첫 출시 버전에서는 Apple 및 Google 로그인이 iOS 빌드에서만 활성화되어 있습니다.",
      errors: {
        appleUnsupportedPlatform: "Apple 로그인은 현재 iOS에서만 사용할 수 있습니다.",
        appleUnavailable: "이 기기에서는 Apple 로그인을 사용할 수 없습니다.",
        appleMissingToken: "Apple 로그인이 identity token을 반환하지 않았습니다.",
        appleCancelled: "Apple 로그인이 취소되었습니다.",
        googleUnsupportedPlatform: "Google 로그인은 현재 iOS에서만 사용할 수 있습니다.",
        googleMissingToken: "Google 로그인이 ID token을 반환하지 않았습니다.",
        googleCancelled: "Google 로그인이 취소되었습니다.",
      },
    },
  },
  privacyConsent: {
    badge: "AI data use",
    title: "Review how TalkPilot uses your voice and text",
    subtitle:
      "Before TalkPilot starts live transcription, translation, or AI reply features, we need your permission to send the required data to our service providers.",
    sections: {
      what: {
        title: "What may be sent",
        body:
          "Voice audio, speech transcripts, conversation text, your suggested reply input, and related language settings for the current session.",
      },
      who: {
        title: "Who may receive it",
        body:
          "Deepgram for speech recognition, Cerebras and Together AI for AI suggestions and review, Google Cloud Translation when that route is enabled, and Supabase-hosted backend services to deliver and store the requested features.",
      },
      why: {
        title: "Why it is sent",
        body:
          "To transcribe speech, translate content, generate reply suggestions, review your phrasing, keep session history available, and return the feature result back to your device.",
      },
    },
    note:
      "TalkPilot only sends this data when you actively use Live or related AI assistance features. You can review the Privacy Policy and Terms of Service at any time in Settings.",
    actions: {
      agree: "Agree",
      openPrivacy: "Privacy Policy",
      openTerms: "Terms of Service",
    },
  },
  settings: {
    title: "설정",
    subtitle: "모국어와 배우고 싶은 언어를 선택하세요.",
    section: {
      appLanguage: "모국어",
      learningLanguage: "학습 언어",
      legal: "법률 및 개인정보",
      debug: "디버그",
    },
    appLanguage: {
      description:
        "화면 문구, 알림, 모국어 도움 입력에도 사용됩니다.",
      followSystemTitle: "시스템 따르기",
      followSystemDescription:
        "기기 언어를 자동으로 사용합니다. 현재: {{language}}",
    },
    learningLanguage: {
      description: "TalkPilot에서 연습할 언어를 저장합니다.",
      supportNote: "모국어와 학습 언어는 같을 수 없습니다.",
    },
    legal: {
      aiConsentTitle: "AI data use consent",
      aiConsentAcceptedDescription:
        "You already agreed to the in-app notice for Live transcription, translation, and AI replies. Open to review it again.",
      aiConsentPendingDescription:
        "Review the in-app notice that appears before Live sends voice or transcript data to Deepgram, Cerebras, Together AI, Google Cloud Translation, and Supabase services.",
      termsDescription:
        "제품 약관, 구독, 허용되는 사용 기준을 확인하세요.",
    },
  },
  profile: {
    headerEyebrow: "계정",
    headerTitle: "프로필",
    talkPilotMember: "TalkPilot 멤버",
    guestAccount: "게스트 계정",
    signOutFailed: "로그아웃에 실패했습니다.",
    signOutConfirmTitle: "로그아웃할까요?",
    signOutConfirmMessage:
      "게스트 모드로 돌아갑니다. 언제든 다시 로그인할 수 있습니다.",
    membershipBody: {
      free:
        "무료 플랜은 하루 10분의 라이브 대화를 제공합니다. AI 리뷰와 답변 제안은 무제한입니다.",
    },
    limits: {
      reviewFree: "무제한",
      suggestFree: "무제한",
    },
    detail: {
      status: "상태",
      sync: "동기화",
      billing: "결제",
      expires: "만료",
      email: "이메일",
    },
    preferences: {
      title: "환경설정",
      body: "모국어와 배우고 싶은 언어를 조정합니다.",
      appLanguage: "모국어",
      learningLanguage: "학습 언어",
    },
    feedback: {
      title: "피드백",
      body: "제품 문제, 아이디어, 불편했던 경험을 공유해 주세요.",
    },
  },
  billing: {
    paywall: {
      benefits: {
        review: "모든 플랜에서 AI 리뷰 무제한",
        suggest: "모든 플랜에서 AI 답변 제안 무제한",
      },
    },
  },
});
