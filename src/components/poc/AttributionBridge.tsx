"use client";

import { useEffect } from "react";
import { eventBus } from "@/lib/eventBus";
import { sendPocAttributionEvent, toPocAttributionEvent } from "@/lib/poc/client";

export function AttributionBridge() {
  useEffect(() => {
    const handler = (event: ReturnType<typeof eventBus.getHistory>[number]) => {
      const attributionEvent = toPocAttributionEvent(event);
      if (!attributionEvent) {
        return;
      }

      void sendPocAttributionEvent(attributionEvent);
    };

    eventBus.onAny(handler);
    return () => eventBus.offAny(handler);
  }, []);

  return null;
}
