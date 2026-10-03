import { RankIconOption } from "@/lib/rankTiers";
import RankEmblem from "@/components/RankEmblem";

// Größen in Pixel. "xs" sitzt als kleines Abzeichen am Profilbild (Kopfzeile)
// und muss trotzdem noch klar erkennbar bleiben.
const SIZES = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
};

export default function RankBadge({
  option,
  size = "md",
}: {
  option: RankIconOption | null | undefined;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  if (!option) return null;
  const isElite = option.kind === "elite";

  return (
    <span title={option.label} className={`inline-flex shrink-0 ${isElite ? "animate-elite-glow-shape" : ""}`}>
      <RankEmblem
        rank={option.rank}
        sub={option.sub}
        sport={option.sport}
        elite={isElite}
        eliteIcon={option.icon}
        colors={{ from: option.colorFrom, to: option.colorTo, text: option.colorText }}
        size={SIZES[size]}
      />
    </span>
  );
}
