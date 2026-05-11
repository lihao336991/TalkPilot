import { createLocale } from "./createLocale";

export const de = createLocale({
  app: {
    defaultHeaderSubtitle: "Echtzeit-Sprachcopilot",
    notFoundTitle: "Dieser Bildschirm existiert nicht.",
    notFoundAction: "Zur Startseite",
    notFoundScreenTitle: "Hoppla",
  },
  navigation: {
    tabs: {
      live: "Live",
      history: "Verlauf",
      coach: "Coach",
      profile: "Profil",
    },
  },
  common: {
    actions: {
      cancel: "Abbrechen",
      close: "Schließen",
      continue: "Weiter",
      retry: "Erneut versuchen",
      tryAgain: "Nochmals versuchen",
      settings: "Einstellungen",
      useSystem: "System folgen",
      goToProfile: "Zum Profil",
      stayHere: "Hier bleiben",
      logIn: "Einloggen",
      logOut: "Ausloggen",
      skip: "Überspringen",
      next: "Weiter",
      getStarted: "Loslegen",
      gotIt: "Verstanden",
      startRecording: "Aufnahme starten",
      startConversation: "Gespräch starten",
      generateReply: "Antwort erstellen",
      restorePurchases: "Käufe wiederherstellen",
      manageSubscription: "Abo verwalten",
      upgradeToPro: "Auf Pro upgraden",
      viewPlans: "Pläne ansehen",
    },
    labels: {
      native: "Muttersprache",
      unavailable: "Nicht verfügbar",
      notSignedIn: "Nicht angemeldet",
      emailUnavailable: "E-Mail nicht verfügbar",
      app: "App",
      account: "Konto",
      guest: "Gast",
      aiPowered: "KI-gestützt",
      realTime: "Echtzeit",
    },
    languageName: {
      en: "Englisch",
      "zh-CN": "Vereinfachtes Chinesisch",
      es: "Spanisch",
      ja: "Japanisch",
      ko: "Koreanisch",
      fr: "Französisch",
      de: "Deutsch",
      "pt-BR": "Portugiesisch (Brasilien)",
    },
    status: {
      loginRequired: "Login erforderlich",
      syncing: "Synchronisierung...",
      synced: "Synchronisiert",
      signingOut: "Abmeldung...",
    },
  },
  auth: {
    login: {
      closeAccessibilityLabel: "Login schließen",
      title: "Mit deinem Konto fortfahren",
      subtitle:
        "Melde dich mit Apple oder Google an, damit dein Fortschritt auf diesem Gerät synchron bleibt.",
      fallbackError: "Anmeldung fehlgeschlagen. Bitte versuche es später erneut.",
      appleButton: "Mit Apple fortfahren",
      googleButton: "Mit Google fortfahren",
      appleLoading: "Apple-Anmeldung wird abgeschlossen...",
      legalHint:
        "Wenn du fortfährst, stimmst du zu, dein Apple- oder Google-Konto auf diesem Gerät zu verwenden.",
      unsupportedTitle: "Derzeit nur iOS",
      unsupportedBody:
        "Apple- und Google-Anmeldung sind in dieser ersten Version derzeit für den iOS-Build aktiviert.",
      errors: {
        appleUnsupportedPlatform: "Apple-Anmeldung ist derzeit nur auf iOS verfügbar.",
        appleUnavailable: "Apple-Anmeldung ist auf diesem Gerät nicht verfügbar.",
        appleMissingToken: "Apple-Anmeldung hat kein Identity Token zurückgegeben.",
        appleCancelled: "Apple-Anmeldung wurde abgebrochen.",
        googleUnsupportedPlatform: "Google-Anmeldung ist derzeit nur auf iOS verfügbar.",
        googleMissingToken: "Google-Anmeldung hat kein ID-Token zurückgegeben.",
        googleCancelled: "Google-Anmeldung wurde abgebrochen.",
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
    title: "Einstellungen",
    subtitle:
      "Wähle deine Muttersprache und die Sprache, die du lernen möchtest.",
    section: {
      appLanguage: "Muttersprache",
      learningLanguage: "Lernsprache",
      legal: "Rechtliches und Datenschutz",
      debug: "Debug",
    },
    appLanguage: {
      description:
        "Sie wird auch für Oberfläche, Hinweise und Hilfe in deiner Muttersprache verwendet.",
      followSystemTitle: "System folgen",
      followSystemDescription:
        "Gerätesprache automatisch verwenden. Aktuell: {{language}}",
    },
    learningLanguage: {
      description: "Speichert, welche Sprache du in TalkPilot üben möchtest.",
      supportNote:
        "Muttersprache und Lernsprache dürfen nicht identisch sein.",
    },
    legal: {
      aiConsentTitle: "AI data use consent",
      aiConsentAcceptedDescription:
        "You already agreed to the in-app notice for Live transcription, translation, and AI replies. Open to review it again.",
      aiConsentPendingDescription:
        "Review the in-app notice that appears before Live sends voice or transcript data to Deepgram, Cerebras, Together AI, Google Cloud Translation, and Supabase services.",
      termsDescription:
        "Lies die Produktbedingungen, Abonnements und Regeln zur zulässigen Nutzung.",
    },
  },
  profile: {
    headerEyebrow: "Konto",
    headerTitle: "Profil",
    talkPilotMember: "TalkPilot-Mitglied",
    guestAccount: "Gastkonto",
    signOutFailed: "Abmeldung fehlgeschlagen.",
    signOutConfirmTitle: "Ausloggen?",
    signOutConfirmMessage:
      "Du kehrst in den Gastmodus zurück. Du kannst dich jederzeit wieder anmelden.",
    membershipBody: {
      free:
        "Free enthält 10 Live-Minuten pro Tag. KI-Review und Antwortvorschläge sind unbegrenzt.",
    },
    limits: {
      reviewFree: "Unbegrenzt",
      suggestFree: "Unbegrenzt",
    },
    detail: {
      status: "Status",
      sync: "Synchronisierung",
      billing: "Abrechnung",
      expires: "Läuft ab",
      email: "E-Mail",
    },
    preferences: {
      title: "Einstellungen",
      body:
        "Passe deine Muttersprache an und wähle die Sprache, die du lernen möchtest.",
      appLanguage: "Muttersprache",
      learningLanguage: "Lernsprache",
    },
    feedback: {
      title: "Feedback",
      body:
        "Teile Produktprobleme, Ideen oder etwas, das sich nicht richtig angefühlt hat.",
    },
  },
  billing: {
    paywall: {
      benefits: {
        review: "Unbegrenztes KI-Review in jedem Plan",
        suggest: "Unbegrenzte KI-Antwortvorschläge in jedem Plan",
      },
    },
  },
});
