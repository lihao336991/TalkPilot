import { createLocale } from "./createLocale";

export const ptBR = createLocale({
  app: {
    defaultHeaderSubtitle: "Copiloto de idiomas em tempo real",
    notFoundTitle: "Esta tela não existe.",
    notFoundAction: "Voltar para o início",
    notFoundScreenTitle: "Ops",
  },
  navigation: {
    tabs: {
      live: "Ao vivo",
      history: "Histórico",
      coach: "Treino",
      profile: "Perfil",
    },
  },
  common: {
    actions: {
      cancel: "Cancelar",
      close: "Fechar",
      continue: "Continuar",
      retry: "Tentar novamente",
      tryAgain: "Tente de novo",
      settings: "Configurações",
      useSystem: "Seguir sistema",
      goToProfile: "Ir para Perfil",
      stayHere: "Ficar aqui",
      logIn: "Entrar",
      logOut: "Sair",
      skip: "Pular",
      next: "Próximo",
      getStarted: "Começar",
      gotIt: "Entendi",
      startRecording: "Iniciar gravação",
      startConversation: "Iniciar conversa",
      generateReply: "Gerar resposta",
      restorePurchases: "Restaurar compras",
      manageSubscription: "Gerenciar assinatura",
      upgradeToPro: "Atualizar para Pro",
      viewPlans: "Ver planos",
    },
    labels: {
      native: "Língua materna",
      unavailable: "Indisponível",
      notSignedIn: "Não conectado",
      emailUnavailable: "E-mail indisponível",
      app: "app",
      account: "conta",
      guest: "convidado",
      aiPowered: "Com IA",
      realTime: "Tempo real",
    },
    languageName: {
      en: "Inglês",
      "zh-CN": "Chinês simplificado",
      es: "Espanhol",
      ja: "Japonês",
      ko: "Coreano",
      fr: "Francês",
      de: "Alemão",
      "pt-BR": "Português (Brasil)",
    },
    status: {
      loginRequired: "Login necessário",
      syncing: "Sincronizando...",
      synced: "Sincronizado",
      signingOut: "Saindo...",
    },
  },
  auth: {
    login: {
      closeAccessibilityLabel: "Fechar login",
      title: "Continue com sua conta",
      subtitle:
        "Use Apple ou Google para manter seu progresso sincronizado neste dispositivo.",
      fallbackError: "Falha ao entrar. Tente novamente mais tarde.",
      appleButton: "Continuar com Apple",
      googleButton: "Continuar com Google",
      appleLoading: "Concluindo login com Apple...",
      legalHint:
        "Ao continuar, você concorda em usar sua conta Apple ou Google neste dispositivo.",
      unsupportedTitle: "Apenas iOS por enquanto",
      unsupportedBody:
        "O login com Apple e Google está ativado atualmente para a versão iOS neste primeiro lançamento.",
      errors: {
        appleUnsupportedPlatform: "O login com Apple está disponível apenas no iOS por enquanto.",
        appleUnavailable: "O login com Apple não está disponível neste dispositivo.",
        appleMissingToken: "O login com Apple não retornou um token de identidade.",
        appleCancelled: "O login com Apple foi cancelado.",
        googleUnsupportedPlatform: "O login com Google está disponível apenas no iOS por enquanto.",
        googleMissingToken: "O login com Google não retornou um ID token.",
        googleCancelled: "O login com Google foi cancelado.",
      },
    },
  },
  settings: {
    title: "Configurações",
    subtitle: "Escolha sua língua materna e o idioma que quer aprender.",
    section: {
      appLanguage: "Língua materna",
      learningLanguage: "Idioma de aprendizado",
      legal: "Legal e privacidade",
      debug: "Depuração",
    },
    appLanguage: {
      description:
        "Também é usada na interface, alertas e ajuda na sua língua materna.",
      followSystemTitle: "Seguir sistema",
      followSystemDescription:
        "Usar automaticamente o idioma do dispositivo. Atual: {{language}}",
    },
    learningLanguage: {
      description: "Salva o idioma que você quer praticar no TalkPilot.",
      supportNote:
        "A língua materna e o idioma de aprendizado não podem ser iguais.",
    },
    legal: {
      termsDescription:
        "Revise os termos do produto, assinaturas e uso aceitável.",
    },
  },
  profile: {
    headerEyebrow: "Conta",
    headerTitle: "Perfil",
    talkPilotMember: "Membro do TalkPilot",
    guestAccount: "Conta de convidado",
    signOutFailed: "Falha ao sair.",
    signOutConfirmTitle: "Sair?",
    signOutConfirmMessage:
      "Você voltará ao modo convidado. Entre novamente quando quiser.",
    membershipBody: {
      free:
        "O plano grátis inclui 10 min ao vivo por dia. Revisão por IA e sugestões de resposta são ilimitadas.",
    },
    limits: {
      reviewFree: "Ilimitado",
      suggestFree: "Ilimitado",
    },
    detail: {
      status: "Status",
      sync: "Sincronização",
      billing: "Cobrança",
      expires: "Expira",
      email: "E-mail",
    },
    preferences: {
      title: "Preferências",
      body: "Ajuste sua língua materna e o idioma que quer aprender.",
      appLanguage: "Língua materna",
      learningLanguage: "Idioma de aprendizado",
    },
    feedback: {
      title: "Feedback",
      body: "Compartilhe problemas, ideias ou algo que pareceu estranho.",
    },
  },
  billing: {
    paywall: {
      benefits: {
        review: "Revisão por IA ilimitada em todos os planos",
        suggest: "Sugestões de resposta por IA ilimitadas em todos os planos",
      },
    },
  },
});
