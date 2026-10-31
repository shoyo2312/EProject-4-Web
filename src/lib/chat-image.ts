/** chat-service's `ImageInspector.MAX_BYTES`. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_MB = 5;

/** chat-service's `MessagePayload.MAX_IMAGE_CAPTION`. */
export const MAX_CAPTION_LENGTH = 1000;

/** What the server accepts; it decides again from the file's own bytes. */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
export const IMAGE_ACCEPT = IMAGE_TYPES.join(",");

/** Why a file cannot be sent, or null. The server checks again; this only saves the round trip. */
export function imageFileError(file: Pick<File, "type" | "size">): string | null {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return "Only JPEG, PNG, GIF or WebP photos can be sent.";
  if (file.size === 0) return "That photo couldn't be read.";
  if (file.size > MAX_IMAGE_BYTES) return `Photos can be up to ${MAX_IMAGE_MB} MB.`;
  return null;
}

/** The first image among files, if any: what a paste, a drop or a picker handed over. */
export function firstImage(files: ArrayLike<File> | null | undefined): File | null {
  if (!files) return null;
  for (let i = 0; i < files.length; i += 1) {
    if (files[i].type.startsWith("image/")) return files[i];
  }
  return null;
}

/**
 * The box a picture is drawn in: its own proportions, scaled down to fit — never up, never stretched.
 * Known from the message before the bytes arrive, so loading it moves nothing.
 */
export function fitImage(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: maxWidth, height: Math.round(maxWidth * 0.75) };
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
