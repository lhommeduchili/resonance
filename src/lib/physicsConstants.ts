/**
 * Physics and audio constants for the Resonance simulation field.
 * Extracted from usePhysicsEngine and useSpatialAudio to eliminate magic numbers
 * and provide a single tuning surface.
 */

// ---------------------------------------------------------------------------
// Simulation field dynamics
// ---------------------------------------------------------------------------

/** Gravity multiplier — controls how strongly broadcast nodes attract particles */
export const GRAVITY_MULTIPLIER = 1.0;

/** Anti-monopoly outward pressure — prevents single-node dominance */
export const ANTI_MONOPOLY_REPULSION = 1000.0;

/** Speed of spin-wave information transfer between nearby agents */
export const SPIN_WAVE_SPEED = 0.02;

/** Spin dampening factor (0–1). Higher = more inertia, slower alignment */
export const SPIN_INERTIA = 0.9;

/** Spatial movement friction. Very high drag for a dense-fluid feel */
export const SPATIAL_FRICTION = 0.5;

/** Maximum distance for spin-wave propagation between agents (px) */
export const INTERACTION_RADIUS = 150;

// ---------------------------------------------------------------------------
// Node rendering
// ---------------------------------------------------------------------------

/** Base radius of the outer broadcast halo (px) */
export const OUTER_HALO_RADIUS = 60;

// ---------------------------------------------------------------------------
// User interaction forces
// ---------------------------------------------------------------------------

/** Spring constant when the user's node is anchored (to a point or broadcast) */
export const ANCHOR_SPRING = 0.03;

/** Spring constant when the user's node is free (following cursor) */
export const FREE_SPRING = 0.015;

// ---------------------------------------------------------------------------
// Spatial audio
// ---------------------------------------------------------------------------

/** Maximum distance (px) at which ambient audio is still audible */
export const MAX_AUDIO_DISTANCE = 600;

/** Low-pass filter cap (Hz) for ambient (non-active) listening */
export const AMBIENT_LOWPASS_CAP = 800;

/** Low-pass filter minimum (Hz) at maximum distance */
export const MIN_LOWPASS_FREQ = 150;

/** Full-spectrum cap (Hz) for active listening */
export const ACTIVE_LOWPASS_CAP = 20000;
