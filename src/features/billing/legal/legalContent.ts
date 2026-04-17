import legalContentJson from "../../../../data/legal/legal.json";

type LegalSection = {
  title: string;
  body: string;
};

type LegalDocument = {
  title: string;
  subtitle: string;
  sections: LegalSection[];
};

type LegalContent = {
  meta: {
    app_name: string;
    publisher_name: string;
    contact_email: string;
    effective_date: string;
    hosting: {
      terms_url: string;
      privacy_url: string;
      repo_url: string;
      repo_local_path: string;
      publish_subdirectory: string;
    };
  };
  subscription_disclosure: {
    title: string;
    bullets: string[];
    restore_copy: string;
  };
  app_review: {
    title: string;
    summary: string;
    items: string[];
  };
  terms: LegalDocument;
  privacy: LegalDocument;
};

export type { LegalDocument, LegalSection, LegalContent };

export const legalContent = legalContentJson as LegalContent;
