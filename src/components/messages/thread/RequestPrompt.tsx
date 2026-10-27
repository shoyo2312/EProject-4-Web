"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import { ReportDialog } from "@/components/report/ReportDialog";
import { toast } from "@/components/ui/toast";
import { COMMENT_REPORT_REASONS } from "@/lib/api/reports";
import { chatErrorMessage, isPermissionChange } from "@/lib/chat";
import { cn } from "@/lib/utils";

type Pending = "accept" | "decline" | null;

/**
 * The bottom of a request the viewer received: what it means, and Delete / Accept. There is no
 * composer under it — the server refuses a reply before Accept, and this does not offer one.
 *
 * Reading the request is not answering it. Only a press here changes the state, and the two
 * buttons lock together while one call is in flight so a double click cannot send two.
 */
export function RequestPrompt({
  conversationId,
  initiatorId,
  name,
}: {
  conversationId: string;
  initiatorId: string | null;
  name: string;
}) {
  const router = useRouter();
  const { acceptRequest, declineRequest, requests, reload } = useChatUnreadContext();
  const [pending, setPending] = useState<Pending>(null);
  const [reporting, setReporting] = useState(false);

  const run = async (action: Exclude<Pending, null>) => {
    if (pending) return;
    setPending(action);
    try {
      if (action === "accept") {
        await acceptRequest(conversationId);
      } else {
        await declineRequest(conversationId);
        // Next stop: the rest of the box, or the inbox when this was the last one.
        const remaining = requests.filter((request) => request.id !== conversationId).length;
        router.replace(remaining > 0 ? "/messages/requests" : "/messages");
      }
    } catch (error) {
      toast.error(chatErrorMessage(error));
      // Somebody (another tab) answered first: show what the server now says rather than a stale prompt.
      if (isPermissionChange(error)) reload();
    } finally {
      setPending(null);
    }
  };

  const button = "h-12 flex-1 text-[15px] font-semibold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/60";

  return (
    <div className="flex-none border-t border-[var(--tt-divider)] bg-white/[0.04]">
      <div className="px-5 pt-4 pb-3 text-center">
        <h2 className="text-[16px] leading-5 font-bold text-[var(--tt-text)]">{name} wants to send you a message</h2>
        <p className="mt-2 text-[13px] leading-[18px] text-[var(--tt-text-muted)]">
          If you accept, you can chat with this user immediately. If you delete, this chat will be removed from
          your Message requests. Note that this user may send only 1 message before you accept.
          {initiatorId && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="font-bold text-[var(--tt-text)] hover:underline focus-visible:outline-2 focus-visible:outline-white/60"
              >
                Report this user
              </button>{" "}
              if you receive a suspicious message.
            </>
          )}
        </p>
      </div>
      <div className="flex border-t border-[var(--tt-divider)]">
        <button
          type="button"
          disabled={pending !== null}
          aria-busy={pending === "decline"}
          onClick={() => void run("decline")}
          className={cn(button, "border-r border-[var(--tt-divider)] text-[var(--tt-text-muted)] hover:bg-[var(--tt-field)]")}
        >
          {pending === "decline" ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          aria-busy={pending === "accept"}
          onClick={() => void run("accept")}
          className={cn(button, "text-[var(--tt-text)] hover:bg-[var(--tt-field)]")}
        >
          {pending === "accept" ? "Accepting…" : "Accept"}
        </button>
      </div>

      {reporting && initiatorId && (
        <ReportDialog
          targetType="USER"
          targetId={initiatorId}
          reasons={COMMENT_REPORT_REASONS}
          onClose={() => setReporting(false)}
        />
      )}
    </div>
  );
}
