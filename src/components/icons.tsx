import type { SVGProps } from "react";

/**
 * SVG icons extracted verbatim from www.tiktok.com.
 * Every path below is the real `d` attribute from the live site — all use a
 * 48×48 viewBox and are rendered by TikTok at a 19px glyph size inside a
 * 32×32 `.TUXButton-iconContainer`.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ForYouIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M24.95 7.84a1.5 1.5 0 0 0-1.9 0l-16.1 13.2a1.5 1.5 0 0 0 .95 2.66h2.33l1.2 13.03A2.5 2.5 0 0 0 13.9 39h7.59a1 1 0 0 0 1-1v-9.68a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V38a1 1 0 0 0 1 1h7.59a2.5 2.5 0 0 0 2.49-2.27l1.19-13.03h2.33a1.5 1.5 0 0 0 .95-2.66l-16.1-13.2Z" />
    </Icon>
  );
}

export function ExploreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M24 37.4a13.4 13.4 0 1 0 0-26.8 13.4 13.4 0 0 0 0 26.8ZM40.5 24a16.5 16.5 0 1 1-33 0 16.5 16.5 0 0 1 33 0Z" />
      <path d="M27.13 27.18 19 32.1a.6.6 0 0 1-.9-.63l1.84-9.33a2 2 0 0 1 .92-1.32L29 15.9a.6.6 0 0 1 .9.63l-1.84 9.33a2 2 0 0 1-.93 1.32Zm-5.04-.45 3.11-1.89.7-3.57-3.1 1.89-.7 3.57Z" />
    </Icon>
  );
}

export function FollowingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18.99 3a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 4a6 6 0 1 0 0 12.00A6 6 0 0 0 19 7ZM18.99 26c2.96 0 5.6.58 7.87 1.65l-3.07 3.06a15.38 15.38 0 0 0-4.8-.71C10.9 30 6.3 35.16 6 43c-.02.55-.46 1-1.02 1h-2c-.55 0-1-.45-.98-1C2.33 32.99 8.7 26 19 26ZM35.7 41.88 31.82 38H45a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H31.82l3.88-3.88a1 1 0 0 0 0-1.41l-1.41-1.42a1 1 0 0 0-1.42 0l-7.3 7.3a2 2 0 0 0 0 2.82l7.3 7.3a1 1 0 0 0 1.42 0l1.41-1.42a1 1 0 0 0 0-1.41Z" />
    </Icon>
  );
}

export function FriendsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 12.5c-2.41 0-4.41 2-4.41 4.53 0 2.54 2 4.54 4.41 4.54s4.42-2 4.42-4.54c0-2.53-2.01-4.53-4.42-4.53Zm-7.41 4.53c0-4.13 3.29-7.53 7.41-7.53s7.42 3.4 7.42 7.53c0 4.14-3.3 7.54-7.42 7.54a7.48 7.48 0 0 1-7.41-7.54ZM18 29.88a8.68 8.68 0 0 0-8.3 6.39c-.15.53-.66.9-1.2.81l-1-.16a.94.94 0 0 1-.78-1.14c1.29-5.1 5.83-8.9 11.28-8.9 5.45 0 10 3.8 11.28 8.9a.94.94 0 0 1-.79 1.14l-.98.16c-.55.1-1.06-.28-1.2-.81a8.68 8.68 0 0 0-8.31-6.4ZM33 31.54c-.76 0-1.48.13-2.16.37-.52.19-1.12.01-1.38-.47l-.48-.88c-.27-.48-.09-1.1.42-1.3a9.38 9.38 0 0 1 3.6-.72c4.46 0 8.16 3.09 9.27 7.24.14.53-.23 1.05-.78 1.14l-.98.16c-.55.09-1.06-.28-1.22-.81A6.65 6.65 0 0 0 33 31.54ZM33 18.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM27.5 21a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z" />
    </Icon>
  );
}

export function LiveIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16.78 26.82c-.08.18-.08.41-.08.88v3.9c0 .47 0 .7.08.88.1.25.3.44.54.54.18.08.41.08.88.08.47 0 .7 0 .88-.08a1 1 0 0 0 .54-.54c.08-.18.08-.41.08-.88v-3.9c0-.47 0-.7-.08-.88a1 1 0 0 0-.54-.54c-.18-.08-.41-.08-.88-.08-.47 0-.7 0-.88.08a1 1 0 0 0-.54.54ZM22.5 21.4c0-.47 0-.7.08-.88a1 1 0 0 1 .54-.54c.18-.08.41-.08.88-.08.47 0 .7 0 .88.08.25.1.44.3.54.54.08.18.08.41.08.88v10.2c0 .47 0 .7-.08.88a1 1 0 0 1-.54.54c-.18.08-.41.08-.88.08-.47 0-.7 0-.88-.08a1 1 0 0 1-.54-.54c-.08-.18-.08-.41-.08-.88V21.4ZM28.38 24.32c-.08.18-.08.41-.08.88v6.4c0 .47 0 .7.08.88.1.25.3.44.54.54.18.08.41.08.88.08.47 0 .7 0 .88-.08a1 1 0 0 0 .54-.54c.08-.18.08-.41.08-.88v-6.4c0-.47 0-.7-.08-.88a1 1 0 0 0-.54-.54c-.18-.08-.41-.08-.88-.08-.47 0-.7 0-.88.08a1 1 0 0 0-.54.54Z" />
      <path d="M16.57 7.49a1 1 0 0 0-.13 1.4l3.62 4.31H15.7c-2.8 0-4.2 0-5.27.55a5 5 0 0 0-2.18 2.18C7.7 17 7.7 18.4 7.7 21.2v10.7c0 2.8 0 4.2.55 5.27a5 5 0 0 0 2.18 2.19c1.07.54 2.47.54 5.27.54h16.6c2.8 0 4.2 0 5.27-.54a5 5 0 0 0 2.19-2.19c.54-1.07.54-2.47.54-5.27V21.2c0-2.8 0-4.2-.54-5.27a5 5 0 0 0-2.19-2.18c-1.07-.55-2.47-.55-5.27-.55h-4.42l3.61-4.3a1 1 0 0 0-.12-1.41l-.77-.65a1 1 0 0 0-1.4.13l-5.23 6.22-5.23-6.22a1 1 0 0 0-1.4-.13l-.77.65Zm-.87 8.71h16.6c1.45 0 2.36 0 3.04.06.65.05.83.14.87.16.37.19.68.5.87.87.02.04.1.22.16.87.06.68.06 1.6.06 3.04v10.7c0 1.45 0 2.36-.06 3.04-.05.65-.14.83-.16.87a2 2 0 0 1-.87.87c-.04.02-.22.1-.87.16-.68.06-1.59.06-3.04.06H15.7c-1.45 0-2.36 0-3.04-.06a2.47 2.47 0 0 1-.87-.16 2 2 0 0 1-.87-.87c-.02-.04-.1-.22-.16-.87-.06-.68-.06-1.59-.06-3.04V21.2c0-1.45 0-2.36.06-3.04.05-.65.14-.83.16-.87a2 2 0 0 1 .87-.87c.04-.02.22-.1.87-.16a42.2 42.2 0 0 1 3.04-.06Z" />
    </Icon>
  );
}

export function MessagesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2.18 9.67A2 2 0 0 1 4 8.5h40a2 2 0 0 1 1.74 3l-20 35a2 2 0 0 1-3.65-.4l-5.87-18.6L2.49 11.82a2 2 0 0 1-.31-2.15Zm18.2 17.72 4.15 13.15L40.55 12.5H8.41l9.98 11.41 11.71-7.2a1 1 0 0 1 1.38.32l1.04 1.7a1 1 0 0 1-.32 1.38L20.38 27.4Z" />
    </Icon>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 11.5A2.5 2.5 0 0 1 11.5 9h25a2.5 2.5 0 0 1 2.5 2.5l.06 21a2.5 2.5 0 0 1-2.5 2.5H29.2l-3.27 4a2.5 2.5 0 0 1-3.87 0l-3.28-4h-7.35a2.5 2.5 0 0 1-2.5-2.5l.06-21Zm3 .5-.06 20h8.27L24 36.63 27.79 32h8.27L36 12H12Z" />
      <path d="M18 22a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H19a1 1 0 0 1-1-1v-1Z" />
    </Icon>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M25 15a1 1 0 0 1 1 1v6h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-6v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-6h-6a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1h6v-6a1 1 0 0 1 1-1h2Z" />
      <path d="M33.58 4.5H14.42c-1.33 0-2.45 0-3.37.07-.95.08-1.86.25-2.73.7a7 7 0 0 0-3.06 3.05 7.14 7.14 0 0 0-.69 2.73 44.6 44.6 0 0 0-.07 3.37v19.16c0 1.33 0 2.45.07 3.37.08.95.25 1.86.7 2.73a7 7 0 0 0 3.05 3.06c.87.44 1.78.6 2.73.69.92.07 2.04.07 3.37.07h19.16c1.33 0 2.45 0 3.37-.07a7.14 7.14 0 0 0 2.73-.7 7 7 0 0 0 3.06-3.05c.44-.87.6-1.78.69-2.73.07-.92.07-2.04.07-3.37V14.42c0-1.33 0-2.45-.07-3.37a7.14 7.14 0 0 0-.7-2.73 7 7 0 0 0-3.05-3.06 7.14 7.14 0 0 0-2.73-.69 44.6 44.6 0 0 0-3.37-.07ZM10.14 8.83c.2-.1.53-.21 1.24-.27.73-.06 1.69-.06 3.12-.06h19c1.43 0 2.39 0 3.12.06a3.3 3.3 0 0 1 1.24.27 3 3 0 0 1 1.31 1.3c.1.21.21.54.27 1.25.06.73.06 1.69.06 3.12v19c0 1.43 0 2.39-.06 3.12a3.3 3.3 0 0 1-.27 1.24 3 3 0 0 1-1.3 1.31c-.21.1-.54.21-1.25.27-.73.06-1.69.06-3.12.06h-19c-1.43 0-2.39 0-3.12-.06a3.3 3.3 0 0 1-1.24-.27 3 3 0 0 1-1.31-1.3c-.1-.21-.21-.54-.27-1.25-.06-.73-.06-1.69-.06-3.12v-19c0-1.43 0-2.39.06-3.12a3.3 3.3 0 0 1 .27-1.24 3 3 0 0 1 1.3-1.31Z" />
    </Icon>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 24a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm15 0a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm15 0a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" />
    </Icon>
  );
}

/* --- Search ------------------------------------------------------------- */

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M21.83 7.5a14.34 14.34 0 1 1 0 28.68 14.34 14.34 0 0 1 0-28.68Zm0-4a18.33 18.33 0 1 0 11.48 32.64l8.9 8.9a1 1 0 0 0 1.42 0l1.4-1.41a1 1 0 0 0 0-1.42l-8.89-8.9A18.34 18.34 0 0 0 21.83 3.5Z" />
    </Icon>
  );
}

