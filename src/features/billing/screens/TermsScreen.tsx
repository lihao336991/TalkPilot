import { legalContent } from "../legal/legalContent";
import { LegalDocumentScreen } from "./LegalDocumentScreen";

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      title={legalContent.terms.title}
      subtitle={legalContent.terms.subtitle}
      sections={legalContent.terms.sections}
      effectiveDate={legalContent.meta.effective_date}
      contactEmail={legalContent.meta.contact_email}
    />
  );
}
