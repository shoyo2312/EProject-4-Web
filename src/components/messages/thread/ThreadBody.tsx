"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { WarningIcon } from "@/components/icons";
import { ChatAvatar } from "@/components/messages/ChatAvatar";
import { BlockedByOtherNotice } from "@/components/messages/thread/BlockedByOtherNotice";
import { BlockedNotice } from "@/components/messages/thread/BlockedNotice";
import { useChatUnreadContext } from "@/components/messages/ChatUnreadProvider";
import { Composer, type ImageSend, type ImageSendResult } from "@/components/messages/thread/Composer";
import { DeleteMessageDialog } from "@/components/messages/thread/DeleteMessageDialog";
import { MessageList } from "@/components/messages/thread/MessageList";
import { RequestPrompt } from "@/components/messages/thread/RequestPrompt";
import type { ReplyDraft } from "@/components/messages/thread/ReplyBar";
import { ReopenConfirm } from "@/components/messages/thread/ReopenConfirm";
import { RequestSentNotice } from "@/components/messages/thread/RequestSentNotice";
import { TypingRow } from "@/components/messages/thread/TypingRow";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import type { ChatThread } from "@/hooks/use-chat-thread";
import { useTypingSender } from "@/hooks/use-typing-sender";
import {
  getConversation,
  uploadChatImage,
  type ConversationResponse,
  type ImageView,
  type MessageResponse,
  type SendPayload,
  type StickerView,
} from "@/lib/api/conversations";
import {
  canReplyTo,
  chatErrorMessage,
  otherParticipantId,
  isPermissionChange,
  isReplyTargetGone,
  isThreadLocked,
  quoteText,
  retryAvailableAfter,
} from "@/lib/chat";
import { firstImage } from "@/lib/chat-image";
import { isWindowActive, setViewing } from "@/lib/chat-viewing";
import { isApiError } from "@/lib/api/errors";
import { unblock } from "@/lib/api/users";

/**
 * Everything under a conversation's header — history, send errors, and whatever stands where the
 * composer goes — shared by the `/messages` page and the floating panel, so the two behave alike.
 *
 * What stands there is decided by the conversation's `sendPermission`, which the server computes:
 * the composer, the "request sent" notice after the one message a request allows, or Delete /
 * Accept for the person who received it. A refusal that says the permission changed (an accept in
 * another tab, a limit already used) fetches the conversation again instead of trusting the client.
 *
 * While mounted with the newest message in view it registers the conversation as being viewed,
 * which is what lets a live message count as read instead of unread, and what releases the
 * "mark read" a thread was holding back until the viewer reached the bottom.
 */
