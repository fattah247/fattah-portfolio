import { describe, expect, it } from "vitest";
import { homeGestureOutcome } from "./use-home-gesture";
import { flicksAway } from "./use-flick-away";
import { sheetGoesAway } from "./debugger-workspace";

describe("the home gesture's release", () => {
  const height = 844;

  it("sends a thrown app Home, however short the throw", () => {
    expect(homeGestureOutcome(-60, -0.9, height)).toBe("home");
    expect(homeGestureOutcome(-260, -1.6, height)).toBe("home");
  });

  it("sends an app carried far up Home even if it slowed down", () => {
    expect(homeGestureOutcome(-360, -0.1, height)).toBe("home");
  });

  it("opens Recents when the app is held still partway up", () => {
    expect(homeGestureOutcome(-220, 0, height)).toBe("recents");
  });

  it("lets a small or reversed pull fall back into place", () => {
    expect(homeGestureOutcome(-90, 0, height)).toBe("back");
    expect(homeGestureOutcome(-220, 0.6, height)).toBe("back");
  });
});

describe("a Recents card's release", () => {
  it("flies away when flicked or thrown far, and springs back from a short pull", () => {
    expect(flicksAway(-40, -1.2, 510)).toBe(true);
    expect(flicksAway(-340, 0, 510)).toBe(true);
    expect(flicksAway(-80, -0.1, 510)).toBe(false);
  });
});

describe("the evidence sheet's release", () => {
  it("goes where the throw would carry it", () => {
    expect(sheetGoesAway(80, 1.7, 770)).toBe(true);
    expect(sheetGoesAway(120, 0.2, 770)).toBe(false);
    expect(sheetGoesAway(300, 0, 770)).toBe(true);
    expect(sheetGoesAway(300, -0.6, 770)).toBe(false);
  });
});
