// Shared colour identity for the 5 rubric dimensions -- used by ScoreCard,
// WeightControls, RadarChart and CompareView so a dimension always reads the
// same colour everywhere. Five muted hues that also differ in lightness, so
// they stay distinguishable in greyscale print.
export const DIM_COLOR: Record<string, string> = {
  market_opportunity: "#1F5FA8",
  legality: "#7A4FB0",
  licence: "#1E7A4C",
  fx_custody: "#9A4A16",
  clarity: "#4A7A8C",
};

/** Public-data screen tag colour: the shortlist tone, since a screen is at best a shortlist signal. */
export const SCREEN_COLOR = "#8A5A00";

/** Chart chrome on white. */
export const GRID = "#E4DDD0";
export const INK = "#1C1A17";
export const INK_2 = "#4A453E";
export const MUTED = "#6B645A";
