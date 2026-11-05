import { ChatThread } from "@/components/messages/ChatThread";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <ChatThread conversationId={conversationId} />;
}
