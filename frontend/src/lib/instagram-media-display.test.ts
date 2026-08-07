import { describe, expect, it } from "vitest";
import {
  formatMediaCaption,
  formatMediaTimestamp,
  formatMediaTypeLabel,
  getMediaKind,
} from "./instagram-media-display";

describe("instagram-media-display", () => {
  it("maps Graph media types to Reel / Post / Carousel labels", () => {
    expect(formatMediaTypeLabel("VIDEO")).toBe("🎥 Reel");
    expect(formatMediaTypeLabel("IMAGE")).toBe("🖼️ Post");
    expect(formatMediaTypeLabel("CAROUSEL_ALBUM")).toBe("📚 Carousel");
    expect(getMediaKind("VIDEO")).toBe("reel");
    expect(getMediaKind("IMAGE")).toBe("post");
    expect(getMediaKind("CAROUSEL_ALBUM")).toBe("carousel");
  });

  it("uses Untitled labels when caption is missing", () => {
    expect(formatMediaCaption(null, "VIDEO")).toBe("Untitled Reel");
    expect(formatMediaCaption("  ", "IMAGE")).toBe("Untitled Post");
    expect(formatMediaCaption(undefined, "CAROUSEL_ALBUM")).toBe("Untitled Carousel");
    expect(formatMediaCaption("Breakfast with Family", "VIDEO")).toBe("Breakfast with Family");
  });

  it("formats timestamps in local timezone as d MMM yyyy • h:mm a", () => {
    const formatted = formatMediaTimestamp("2026-08-07T15:42:00.000Z");
    expect(formatted).not.toBeNull();
    // en-GB day+month+year + en-US time with am/pm
    expect(formatted).toMatch(/^\d{1,2} \w{3} 2026 • \d{1,2}:\d{2} (AM|PM)$/);
  });

  it("returns null for missing/invalid timestamps (old rules)", () => {
    expect(formatMediaTimestamp(null)).toBeNull();
    expect(formatMediaTimestamp(undefined)).toBeNull();
    expect(formatMediaTimestamp("")).toBeNull();
    expect(formatMediaTimestamp("not-a-date")).toBeNull();
  });
});
