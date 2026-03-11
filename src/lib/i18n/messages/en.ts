import { GLOSSARY } from "@/lib/i18n/glossary";

export type AppMessages = {
  common: {
    metadataDescription: string;
    homeLabel: string;
    broadcastLabel: string;
  };
  system: {
    reconnectChannel: string;
    resyncField: string;
    transportDriftTitle: string;
    transportDriftMessage: string;
    simulationDriftTitle: string;
    simulationDriftMessage: string;
    broadcastTransportFaultTitle: string;
    broadcastTransportFaultMessage: string;
    broadcastSimulationDriftTitle: string;
    broadcastSimulationDriftMessage: string;
  };
  home: {
    openChannel: string;
    explorationPhase: string;
    negotiatingPhase: string;
    signalLocked: string;
    activePeersLabel: string;
    activeBroadcastNodes: string;
    tuneIntoNode: string;
    disconnectFromNode: string;
    broadcastNode: string;
    unknownNode: string;
  };
  broadcast: {
    heading: string;
    subtitle: string;
    fieldReceptive: string;
    igniteHint: string;
    ignitionPriming: string;
    ignitionStabilizing: string;
    channelSource: string;
    transmissionMode: string;
    voiceMode: string;
    highFidelityMode: string;
    state: string;
    directPeers: string;
    telemetry: string;
    audioSource: string;
    defaultEnvironment: string;
    microphoneFallback: string;
    igniteTransmission: string;
    collapseSignal: string;
    microphoneDenied: string;
    unknownError: string;
  };
  a11y: {
    nodeAction: string;
    routeSwitchLabel: string;
    overlayRegionLabel: string;
    nodeStatus: string;
    audioLocked: string;
    connecting: string;
    tunedIn: string;
    proximityMid: string;
    proximityClose: string;
    listenerJoined: string;
    listenerLeft: string;
    broadcastStarted: string;
    broadcastStartedNamed: string;
    broadcastEnded: string;
  };
  glossary: typeof GLOSSARY;
};

export const enMessages = {
  common: {
    metadataDescription: "A P2P generative radio network and cultural simulation field.",
    homeLabel: "Field",
    broadcastLabel: "Broadcast",
  },
  system: {
    reconnectChannel: "Reconnect Channel",
    resyncField: "Re-Sync Field",
    transportDriftTitle: "Transport Drift",
    transportDriftMessage: "The listening mesh lost coherence. Reconnect to re-enter the field.",
    simulationDriftTitle: "Field Distortion",
    simulationDriftMessage: "The simulation layer drifted out of phase. Re-sync to continue listening.",
    broadcastTransportFaultTitle: "Broadcast Transport Fault",
    broadcastTransportFaultMessage:
      "The transmission layer became unstable. Reconnect to stabilize the signal.",
    broadcastSimulationDriftTitle: "Broadcast Field Distortion",
    broadcastSimulationDriftMessage:
      "The local simulation renderer collapsed. Re-sync the field to continue.",
  },
  home: {
    openChannel: "Click anywhere to open channel",
    explorationPhase: "Exploration Phase",
    negotiatingPhase: "Negotiating Phase...",
    signalLocked: "Signal Locked.",
    activePeersLabel: "State active peers",
    activeBroadcastNodes: "Active Broadcast Nodes",
    tuneIntoNode: "Tune into",
    disconnectFromNode: "Disconnect from",
    broadcastNode: "Broadcast Node",
    unknownNode: "Unknown node",
  },
  broadcast: {
    heading: "✧ RESONANCE INGESTION ✧",
    subtitle: "BROADCAST NODE CONFIGURATION",
    fieldReceptive: "The field is receptive.",
    igniteHint: "Ignite when nearby listeners can cohere into a live node.",
    ignitionPriming: "Priming signal lattice...",
    ignitionStabilizing: "Stabilizing carrier wave...",
    channelSource: "Channel Source:",
    transmissionMode: "Transmission Mode:",
    voiceMode: "Voice",
    highFidelityMode: "High-Fidelity",
    state: "State:",
    directPeers: "Direct Peers:",
    telemetry: "Telemetry:",
    audioSource: "Audio Source:",
    defaultEnvironment: "Default Environment",
    microphoneFallback: "Microphone {id}...",
    igniteTransmission: "Ignite Transmission",
    collapseSignal: "Collapse Signal",
    microphoneDenied: "Microphone Access Denied / Server Error",
    unknownError: "Unknown Error",
  },
  a11y: {
    nodeAction: "{action} {node}",
    routeSwitchLabel: "Switch route",
    overlayRegionLabel: "Spatial node controls",
    nodeStatus: "{listeners} listeners. Energy {energy}.",
    audioLocked: "Open the channel to unlock spatial audio.",
    connecting: "Negotiating transmission path.",
    tunedIn: "You are tuned into a broadcast node.",
    proximityMid: "Approaching transmission field.",
    proximityClose: "Transmission is near. Audio is intensifying.",
    listenerJoined: "A listener joined the field.",
    listenerLeft: "A listener left the field.",
    broadcastStarted: "A new transmission ignited.",
    broadcastStartedNamed: "A new transmission ignited in {channel}.",
    broadcastEnded: "A transmission collapsed.",
  },
  glossary: GLOSSARY,
} satisfies AppMessages;
