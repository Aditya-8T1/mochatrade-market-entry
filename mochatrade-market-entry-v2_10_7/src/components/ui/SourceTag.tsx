// Reusable badge for src/engine SourceType provenance. Used everywhere a
// figure or claim appears in the UI so a judge can tell fact from estimate
// at a glance -- see docs/SPEC.md section F.8.
import type { ReactElement } from "react";
import type { SourceType } from "../../engine/types";

const CONFIG: Record<SourceType, { label: string; dot: string; text: string; title: string }> = {
  verified_fact: {
    label: "Verified",
    dot: "bg-now",
    text: "text-now",
    title: "A regulator, exchange or central-bank rule or figure, dated to a primary source.",
  },
  calculated: {
    label: "Calculated",
    dot: "bg-next",
    text: "text-coral-strong",
    title: "Computed from verified facts and the Round 1 rubric or deep-dive text.",
  },
  assumption: {
    label: "Assumption",
    dot: "bg-later",
    text: "text-later",
    title: "A stated working assumption -- e.g. partner availability or indicative FX.",
  },
  route_requires_confirmation: {
    label: "Route unconfirmed",
    dot: "bg-no",
    text: "text-no",
    title: "Flagged as not yet confirmed against MochaTrade's actual operating route.",
  },
  engine_reconstruction: {
    label: "Team estimate",
    dot: "bg-plum",
    text: "text-plum",
    title: "Not stated in Round 1 -- a team estimate so the tool can compute end to end.",
  },
};

export default function SourceTag({
  type,
  compact = false,
}: {
  type: SourceType;
  compact?: boolean;
}): ReactElement {
  const c = CONFIG[type];
  return (
    <span
      title={c.title}
      className={`inline-flex items-center gap-1.5 rounded-full border border-rule bg-surface px-2 py-[3px] text-[14px] ${c.text} ${
        compact ? "px-1.5" : ""
      }`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
      {!compact && c.label}
    </span>
  );
}
