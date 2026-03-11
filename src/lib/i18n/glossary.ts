export const GLOSSARY = {
  flowEnergy: "Flow Energy",
  resonanceMarks: "resonance Marks",
  treasury: "Treasury",
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;
