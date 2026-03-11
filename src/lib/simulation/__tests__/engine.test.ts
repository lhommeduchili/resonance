import { describe, expect, it } from "vitest";
import { createSimulationEngine } from "@/lib/simulation/engine";
import type { SimulationConfig } from "@/lib/simulation/contracts";

const baseConfig: SimulationConfig = {
  isActive: false,
  isListener: true,
  dataTransferRate: 1,
  connectedNodeId: null,
  isReady: true,
  activeProfile: "VOICE",
};

describe("simulation engine", () => {
  it("is deterministic for equal seed and inputs", () => {
    const engineA = createSimulationEngine(baseConfig, 42);
    const engineB = createSimulationEngine(baseConfig, 42);

    engineA.handleMouseMove(320, 180);
    engineB.handleMouseMove(320, 180);

    const frameA1 = engineA.step(16, 800, 600);
    const frameB1 = engineB.step(16, 800, 600);
    const frameA2 = engineA.step(16, 800, 600);
    const frameB2 = engineB.step(16, 800, 600);

    const selfA1 = frameA1.agents.find((agent) => agent.id === frameA1.selfId);
    const selfB1 = frameB1.agents.find((agent) => agent.id === frameB1.selfId);
    const selfA2 = frameA2.agents.find((agent) => agent.id === frameA2.selfId);
    const selfB2 = frameB2.agents.find((agent) => agent.id === frameB2.selfId);

    expect(selfA1).toBeDefined();
    expect(selfB1).toBeDefined();
    expect(selfA2?.x).toBeCloseTo(selfB2?.x ?? 0, 6);
    expect(selfA2?.y).toBeCloseTo(selfB2?.y ?? 0, 6);
    expect(selfA2?.spin).toBeCloseTo(selfB2?.spin ?? 0, 6);
  });

  it("ingests peer map updates into agent state", () => {
    const engine = createSimulationEngine(baseConfig, 7);

    engine.updatePeers([
      {
        id: "root-test",
        role: "root",
        latentState: { x: 400, y: 300, spin: 0.3 },
        connections: 2,
        energy: 85,
      },
    ]);

    const frame = engine.step(16, 800, 600);
    const root = frame.agents.find((agent) => agent.id === "root-test");

    expect(root).toBeDefined();
    expect(root?.type).toBe("node");
    expect(root?.energy).toBeGreaterThan(0);
  });

  it("does not advance simulation on zero or invalid delta", () => {
    const engine = createSimulationEngine(baseConfig, 99);
    engine.handleMouseMove(150, 120);

    const before = engine.step(16, 800, 600);
    const stable = before.agents.find((agent) => agent.id === before.selfId);

    const zeroDelta = engine.step(0, 800, 600);
    const invalidDelta = engine.step(Number.NaN, 800, 600);

    const afterZero = zeroDelta.agents.find((agent) => agent.id === zeroDelta.selfId);
    const afterInvalid = invalidDelta.agents.find((agent) => agent.id === invalidDelta.selfId);

    expect(afterZero?.x).toBeCloseTo(stable?.x ?? 0, 6);
    expect(afterZero?.y).toBeCloseTo(stable?.y ?? 0, 6);
    expect(afterInvalid?.x).toBeCloseTo(stable?.x ?? 0, 6);
    expect(afterInvalid?.y).toBeCloseTo(stable?.y ?? 0, 6);
  });

  it("keeps frame-rate equivalence across chunked deltas", () => {
    const singleStepEngine = createSimulationEngine(baseConfig, 21);
    const chunkedStepEngine = createSimulationEngine(baseConfig, 21);

    singleStepEngine.handleMouseMove(500, 320);
    chunkedStepEngine.handleMouseMove(500, 320);

    const single = singleStepEngine.step(16, 800, 600);
    chunkedStepEngine.step(8, 800, 600);
    const chunked = chunkedStepEngine.step(8, 800, 600);

    const singleSelf = single.agents.find((agent) => agent.id === single.selfId);
    const chunkedSelf = chunked.agents.find((agent) => agent.id === chunked.selfId);

    const deltaX = Math.abs((singleSelf?.x ?? 0) - (chunkedSelf?.x ?? 0));
    const deltaY = Math.abs((singleSelf?.y ?? 0) - (chunkedSelf?.y ?? 0));
    const deltaSpin = Math.abs((singleSelf?.spin ?? 0) - (chunkedSelf?.spin ?? 0));

    expect(deltaX).toBeLessThan(0.2);
    expect(deltaY).toBeLessThan(0.2);
    expect(deltaSpin).toBeLessThan(0.02);
  });

  it("expires interaction state based on stepped time", () => {
    const engine = createSimulationEngine(baseConfig, 11);
    engine.handleMouseMove(240, 160);

    const activeFrame = engine.step(16, 800, 600);
    expect(activeFrame.mouse.isInteracting).toBe(true);

    const expiredFrame = engine.step(1600, 800, 600);
    expect(expiredFrame.mouse.isInteracting).toBe(false);
  });
});
