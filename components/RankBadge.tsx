import { RankIconOption } from "@/lib/rankTiers";

const SIZES = {
  xs: "h-4 w-4 text-[8px]",
  sm: "h-6 w-6 text-[10px]",
  md: "h-8 w-8 text-xs",
  lg: "h-11 w-11 text-base",
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

  return (
    <span
      title={option.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-display font-bold leading-none shadow-sm ${SIZES[size]}`}
      style={{
        background: `linear-gradient(135deg, ${option.colorFrom}, ${option.colorTo})`,
        color: option.colorText,
        boxShadow: option.kind === "elite" ? `0 0 10px ${option.colorFrom}80` : undefined,
      }}
    >
      {option.icon}
      {option.kind === "sport" && subTier && size !== "xs" && (
        <span className="ml-0.5 text-[0.65em]">{subTier}</span>
      )}
    </span>
  );
}
