import type { Metadata } from "next";

import { MessagesShell } from "@/components/messages/MessagesShell";

export const metadata: Metadata = { title: "Messages | Nowa" };

export default function MessagesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <MessagesShell>{children}</MessagesShell>;
}
