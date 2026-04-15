import { LegalDocumentScreen } from './LegalDocumentScreen';

const sections = [
  {
    title: '1. Information we collect',
    body:
      'TalkPilot may collect account identifiers, subscription status, usage events, and app diagnostics needed to deliver and improve the subscription experience. Replace this section with your final privacy disclosures and data categories.',
  },
  {
    title: '2. How we use your information',
    body:
      'Information may be used to authenticate users, unlock Pro features, restore purchases, provide support, and maintain service reliability. Replace this paragraph with the final lawful use cases that apply to your product.',
  },
  {
    title: '3. Sharing and storage',
    body:
      'Subscription and billing related information may be processed by trusted providers such as app stores, RevenueCat, and backend infrastructure vendors acting on our behalf. Replace this section with your final third-party sharing and retention terms.',
  },
  {
    title: '4. Your choices',
    body:
      'Users may manage subscriptions through the relevant app store account settings and can contact support for account-related privacy requests. Replace this with your final user rights, contact details, and region-specific language.',
  },
];

export default function PrivacyScreen() {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      subtitle="Placeholder privacy copy for the Pro subscription flow. Replace with your final Privacy Policy before release."
      sections={sections}
    />
  );
}