/* --- Action rail (right side of each video) ----------------------------- */

/** The "+" badge overlapping the author avatar. */
export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M22 4a1 1 0 0 0-1 1v16H5a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h16v16a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V27h16a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H27V5a1 1 0 0 0-1-1h-4Z" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M40.6 12.4a1 1 0 0 1 0 1.42L19.9 34.5a1 1 0 0 1-1.42 0L7.4 23.44a1 1 0 0 1 0-1.42l2.83-2.83a1 1 0 0 1 1.42 0l7.54 7.54L36.35 9.57a1 1 0 0 1 1.42 0l2.83 2.83Z" />
    </Icon>
  );
}

export function HeartIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M24 9.44c3.2-4.03 7.61-5.56 12-4.67 2.31.47 5.59 2.28 7.75 5.48 2.26 3.32 3.21 7.99.98 13.85-1.75 4.57-5.5 8.83-9.28 12.2a56.6 56.6 0 0 1-10.52 7.47l-.93.49-.93-.49a56.6 56.6 0 0 1-10.52-7.47c-3.78-3.37-7.53-7.63-9.28-12.2-2.24-5.86-1.28-10.53.98-13.85C6.4 7.05 9.69 5.24 12 4.77c4.39-.9 8.8.64 12 4.67Z" />
    </Icon>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 21.5c0-10.22 9.88-18 22-18s22 7.78 22 18c0 5.63-3.19 10.74-7.32 14.8a43.55 43.55 0 0 1-14.14 9.1A1.5 1.5 0 0 1 22.5 44v-5.04C11.13 38.4 2 31.34 2 21.5ZM14 25a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm13-3a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </Icon>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M13 4a5 5 0 0 0-5 5v32.8a2 2 0 0 0 3.26 1.55l12.1-9.84a1 1 0 0 1 1.27 0l12.1 9.84A2 2 0 0 0 40 41.8V9a5 5 0 0 0-5-5H13Z" />
    </Icon>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M23.82 3.5A2 2 0 0 0 20.5 5v10.06C8.7 15.96 1 25.32 1 37a2 2 0 0 0 3.41 1.41c4.14-4.13 10.4-5.6 16.09-5.88v9.97a2 2 0 0 0 3.3 1.52l21.5-18.5a2 2 0 0 0 .02-3.02z" />
    </Icon>
  );
}

