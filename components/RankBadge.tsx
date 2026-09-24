import { RankIconOption } from "@/lib/rankTiers";

// Größer als früher (v.a. "xs"), damit das Icon als kleines Abzeichen auf
// einem Profilbild noch klar erkennbar bleibt statt nur ein winziger,
// verschwommener Punkt zu sein.
const SIZES = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-lg",
};

export default function RankBadge({
  option,
  size = "md",
}: {
  option: RankIconOption | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  if (!option) return null;

  const subTier = option.kind === "sport" ? option.label.split(" ").pop() : null;
  const isElite = option.kind === "elite";

  return (
    <span
      title={option.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-display font-bold leading-none shadow-md ${
        SIZES[size]
      } ${isElite ? "animate-elite-glow" : ""}`}
      style={{
        background: `linear-gradient(135deg, ${option.colorFrom}, ${option.colorTo})`,
        color: option.colorText,
      }}
    >
      {option.icon}
      {option.kind === "sport" && subTier && size !== "xs" && (
        <span className="ml-0.5 text-[0.65em]">{subTier}</span>
      )}
    </span>
  );
}
