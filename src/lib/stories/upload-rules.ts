const MB = 1024 * 1024;

/**
 * What story-service presigns uploads for, and the byte limits it signs into them — checked here
 * first so a refused file fails before it uploads. Formats browsers play natively: stories are not
 * transcoded.
 */
const LIMITS: Record<string, number> = {
  "image/jpeg": 10 * MB,
  "image/png": 10 * MB,
  "image/webp": 10 * MB,
  "video/mp4": 50 * MB,
  "video/webm": 50 * MB,
};

export const STORY_UPLOAD_TYPES = Object.keys(LIMITS);

export function storyFileProblem(file: { type: string; size: number }): string | null {
  const limit = LIMITS[file.type];
  if (limit === undefined) {
    return "Choose a JPG, PNG or WebP photo, or an MP4 or WebM video.";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  if (file.size > limit) {
    return `That file is too large. The limit is ${limit / MB} MB.`;
  }
  return null;
}

export const STORY_MAX_VIDEO_SECONDS = 60;

/**
 * media-worker rejects a longer video only after it has been uploaded and screened, so it is caught
 * here first. Rounded the way media-worker rounds its probe, so a 60.4 s clip passes both.
 */
export function storyDurationProblem(seconds: number): string | null {
  return Math.round(seconds) > STORY_MAX_VIDEO_SECONDS
    ? `That video is too long. Stories can be up to ${STORY_MAX_VIDEO_SECONDS} seconds.`
    : null;
}
