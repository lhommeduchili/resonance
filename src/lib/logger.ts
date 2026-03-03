/**
 * Resonance Telemetry & Logging Wrapper
 * 
 * Enforces structured logging across the P2P Mesh and Simulation layers.
 * Suppresses verbose `info` traces in production to prevent terminal/browser console flooding.
 */

// LogLevel is not currently used since the logger exposes explicit functions

const formatMessage = (namespace: string, message: string) => `[${namespace}] ${message}`;

export const logger = {
    info: (namespace: string, message: string, ...args: unknown[]) => {
        if (process.env.NODE_ENV !== "production") {
            console.log(formatMessage(namespace, message), ...args);
        }
    },
    warn: (namespace: string, message: string, ...args: unknown[]) => {
        console.warn(formatMessage(namespace, message), ...args);
    },
    error: (namespace: string, message: string, ...args: unknown[]) => {
        console.error(formatMessage(namespace, message), ...args);
    },
    debug: (namespace: string, message: string, ...args: unknown[]) => {
        if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
            console.debug(formatMessage(namespace, message), ...args);
        }
    }
};
