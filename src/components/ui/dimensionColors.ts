// Shared color identity for the 5 rubric dimensions -- used by ScoreCard,
// WeightControls and RadarChart so a dimension always reads the same color
// everywhere on screen.
export const DIM_COLOR: Record<string, string> = {
  market_opportunity: "#22D3EE",
  legality: "#9B8CFF",
  licence: "#34D399",
  fx_custody: "#F5A623",
  clarity: "#7DD3FC",
};

/** Public-data screen tag colour: distinct from the verdict colours, "your entry" violet and the cyan of the score-new row. */
export const SCREEN_COLOR = "#FB923C";
