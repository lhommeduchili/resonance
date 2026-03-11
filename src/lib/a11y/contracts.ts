export type NodeSemanticSnapshot = {
  id: string;
  label: string;
  listeners: number;
  energy: number;
  x: number;
  y: number;
  isTuned: boolean;
};

export type LiveAnnouncement = {
  id: string;
  message: string;
  priority: "polite" | "assertive";
};
