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
  auth: {
    login: {
      closeAccessibilityLabel: "Fermer la connexion",
      title: "Continuez avec votre compte",
      subtitle:
        "Utilisez Apple ou Google pour garder votre progression synchronisée sur cet appareil.",
      fallbackError: "Échec de la connexion. Veuillez réessayer plus tard.",
      appleButton: "Continuer avec Apple",
      googleButton: "Continuer avec Google",
      appleLoading: "Finalisation de la connexion Apple...",
      legalHint:
        "En continuant, vous acceptez d'utiliser votre compte Apple ou Google sur cet appareil.",
      unsupportedTitle: "iOS uniquement pour le moment",
      unsupportedBody:
        "La connexion Apple et Google est actuellement activée pour la version iOS de cette première sortie.",
      errors: {
        appleUnsupportedPlatform: "La connexion Apple est actuellement disponible uniquement sur iOS.",
        appleUnavailable: "La connexion Apple n'est pas disponible sur cet appareil.",
        appleMissingToken: "La connexion Apple n'a pas renvoyé de jeton d'identité.",
        appleCancelled: "La connexion Apple a été annulée.",
        googleUnsupportedPlatform: "La connexion Google est actuellement disponible uniquement sur iOS.",
        googleMissingToken: "La connexion Google n'a pas renvoyé de jeton d'identification.",
        googleCancelled: "La connexion Google a été annulée.",
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
      agree: "Agree and Continue",
      openPrivacy: "Privacy Policy",
      openTerms: "Terms of Service",
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
    legal: {
      aiConsentTitle: "AI data use consent",
      aiConsentAcceptedDescription:
        "You already agreed to the in-app notice for Live transcription, translation, and AI replies. Open to review it again.",
      aiConsentPendingDescription:
        "Review the in-app notice that appears before Live sends voice or transcript data to Deepgram, Cerebras, Together AI, Google Cloud Translation, and Supabase services.",
      termsDescription:
        "Consultez les conditions du produit, les abonnements et l'utilisation acceptable.",
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
    membershipBody: {
      free:
        "La formule gratuite inclut 10 min de live par jour. Les corrections IA et suggestions de réponse sont illimitées.",
    },
    limits: {
      reviewFree: "Illimité",
      suggestFree: "Illimité",
    },
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
  billing: {
    paywall: {
      benefits: {
        review: "Correction IA illimitée dans toutes les formules",
        suggest: "Suggestions de réponse IA illimitées dans toutes les formules",
      },
    },
  },
});
