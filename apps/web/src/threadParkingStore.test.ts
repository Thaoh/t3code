import { describe, expect, it } from "vite-plus/test";
import { resolveDisplayedParkedNote, shouldPushLocalNote } from "./threadParkingStore";

const note = (createdAt: string) => ({
  goal: "goal",
  nextStep: "next",
  createdAt,
});

describe("resolveDisplayedParkedNote", () => {
  it("returns null when neither side has a note", () => {
    expect(resolveDisplayedParkedNote(null, null)).toBeNull();
  });

  it("falls back to the only available note", () => {
    const local = note("2026-07-16T10:00:00.000Z");
    const server = note("2026-07-16T11:00:00.000Z");
    expect(resolveDisplayedParkedNote(null, local)).toBe(local);
    expect(resolveDisplayedParkedNote(server, null)).toBe(server);
  });

  it("prefers the most recently created note", () => {
    const older = note("2026-07-16T10:00:00.000Z");
    const newer = note("2026-07-16T11:00:00.000Z");
    expect(resolveDisplayedParkedNote(older, newer)).toBe(newer);
    expect(resolveDisplayedParkedNote(newer, older)).toBe(newer);
  });

  it("prefers the server note on a timestamp tie", () => {
    const server = note("2026-07-16T10:00:00.000Z");
    const local = note("2026-07-16T10:00:00.000Z");
    expect(resolveDisplayedParkedNote(server, local)).toBe(server);
  });
});

describe("shouldPushLocalNote", () => {
  it("pushes when the server has no note", () => {
    expect(shouldPushLocalNote(null, note("2026-07-16T10:00:00.000Z"))).toBe(true);
  });

  it("pushes when the local note is newer", () => {
    expect(
      shouldPushLocalNote(note("2026-07-16T10:00:00.000Z"), note("2026-07-16T11:00:00.000Z")),
    ).toBe(true);
  });

  it("drops the local note when the server note is newer or equal", () => {
    expect(
      shouldPushLocalNote(note("2026-07-16T11:00:00.000Z"), note("2026-07-16T10:00:00.000Z")),
    ).toBe(false);
    expect(
      shouldPushLocalNote(note("2026-07-16T10:00:00.000Z"), note("2026-07-16T10:00:00.000Z")),
    ).toBe(false);
  });
});
