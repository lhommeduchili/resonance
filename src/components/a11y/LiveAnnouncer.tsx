"use client";

import { useEffect, useMemo, useState } from "react";
import { eventBus } from "@/lib/eventBus";
import type { AppMessages } from "@/lib/i18n/dictionaries";
import type { LiveAnnouncement } from "@/lib/a11y/contracts";
import type { ListenerStatus } from "@/lib/types";

export function LiveAnnouncer({
  messages,
  status,
  distanceToNode,
  isAudioReady,
}: {
  messages: AppMessages;
  status: ListenerStatus;
  distanceToNode: number;
  isAudioReady: boolean;
}) {
  const [eventAnnouncement, setEventAnnouncement] = useState<LiveAnnouncement | null>(null);

  const statusAnnouncement = useMemo<LiveAnnouncement | null>(() => {
    if (!isAudioReady) {
      return { id: "audio-locked", message: messages.a11y.audioLocked, priority: "polite" };
    }

    if (status === "CONNECTING") {
      return { id: "status-connecting", message: messages.a11y.connecting, priority: "polite" };
    }

    if (status === "LISTENING") {
      return { id: "status-listening", message: messages.a11y.tunedIn, priority: "polite" };
    }

    if (status === "AMBIENT" && distanceToNode < 120) {
      return { id: "proximity-close", message: messages.a11y.proximityClose, priority: "polite" };
    }

    if (status === "AMBIENT" && distanceToNode < 280) {
      return { id: "proximity-mid", message: messages.a11y.proximityMid, priority: "polite" };
    }

    return null;
  }, [distanceToNode, isAudioReady, messages, status]);

  useEffect(() => {
    const handler = (event: ReturnType<typeof eventBus.getHistory>[number]) => {
      if (event.type === "listener_joined") {
        setEventAnnouncement({
          id: `${event.type}-${event.timestamp}`,
          message: messages.a11y.listenerJoined,
          priority: "polite",
        });
      }

      if (event.type === "listener_left") {
        setEventAnnouncement({
          id: `${event.type}-${event.timestamp}`,
          message: messages.a11y.listenerLeft,
          priority: "polite",
        });
      }

      if (event.type === "broadcast_started") {
        const graphName = "graphName" in event.payload ? event.payload.graphName : "";
        const channelAwareMessage = messages.a11y.broadcastStartedNamed.replace(
          "{channel}",
          graphName,
        );
        setEventAnnouncement({
          id: `${event.type}-${event.timestamp}`,
          message: channelAwareMessage || messages.a11y.broadcastStarted,
          priority: "assertive",
        });
      }

      if (event.type === "broadcast_ended") {
        setEventAnnouncement({
          id: `${event.type}-${event.timestamp}`,
          message: messages.a11y.broadcastEnded,
          priority: "polite",
        });
      }
    };

    eventBus.onAny(handler);
    return () => eventBus.offAny(handler);
  }, [messages]);

  const announcement = eventAnnouncement ?? statusAnnouncement;

  return (
    <div aria-live={announcement?.priority ?? "polite"} className="sr-only">
      {announcement?.message ?? ""}
    </div>
  );
}
