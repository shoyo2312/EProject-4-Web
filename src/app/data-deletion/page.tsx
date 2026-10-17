import type { Metadata } from "next";
import Link from "next/link";

import {
  LegalList,
  LegalPage,
  LegalSection,
  SupportEmailLink,
} from "@/components/legal/LegalPage";
import {
  DELETION_REQUEST_DAYS,
  LEGAL_LINKS,
  SECURITY_LOG_RETENTION_DAYS,
  SUPPORT_EMAIL,
} from "@/lib/legal";

export const metadata: Metadata = { title: "Data Deletion | Nowa" };

/**
 * The page Facebook Login's "User data deletion → Data deletion instructions
 * URL" points at. It must describe how a person deletes the data the app
 * received from Facebook.
 */
export default function DataDeletionPage() {
  return (
    <LegalPage title="Data Deletion Instructions">
      <p>
        You can ask us to delete your Nowa account and all personal data associated with it at
        any time, including the data we received when you signed in with Facebook or Google.
      </p>

      <LegalSection heading="How to request deletion">
        <p>
          Send an email to <SupportEmailLink email={SUPPORT_EMAIL} /> with the subject{" "}
          <strong className="text-[var(--tt-text)]">&ldquo;Delete my account&rdquo;</strong>{" "}
          and include:
        </p>
        <LegalList>
          <li>your Nowa username, and</li>
          <li>
            the email address of your account (or of the Facebook / Google account you signed in
            with).
          </li>
        </LegalList>
        <p>
          Please send the request from that same email address so that we can confirm the
          account is yours. If you cannot, tell us why and we will ask you to verify ownership
          another way.
        </p>
      </LegalSection>

      <LegalSection heading="What happens next">
        <LegalList>
          <li>We reply to confirm we have received your request.</li>
          <li>
            Within {DELETION_REQUEST_DAYS} days we delete your account, profile, videos,
            comments, likes and follows, and the name, email address, profile picture and account
            identifier we received from Facebook or Google.
          </li>
          <li>We email you once the deletion is complete.</li>
        </LegalList>
        <p>
          Sign-in security records are kept for up to {SECURITY_LOG_RETENTION_DAYS} days from
          the time they were made, to protect against fraud, and are then deleted automatically.
          We may keep information we are legally required to retain.
        </p>
      </LegalSection>

      <LegalSection heading="Removing Nowa from your Facebook account">
        <p>
          Deleting your Nowa data does not change your Facebook account. To also stop Nowa from
          receiving any information from Facebook:
        </p>
        <LegalList>
          <li>
            Open Facebook and go to <strong className="text-[var(--tt-text)]">Settings &amp;
            privacy → Settings → Apps and websites</strong>.
          </li>
          <li>
            Find <strong className="text-[var(--tt-text)]">Nowa</strong> and select{" "}
            <strong className="text-[var(--tt-text)]">Remove</strong>.
          </li>
        </LegalList>
        <p>
          For a Google sign-in, you can do the same at{" "}
          <strong className="text-[var(--tt-text)]">myaccount.google.com → Security → Your
          connections to third-party apps &amp; services</strong>.
        </p>
      </LegalSection>

      <LegalSection heading="More information">
        <p>
          Our{" "}
          <Link href={LEGAL_LINKS.privacy} className="underline">
            Privacy Policy
          </Link>{" "}
          explains what data we collect and how we use it.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
