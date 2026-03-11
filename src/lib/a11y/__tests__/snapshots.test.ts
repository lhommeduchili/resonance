import { describe, expect, it } from "vitest";
import { buildNodeSemanticSnapshots } from "@/lib/a11y/snapshots";

describe("buildNodeSemanticSnapshots", () => {
  it("maps only root and relay peers", () => {
    const snapshots = buildNodeSemanticSnapshots(
      [
        {
          id: "root-1",
          role: "root",
          latentState: { x: 100, y: 200, spin: 0.5 },
          connections: 9,
          energy: 88,
        },
        {
          id: "relay-1",
          role: "relay",
          latentState: { x: 120, y: 220, spin: 0.2 },
          connections: 3,
          energy: 21,
        },
        {
          id: "observer-1",
          role: "observer",
          latentState: { x: 10, y: 20, spin: 0.1 },
          connections: 0,
          energy: 0,
        },
      ],
      "relay-1",
    );

    expect(snapshots).toHaveLength(2);
    expect(snapshots[1]?.isTuned).toBe(true);
    expect(snapshots[0]?.label).toBe("root");
  });
});