/*
 * ---------------------------------------------------------------------------
 * Comment-panel glyphs.
 *
 * Unlike everything above, these four `d` attributes were NOT extracted — the
 * panel's icons are rendered from a cross-origin TUX sprite whose source could
 * not be read. They are reconstructions drawn to the same 48×48 grid and
 * optical weight. Replace them if the real paths become readable.
 * ---------------------------------------------------------------------------
 */

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.7 7.6a1.5 1.5 0 0 0-2.1 2.1L21.9 24 7.6 38.3a1.5 1.5 0 1 0 2.1 2.1L24 26.1l14.3 14.3a1.5 1.5 0 0 0 2.1-2.1L26.1 24 40.4 9.7a1.5 1.5 0 0 0-2.1-2.1L24 21.9 9.7 7.6Z" />
    </Icon>
  );
}

export function EmojiIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M24 4a20 20 0 1 0 0 40 20 20 0 0 0 0-40Zm0 3a17 17 0 1 1 0 34 17 17 0 0 1 0-34Zm-6.5 10a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm13 0a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM15.6 28a1.5 1.5 0 0 0-1.2 2.4A12 12 0 0 0 24 35a12 12 0 0 0 9.6-4.6 1.5 1.5 0 1 0-2.4-1.8A9 9 0 0 1 24 32a9 9 0 0 1-7.2-3.4 1.5 1.5 0 0 0-1.2-.6Z" />
    </Icon>
  );
}

export function AtIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M24 4a20 20 0 1 0 8.8 37.9 1.5 1.5 0 0 0-1.3-2.7A17 17 0 1 1 41 24v2a3 3 0 0 1-6 0V15.5a1.5 1.5 0 0 0-3 0v1a9.5 9.5 0 1 0 .8 13.2A6 6 0 0 0 44 26v-2A20 20 0 0 0 24 4Zm0 13.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Z" />
    </Icon>
  );
}

/** The play glyph next to the view count on each Explore tile. */
export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M16 8.5a1.5 1.5 0 0 1 2.28-1.28l22 15.5a1.5 1.5 0 0 1 0 2.56l-22 15.5A1.5 1.5 0 0 1 16 39.5v-31Z" />
    </Icon>
  );
}

/** Speaker with sound waves — the unmuted state of every volume toggle. */
export function VolumeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M26 6.5a1.5 1.5 0 0 0-2.4-1.2L13.5 13H7a3 3 0 0 0-3 3v16a3 3 0 0 0 3 3h6.5l10.1 7.7A1.5 1.5 0 0 0 26 41.5v-35ZM32.5 16.2a1 1 0 0 1 1.4-.2 11 11 0 0 1 0 16 1 1 0 0 1-1.4-.2l-1.2-1.6a1 1 0 0 1 .2-1.4 7 7 0 0 0 0-9.6 1 1 0 0 1-.2-1.4l1.2-1.6Z" />
    </Icon>
  );
}

/** Speaker with a cross — the muted state of every volume toggle. */
export function MutedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M26 6.5a1.5 1.5 0 0 0-2.4-1.2L13.5 13H7a3 3 0 0 0-3 3v16a3 3 0 0 0 3 3h6.5l10.1 7.7A1.5 1.5 0 0 0 26 41.5v-35ZM33.4 18.6a1 1 0 0 1 1.4 0l3.2 3.2 3.2-3.2a1 1 0 0 1 1.4 0l1.4 1.4a1 1 0 0 1 0 1.4L40.8 24.6l3.2 3.2a1 1 0 0 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4 0L38 27.4l-3.2 3.2a1 1 0 0 1-1.4 0L32 29.2a1 1 0 0 1 0-1.4l3.2-3.2L32 21.4a1 1 0 0 1 0-1.4l1.4-1.4Z" />
    </Icon>
  );
}

export function ArrowPostIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M25.06 6.94a1.5 1.5 0 0 0-2.12 0L10.4 19.48a1.5 1.5 0 0 0 2.12 2.12l9.98-9.98V40a1.5 1.5 0 0 0 3 0V11.62l9.98 9.98a1.5 1.5 0 0 0 2.12-2.12L25.06 6.94Z" />
    </Icon>
  );
}

/*
 * The `/video/[id]` overflow menu's row icons.
 *
 * Unlike everything above, these paths are NOT extracted from the live site —
 * they are drawn from a screenshot of the menu rather than a DOM capture, so
 * the real `d` attributes were never available. They match that reference's
 * outline style (24 viewBox, 1.6px stroke, round caps) at the sizes the menu
 * renders them.
 */

function StrokeIcon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SpeedIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 12l4-4" />
    </StrokeIcon>
  );
}

export function AutoScrollIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M9.4 4.2v11.5l2.7-2.6 1.9 4.3 2.1-.9-1.9-4.2h3.7z" />
      <path d="M5.6 6.2 4.2 4.8M5.2 11l-1.9.3" />
    </StrokeIcon>
  );
}

export function FloatingPlayerIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <rect x="3.4" y="4.8" width="17.2" height="14.4" rx="2.6" />
      <rect x="12" y="11.4" width="6.6" height="5.4" rx="1.4" />
    </StrokeIcon>
  );
}

/** The reference draws this one as literal "Aa" rather than as a glyph. */
export function CaptionsIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <text
        x="12"
        y="17"
        textAnchor="middle"
        fontFamily="inherit"
        fontSize="14"
        fontWeight="500"
      >
        Aa
      </text>
    </svg>
  );
}

/** "HD" in a rounded outline, as the feed menu's Quality row draws it. */
export function QualityIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        x="2.8"
        y="6"
        width="18.4"
        height="12"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <text
        x="12"
        y="15.4"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="inherit"
        fontSize="8"
        fontWeight="700"
      >
        HD
      </text>
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M12 3.8v10.4" />
      <path d="m7.8 10.2 4.2 4.2 4.2-4.2" />
      <path d="M4.6 18.2h14.8" />
    </StrokeIcon>
  );
}

/** The chain link on the menu's "Copy link" row. */
export function LinkIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M10.2 13.8a3.8 3.8 0 0 0 5.4 0l3-3a3.8 3.8 0 0 0-5.4-5.4l-1.5 1.5" />
      <path d="M13.8 10.2a3.8 3.8 0 0 0-5.4 0l-3 3a3.8 3.8 0 0 0 5.4 5.4l1.5-1.5" />
    </StrokeIcon>
  );
}

