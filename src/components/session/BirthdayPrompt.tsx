"use client";

import { useState } from "react";

import { BirthdayFields } from "@/components/session/auth-modal/BirthdayFields";
import { ModalTitle, PillButton } from "@/components/session/auth-modal/ModalFields";
import { useSession } from "@/components/session/SessionProvider";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { messageFor } from "@/lib/api/errors";
import { updateMyProfile } from "@/lib/api/users";
import { toIsoBirthDate } from "@/lib/forms/birthday";
import { birthdaySchema } from "@/lib/forms/schemas";
import { useForm } from "@/lib/forms/use-form";

/**
 * Asks a signed-in viewer for their birthday once, when their profile has
 * none — an account from Google or Facebook, or one from before sign-up
 * stored it. Closing it keeps it closed for this tab's session; the next
 * sign-in asks again, since the profile still has no birthday.
 */
export function BirthdayPrompt() {
  const { user, reload } = useSession();
  const [dismissed, setDismissed] = useState(false);
  const form = useForm({
    schema: birthdaySchema,
    toastFieldErrors: true,
    initialValues: { birthMonth: "", birthDay: "", birthYear: "" },
    onSubmit: async (values) => {
      try {
        await updateMyProfile({ birthDate: toIsoBirthDate(values.birthMonth, values.birthDay, values.birthYear) });
        await reload();
      } catch (cause) {
        toast.error(messageFor(cause));
      }
    },
  });

  if (!user || !user.profileReady || user.birthDate !== null || dismissed) return null;

  const complete = form.values.birthMonth && form.values.birthDay && form.values.birthYear;

  return (
    <Modal onClose={() => setDismissed(true)} className="w-[400px] rounded-[12px] p-8">
      <ModalTitle className="mb-6">When&rsquo;s your birthday?</ModalTitle>
      <form onSubmit={form.handleSubmit} noValidate className="flex flex-col gap-2">
        <BirthdayFields form={form} />
        <PillButton disabled={!complete || form.submitting} className="mt-2">
          {form.submitting ? "Saving…" : "Continue"}
        </PillButton>
      </form>
    </Modal>
  );
}
