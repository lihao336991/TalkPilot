export const en = {
  app: {
    defaultHeaderTitle: "TalkPilot",
    defaultHeaderSubtitle: "Real-Time Language Copilot",
    notFoundTitle: "This screen doesn't exist.",
    notFoundAction: "Go to home screen!",
    notFoundScreenTitle: "Oops!",
  },
  navigation: {
    tabs: {
      live: "Live",
      history: "History",
      coach: "Coach",
      profile: "Profile",
    },
  },
  common: {
    actions: {
      cancel: "Cancel",
      close: "Close",
      continue: "Continue",
      retry: "Retry",
      tryAgain: "Try again",
      settings: "Settings",
      useSystem: "Follow system",
      goToProfile: "Go to Profile",
      stayHere: "Stay here",
      logIn: "Log in",
      logOut: "Log out",
      skip: "Skip",
      next: "Next",
      getStarted: "Get Started",
      gotIt: "Got it",
      startRecording: "Start Recording",
      startConversation: "Start conversation",
      generateReply: "Generate reply",
      restorePurchases: "Restore Purchases",
      manageSubscription: "Manage subscription",
      upgradeToPro: "Upgrade to Pro",
      viewPlans: "View plans",
    },
    labels: {
      native: "Native",
      unavailable: "Unavailable",
      notSignedIn: "Not signed in",
      emailUnavailable: "Email unavailable",
      app: "app",
      account: "account",
      guest: "guest",
      aiPowered: "AI-powered",
      realTime: "Real-time",
    },
    languageName: {
      en: "English",
      "zh-CN": "Simplified Chinese",
      es: "Spanish",
      ja: "Japanese",
      ko: "Korean",
      fr: "French",
      de: "German",
      "pt-BR": "Portuguese (Brazil)",
    },
    status: {
      loginRequired: "Log in required",
      syncing: "Syncing…",
      synced: "Synced",
      signingOut: "Signing out…",
    },
    legal: {
      effectiveDate: "Effective date",
      contact: "Contact",
    },
    authProvider: {
      anonymous: "guest",
      apple: "Apple",
      google: "Google",
      unknown: "account",
    },
    subscriptionTier: {
      free: "Free",
      pro: "TalkPilot Pro",
      unlimited: "TalkPilot Pro",
      freePreview: "Free preview",
    },
    subscriptionStatus: {
      inactive: "inactive",
      active: "active",
      trialing: "trialing",
      canceled: "canceled",
      billingIssue: "billing issue",
      expired: "expired",
      syncing: "syncing",
    },
  },
  auth: {
    login: {
      closeAccessibilityLabel: "Close login",
      title: "Continue with your account",
      subtitle:
        "Use Apple or Google to keep your progress synced on this device.",
      fallbackError: "Sign in failed. Please try again later.",
      googleButton: "Continue with Google",
      appleLoading: "Completing Apple sign-in...",
      legalHint:
        "By continuing, you agree to use your Apple or Google account on this device.",
      unsupportedTitle: "iOS only for now",
      unsupportedBody:
        "Apple and Google sign-in are currently enabled for the iOS build in this first release.",
    },
  },
  onboarding: {
    slides: {
      speak: {
        eyebrow: "REAL-TIME",
        headline: "No prep.\nJust start speaking",
        body: "Tap once and say it.",
      },
      reply: {
        eyebrow: "AI SUGGESTIONS",
        headline: "When they finish,\nyou know what to say",
        body: "AI gives you a reply that fits.",
        sourceLabel: "They said",
        sourceTextLine1: "Are you free this weekend?",
        sourceTextLine2: "你这周末有空吗？",
        suggestionLabel: "Suggested",
        suggestionLine1: "I'm free on Sunday.",
        suggestionLine2: "我周日有空。",
      },
      review: {
        eyebrow: "INSTANT REVIEW",
        headline: "Turns out,\nit can sound more natural",
        body: "Tap once and refine it.",
        originalLabel: "Your version",
        originalText: "I very like this movie.",
        improvedLabel: "More natural",
        improvedText: "I really like this movie.",
      },
    },
  },
  live: {
    nativeAssist: {
      listening: "Listening to your native speech...",
      generating: "Translating to the learning language...",
      ready: "Translation ready",
      original: "{{language}} original",
      suggestedReply: "Translation",
    },
    screen: {
      wsHintListening: "Mic is sending audio",
      wsHintPaused: "Mic is paused",
      assistDraftTitle: "Edit before sending",
      assistDraftSubtitle:
        "Refine your text, then generate a reply in your learning language",
      assistDraftPlaceholder: "Edit your speech into clearer text",
    },
    startSession: {
      accessibilityLabel: "Start conversation",
      titleReady: "Start Conversation",
      subtitleReady: "Tap to begin your live session",
      titleLimit: "Daily limit reached",
      subtitleLimit: "Upgrade to Pro for 120 min/day",
      usageLabel: "Daily usage",
      usageLimitReached: "Limit reached",
      usageRemaining: "{{count}} min left",
      usageSummary: "{{used}} / {{limit}} min used today",
    },
    voiceEnrollment: {
      title: "Voice Setup",
      introBody:
        "Speak for {{seconds}} seconds so the app can recognise your voice and separate it from your conversation partner's.",
      introHint:
        "You only need to do this once. Your sample is stored locally.",
      skipForNow: "Skip for now",
      recordingBody: "Keep talking naturally - anything works.",
      countdown: "{{count}}s",
      saving: "Saving voice sample and generating local voiceprint…",
      doneBody:
        "Voice sample saved. Your voice will be recognised automatically in every session.",
      errorBody: "Local voiceprint generation failed. Please record again.",
      retryAction: "Record again",
    },
    speakerCalibration: {
      title: "Voice Detection",
      instruction:
        "Please speak first when the session starts - the system will automatically recognize your voice from the first sentence.",
      skipAccessibilityLabel: "Skip voice detection",
      startAccessibilityLabel: "Start session",
    },
    suggestionPanel: {
      title: "Reply Suggestion",
      subtitle: "AI has prepared a more natural reply for you",
      actionSendAndPlay: "Send and play suggestion",
      sending: "Sending...",
    },
    suggestionStyle: {
      formal: "Formal",
      casual: "Casual",
      simple: "Simple",
    },
    reviewIndicator: {
      pass: "Pass",
      warn: "Warn",
      error: "Error",
      grammar: "Grammar",
      wording: "Wording",
      naturalness: "Naturalness",
      tryTemplate: "Try: {{text}}",
      tapReviewDetails: "Tap to review details",
      moreNaturalOption: "More natural option",
      suggestion: "Suggestion",
      tapSeeFeedback: "Tap to see feedback",
    },
    reviewDetail: {
      scoreHelpPass: "This sentence is okay.",
      scoreHelpWarn: "A small fix or cleaner phrasing will sound better.",
      scoreHelpError: "There is a clear issue worth fixing.",
      mainIssue: "Main issue",
      youSaid: "You said",
      sayInstead: "Say instead",
      recommendedWording: "Recommended wording",
      goodPart: "Good part",
      empty: "No detailed issue was returned for this sentence.",
    },
    transcript: {
      translating: "Translating...",
      translationFailed: "Translation failed",
      playLearningTranslation: "Play learning-language translation",
    },
    toolbar: {
      paused: "Paused",
      listening: "Listening…",
      live: "Live",
      resume: "Resume",
      pause: "Pause",
      holdToSpeak: "Hold to speak",
      assistOverlayTitle: "Say it in your native language when you get stuck.",
      assistOverlaySubtitle:
        "I turn it into the learning language live. Release for text only, or slide right to speak it out.",
      releaseToSend: "Release to send",
      sosCaption: "Native language assist",
      endConversation: "End conversation",
      end: "End",
    },
    pressAndSlide: {
      editDraftFallback: "Release to turn this into editable text",
      speakReplyFallback: "Slide right and release to speak the learning-language reply",
      releaseCancel: "Release to cancel",
      cancel: "Cancel",
      releaseEditText: "Release to edit text",
      releaseSpeakReply: "Release to translate and speak",
      slideToText: "Slide here for text",
      slideToSpeak: "Slide here to speak",
      releaseSend: "Release to send",
      releaseTranslateOnly: "Release for text only",
    },
    conversationFlow: {
      listening: "Listening...",
    },
  },
  history: {
    headerEyebrow: "History",
    headerTitle: "Sessions",
    refreshAccessibilityLabel: "Refresh session history",
    stats: {
      sessions: "sessions",
      minutesPracticed: "min practiced",
      completed: "completed",
    },
    state: {
      loadingTitle: "Loading sessions…",
      loadingBody: "Pulling your conversation history.",
      errorTitle: "Could not load history",
      emptyTitle: "No sessions yet",
      emptyBody:
        "Start a conversation in Live and end it to see it appear here.",
    },
    duration: {
      lessThanOneMinute: "< 1 min",
      seconds: "{{count}}s",
      minutesOnly: "{{count}} min",
      minutesSeconds: "{{minutes}} min {{seconds}}s",
    },
    scene: {
      freeConversation: "Free conversation",
    },
    sessionStatus: {
      ended: "ended",
      paused: "paused",
      active: "active",
    },
    detail: {
      conversation: "Conversation",
      recap: "Session Recap",
      recapGenerating: "Analyzing your session…",
      recapRetry: "Generate Recap",
      recapEmpty: "Not enough conversation data to generate a recap.",
      highlights: "Language Highlights",
      improvements: "Areas to Improve",
      overallComment: "Overall",
      reviewBadge: {
        green: "Great",
        yellow: "Good",
        red: "Needs work",
      },
      noTurns: "No conversation recorded in this session.",
    },
    card: {
      recapped: "Reviewed",
    },
  },
  coach: {
    title: "Coach",
    subtitle: "Practice flows and reply strategy",
    heroTitle:
      "Build reusable coaching surfaces before wiring in real-time AI logic.",
    heroDescription:
      "This tab is ready for prompt templates, speaking drills, review rubrics, and expression packs.",
    drills: {
      replyPolishTitle: "Reply polish",
      replyPolishDescription:
        "Shorten a response while keeping it friendly and confident.",
      rephraseIntentTitle: "Rephrase intent",
      rephraseIntentDescription:
        "Switch between casual, business, and interview tones in one tap.",
      repairMomentsTitle: "Repair moments",
      repairMomentsDescription:
        'Handle "Sorry, could you repeat that?" and clarification follow-ups.',
    },
    placeholderTitle: "Coming soon",
    placeholderBody:
      "Coach features are planned for Phase 2. Stay tuned for prompt templates, speaking drills, and expression packs.",
  },
  settings: {
    title: "Settings",
    subtitle: "Choose the app language and the language you want to learn.",
    section: {
      appLanguage: "App language",
      learningLanguage: "Learning language",
      debug: "Debug",
    },
    appLanguage: {
      description:
        "This changes navigation, buttons, alerts, and other interface text.",
      followSystemTitle: "Follow system",
      followSystemDescription:
        "Use your device language automatically. Current: {{language}}",
    },
    learningLanguage: {
      description:
        "This saves which language you want to learn in TalkPilot.",
      supportNote:
        "The main live WebSocket listens to your learning language, while Assist listens to your native language for rescue input.",
    },
    voiceEnrollment: {
      title: "Voice sample",
      description:
        "If you already saved a local voice sample, Live can enter directly without showing the voice recognition prompt.",
      statusLabel: "Local sample",
      loading: "Checking…",
      saved: "Saved on this device",
      enhancedReady: "Enhanced recognition enabled",
      legacyOnly: "Legacy sample only",
      notSaved: "Not set up yet",
      savedHint:
        "PCM sample and local voiceprint are both ready. You can play this sample or reset it.",
      legacyHint:
        "Only an older PCM sample is available right now. Re-record once to enable enhanced recognition.",
      emptyHint:
        "No local sample is saved right now. The next Live session will ask you to record one.",
      playAction: "Play sample",
      playing: "Playing…",
      resetAction: "Reset sample",
      unavailableTitle: "Sample unavailable",
      unavailableBody:
        "The local voice sample could not be loaded. Try recording it again from Live.",
      playbackErrorTitle: "Playback failed",
      playbackErrorBody:
        "The local voice sample could not be played right now. Please try again.",
      resetConfirmTitle: "Reset voice sample?",
      resetConfirmBody:
        "This removes the local enrollment sample. The next Live session will ask you to record a new one.",
    },
    debug: {
      description:
        "Developer-only tools for testing setup flows. This section is hidden in production builds.",
      forceOnboardingTitle: "Force onboarding on launch",
      forceOnboardingDescription:
        "Always show onboarding on the next cold launch, even if it was already completed.",
    },
  },
  profile: {
    headerEyebrow: "Account",
    headerTitle: "Profile",
    talkPilotMember: "TalkPilot Member",
    guestAccount: "Guest account",
    signOutFailed: "Sign out failed.",
    signOutConfirmTitle: "Log out?",
    signOutConfirmMessage:
      "You'll return to guest mode. Sign in again anytime.",
    membershipBody: {
      syncing:
        "Purchase confirmed. Pro access is already active while we finish syncing.",
      active: "Pro is active. Manage billing or restore purchases anytime below.",
      free: "Free includes 10 live min, 100 reviews, and 100 suggestions per day.",
      guest:
        "Log in before purchasing so your subscription stays synced across devices.",
    },
    limits: {
      live: "Live",
      review: "Review",
      suggest: "Suggest",
      liveFree: "10 min/day",
      livePro: "120 min/day",
      reviewFree: "100/day",
      reviewPro: "Unlimited",
      suggestFree: "100/day",
      suggestPro: "Unlimited",
    },
    detail: {
      status: "Status",
      sync: "Sync",
      billing: "Billing",
      expires: "Expires",
      email: "Email",
    },
    preferences: {
      title: "Preferences",
      body: "Adjust app language and choose the language you want to learn.",
      appLanguage: "App language",
      learningLanguage: "Learning language",
    },
  },
  billing: {
    customerCenter: {
      unsupportedTitle: "Customer center is mobile-only",
      unsupportedBody:
        "Open the iOS or Android build to manage subscriptions with RevenueCat UI.",
      closeAccessibilityLabel: "Close customer center",
      title: "Manage subscription",
      subtitle:
        "Review your plan, restore purchases, or manage billing actions from RevenueCat Customer Center.",
    },
    legal: {
      closeAccessibilityLabel: "Close legal document",
    },
    paywall: {
      closeAccessibilityLabel: "Close paywall",
      titleEyebrow: "TalkPilot Pro",
      titleChoosePlan: "Choose your plan",
      titleAlreadyPro: "You're already Pro",
      loading: "Loading paywall...",
      unavailableTitle: "Paywall unavailable",
      unavailableFallback: "Failed to load paywall.",
      webUnsupportedTitle: "Purchases are not available on web",
      webUnsupportedBody:
        "Open the iOS or Android development build to test RevenueCat paywalls.",
      activeStatusSyncing:
        "Pro is already active. We're just finishing the account sync.",
      activeStatusReady: "This account already has Pro access.",
      restoreChecking: "Checking this account for existing purchases...",
      restoreCompleteTitle: "Restore complete",
      restoreMissingTitle: "Nothing to restore",
      restoreFailedTitle: "Restore failed",
      restoreFailedFallback:
        "We couldn't restore purchases right now. Please try again later.",
      purchaseCompleteTitle: "Purchase complete",
      purchaseReceivedTitle: "Purchase received",
      purchaseFailedTitle: "Purchase failed",
      purchaseFailedFallback: "Please try again in a moment.",
      purchaseCancelled: "Purchase cancelled. No changes were made.",
      purchaseProcessing: "Processing purchase...",
      sectionTitlePlans: "Plans",
      sectionTitleAvailablePlans: "Available plans",
      sectionTitleProDetails: "Pro details",
      noOfferingTitle: "No offering configured",
      noOfferingBody:
        "RevenueCat did not return a current offering. Check your default offering in the dashboard.",
      statusCard: {
        syncingTitle: "Pro is active and still syncing",
        syncingBody:
          "Your purchase has already gone through. You can keep using Pro while we finish syncing this account.",
        activeTitle: "Pro is already active",
        activeBody:
          "This account already has Pro. You can manage billing below or review other plans if you want to switch later.",
      },
      benefits: {
        live: "120 live speaking minutes every day instead of 10",
        review: "Unlimited AI review instead of the free 100/day cap",
        suggest: "Unlimited AI reply suggestions instead of the free 100/day cap",
        sync: "Purchase restore and account sync",
      },
      inlineActionTerms: "Terms",
      inlineActionPrivacy: "Privacy",
      footerManageSubscription: "Manage subscription",
      footerManageBillingSyncing: "Pro active, manage billing",
      footerRestorePurchases: "Restore Purchases",
      footerRestoring: "Restoring...",
      continueForPrice: "Continue for {{price}}",
      choosePlanFallback: "Choose a plan",
      package: {
        periodYear: "per year",
        periodMonth: "per month",
        periodWeek: "per week",
        periodSubscription: "subscription",
        cycleAnnual: "Annual billing",
        cycleMonthly: "Monthly billing",
        cycleWeekly: "Weekly billing",
        cycleRecurring: "Recurring billing",
        titleYearly: "Yearly Pro",
        titleMonthly: "Monthly Pro",
        titleFallback: "Pro Plan",
        captionYearly: "Best value",
        captionMonthly: "Most flexible",
        captionFallback: "Premium access",
        badgeYearly: "Best Value",
        badgeMonthly: "Most Flexible",
        savePercent: "Save {{percent}}%",
        saveAmount: "Save {{amount}}",
        perMonth: "{{price}} / month",
      },
      summary: {
        purchaseReady: "You're all set. Pro is active on this account now.",
        purchaseSyncing:
          "Purchase confirmed. Pro is already active, and we're finishing account sync in the background.",
        purchaseDelayed:
          "Purchase completed, but activation is taking a little longer than expected.",
        restoreReady: "Your subscription has been restored and is ready to use.",
        restoreSyncing:
          "Restore succeeded. Pro is available now, and account sync is still finishing.",
        restoreMissing:
          "No active subscription was found to restore for this account.",
      },
    },
  },
} as const;