export function NotInterestedIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M12 20s-7.8-4.8-7.8-10.3A4.8 4.8 0 0 1 9 4.8c1.6 0 2.5.8 3 1.7.5-.9 1.4-1.7 3-1.7a4.8 4.8 0 0 1 4.8 4.9C19.8 15.2 12 20 12 20Z" />
      <path d="m4.6 3.6 15 15" />
    </StrokeIcon>
  );
}

export function ReportIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M6 3.6v16.8" />
      <path d="M6 4.6h11.4l-2.6 4 2.6 4H6z" />
    </StrokeIcon>
  );
}

/**
 * `[data-e2e="follow-bluev"]` — the verified tick. Two-tone rather than
 * `currentColor`: the live badge is a fixed `#20D5EC` disc with a white check,
 * and it never inherits the surrounding text colour.
 */
export function VerifiedBadgeIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="24" cy="24" r="24" fill="#20D5EC" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M37.1213 15.8787C38.2929 17.0503 38.2929 18.9497 37.1213 20.1213L23.6213 33.6213C22.4497 34.7929 20.5503 34.7929 19.3787 33.6213L10.8787 25.1213C9.70711 23.9497 9.70711 22.0503 10.8787 20.8787C12.0503 19.7071 13.9497 19.7071 15.1213 20.8787L21.5 27.2574L32.8787 15.8787C34.0503 14.7071 35.9497 14.7071 37.1213 15.8787Z"
        fill="white"
      />
    </svg>
  );
}

/** Login modal, "Use QR code" — a plain QR mark, drawn to match the 20px slot. */
export function QrCodeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6h14v14H6V6Zm4 4v6h6v-6h-6ZM28 6h14v14H28V6Zm4 4v6h6v-6h-6ZM6 28h14v14H6V28Zm4 4v6h6v-6h-6ZM28 28h6v6h-6v-6ZM36 28h6v6h-6v-6ZM28 36h6v6h-6v-6ZM36 36h6v6h-6v-6Z" />
    </Icon>
  );
}

/** Login modal, "Use phone or email" — the generic account glyph. */
export function PersonIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M24 6a9 9 0 1 1 0 18 9 9 0 0 1 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10ZM24 27c8.5 0 15 5.6 15.4 14.1a1 1 0 0 1-1 .9h-2a1 1 0 0 1-1-.9C35 35.3 30.4 31 24 31s-11 4.3-11.4 10.1a1 1 0 0 1-1 .9h-2a1 1 0 0 1-1-.9C9 32.6 15.5 27 24 27Z" />
    </Icon>
  );
}

/*
 * ---------------------------------------------------------------------------
 * Profile page (`/@handle`).
 *
 * The four tab glyphs, the header's icon buttons and the bio-link glyph are
 * real `d` attributes read off the live page — see
 * `docs/research/tiktok.com/PROFILE.md`. The two exceptions are marked below:
 * the owner-view settings cog and the empty-state grid, whose page stopped
 * getting past TikTok's bot interstitial before their DOM could be read.
 * ---------------------------------------------------------------------------
 */

/** Profile tab 1 — the nine-bar grid mark. */
export function ProfileVideosIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11 8a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-2Zm0 18a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V27a1 1 0 0 0-1-1h-2ZM22 9a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V9Zm1 17a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V27a1 1 0 0 0-1-1h-2ZM34 9a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V9Zm1 17a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V27a1 1 0 0 0-1-1h-2Z" />
    </Icon>
  );
}

/** Profile tab 2 — the two-arrow repost mark. */
export function RepostIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M37.7 15v19.7l3.48-3.7a.7.7 0 0 1 .99-.03l1.46 1.37c.28.26.3.7.03.99l-6.26 6.66a2.3 2.3 0 0 1-3.34.01l-6.36-6.66a.7.7 0 0 1 .02-.99l1.45-1.38a.7.7 0 0 1 .99.02l4.14 4.34V15a4.3 4.3 0 0 0-4.3-4.3h-3.5a.7.7 0 0 1-.7-.7V8c0-.39.31-.7.7-.7H30a7.7 7.7 0 0 1 7.7 7.7ZM17.84 17.34 13.7 13v20a4.3 4.3 0 0 0 4.3 4.3h3.5c.39 0 .7.31.7.7v2a.7.7 0 0 1-.7.7H18a7.7 7.7 0 0 1-7.7-7.7V13.63l-3.48 3.7a.7.7 0 0 1-.99.03L4.37 16a.7.7 0 0 1-.03-.98l6.26-6.67a2.3 2.3 0 0 1 3.34-.01l6.36 6.66a.7.7 0 0 1-.02.99l-1.45 1.38a.7.7 0 0 1-.99-.02Z" />
    </Icon>
  );
}

/** Profile tab 3 — an outlined bookmark ribbon. */
export function FavoritesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.5 11A4.5 4.5 0 0 1 15 6.5h18a4.5 4.5 0 0 1 4.5 4.5v28a1.5 1.5 0 0 1-2.38 1.21L24 32.14 12.88 40.2A1.5 1.5 0 0 1 10.5 39V11ZM15 9.5c-.83 0-1.5.67-1.5 1.5v25.06l9.62-7a1.5 1.5 0 0 1 1.76 0l9.62 7V11c0-.83-.67-1.5-1.5-1.5H15Z" />
    </Icon>
  );
}

/**
 * Profile tab 4 — an outlined heart crossed by a slash. The slash is part of
 * the glyph itself, not a state overlay: the Liked list is private, and the
 * live tab carries the mark whether or not it is the active tab.
 */
export function LikedIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.71 10.56c4.24-4.2 10.93-4.15 15.29.63 4.36-4.78 11.05-4.84 15.29-.63a10.82 10.82 0 0 1 2.82 10.55L39.5 18.5c.06-2.1-.71-4.21-2.32-5.81-3.06-3.03-7.92-3.03-11.17.75l-.03.04-.92.91a1.5 1.5 0 0 1-2.12 0l-.92-.91-.03-.04c-3.25-3.78-8.11-3.78-11.17-.75a7.82 7.82 0 0 0 0 11.12L24 36.89l1.95-1.94 2.12 2.12-3.01 3a1.5 1.5 0 0 1-2.12 0L8.71 25.93a10.82 10.82 0 0 1 0-15.38Zm33.14 21.3a16.64 16.64 0 0 0 2.25-2.68 4 4 0 0 0 .22-.41c.04-.09.18-.4.18-.77 0-.3-.09-.56-.12-.64a8.38 8.38 0 0 0-.68-1.32c-.43-.67-1.07-1.5-1.91-2.31a11.15 11.15 0 0 0-10.85-2.8l2.57 2.58.49-.01c2.5 0 4.4 1.14 5.71 2.4a9.87 9.87 0 0 1 1.63 2.02 13.67 13.67 0 0 1-1.6 1.8l2.11 2.13Zm-5.84.27c-.65.24-1.33.37-2.01.37-1.95 0-3.85-1.1-5.37-2.44a13.9 13.9 0 0 1-1.97-2.14l.17-.26a9.87 9.87 0 0 1 2.26-2.45L36 32.13Zm-9.06-9.06a12.74 12.74 0 0 0-3.17 3.89c-.06.13-.12.27-.16.4-.03.08-.12.34-.12.64 0 .37.14.68.18.76a9.6 9.6 0 0 0 .84 1.3c.51.66 1.23 1.47 2.12 2.25 1.74 1.54 4.34 3.19 7.36 3.19 1.57 0 3.02-.44 4.3-1.08l1.93 1.93a1 1 0 0 0 1.42 0l.7-.7a1 1 0 0 0 0-1.42L27.77 19.65a1 1 0 0 0-1.42 0l-.7.7a1 1 0 0 0 0 1.42l1.3 1.3Z" />
    </Icon>
  );
}

