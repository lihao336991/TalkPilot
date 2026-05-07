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
});
