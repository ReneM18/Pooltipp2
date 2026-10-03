import { RankIconOption } from "@/lib/rankTiers";
import RankEmblem from "@/components/RankEmblem";

// Größen in Pixel. "2xs" und "xs" sitzen als kleines Abzeichen in der Ecke
// eines Profilbilds (Kopfzeile bzw. Profil/Spielerseite) – bewusst klein,
// damit Foto oder Buchstabe gut sichtbar bleiben.
const SIZES = {
  "2xs": 15,
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
  size?: keyof typeof SIZES;
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
        unsterblich={option.kind === "unsterblich"}
        eliteIcon={option.icon}
        colors={{ from: option.colorFrom, to: option.colorTo, text: option.colorText }}
        size={SIZES[size]}
      />
    </span>
  );
}
