"use client";

import { BUTTON_PRIMARY, BUTTON_QUIET, NOTICE_CARD } from "@/components/messages/chat-ui";
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

  return (
    <div className="flex-none px-5 pt-2 pb-4 tt-768:px-3">
      <div className={`px-5 pt-4 pb-4 ${NOTICE_CARD}`}>
        <h2 className="text-center text-[16px] leading-5 font-bold text-[var(--tt-text)]">{name} wants to send you a message</h2>
        <p className="mt-2 text-center text-[13px] leading-[19px] text-[var(--chat-meta)]">
          If you accept, you can chat with this user immediately. If you delete, this chat will be removed from
          your Message requests. Note that this user may send only 1 message before you accept.
          {initiatorId && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="font-semibold text-[var(--tt-text)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-white/70"
              >
                Report this user
              </button>{" "}
              if you receive a suspicious message.
            </>
          )}
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            disabled={pending !== null}
            aria-busy={pending === "decline"}
            onClick={() => void run("decline")}
            className={cn("flex-1", BUTTON_QUIET)}
          >
            {pending === "decline" ? "Deleting…" : "Delete"}
          </button>
          <button
            type="button"
            disabled={pending !== null}
            aria-busy={pending === "accept"}
            onClick={() => void run("accept")}
            className={cn("flex-1", BUTTON_PRIMARY)}
          >
            {pending === "accept" ? "Accepting…" : "Accept"}
          </button>
        </div>
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
