import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalList,
  LegalPage,
  LegalSection,
  SupportEmailLink,
} from "@/components/legal/LegalPage";
import { LEGAL_LINKS, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: "Terms of Service | Nowa" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms govern your use of Nowa at nowaa.site. By creating an account or using Nowa,
        you agree to them. If you do not agree, please do not use Nowa.
      </p>

      <LegalSection heading="1. Your account">
        <LegalList>
          <li>You must be at least 13 years old to use Nowa.</li>
          <li>
            Give accurate information when you sign up, keep your password safe, and tell us if
            you think someone else has accessed your account.
          </li>
          <li>You are responsible for what happens under your account.</li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="2. Your content">
        <p>
          You keep ownership of the videos, comments and other content you post. By posting
          content, you give Nowa a non-exclusive, worldwide, royalty-free licence to host,
          store, process, display and distribute it in order to operate the service, for
          example to transcode your videos and show them in other users&rsquo; feeds. This
          licence ends when you delete the content or your account, except for copies other
          users have already shared or that we must keep by law.
        </p>
        <p>You confirm that you have the rights to everything you post.</p>
      </LegalSection>

      <LegalSection heading="3. What is not allowed">
        <LegalList>
          <li>Illegal content, or content that infringes someone else&rsquo;s rights.</li>
          <li>Harassment, hate speech, threats, or content that sexualises minors.</li>
          <li>Graphic violence, pornography, or content promoting self-harm.</li>
          <li>Spam, scams, impersonation, or manipulating likes, views or followers.</li>
          <li>
            Interfering with the service: scraping, overloading it, bypassing security or rate
            limits, or accessing other people&rsquo;s accounts.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="4. Moderation and enforcement">
        <p>
          We use automated tools and human review to find content that breaks these terms. We
          may hold, remove or restrict content, limit features such as commenting, or suspend or
          ban accounts that violate them. If you think we made a mistake, contact us.
        </p>
      </LegalSection>

      <LegalSection heading="5. Ending your use of Nowa">
        <p>
          You can stop using Nowa at any time and ask us to delete your account as described on
          our{" "}
          <Link href={LEGAL_LINKS.dataDeletion} className="underline">
            Data Deletion
          </Link>{" "}
          page. We may suspend or close accounts that violate these terms.
        </p>
      </LegalSection>

      <LegalSection heading="6. Disclaimers">
        <p>
          Nowa is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We do not
          guarantee that it will always be available or error-free, and we are not responsible
          for content posted by users. To the extent permitted by law, we are not liable for
          indirect or consequential losses arising from your use of Nowa.
        </p>
      </LegalSection>

      <LegalSection heading="7. Privacy">
        <p>
          How we handle your personal data is described in our{" "}
          <Link href={LEGAL_LINKS.privacy} className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes and contact">
        <p>
          We may update these terms; the date at the top shows the latest version, and
          continuing to use Nowa after a change means you accept it. Questions? Email{" "}
          <SupportEmailLink email={SUPPORT_EMAIL} />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
