import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalList,
  LegalPage,
  LegalSection,
  SupportEmailLink,
} from "@/components/legal/LegalPage";
import {
  LEGAL_LINKS,
  SECURITY_LOG_RETENTION_DAYS,
  SUPPORT_EMAIL,
  VIDEO_TRASH_RETENTION_DAYS,
} from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy | Nowa" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Nowa (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a short-video platform available at
        nowaa.site. This policy explains what personal data we collect when you use Nowa, why
        we collect it, who we share it with, and the choices you have.
      </p>

      <LegalSection heading="1. Data we collect">
        <p>
          <strong className="text-[var(--tt-text)]">Account data.</strong> When you sign up we
          store your email address, username, display name and a hashed password. If you sign
          in with Google or Facebook, we receive your name, email address, profile picture and
          the account identifier that provider assigns to you. We never receive your Google or
          Facebook password.
        </p>
        <p>
          <strong className="text-[var(--tt-text)]">Content you create.</strong> Videos,
          captions, thumbnails, comments, likes, follows, reposts and profile information
          (bio, avatar) that you add to Nowa.
        </p>
        <p>
          <strong className="text-[var(--tt-text)]">Sign-in and security data.</strong> Each
          time you sign in we record the time, your IP address, your browser&rsquo;s user agent
          and, where your browser provides them, your device model and operating system
          version. We use this to show you where your account is signed in and to detect
          suspicious activity.
        </p>
        <p>
          <strong className="text-[var(--tt-text)]">Usage data.</strong> The videos you watch
          and interact with, which we use to recommend content and to compute aggregate
          statistics.
        </p>
        <p>
          <strong className="text-[var(--tt-text)]">Data stored in your browser.</strong> We
          keep your sign-in tokens and display preferences (such as sound and layout settings)
          in your browser&rsquo;s local storage and cookies. We do not use advertising or
          third-party tracking cookies.
        </p>
      </LegalSection>

      <LegalSection heading="2. How we use your data">
        <LegalList>
          <li>To create and operate your account and let you sign in.</li>
          <li>To publish, store and stream the content you upload.</li>
          <li>To personalise your feed and recommendations.</li>
          <li>
            To keep Nowa safe: preventing spam and abuse, moderating content that breaks our{" "}
            <Link href={LEGAL_LINKS.terms} className="underline">
              Terms of Service
            </Link>
            , and protecting accounts from unauthorised access.
          </li>
          <li>To send you account emails such as verification codes and password resets.</li>
        </LegalList>
        <p>We do not sell your personal data and we do not use it for advertising.</p>
      </LegalSection>

      <LegalSection heading="3. Who we share data with">
        <p>
          Content you publish publicly can be seen by anyone. Beyond that, we share data only
          with the service providers that run parts of Nowa for us:
        </p>
        <LegalList>
          <li>
            <strong className="text-[var(--tt-text)]">Google and Meta (Facebook)</strong>, only
            if you choose to sign in with them.
          </li>
          <li>
            <strong className="text-[var(--tt-text)]">Cloudflare</strong>, which delivers our
            website and runs the Turnstile check that protects sign-in from bots.
          </li>
          <li>
            <strong className="text-[var(--tt-text)]">Resend</strong>, which delivers our
            account emails.
          </li>
        </LegalList>
        <p>
          We may also disclose data when required by law or to protect the rights and safety
          of our users.
        </p>
      </LegalSection>

      <LegalSection heading="4. How long we keep data">
        <LegalList>
          <li>Account data and content are kept for as long as your account exists.</li>
          <li>
            Videos you delete are kept for {VIDEO_TRASH_RETENTION_DAYS} days so that moderators
            can review them, then permanently removed.
          </li>
          <li>Sign-in and security records are deleted after {SECURITY_LOG_RETENTION_DAYS} days.</li>
          <li>
            When your account is deleted, we remove your personal data as described on our{" "}
            <Link href={LEGAL_LINKS.dataDeletion} className="underline">
              Data Deletion
            </Link>{" "}
            page.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection heading="5. Your rights">
        <p>
          You can view and edit your profile at any time in the app. You can also ask us to
          give you a copy of your data, correct it, or delete your account and its data. See
          the{" "}
          <Link href={LEGAL_LINKS.dataDeletion} className="underline">
            Data Deletion
          </Link>{" "}
          page for how to request deletion.
        </p>
      </LegalSection>

      <LegalSection heading="6. Security">
        <p>
          All traffic to Nowa is encrypted with HTTPS. Passwords are stored only as salted
          hashes, and sign-in tokens are short-lived. No system is perfectly secure, so please
          use a unique password and tell us if you notice anything suspicious.
        </p>
      </LegalSection>

      <LegalSection heading="7. Children">
        <p>
          Nowa is not intended for children under 13, and we do not knowingly collect data from
          them. If you believe a child under 13 has an account, contact us and we will delete it.
        </p>
      </LegalSection>

      <LegalSection heading="8. Changes and contact">
        <p>
          We may update this policy from time to time; the date at the top shows the latest
          version. For any question about your privacy, email{" "}
          <SupportEmailLink email={SUPPORT_EMAIL} />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
