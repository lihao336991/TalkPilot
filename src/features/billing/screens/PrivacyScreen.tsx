import { legalContent } from "../legal/legalContent";
import { LegalDocumentScreen } from "./LegalDocumentScreen";

export default function PrivacyScreen() {
  return (
    <LegalDocumentScreen
      title={legalContent.privacy.title}
      subtitle={legalContent.privacy.subtitle}
      sections={legalContent.privacy.sections}
      effectiveDate={legalContent.meta.effective_date}
      contactEmail={legalContent.meta.contact_email}
    />
  );
}
