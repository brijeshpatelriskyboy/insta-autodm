import { describe, expect, it } from "vitest";
import { containsHeaderInjection, stripHeaderInjection } from "./contact";

describe("contact header-injection guards", () => {
  it("detects CR/LF/NUL and strips them", () => {
    expect(containsHeaderInjection("Hello\r\nBcc: evil@example.com")).toBe(true);
    expect(stripHeaderInjection("Hello\r\nBcc: evil@example.com")).toBe("Hello Bcc: evil@example.com");
    expect(containsHeaderInjection("Ada Lovelace")).toBe(false);
  });
});