export function ThreadBody({
  conversation,
  thread,
  me,
  name,
  avatar,
}: {
  conversation: ConversationResponse;
  thread: ChatThread;
  me: string;
  name: string;
  avatar: string | undefined;
}) {
  const conversationId = conversation.id;
  const { applyConversation, blockedUsers, setBlockedUser } = useChatUnreadContext();
  const otherId = otherParticipantId(conversation, me);
  // The server's word for this conversation, the viewer's block list only while it could not tell.
  const blockedByMe = conversation.blockedByViewer ?? blockedUsers.has(otherId);
  const messagingBlocked = blockedByMe || conversation.messagingBlocked === true;
  const [draft, setDraft] = useState({ conversationId, text: "" });
  const [unblocking, setUnblocking] = useState(false);
  const [unblockError, setUnblockError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<unknown>(null);
  const [locked, setLocked] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MessageResponse | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const { markSeen } = thread;
  /** A file dropped on the thread, handed to the composer; a new object per drop. */
  const [dropped, setDropped] = useState<{ file: File } | null>(null);
  const lastSendError = useRef<unknown>(null);

  /**
   * "Seen" is a message the list has drawn and the browser reports in view, while the tab is shown and
   * the window focused — all three. The list reports what is in view; the window's state is tracked
   * here so that coming back to the tab (or the window gaining focus) acknowledges what is on screen
   * without waiting for a new message to arrive.
   */
  const [windowActive, setWindowActive] = useState(false);
  useEffect(() => {
    const update = () => setWindowActive(isWindowActive());
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
    };
  }, []);
  const [visible, setVisible] = useState<{ conversationId: string; id: string | null }>({
    conversationId,
    id: null,
  });
  const visibleNewest = visible.conversationId === conversationId ? visible.id : null;
  useEffect(() => {
    if (windowActive && visibleNewest) markSeen(visibleNewest);
  }, [windowActive, visibleNewest, markSeen]);

  /**
   * The message being answered, as it is now: one that was recalled or deleted meanwhile is no longer
   * there to answer, so the reply simply stops being offered instead of failing at send.
   */
  const replyTarget = useMemo(() => {
    const found = replyId ? thread.messages.find((message) => message.id === replyId) : undefined;
    return found && canReplyTo(found) ? found : null;
  }, [replyId, thread.messages]);
  const reply: ReplyDraft | null = replyTarget && {
    messageId: replyTarget.id,
    author: replyTarget.senderId === me ? "You" : name,
    text: quoteText(replyTarget.content, replyTarget.type),
  };

  useEffect(() => {
    setViewing(conversationId, atBottom);
    return () => setViewing(conversationId, false);
  }, [conversationId, atBottom]);

  /** Typing is announced only where a message could be sent: an open conversation, not blocked, not locked. */
  const typing = useTypingSender(
    conversationId,
    conversation.sendPermission === "ALLOWED" && !messagingBlocked && !locked && thread.status === "ready",
  );

  /** Text and stickers take the same road: the same permission checks, errors and reopen handling. */
  const send = async (payload: SendPayload) => {
    setSendError(null);
    const result = await thread.send(replyTarget ? { ...payload, replyToMessageId: replyTarget.id } : payload);
    if (result.ok) {
      setReplyId(null);
      // Deleted from the viewer's side and brought back by this message: the server's view puts it in the inbox again.
      if (conversation.inboxHidden) getConversation(conversationId).then(applyConversation, () => {});
      const sent = {
        lastMessageContent: result.message.content,
        lastMessageType: result.message.type,
        lastMessageSenderId: me,
        lastMessageAt: result.message.sentAt,
      };
      if (conversation.sendPermission === "FIRST_MESSAGE_ONLY") {
        // The allowance is spent. The server says so too (and pushes it to the other tabs); this
        // just shuts the composer in the same frame instead of after the round trip.
        applyConversation({
          ...conversation,
          ...sent,
          sendPermission: "REQUEST_SENT",
          retryAvailableAt: retryAvailableAfter(result.message.sentAt),
        });
      } else if (conversation.sendPermission === "REOPEN_ON_SEND") {
        // Sending reopened the thread: from here it is an ordinary conversation.
        applyConversation({
          ...conversation,
          ...sent,
          requestState: null,
          sendPermission: "ALLOWED",
          retryAvailableAt: null,
        });
      }
      return true;
    }
    if (isPermissionChange(result.error)) {
      getConversation(conversationId).then(applyConversation, () => {
        // The error below is still true; the next sync corrects the rest.
      });
    }
    setSendError(result.error);
    if (isThreadLocked(result.error)) setLocked(true);
    if (isReplyTargetGone(result.error)) setReplyId(null);
    lastSendError.current = result.error;
    return false;
  };

  /** The composer shows a picture's failure in its own tray, so the thread's alert line is not used for it. */
  const sendImage = async (image: ImageSend): Promise<ImageSendResult> => {
    lastSendError.current = null;
    const ok = await send({
      type: "IMAGE",
      imageId: image.imageId,
      content: image.content,
      clientRequestId: image.clientRequestId,
    });
    if (ok) return { ok: true };
    setSendError(null);
    return { ok: false, error: lastSendError.current };
  };
  const uploadImage = (file: File, signal: AbortSignal) => uploadChatImage(conversationId, file, signal);

  const hasFiles = (event: React.DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

  const unblockNow = async () => {
    if (unblocking) return;
    setUnblocking(true);
    setUnblockError(null);
    try {
      try {
        await unblock(otherId);
      } catch (cause) {
        // Already lifted from another tab: the state the viewer asked for.
        if (!(isApiError(cause) && cause.is("NOT_BLOCKED"))) throw cause;
      }
      setBlockedUser(otherId, false);
      // A send that was refused for the block locked the composer; it is the viewer's to reopen now.
      setLocked(false);
      setSendError(null);
      toast.success(`Unblocked ${name}.`);
    } catch (cause) {
      setUnblockError(chatErrorMessage(cause));
    } finally {
      setUnblocking(false);
    }
  };

  const act = async (request: Promise<{ ok: true } | { ok: false; error: unknown }>) => {
    const result = await request;
    if (!result.ok) setSendError(result.error);
    return result.ok;
  };

  const confirmDelete = async (forEveryone: boolean) => {
    if (!deleting || deleteBusy) return;
    setDeleteBusy(true);
    setSendError(null);
    const ok = await act(forEveryone ? thread.recall(deleting.id) : thread.hide(deleting.id));
    setDeleteBusy(false);
    // A failure leaves the dialog's choice to be made again; the reason is in the alert line.
    if (ok) setDeleting(null);
  };

  return (
    <div
      className="contents"
      onDragOver={(event) => {
        if (hasFiles(event)) event.preventDefault();
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        const file = firstImage(event.dataTransfer.files);
        if (file) setDropped({ file });
      }}
    >
      {thread.status === "loading" ? (
        <ThreadBodySkeleton />
      ) : thread.status === "error" ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="text-[16px] font-semibold text-[var(--tt-text)]">Couldn&apos;t load this conversation</p>
          <button
            type="button"
            onClick={thread.retry}
            className="mt-3 h-9 rounded-full bg-[var(--tt-field)] px-5 text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            Try again
          </button>
        </div>
      ) : thread.messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <ChatAvatar userId={otherId} src={avatar} className="h-20 w-20" />
          <p className="mt-3 text-[16px] font-semibold text-[var(--tt-text)]">{name}</p>
          <p className="mt-1 text-[14px] text-[var(--tt-text-muted)]">Say hello to start the conversation.</p>
        </div>
      ) : (
        <MessageList
          messages={thread.messages}
          me={me}
          hasMore={thread.hasMore}
          loadingOlder={thread.loadingOlder}
          onLoadOlder={thread.loadOlder}
          onAtBottomChange={setAtBottom}
          peerName={name}
          peerAvatar={avatar}
          receipt={thread.receipt ?? null}
          liveIds={thread.liveIds}
          onVisibleNewestChange={(id) => setVisible({ conversationId, id })}
          onReact={(message, emoji) => {
            setSendError(null);
            void act(thread.react(message.id, emoji));
          }}
          onReply={(message) => {
            if (!messagingBlocked) setReplyId(message.id);
          }}
          onDelete={setDeleting}
        />
      )}

      <TypingRow active={thread.peerTyping === true && !messagingBlocked} name={name} avatar={avatar} />

      {sendError !== null && (
        <p
          role="alert"
          className="mx-4 mb-1 flex items-center gap-2 text-[13px] leading-4 text-[var(--tt-red)] tt-768:mx-3"
        >
          <WarningIcon className="h-3.5 w-3.5 flex-none" />
          {chatErrorMessage(sendError)}
        </p>
      )}

      <ThreadFooter
        conversation={conversation}
        name={name}
        locked={locked}
        blockedByMe={blockedByMe}
        messagingBlocked={messagingBlocked}
        draft={draft.conversationId === conversationId ? draft.text : ""}
        onTyping={typing.input}
        onDraftChange={(text) => setDraft({ conversationId, text })}
        unblocking={unblocking}
        unblockError={unblockError}
        onUnblock={() => void unblockNow()}
        ready={thread.status === "ready"}
        reply={reply}
        onCancelReply={() => setReplyId(null)}
        onSend={(content) => send({ type: "TEXT", content })}
        onSendSticker={(sticker) => send({ type: "STICKER", stickerId: sticker.stickerId })}
        photos={{ onUploadImage: uploadImage, onSendImage: sendImage, incomingFile: dropped }}
      />

      {deleting && (
        <DeleteMessageDialog
          canRecall={deleting.senderId === me && deleting.recalledAt === null}
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onHide={() => void confirmDelete(false)}
          onRecall={() => void confirmDelete(true)}
        />
      )}
    </div>
  );
}

