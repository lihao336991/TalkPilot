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
});
