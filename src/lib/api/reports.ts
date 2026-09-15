"use client";

import { apiFetch } from "@/lib/api/client";

/**
 * admin-service. Every route there is ROLE_ADMIN except this one: submitting a
 * report is open to any authenticated user (see admin-service `SecurityConfig`).
 */

export type ReportTargetType = "USER" | "VIDEO" | "COMMENT";

/** `POST /api/v1/admin/reports` — one report against one target. */
export function submitReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: string,
): Promise<unknown> {
  return apiFetch("/admin/reports", {
    method: "POST",
    body: { targetType, targetId, reason },
    auth: "required",
  });
}

/**
 * The scenarios a viewer can pick from, each with the rules that scenario
 * covers — shown back to them before they submit, the way the live site does
 * ("We don't allow the following" + bullets). `reason` is a free-text column
 * server-side, so the label is what gets stored: keep the labels stable, the
 * moderation console groups by them.
 */
export type ReportReason = { label: string; bullets: readonly string[] };

export const VIDEO_REPORT_REASONS = [
  {
    label: "Violence, abuse, and criminal exploitation",
    bullets: [
      "Showing, promoting, or threatening violence against a person, group, or animal",
      "Showing or promoting human exploitation, including trafficking, forced labor, or sexual exploitation",
      "Showing, promoting, or facilitating criminal activity such as theft, fraud, or property damage",
    ],
  },
  {
    label: "Hate and harassment",
    bullets: [
      "Showing, promoting, or threatening to insult someone, including using profanity or obscene language to degrade them",
      "Showing, promoting, or threatening harassment or bullying of others, physical or otherwise, including coordinated harassment",
      "Attacking a person or group based on race, ethnicity, religion, gender, sexual orientation, or disability",
    ],
  },
  {
    label: "Suicide and self-harm",
    bullets: [
      "Showing, promoting, or providing instructions for suicide or self-harm",
      "Showing or promoting hoaxes, games, or challenges that encourage self-harm",
    ],
  },
  {
    label: "Dangerous activities and challenges",
    bullets: [
      "Showing or promoting dangerous stunts, dares, or challenges that could lead someone to imitate them and get hurt",
      "Showing dangerous driving, weapon handling, or amateur use of hazardous tools and substances",
    ],
  },
  {
    label: "Nudity and sexual content",
    bullets: [
      "Showing nudity, sexual acts, or content meant to arouse",
      "Any sexual content involving a minor, which we remove and report to the authorities",
    ],
  },
  {
    label: "Shocking and graphic content",
    bullets: [
      "Showing gore, graphic injury, or human or animal remains",
      "Showing extremely violent or disturbing footage, real or staged",
    ],
  },
  {
    label: "Misinformation",
    bullets: [
      "False or misleading claims that could cause harm, such as fake medical advice or election misinformation",
      "Manipulated media presented as real footage",
    ],
  },
  {
    label: "Deceptive behavior and spam",
    bullets: [
      "Bulk or repetitive posting, fake engagement, or impersonation of another person or business",
      "Phishing links, scams, or anything trying to trick people out of money or account details",
    ],
  },
  {
    label: "Illegal activities and regulated goods",
    bullets: [
      "Selling or promoting drugs, weapons, counterfeit goods, or other regulated products",
      "Showing or promoting gambling or other activity that breaks the law",
    ],
  },
  {
    label: "Intellectual property violation",
    bullets: [
      "The video uses copyrighted work — footage, music, or images — without permission",
      "The video uses someone else's trademark or brand identity without permission",
    ],
  },
] as const;

/**
 * The comment sheet's own scenarios — the live site shows a shorter list here
 * than for a video (no "Intellectual property violation" on its own, no
 * "Shocking and graphic content" until "More"), because a comment is text.
 * Labels copied from the live comment report sheet; they are what gets stored
 * as `reason`, so keep them stable.
 */
export const COMMENT_REPORT_REASONS = [
  {
    label: "Violence, abuse, and criminal exploitation",
    bullets: [
      "Threatening violence against a person, group, or animal",
      "Promoting or facilitating criminal activity, trafficking, or exploitation",
    ],
  },
  {
    label: "Hate and harassment",
    bullets: [
      "Insulting, degrading, or using obscene language against someone",
      "Harassment or bullying, including coordinated pile-ons",
      "Attacking a person or group based on race, ethnicity, religion, gender, sexual orientation, or disability",
    ],
  },
  {
    label: "Suicide and self-harm",
    bullets: [
      "Promoting or giving instructions for suicide or self-harm",
      "Encouraging hoaxes, games, or challenges that lead to self-harm",
    ],
  },
  {
    label: "Misinformation",
    bullets: [
      "False or misleading claims that could cause harm, such as fake medical advice or election misinformation",
      "Passing off manipulated media as real",
    ],
  },
  {
    label: "Frauds and scams",
    bullets: [
      "Phishing links, fake giveaways, or investment and crypto scams",
      "Anything trying to trick people out of money or account details",
    ],
  },
  {
    label: "Deceptive behavior and spam",
    bullets: [
      "Bulk or repetitive posting, fake engagement, or unsolicited promotion",
      "Impersonating another person or business",
    ],
  },
  {
    label: "Nudity and sexual content",
    bullets: [
      "Sexual solicitation or content meant to arouse",
      "Any sexual content involving a minor, which we remove and report to the authorities",
    ],
  },
  {
    label: "Regulated goods and activities",
    bullets: [
      "Selling or promoting drugs, weapons, counterfeit goods, or other regulated products",
      "Promoting gambling or other activity that breaks the law",
    ],
  },
  {
    label: "Sharing personal information",
    bullets: [
      "Posting someone else's address, phone number, or other private details",
      "Threatening to expose private information",
    ],
  },
  {
    label: "Counterfeits and intellectual property",
    bullets: [
      "Selling counterfeit goods or using someone else's trademark or brand identity",
      "Reposting copyrighted work without permission",
    ],
  },
] as const satisfies readonly ReportReason[];
