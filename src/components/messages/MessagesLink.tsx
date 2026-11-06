"use client";

import Link from "next/link";
import { useContext } from "react";

import { PanelNavContext } from "@/components/messages/panel/MessagesPanelProvider";
import { parseMessagesHref } from "@/lib/messages-panel";

/** A link to a message route that stays inside the panel when rendered in one. */
export function MessagesLink({
  href,
  onClick,
  ...rest
}: Omit<React.ComponentProps<typeof Link>, "href"> & { href: string }) {
  const go = useContext(PanelNavContext);
  return (
    <Link
      href={href}
      onClick={(event) => {
        onClick?.(event);
        const target = go ? parseMessagesHref(href) : null;
        if (!target || !go || event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        go(target);
      }}
      {...rest}
    />
  );
}
