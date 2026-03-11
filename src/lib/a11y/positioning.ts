export function projectWorldToScreen(
  worldX: number,
  worldY: number,
  viewportWidth: number,
  viewportHeight: number,
  zoomScalar: number,
): { x: number; y: number } {
  return {
    x: (worldX - viewportWidth / 2) * zoomScalar + viewportWidth / 2,
    y: (worldY - viewportHeight / 2) * zoomScalar + viewportHeight / 2,
  };
}

export function clampOverlayPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  padding = 16,
): { x: number; y: number } {
  return {
    x: Math.max(padding, Math.min(width - padding, x)),
    y: Math.max(padding, Math.min(height - padding, y)),
  };
}