interface PhotoProps {
  onUploadImage?: (file: File, signal: AbortSignal) => Promise<ImageView>;
  onSendImage?: (image: ImageSend) => Promise<ImageSendResult>;
  incomingFile?: { file: File } | null;
}

function ThreadFooter({
  conversation,
  name,
  locked,
  blockedByMe,
  messagingBlocked,
  draft,
  onDraftChange,
  onTyping,
  unblocking,
  unblockError,
  onUnblock,
  ready,
  reply,
  onCancelReply,
  onSend,
  onSendSticker,
  photos,
}: {
  conversation: ConversationResponse;
  name: string;
  locked: boolean;
  blockedByMe: boolean;
  messagingBlocked: boolean;
  draft: string;
  onDraftChange: (text: string) => void;
  onTyping: (typing: boolean) => void;
  unblocking: boolean;
  unblockError: string | null;
  onUnblock: () => void;
  ready: boolean;
  reply: ReplyDraft | null;
  onCancelReply: () => void;
  onSend: (content: string) => Promise<boolean>;
  onSendSticker: (sticker: StickerView) => Promise<boolean>;
  photos: PhotoProps;
}) {
  // The viewer's own block comes first: whatever the request state, there is nothing to send into.
  if (blockedByMe) {
    return <BlockedNotice name={name} busy={unblocking} error={unblockError} onUnblock={onUnblock} />;
  }
  if (messagingBlocked) return <BlockedByOtherNotice />;
  switch (conversation.sendPermission) {
    case "REQUEST_SENT":
      return <RequestSentNotice retryAvailableAt={conversation.retryAvailableAt} />;
    case "AWAITING_ACCEPT":
      return (
        <RequestPrompt
          conversationId={conversation.id}
          initiatorId={conversation.initiatorId}
          name={name}
        />
      );
    case "REOPEN_ON_SEND":
      return (
        <ReopenComposer
          conversationKey={conversation.id}
          name={name}
          draft={draft}
          onDraftChange={onDraftChange}
          disabled={locked || !ready}
          reply={reply}
          onCancelReply={onCancelReply}
          onSend={onSend}
          onSendSticker={onSendSticker}
          photos={photos}
        />
      );
    default:
      return (
        <Composer
          key={conversation.id}
          draft={draft}
          onDraftChange={onDraftChange}
          onTyping={onTyping}
          disabled={locked || !ready}
          disabledReason={locked ? "You can't send messages in this conversation" : undefined}
          reply={reply}
          onCancelReply={onCancelReply}
          onSend={onSend}
          onSendSticker={onSendSticker}
          {...photos}
        />
      );
  }
}

