import { LegalDocumentScreen } from './LegalDocumentScreen';

const sections = [
  {
    title: '1. Subscription overview',
    body:
      'TalkPilot Pro is a recurring subscription that unlocks additional speaking time, richer coaching features, and other premium experiences. Replace this section with your exact commercial terms, renewal rules, and eligibility details.',
  },
  {
    title: '2. Billing and renewal',
    body:
      'Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current billing period. Billing is handled through the app store tied to the device account. Replace this paragraph with your final renewal and cancellation wording.',
  },
  {
    title: '3. Account and access',
    body:
      'A paid subscription is linked to the signed-in TalkPilot account used during purchase. Access to Pro features may depend on successful payment, entitlement sync, and compliance with these terms. Replace this with your final account access policy.',
  },
  {
    title: '4. Refunds and support',
    body:
      'Refund eligibility and processing are generally governed by the applicable app store. TalkPilot support can help with restore issues, entitlement sync, and subscription questions. Replace this with your official refund and support policy.',
  },
];

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      title="Terms of Service"
      subtitle="Placeholder legal copy for the Pro subscription flow. Replace with your final Terms before release."
      sections={sections}
    />
  );
}
