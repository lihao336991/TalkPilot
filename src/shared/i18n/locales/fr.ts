import { createLocale } from "./createLocale";

export const fr = createLocale({
  app: {
    defaultHeaderSubtitle: "Copilote linguistique en temps réel",
    notFoundTitle: "Cet écran n'existe pas.",
    notFoundAction: "Retour à l'accueil",
    notFoundScreenTitle: "Oups",
  },
  navigation: {
    tabs: {
      live: "Live",
      history: "Historique",
      coach: "Coach",
      profile: "Profil",
    },
  },
  common: {
    actions: {
      cancel: "Annuler",
      close: "Fermer",
      continue: "Continuer",
      retry: "Réessayer",
      tryAgain: "Réessayer",
      settings: "Réglages",
      useSystem: "Suivre le système",
      goToProfile: "Aller au profil",
      stayHere: "Rester ici",
      logIn: "Se connecter",
      logOut: "Se déconnecter",
      skip: "Ignorer",
      next: "Suivant",
      getStarted: "Commencer",
      gotIt: "Compris",
      startRecording: "Démarrer l'enregistrement",
      startConversation: "Démarrer la conversation",
      generateReply: "Générer une réponse",
      restorePurchases: "Restaurer les achats",
      manageSubscription: "Gérer l'abonnement",
      upgradeToPro: "Passer à Pro",
      viewPlans: "Voir les offres",
    },
    labels: {
      native: "Langue maternelle",
      unavailable: "Indisponible",
      notSignedIn: "Non connecté",
      emailUnavailable: "E-mail indisponible",
      app: "app",
      account: "compte",
      guest: "invité",
      aiPowered: "Avec IA",
      realTime: "Temps réel",
    },
    languageName: {
      en: "Anglais",
      "zh-CN": "Chinois simplifié",
      es: "Espagnol",
      ja: "Japonais",
      ko: "Coréen",
      fr: "Français",
      de: "Allemand",
      "pt-BR": "Portugais (Brésil)",
    },
    status: {
      loginRequired: "Connexion requise",
      syncing: "Synchronisation...",
      synced: "Synchronisé",
      signingOut: "Déconnexion...",
    },
  },
  settings: {
    title: "Réglages",
    subtitle:
      "Choisissez votre langue maternelle et la langue que vous voulez apprendre.",
    section: {
      appLanguage: "Langue maternelle",
      learningLanguage: "Langue d'apprentissage",
      legal: "Juridique et confidentialité",
      debug: "Débogage",
    },
    appLanguage: {
      description:
        "Elle sert aussi pour l'interface, les alertes et l'aide en langue maternelle.",
      followSystemTitle: "Suivre le système",
      followSystemDescription:
        "Utiliser automatiquement la langue de l'appareil. Actuelle : {{language}}",
    },
    learningLanguage: {
      description: "Enregistre la langue que vous voulez pratiquer dans TalkPilot.",
      supportNote:
        "La langue maternelle et la langue d'apprentissage ne peuvent pas être identiques.",
    },
  },
  profile: {
    headerEyebrow: "Compte",
    headerTitle: "Profil",
    talkPilotMember: "Membre TalkPilot",
    guestAccount: "Compte invité",
    signOutFailed: "Échec de la déconnexion.",
    signOutConfirmTitle: "Se déconnecter ?",
    signOutConfirmMessage:
      "Vous reviendrez en mode invité. Vous pourrez vous reconnecter à tout moment.",
    detail: {
      status: "Statut",
      sync: "Synchronisation",
      billing: "Facturation",
      expires: "Expire",
      email: "E-mail",
    },
    preferences: {
      title: "Préférences",
      body:
        "Ajustez votre langue maternelle et choisissez la langue à apprendre.",
      appLanguage: "Langue maternelle",
      learningLanguage: "Langue d'apprentissage",
    },
    feedback: {
      title: "Retour",
      body:
        "Partagez les problèmes produit, vos idées ou ce qui vous a semblé étrange.",
    },
  },
});