/** Header icon button — person with a plus, "add friend". */
export function AddFriendIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M31 2.5a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM31 25.5c-10.94 0-17 7.92-17 14.44 0 3.56 2 3.56 9 3.56h16c7 0 9 0 9-3.56 0-6.52-6.06-14.44-17-14.44ZM9 12.5a1 1 0 0 0-1 1v7H1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h7v7a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-7h7a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1h-7v-7a1 1 0 0 0-1-1H9Z" />
    </Icon>
  );
}

/** Header icon button — the three-dot overflow. */
export function MoreHorizontalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 24a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm15 0a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm15 0a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z" />
    </Icon>
  );
}

/**
 * The bio's external-link glyph — two chain halves plus the bar between them.
 * Not the same mark as `LinkIcon`, which is a 24-grid reconstruction for the
 * overflow menu; this one is the live 48-grid path.
 */
export function BioLinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m21.88 37.43 3.18-3.18a1.5 1.5 0 0 1 2.12 0l2.12 2.12a1.5 1.5 0 0 1 0 2.13l-3.18 3.18a14 14 0 1 1-19.8-19.8L9.5 18.7a1.5 1.5 0 0 1 2.13 0l2.12 2.12a1.5 1.5 0 0 1 0 2.12l-3.18 3.18a8 8 0 1 0 11.3 11.31ZM38.5 29.3a1.5 1.5 0 0 1-2.13 0l-2.12-2.12a1.5 1.5 0 0 1 0-2.12l3.19-3.18a8 8 0 1 0-11.32-11.32l-3.18 3.19a1.5 1.5 0 0 1-2.12 0l-2.12-2.12a1.5 1.5 0 0 1 0-2.13l3.18-3.18a14 14 0 0 1 19.8 19.8L38.5 29.3Z" />
      <path d="M17.99 32.13a1.5 1.5 0 0 0 2.12 0l12.02-12.02a1.5 1.5 0 0 0 0-2.12l-2.12-2.12a1.5 1.5 0 0 0-2.12 0L15.87 27.89a1.5 1.5 0 0 0 0 2.12l2.12 2.12Z" />
    </Icon>
  );
}

/**
 * The pencil badge on the Edit profile modal's avatar — a pencil over a rule.
 * Live 48-grid path, read from `.DivAvatarEditIcon svg`; the live glyph is
 * rendered at 16px inside a 32px disc.
 */
export function EditPencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M26.5858 5.08579C27.3479 4.32371 28.5767 4.30253 29.3646 5.03789L36.8646 12.0379C37.2612 12.408 37.4904 12.9232 37.4997 13.4655C37.5091 14.0078 37.2977 14.5307 36.9142 14.9142L16.9142 34.9142C16.5391 35.2893 16.0304 35.5 15.5 35.5H8.5C7.39543 35.5 6.5 34.6046 6.5 33.5V26C6.5 25.4696 6.71071 24.9609 7.08579 24.5858L26.5858 5.08579ZM28.0479 9.2805L10.5 26.8284V31.5H14.6716L32.622 13.5496L28.0479 9.2805Z"
      />
      <path d="M7 41C7 40.4477 7.44772 40 8 40H41C41.5523 40 42 40.4477 42 41V43C42 43.5523 41.5523 44 41 44H8C7.44772 44 7 43.5523 7 43V41Z" />
    </Icon>
  );
}

/**
 * Owner-view settings cog. NOT extracted — drawn to the 48 grid at the same
 * optical weight as the icons above, from a screenshot of the owner's profile
 * header.
 */
export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M24 16a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z" />
      <path d="M21.4 3h5.2a2 2 0 0 1 1.96 1.6l.62 3.08c.9.32 1.75.73 2.55 1.22l2.95-1.03a2 2 0 0 1 2.4.9l2.6 4.5a2 2 0 0 1-.44 2.5l-2.36 2.05c.08.47.12.95.12 1.44v.03c0 .49-.04.97-.12 1.44l2.36 2.05a2 2 0 0 1 .44 2.5l-2.6 4.5a2 2 0 0 1-2.4.9l-2.95-1.03c-.8.5-1.65.9-2.55 1.22l-.62 3.08A2 2 0 0 1 26.6 41h-5.2a2 2 0 0 1-1.96-1.6l-.62-3.08a13.7 13.7 0 0 1-2.55-1.22l-2.95 1.03a2 2 0 0 1-2.4-.9l-2.6-4.5a2 2 0 0 1 .44-2.5l2.36-2.05A11.4 11.4 0 0 1 11 24.3v-.03c0-.49.04-.97.12-1.44L8.76 20.8a2 2 0 0 1-.44-2.5l2.6-4.5a2 2 0 0 1 2.4-.9l2.95 1.03c.8-.5 1.65-.9 2.55-1.22l.62-3.08A2 2 0 0 1 21.4 3Zm1.63 3.5-.63 3.16a2 2 0 0 1-1.42 1.54c-1.02.29-1.98.7-2.85 1.24a2 2 0 0 1-2.1.06l-2.87-1a.5.5 0 0 0-.6.22l-1.7 2.94a.5.5 0 0 0 .1.62l2.42 2.1a2 2 0 0 1 .66 2c-.13.56-.2 1.14-.2 1.74s.07 1.18.2 1.74a2 2 0 0 1-.66 2l-2.42 2.1a.5.5 0 0 0-.1.62l1.7 2.94a.5.5 0 0 0 .6.22l2.87-1a2 2 0 0 1 2.1.06c.87.55 1.83.96 2.85 1.24a2 2 0 0 1 1.42 1.54l.63 3.16h3.94l.63-3.16a2 2 0 0 1 1.42-1.54c1.02-.28 1.98-.7 2.85-1.24a2 2 0 0 1 2.1-.06l2.87 1a.5.5 0 0 0 .6-.22l1.7-2.94a.5.5 0 0 0-.1-.62l-2.42-2.1a2 2 0 0 1-.66-2c.13-.56.2-1.14.2-1.74s-.07-1.18-.2-1.74a2 2 0 0 1 .66-2l2.42-2.1a.5.5 0 0 0 .1-.62l-1.7-2.94a.5.5 0 0 0-.6-.22l-2.87 1a2 2 0 0 1-2.1-.06 10.7 10.7 0 0 0-2.85-1.24 2 2 0 0 1-1.42-1.54l-.63-3.16h-3.94Z" />
    </Icon>
  );
}