/**
 * The composer for a request the viewer deleted: the first send asks "let them message you again?"
 * and only goes through on a yes. The text stays in the box while the question is up, and a No puts
 * everything back as it was.
 */
function ReopenComposer({
  conversationKey,
  name,
  draft,
  onDraftChange,
  disabled,
  reply,
  onCancelReply,
  onSend,
  onSendSticker,
  photos: { onUploadImage, onSendImage, incomingFile },
}: {
  conversationKey: string;
  name: string;
  draft: string;
  onDraftChange: (text: string) => void;
  disabled: boolean;
  reply: ReplyDraft | null;
  onCancelReply: () => void;
  onSend: (content: string) => Promise<boolean>;
  onSendSticker: (sticker: StickerView) => Promise<boolean>;
  photos: PhotoProps;
}) {
  const [asking, setAsking] = useState<{ send: () => Promise<unknown>; settle: (result: unknown) => void; cancelled: unknown } | null>(null);
  const [busy, setBusy] = useState(false);

  /** Holds whatever is being sent — text, a sticker or a photo — until the viewer answers the question. */
  const ask = <T,>(send: () => Promise<T>, cancelled: T) =>
    new Promise<T>((settle) => setAsking({ send, settle: settle as (result: unknown) => void, cancelled }));

  const cancel = () => {
    asking?.settle(asking.cancelled);
    setAsking(null);
  };

  const confirm = async () => {
    if (!asking || busy) return;
    setBusy(true);
    const sent = await asking.send();
    asking.settle(sent);
    setBusy(false);
    setAsking(null);
  };

  return (
    <>
      <Composer
        key={conversationKey}
        draft={draft}
        onDraftChange={onDraftChange}
        disabled={disabled}
        reply={reply}
        onCancelReply={onCancelReply}
        onSend={(content) => ask(() => onSend(content), false)}
        onSendSticker={(sticker) => ask(() => onSendSticker(sticker), false)}
        onUploadImage={onUploadImage}
        onSendImage={
          onSendImage && ((image) => ask(() => onSendImage(image), { ok: false, error: null } as ImageSendResult))
        }
        incomingFile={incomingFile}
      />
      {asking && <ReopenConfirm name={name} busy={busy} onCancel={cancel} onConfirm={() => void confirm()} />}
    </>
  );
}

export function ThreadBodySkeleton() {
  return (
    <div aria-hidden className="flex flex-1 flex-col justify-end gap-2 px-4 py-4">
      <Skeleton className="h-9 w-1/3 rounded-[18px]" />
      <Skeleton className="h-9 w-1/2 self-end rounded-[18px]" />
      <Skeleton className="h-9 w-2/5 rounded-[18px]" />
    </div>
  );
}
