import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMediaCaption,
  formatMediaTimestamp,
  formatMediaTypeLabel,
  getMediaKind,
} from "./instagram-media-display";

describe("instagram-media-display", () => {
  it("maps Graph media types to Reel / Post / Carousel labels", () => {
    assert.equal(formatMediaTypeLabel("VIDEO"), "🎥 Reel");
    assert.equal(formatMediaTypeLabel("IMAGE"), "🖼️ Post");
    assert.equal(formatMediaTypeLabel("CAROUSEL_ALBUM"), "📚 Carousel");
    assert.equal(getMediaKind("VIDEO"), "reel");
    assert.equal(getMediaKind("IMAGE"), "post");
    assert.equal(getMediaKind("CAROUSEL_ALBUM"), "carousel");
  });

  it("uses Untitled labels when caption is missing", () => {
    assert.equal(formatMediaCaption(null, "VIDEO"), "Untitled Reel");
    assert.equal(formatMediaCaption("  ", "IMAGE"), "Untitled Post");
    assert.equal(formatMediaCaption(undefined, "CAROUSEL_ALBUM"), "Untitled Carousel");
    assert.equal(formatMediaCaption("Breakfast with Family", "VIDEO"), "Breakfast with Family");
  });

  it("formats timestamps in local timezone as d MMM yyyy • h:mm a", () => {
    const formatted = formatMediaTimestamp("2026-08-07T15:42:00.000Z");
    assert.ok(formatted);
    assert.match(formatted, /^\d{1,2} \w{3} 2026 • \d{1,2}:\d{2} (AM|PM)$/);
  });

  it("returns null for missing/invalid timestamps (old rules)", () => {
    assert.equal(formatMediaTimestamp(null), null);
    assert.equal(formatMediaTimestamp(undefined), null);
    assert.equal(formatMediaTimestamp(""), null);
    assert.equal(formatMediaTimestamp("not-a-date"), null);
  });

  it("UI falls back to Date unavailable when formatter returns null", () => {
    assert.equal(formatMediaTimestamp(null) ?? "Date unavailable", "Date unavailable");
  });
});