/**
 * The empty grid's four-square mark. NOT extracted — same reason and same
 * source screenshot as `SettingsIcon`.
 */
export function EmptyGridIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="7" y="7" width="16" height="16" rx="3" />
      <rect x="25" y="7" width="16" height="16" rx="3" />
      <rect x="7" y="25" width="16" height="16" rx="3" />
      <rect x="25" y="25" width="16" height="16" rx="3" />
    </Icon>
  );
}

/*
 * ---------------------------------------------------------------------------
 * `/setting` glyphs.
 *
 * Every path below is the live 48-grid `d` attribute read from the settings
 * page's own SVGs, except `BusinessVerificationIcon` — that one ships on a
 * 20-grid as a 3.2KB multi-part logo, so it is redrawn here on the 48 grid at
 * the same optical weight. It is marked again at its definition.
 * ---------------------------------------------------------------------------
 */

/** Back arrow, top-left of the settings card. */
export function ArrowLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.58579 22.5858L20.8787 6.29289C21.2692 5.90237 21.9024 5.90237 22.2929 6.29289L23.7071 7.70711C24.0976 8.09763 24.0976 8.7308 23.7071 9.12132L10.8284 22H39C39.5523 22 40 22.4477 40 23V25C40 25.5523 39.5523 26 39 26H10.8284L23.7071 38.8787C24.0976 39.2692 24.0976 39.9024 23.7071 40.2929L22.2929 41.7071C21.9024 42.0976 21.2692 42.0976 20.8787 41.7071L4.58579 25.4142C3.80474 24.6332 3.80474 23.3668 4.58579 22.5858Z"
      />
    </Icon>
  );
}

/** `.DivArrowIcon` — the disclosure chevron at the right edge of a row. */
export function ChevronRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M34.4142 22.5858L18.1213 6.29289C17.7308 5.90237 17.0976 5.90237 16.7071 6.29289L15.2929 7.70711C14.9024 8.09763 14.9024 8.7308 15.2929 9.12132L30.1716 24L15.2929 38.8787C14.9024 39.2692 14.9024 39.9024 15.2929 40.2929L16.7071 41.7071C17.0976 42.0976 17.7308 42.0976 18.1213 41.7071L34.4142 25.4142C35.1953 24.6332 35.1953 23.3668 34.4142 22.5858Z"
      />
    </Icon>
  );
}

/** The same chevron turned down, for a row that expands in place. */
export function CaretDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11.3 17.3a1.5 1.5 0 0 1 2.12 0L24 27.88l10.58-10.6a1.5 1.5 0 1 1 2.12 2.13L25.06 31.06a1.5 1.5 0 0 1-2.12 0L11.3 19.42a1.5 1.5 0 0 1 0-2.12Z" />
    </Icon>
  );
}

/** Marks a row that leaves TikTok — drawn to the 48 grid, not extracted. */
export function ExternalLinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M28 6a1.5 1.5 0 0 0 0 3h8.88L21.44 24.44a1.5 1.5 0 0 0 2.12 2.12L39 11.12V20a1.5 1.5 0 0 0 3 0V7.5A1.5 1.5 0 0 0 40.5 6H28Z" />
      <path d="M9 13.5A1.5 1.5 0 0 1 10.5 12H22a1.5 1.5 0 0 1 0 3H12v21h21V26a1.5 1.5 0 0 1 3 0v11.5a1.5 1.5 0 0 1-1.5 1.5h-24A1.5 1.5 0 0 1 9 37.5v-24Z" />
    </Icon>
  );
}

export function ManageAccountIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24.0003 7C20.1343 7 17.0003 10.134 17.0003 14C17.0003 17.866 20.1343 21 24.0003 21C27.8663 21 31.0003 17.866 31.0003 14C31.0003 10.134 27.8663 7 24.0003 7ZM13.0003 14C13.0003 7.92487 17.9252 3 24.0003 3C30.0755 3 35.0003 7.92487 35.0003 14C35.0003 20.0751 30.0755 25 24.0003 25C17.9252 25 13.0003 20.0751 13.0003 14ZM24.0003 33C18.0615 33 13.0493 36.9841 11.4972 42.4262C11.3457 42.9573 10.8217 43.3088 10.2804 43.1989L8.32038 42.8011C7.77914 42.6912 7.4266 42.1618 7.5683 41.628C9.49821 34.358 16.1215 29 24.0003 29C31.8792 29 38.5025 34.358 40.4324 41.628C40.5741 42.1618 40.2215 42.6912 39.6803 42.8011L37.7203 43.1989C37.179 43.3088 36.6549 42.9573 36.5035 42.4262C34.9514 36.9841 29.9391 33 24.0003 33Z"
      />
    </Icon>
  );
}

export function PrivacyLockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24 6C20.134 6 17 9.13401 17 13V17H31V13C31 9.13401 27.866 6 24 6ZM35 17V13C35 6.92487 30.0751 2 24 2C17.9249 2 13 6.92487 13 13V17H12C8.68629 17 6 19.6863 6 23V39C6 42.3137 8.68629 45 12 45H36C39.3137 45 42 42.3137 42 39V23C42 19.6863 39.3137 17 36 17H35ZM12 21C10.8954 21 10 21.8954 10 23V39C10 40.1046 10.8954 41 12 41H36C37.1046 41 38 40.1046 38 39V23C38 21.8954 37.1046 21 36 21H12ZM26 32.4649C27.1956 31.7733 28 30.4806 28 29C28 26.7909 26.2091 25 24 25C21.7909 25 20 26.7909 20 29C20 30.4806 20.8044 31.7733 22 32.4649V37C22 37.5523 22.4477 38 23 38H25C25.5523 38 26 37.5523 26 37V32.4649Z"
      />
    </Icon>
  );
}

