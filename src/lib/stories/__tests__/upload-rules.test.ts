import { describe, expect, it } from "vitest";

import { STORY_UPLOAD_TYPES, storyFileProblem } from "../upload-rules";

const MB = 1024 * 1024;

describe("storyFileProblem", () => {
  it("accepts an image up to 10 MB", () => {
    expect(storyFileProblem({ type: "image/jpeg", size: 10 * MB })).toBeNull();
  });

  it("refuses an image over 10 MB", () => {
    expect(storyFileProblem({ type: "image/png", size: 10 * MB + 1 })).toMatch(/10 MB/);
  });

  it("accepts a video up to 50 MB", () => {
    expect(storyFileProblem({ type: "video/mp4", size: 50 * MB })).toBeNull();
  });

  it("refuses a video over 50 MB", () => {
    expect(storyFileProblem({ type: "video/webm", size: 50 * MB + 1 })).toMatch(/50 MB/);
  });

  it("refuses a type browsers cannot play back", () => {
    expect(storyFileProblem({ type: "video/quicktime", size: MB })).not.toBeNull();
  });

  it("refuses an empty file", () => {
    expect(storyFileProblem({ type: "image/webp", size: 0 })).not.toBeNull();
  });

  it("lists exactly the five types the backend presigns", () => {
    expect([...STORY_UPLOAD_TYPES].sort()).toEqual(
      ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"],
    );
  });
});
