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
});
