import { RankIconOption } from "@/lib/rankTiers";
import RankEmblem from "@/components/RankEmblem";

// Größen in Pixel. "2xs" und "xs" sitzen als kleines Abzeichen in der Ecke
// eines Profilbilds (Kopfzeile bzw. Profil/Spielerseite) – bewusst klein,
// damit Foto oder Buchstabe gut sichtbar bleiben. "profil" sitzt ebenfalls in
// der Ecke des großen Profilbilds (eigenes Profil, Spielerseite), aber
// im selben Verhältnis zum Bild wie oben in der Kopfzeile (15 px auf 40 px
// Bild -> 24 px auf 64 px Bild), damit es mit dem Bild mitwächst.
const SIZES = {
  "2xs": 15,
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  profil: 24,
};

export type RankBadgeSize = keyof typeof SIZES;

export default function RankBadge({
  option,
  size = "md",
}: {
  option: RankIconOption | null | undefined;
  size?: RankBadgeSize;
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
        prestige={option.prestige ?? 0}
      />
    </span>
  );
}
