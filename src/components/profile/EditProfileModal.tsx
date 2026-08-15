"use client";

import { useEffect, useRef } from "react";

import { CloseIcon, EditPencilIcon } from "@/components/icons";
import { editProfileSchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";
import { cn } from "@/lib/utils";
import type { UserProfile } from "@/types/tiktok";

/**
 * `.DivModalContainer` (`e1lwtbhx0`) — the Edit profile modal, opened by
 * `[data-e2e="edit-profile-entrance"]` on the owner's own profile.
 *
 * Measured live on an owner profile at 1920px (see the "Edit profile modal"
 * section of `docs/research/tiktok.com/PROFILE.md`). The browser was at 80%
 * zoom, so the CSS values below come from `getComputedStyle`, not from the
 * rects — the two differ by exactly that factor.
 *
 *   card     700 × 700, radius 8, #121212, shadow 0 2px 12px rgba(0,0,0,.12)
 *   header   padding 24/24/12, border-bottom 1px rgba(255,255,255,.2),
 *            title 24/36/600, 24px close glyph 12px in from the padding
 *   rows     flex, padding-block 16, hairline .5px rgba(255,255,255,.5)
 *            between them and none under the last
 *   label    120 wide, margin-right 24, 16/24/600
 *   field    360 wide; input 38 tall radius 4 on rgba(255,255,255,.12),
 *            16/24 text, caret #FE2C55; textarea 100 tall, padding 12
 *   tips     12/18, rgba(255,255,255,.75), 8 under the field
 *   footer   absolute, 86 tall, padding-inline 24, buttons 96 × 36 radius 4,
 *            14/24/600, 16 apart
 *
 * Two live behaviours the layout does not show: **Save stays disabled until
 * something changes** (and then turns #FF3B5C), and **clicking the mask does
 * not close the modal** — only Cancel and the ✕ do, so a half-finished edit
 * cannot be lost by a stray click. Both are reproduced here.
 */
export function EditProfileModal({
  profile,
  onClose,
  onSave,
  saving,
  error: saveError,
  usernameLocked,
  avatarAsUrl,
}: {
  profile: UserProfile;
  onClose: () => void;
  onSave: (draft: ProfileDraft) => void;
  /** True while the PATCH is in flight — the footer buttons lock. */
  saving?: boolean;
  /** A failed save, shown above the footer. */
  error?: string | null;
  /**
   * Handles are issued by auth-service at registration and there is no rename
   * endpoint, so a backend profile shows its handle read-only rather than
   * offering an edit that cannot be saved.
   */
  usernameLocked?: boolean;
  /**
   * The live site uploads a cropped file. There is no upload service here, and
   * user-service only accepts https URLs on an allow-listed CDN host, so
   * backend profiles type the URL instead of picking a file that has nowhere
   * to go.
   */
  avatarAsUrl?: boolean;
}) {
  /**
   * The same hook the auth forms use, so the rules and the focus behaviour are
   * one implementation. The modal differs in one way only: Save is not a form
   * submit button, so `handleSubmit` is called from its `onClick`.
   */
  const form = useForm({
    schema: editProfileSchema,
    initialValues: {
      username: profile.author.username,
      nickname: profile.author.nickname,
      bio: profile.bio,
      avatarUrl: profile.author.avatarUrl,
    },
    onSubmit: (values) => onSave({ ...values, bio: values.bio.trim() }),
  });

  const draft = form.values;
  const setDraft = (patch: Partial<ProfileDraft>) => {
    for (const [key, value] of Object.entries(patch)) form.setValue(key, value);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  /**
   * Object URLs for avatars picked in this session. They are revoked on
   * unmount rather than on each pick, because the preview above is still
   * showing the previous one until the new file loads.
   */
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const dirty =
    draft.username !== profile.author.username ||
    draft.nickname !== profile.author.nickname ||
    draft.bio !== profile.bio ||
    draft.avatarUrl !== profile.author.avatarUrl;

  const pickAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // The live site opens a crop modal here; without a backend to upload to,
    // the picked file is previewed straight from an object URL instead.
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    setDraft({ avatarUrl: url });
    event.target.value = "";
  };

  // Read off `errors` rather than off a bound field object: a variable holding
  // a `ref` is treated as a ref by the compiler lint, and this modal needs the
  // message twice — once in the field, once in place of the tip under it.
  const errors = form.errors;

  return (
    <div className="fixed inset-0 z-[3001] flex items-center justify-center">
      {/* Not a button, unlike the login modal's mask: the live Edit profile
          mask swallows the click rather than closing. */}
      <div aria-hidden className="absolute inset-0 bg-black/[0.68]" />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="relative flex h-[700px] max-h-full w-[700px] max-w-full flex-col overflow-hidden rounded-[8px] bg-[#121212] shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
      >
        <div className="flex flex-none items-center justify-between border-b border-white/20 px-6 pt-6 pb-3">
          <h2
            id="edit-profile-title"
            className="text-[24px] leading-9 font-semibold text-[var(--tt-text)]"
          >
            Edit profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mr-3 flex h-6 w-6 items-center justify-center text-[var(--tt-text)]"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        {/* No bottom padding, deliberately: on the live site the footer floats
            over the last row's 16px of padding, which is exactly why the four
            rows fit a 700px card without scrolling. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-2">
          <Row label="Profile photo">
            {avatarAsUrl ? (
              <>
                <Field {...form.field("avatarUrl")} placeholder="https://…" />
                {errors.avatarUrl ? (
                  <Tip error>{errors.avatarUrl}</Tip>
                ) : (
                  <Tip>
                    Must be an https URL on an allowed CDN host — the server
                    rejects anything else.
                  </Tip>
                )}
              </>
            ) : (
              <div className="relative h-24 w-[224px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- may be an object: URL from the file picker */}
                <img
                  src={draft.avatarUrl}
                  alt=""
                  className="ml-32 h-24 w-24 rounded-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="Change profile photo"
                  className="absolute top-16 left-48 flex h-8 w-8 items-center justify-center rounded-full border border-[#d0d0d3] bg-[#2e2e2e] text-[var(--tt-text)]"
                >
                  <EditPencilIcon className="h-4 w-4" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={pickAvatar}
                  className="sr-only"
                />
              </div>
            )}
          </Row>

          <Row label="Username">
            {usernameLocked ? (
              <>
                <p className="flex h-[38px] w-[360px] max-w-full items-center rounded-[4px] bg-white/[0.06] px-3 text-[16px] leading-6 text-[var(--tt-text-secondary)]">
                  {draft.username}
                </p>
                <Tip>Your username was set when you registered and can’t be changed.</Tip>
              </>
            ) : (
              <>
                <Field {...form.field("username")} placeholder="Username" />
                <p className="mt-4 text-[12px] leading-[18px] text-[var(--tt-text-secondary)]">
                  www.tiktok.com/@{draft.username}
                </p>
                {errors.username ? (
                  <Tip error>{errors.username}</Tip>
                ) : (
                  <Tip>
                    Usernames can only contain letters, numbers, underscores, and
                    periods. Changing your username will also change your profile
                    link.
                  </Tip>
                )}
              </>
            )}
          </Row>

          <Row label="Name">
            <Field {...form.field("nickname")} placeholder="Name" />
            {errors.nickname ? (
              <Tip error>{errors.nickname}</Tip>
            ) : (
              <Tip>Your nickname can only be changed once every 7 days.</Tip>
            )}
          </Row>

          <Row label="Bio" last>
            <textarea
              value={draft.bio}
              placeholder="Bio"
              maxLength={BIO_LIMIT}
              onChange={(event) => form.setValue("bio", event.target.value)}
              className="block h-25 w-[360px] max-w-full resize-none rounded-[4px] bg-white/[0.12] p-3 text-[16px] leading-6 text-[var(--tt-text)] caret-[var(--tt-red)] outline-none placeholder:text-[var(--tt-text-muted)] focus:bg-white/[0.08] focus:outline-[1.5px] focus:outline-[rgb(22_24_35/0.2)]"
            />
            <p className="mt-1.5 text-[12px] leading-[18px] text-[var(--tt-text-secondary)]">
              {draft.bio.length}/{BIO_LIMIT}
            </p>
          </Row>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex h-[86px] items-center justify-end px-6">
          {saveError && (
            <p role="alert" className="mr-auto text-[13px] leading-5 text-[var(--tt-red-active)]">
              {saveError}
            </p>
          )}
          <FooterButton onClick={onClose}>Cancel</FooterButton>
          {/* Still disabled until something changes — that is the live site's
              behaviour — but no longer disabled by invalid input: pressing Save
              is what asks for the messages. */}
          <FooterButton
            primary
            disabled={!dirty || saving}
            onClick={() => form.handleSubmit()}
          >
            {saving ? "Saving…" : "Save"}
          </FooterButton>
        </div>
      </div>
    </div>
  );
}

export interface ProfileDraft {
  username: string;
  nickname: string;
  bio: string;
  avatarUrl: string;
}

const BIO_LIMIT = 80;

/** `.StyledItemContainerWithLine` — label column beside a 360px field column. */
function Row({
  label,
  last,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex py-4",
        !last && "border-b-[0.5px] border-white/50",
      )}
    >
      <div className="mr-6 w-30 flex-none text-[16px] leading-6 font-semibold text-[var(--tt-text)]">
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** `.InputText` — 38px tall, and it grows a 1.5px outline on focus. */
function Field({
  value,
  placeholder,
  onChange,
  error,
  ref,
}: {
  value: string;
  placeholder: string;
  onChange: (next: string) => void;
  error?: string;
  ref?: React.Ref<HTMLInputElement>;
}) {
  return (
    <input
      ref={ref}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      aria-invalid={error ? true : undefined}
      className={cn(
        "h-[38px] w-[360px] max-w-full rounded-[4px] border border-transparent bg-white/[0.12] px-3 py-[7px] text-[16px] leading-6 text-[var(--tt-text)] caret-[var(--tt-red)] outline-none placeholder:text-[var(--tt-text-muted)] focus:bg-white/[0.08] focus:outline-[1.5px] focus:outline-[rgb(22_24_35/0.2)]",
        error && "border-[var(--tt-red-active)]",
      )}
    />
  );
}

/** `.StyledTip` — the small print under a field. */
function Tip({
  error,
  children,
}: {
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "mt-2 w-[360px] max-w-full text-[12px] leading-[18px]",
        error ? "text-[var(--tt-red-active)]" : "text-[var(--tt-text-secondary)]",
      )}
    >
      {children}
    </p>
  );
}

/** `.StyledBtn` — 96 × 36, 16px apart, Save red only once it is usable. */
function FooterButton({
  primary,
  disabled,
  onClick,
  children,
}: {
  primary?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "ml-4 h-9 w-24 rounded-[4px] text-[14px] leading-6 font-semibold transition-colors",
        primary && !disabled
          ? "bg-[var(--tt-red-active)] text-white hover:bg-[var(--tt-red-hover)]"
          : "bg-white/[0.08] text-[var(--tt-text)]",
        disabled && "cursor-not-allowed text-white/[0.34]",
      )}
    >
      {children}
    </button>
  );
}