export function PushNotificationsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24 6C30.6274 6 36 11.3726 36 18V26C36 28.0577 36.4561 30.2073 37.4628 32H10.5372C11.544 30.2073 12 28.0577 12 26V18C12 11.3726 17.3726 6 24 6ZM44 32C42.7758 32 41.8568 31.4296 41.1641 30.3906C40.4319 29.2923 40 27.7033 40 26V18C40 9.16344 32.8366 2 24 2C15.1634 2 8 9.16344 8 18V26C8 27.7033 7.56811 29.2923 6.8359 30.3906C6.1432 31.4296 5.22419 32 4 32C2.89543 32 2 32.8954 2 34C2 35.1046 2.89543 36 4 36H44C45.1046 36 46 35.1046 46 34C46 32.8954 45.1046 32 44 32ZM18.2987 40.9485C18.6631 40.3589 19.3068 40 20 40H28C28.6932 40 29.3369 40.3589 29.7013 40.9485C30.0657 41.5382 30.0988 42.2745 29.7889 42.8944C29.7889 42.8944 29.7878 42.8965 29.7867 42.8987L29.7844 42.9032L29.7796 42.9128L29.7684 42.9343C29.7604 42.9496 29.7511 42.967 29.7405 42.9863C29.7193 43.0248 29.6928 43.0711 29.6607 43.1239C29.5967 43.2293 29.5097 43.3621 29.3969 43.5125C29.1719 43.8125 28.8387 44.1903 28.3744 44.5617C27.4203 45.325 25.9858 46 24 46C22.0142 46 20.5797 45.325 19.6256 44.5617C19.1613 44.1903 18.8281 43.8125 18.6031 43.5125C18.4903 43.3621 18.4033 43.2293 18.3393 43.1239C18.3072 43.0711 18.2807 43.0248 18.2595 42.9863C18.2489 42.967 18.2396 42.9496 18.2316 42.9343L18.2204 42.9128L18.2156 42.9032L18.2133 42.8987L18.2122 42.8965C17.9012 42.2745 17.9343 41.5382 18.2987 40.9485Z"
      />
    </Icon>
  );
}

/**
 * Business verification's storefront. NOT extracted — the live glyph is a
 * 3.2KB multi-part mark on a 20 viewBox; this is the same shape redrawn on the
 * 48 grid, from a screenshot of the settings page.
 */
export function BusinessVerificationIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 6a2 2 0 0 0-1.86 1.26l-3 7.5A2 2 0 0 0 3 15.5V17a5 5 0 0 0 2 4v18a2 2 0 0 0 2 2h34a2 2 0 0 0 2-2V21a5 5 0 0 0 2-4v-1.5a2 2 0 0 0-.14-.74l-3-7.5A2 2 0 0 0 40 6H8Zm1.35 4h29.3l2.2 5.5V17a2 2 0 0 1-4 0 2 2 0 0 0-4 0 2 2 0 0 1-4 0 2 2 0 0 0-4 0 2 2 0 0 1-4 0 2 2 0 0 0-4 0 2 2 0 0 1-4 0 2 2 0 0 0-4 0 2 2 0 0 1-4 0v-1.5L9.35 10ZM9 22.8a6 6 0 0 0 6-1.7 6 6 0 0 0 9 0 6 6 0 0 0 9 0 6 6 0 0 0 6 1.7V37H9V22.8Z" />
    </Icon>
  );
}

export function AdsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M41.11 5.34A2 2 0 0 1 42 7v33.36a2 2 0 0 1-2.7 1.87l-7.88-2.97A9.89 9.89 0 0 1 23.65 43a9.77 9.77 0 0 1-9.82-10.38L8 30.42v1.24a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V16.34a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.78L39.23 5.15a2 2 0 0 1 1.88.19ZM8 22.44v3.7l30 11.33V10L8 22.45Zm9.87 11.7a5.91 5.91 0 0 0 9.47 3.57l-9.47-3.56Z" />
    </Icon>
  );
}

export function ScreenTimeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M11.45 18.62 19.5 24l-8.05 5.38A10 10 0 0 0 7 37.69V45a1 1 0 0 0 1 1h32a1 1 0 0 0 1-1v-7.3a10 10 0 0 0-4.45-8.32L28.5 24l8.05-5.38A10 10 0 0 0 41 10.31V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7.3a10 10 0 0 0 4.45 8.32ZM37 6v4.3a6 6 0 0 1-2.67 5L28.78 19h-9.56l-5.55-3.7a6 6 0 0 1-2.67-5V6h26Zm0 36H11v-4h26v4Zm-24.73-8a6 6 0 0 1 1.4-1.3L24 25.8l10.33 6.9a6 6 0 0 1 1.4 1.3H12.27Z" />
    </Icon>
  );
}

export function ContentPreferencesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M2 15a6 6 0 0 1 6-6h22a6 6 0 0 1 6 6v4.21l9.18-6.28A1.8 1.8 0 0 1 48 14.4V33.6a1.8 1.8 0 0 1-2.82 1.48L36 28.8V33a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6V15Zm6-2a2 2 0 0 0-2 2v18c0 1.1.9 2 2 2h22a2 2 0 0 0 2-2V15a2 2 0 0 0-2-2H8Zm28.08 11L44 29.42V18.58L36.08 24Z" />
    </Icon>
  );
}

export function AccessibilityIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M24 6a18 18 0 1 0 0 36 18 18 0 0 0 0-36ZM2 24a22 22 0 1 1 44 0 22 22 0 0 1-44 0Zm26-11a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-15.62 7.2c2.23.65 4.11 1.15 5.92 1.49l-1.68 15.1a1 1 0 0 0 .89 1.1l1.98.22a1 1 0 0 0 1.1-.88l.7-6.21 5.42-.02.7 6.23a1 1 0 0 0 1.1.88l1.98-.22a1 1 0 0 0 .89-1.1l-.89-8-.65-7.06a44.4 44.4 0 0 0 5.86-1.52c.52-.17.8-.74.62-1.26l-.64-1.9c-.18-.52-.75-.8-1.28-.63a36.58 36.58 0 0 1-6.97 1.64c-2.03.25-4.6.2-6.7-.05a44.1 44.1 0 0 1-7.2-1.64 1 1 0 0 0-1.24.67l-.58 1.92a1 1 0 0 0 .67 1.24Zm9.35 6.82.54-4.86c1.18.07 2.41.09 3.6.03l.44 4.82h-4.58Z" />
    </Icon>
  );
}

/* --- /login and /signup --------------------------------------------------
 * Every glyph below is a live path from the auth pages, on the same 48 grid.
 * ------------------------------------------------------------------------- */

