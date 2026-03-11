"use client";

import React from "react";
import { logger } from "@/lib/logger";

type FallbackRender = (args: { error: Error; reset: () => void }) => React.ReactNode;

type SubsystemErrorBoundaryProps = {
  subsystem: "transport" | "simulation";
  children: React.ReactNode;
  fallback: FallbackRender;
};

type SubsystemErrorBoundaryState = {
  error: Error | null;
};

export class SubsystemErrorBoundary extends React.Component<
  SubsystemErrorBoundaryProps,
  SubsystemErrorBoundaryState
> {
  constructor(props: SubsystemErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): SubsystemErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    logger.error(
      "System",
      `Subsystem failure captured (${this.props.subsystem})`,
      error,
    );
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    if (this.state.error) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }

    return this.props.children;
  }
}
