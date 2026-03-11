import { describe, expect, it } from "vitest";
import { clampOverlayPoint, projectWorldToScreen } from "@/lib/a11y/positioning";

describe("a11y positioning", () => {
  it("projects world coordinates to screen space using zoom", () => {
    const point = projectWorldToScreen(600, 450, 800, 600, 0.5);

    expect(point.x).toBeCloseTo(500, 6);
    expect(point.y).toBeCloseTo(375, 6);
  });

  it("clamps overlay points inside viewport padding", () => {
    const point = clampOverlayPoint(-20, 9999, 800, 600, 20);

    expect(point.x).toBe(20);
    expect(point.y).toBe(580);
  });
});
