import { createLocale } from "./createLocale";

export const es = createLocale({
  app: {
    defaultHeaderSubtitle: "Copiloto de idiomas en tiempo real",
    notFoundTitle: "Esta pantalla no existe.",
    notFoundAction: "Volver al inicio",
    notFoundScreenTitle: "Vaya",
  },
  navigation: {
    tabs: {
      live: "En vivo",
      history: "Historial",
      coach: "Entrenador",
      profile: "Perfil",
    },
  },
  common: {
    actions: {
      cancel: "Cancelar",
      close: "Cerrar",
      continue: "Continuar",
      retry: "Reintentar",
      tryAgain: "Intentar de nuevo",
      settings: "Ajustes",
      useSystem: "Seguir sistema",
      goToProfile: "Ir al perfil",
      stayHere: "Quedarse aquí",
      logIn: "Iniciar sesión",
      logOut: "Cerrar sesión",
      skip: "Saltar",
      next: "Siguiente",
      getStarted: "Empezar",
      gotIt: "Entendido",
      startRecording: "Empezar grabación",
      startConversation: "Iniciar conversación",
      generateReply: "Generar respuesta",
      restorePurchases: "Restaurar compras",
      manageSubscription: "Gestionar suscripción",
      upgradeToPro: "Mejorar a Pro",
      viewPlans: "Ver planes",
    },
    labels: {
      native: "Lengua materna",
      unavailable: "No disponible",
      notSignedIn: "Sin sesión",
      emailUnavailable: "Correo no disponible",
      app: "app",
      account: "cuenta",
      guest: "invitado",
      aiPowered: "Con IA",
      realTime: "Tiempo real",
    },
    languageName: {
      en: "Inglés",
      "zh-CN": "Chino simplificado",
      es: "Español",
      ja: "Japonés",
      ko: "Coreano",
      fr: "Francés",
      de: "Alemán",
      "pt-BR": "Portugués (Brasil)",
    },
    status: {
      loginRequired: "Inicio de sesión requerido",
      syncing: "Sincronizando...",
      synced: "Sincronizado",
      signingOut: "Cerrando sesión...",
    },
  },
  settings: {
    title: "Ajustes",
    subtitle: "Elige tu lengua materna y el idioma que quieres aprender.",
    section: {
      appLanguage: "Lengua materna",
      learningLanguage: "Idioma de aprendizaje",
      legal: "Legal y privacidad",
      debug: "Depuración",
    },
    appLanguage: {
      description:
        "También se usa para la interfaz, alertas y ayuda en tu lengua materna.",
      followSystemTitle: "Seguir sistema",
      followSystemDescription:
        "Usar automáticamente el idioma del dispositivo. Actual: {{language}}",
    },
    learningLanguage: {
      description: "Guarda el idioma que quieres practicar en TalkPilot.",
      supportNote:
        "La lengua materna y el idioma de aprendizaje no pueden ser iguales.",
    },
  },
  profile: {
    headerEyebrow: "Cuenta",
    headerTitle: "Perfil",
    talkPilotMember: "Miembro de TalkPilot",
    guestAccount: "Cuenta de invitado",
    signOutFailed: "No se pudo cerrar sesión.",
    signOutConfirmTitle: "¿Cerrar sesión?",
    signOutConfirmMessage:
      "Volverás al modo invitado. Puedes iniciar sesión de nuevo cuando quieras.",
    detail: {
      status: "Estado",
      sync: "Sincronización",
      billing: "Facturación",
      expires: "Vence",
      email: "Correo",
    },
    preferences: {
      title: "Preferencias",
      body: "Ajusta tu lengua materna y el idioma que quieres aprender.",
      appLanguage: "Lengua materna",
      learningLanguage: "Idioma de aprendizaje",
    },
    feedback: {
      title: "Comentarios",
      body: "Comparte problemas, ideas o cualquier experiencia incómoda.",
    },
  },
});