/** `.StyledHelpIcon` — the "Feedback and help" mark in the auth header. */
export function HelpCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M24 6C14.0589 6 6 14.0589 6 24C6 33.9411 14.0589 42 24 42C33.9411 42 42 33.9411 42 24C42 14.0589 33.9411 6 24 6ZM2 24C2 11.8497 11.8497 2 24 2C36.1503 2 46 11.8497 46 24C46 36.1503 36.1503 46 24 46C11.8497 46 2 36.1503 2 24ZM24.0909 15C22.172 15 20.3433 16.2292 19.2617 18.61C19.0332 19.1128 18.4726 19.4 17.9487 19.2253L16.0513 18.5929C15.5274 18.4182 15.2406 17.8497 15.4542 17.3405C16.9801 13.7031 20.0581 11 24.0909 11C28.459 11 32 14.541 32 18.9091C32 21.2138 30.7884 23.4606 29.2167 25.074C27.8157 26.5121 25.5807 27.702 22.9988 27.9518C22.4491 28.0049 22.0001 27.5523 22.0001 27V25C22.0001 24.4477 22.4504 24.0057 22.9955 23.9167C24.2296 23.7153 25.5034 23.1533 26.3515 22.2828C27.4389 21.1666 28 19.8679 28 18.9091C28 16.7502 26.2498 15 24.0909 15ZM24 36C22.3431 36 21 34.6569 21 33C21 31.3431 22.3431 30 24 30C25.6569 30 27 31.3431 27 33C27 34.6569 25.6569 36 24 36Z"
      />
    </Icon>
  );
}

/** `.DivBack` — the chevron before "Go back". */
export function ChevronLeftIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4.58579 22.5858L20.8787 6.29289C21.2692 5.90237 21.9024 5.90237 22.2929 6.29289L23.7071 7.70711C24.0976 8.09763 24.0976 8.7308 23.7071 9.12132L8.82843 24L23.7071 38.8787C24.0976 39.2692 24.0976 39.9024 23.7071 40.2929L22.2929 41.7071C21.9024 42.0976 21.2692 42.0976 20.8787 41.7071L4.58579 25.4142C3.80474 24.6332 3.80474 23.3668 4.58579 22.5858Z"
      />
    </Icon>
  );
}

/**
 * The solid triangle inside a select. Distinct from `CaretDownIcon`, which is
 * the hairline chevron `/setting` uses for a row that expands in place.
 */
export function CaretFilledIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M25.5187 35.2284C24.7205 36.1596 23.2798 36.1596 22.4816 35.2284L8.83008 19.3016C7.71807 18.0042 8.63988 16 10.3486 16H37.6517C39.3604 16 40.2822 18.0042 39.1702 19.3016L25.5187 35.2284Z"
      />
    </Icon>
  );
}

/** `.IPasswordIcon`, password revealed — the eye. */
export function EyeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M41.4 23.71a.9.9 0 0 1 0 .58c-.63 1.92-2.2 4.89-4.82 7.51A17.35 17.35 0 0 1 24 37.11c-5.42 0-9.55-2.28-12.58-5.3a20.44 20.44 0 0 1-4.82-7.52.9.9 0 0 1 0-.58c.63-1.92 2.2-4.89 4.82-7.51A17.35 17.35 0 0 1 24 10.89c5.42 0 9.55 2.28 12.58 5.3a20.44 20.44 0 0 1 4.82 7.52ZM24 41c13.83 0 20.82-11.7 21.96-16.81a.85.85 0 0 0 0-.38C44.82 18.71 37.83 7 24 7S3.18 18.7 2.04 23.81a.85.85 0 0 0 0 .38C3.18 29.29 10.17 41 24 41Z" />
      <path d="M24 27.21a3.21 3.21 0 1 1 0-6.42 3.21 3.21 0 0 1 0 6.42Zm0 4.29a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z" />
    </Icon>
  );
}

/** `.IPasswordIcon`, password hidden — the eye with a stroke through it. */
export function EyeOffIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M38.88 41.7a1 1 0 0 0 1.41 0l1.42-1.4a1 1 0 0 0 0-1.42l-3.86-3.86a24.57 24.57 0 0 0 6.27-9.69 1 1 0 0 0 0-.66C41 15.8 32.66 9 23 9c-3.27 0-6.35.73-9.12 2.05L9.12 6.29a1 1 0 0 0-1.41 0L6.29 7.71a1 1 0 0 0 0 1.41l32.59 32.59Zm-22-27.66A17.8 17.8 0 0 1 23 13c12.75 0 17 12 17 12s-1.38 3.9-4.93 7.25l-4.54-4.55A7.99 7.99 0 0 0 23 17c-.95 0-1.86.16-2.7.47l-3.43-3.43ZM1.87 24.67a24.64 24.64 0 0 1 5.8-9.23l2.77 2.78C7.25 21.46 6 25 6 25s4.25 12 17 12a18 18 0 0 0 5.42-.8l3.05 3.05A21.2 21.2 0 0 1 23 41c-9.83 0-17.93-6.63-21.13-15.67a1 1 0 0 1 0-.66Z" />
      <path d="M15 25c0-.68.08-1.35.24-1.98l9.74 9.73A8.02 8.02 0 0 1 15 25Z" />
    </Icon>
  );
}

/* --- Search drawer ------------------------------------------------------- */

/**
 * The three glyphs in the search panel's lists. Like the video-settings icons
 * above, these are reconstructions on the same 48×48 grid rather than extracted
 * paths — the live panel draws them from a cross-origin sprite.
 */

/** Marks a row that came from the viewer's own search history. */
export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M24 4a20 20 0 1 0 0 40 20 20 0 0 0 0-40Zm0 3a17 17 0 1 1 0 34 17 17 0 0 1 0-34Zm-1.5 5a1.5 1.5 0 0 0-1.5 1.5V25c0 .5.3 1 .7 1.3l7.5 4.5a1.5 1.5 0 0 0 1.6-2.6L24 24.2V13.5a1.5 1.5 0 0 0-1.5-1.5Z" />
    </Icon>
  );
}

/** Marks a trending suggestion — the rising line the live panel uses. */
export function TrendingIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M29 12a1.5 1.5 0 0 0 0 3h6.9L26 24.9l-6.9-7a1.5 1.5 0 0 0-2.2 0L5.4 29.5a1.5 1.5 0 0 0 2.2 2.1L18 21.1l6.9 7a1.5 1.5 0 0 0 2.2 0L38 17.1V24a1.5 1.5 0 0 0 3 0V13.5c0-.8-.7-1.5-1.5-1.5H29Z" />
    </Icon>
  );
}

/** The plain bullet on a non-trending suggestion. */
export function DotIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="24" cy="24" r="5" />
    </Icon>
  );
}
