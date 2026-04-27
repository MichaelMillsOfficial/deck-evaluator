import { Tag, type TagVariant } from "./Tag";

export type DeckRole =
  | "COMMANDER"
  | "ENGINE"
  | "WINCON"
  | "DRAW"
  | "RAMP"
  | "REMOVAL"
  | "INTERACTION"
  | "UTILITY";

const ROLE_VARIANT: Record<DeckRole, TagVariant> = {
  COMMANDER: "accent",
  ENGINE: "accent",
  WINCON: "accent",
  DRAW: "cyan",
  RAMP: "gold",
  REMOVAL: "warn",
  INTERACTION: "warn",
  UTILITY: "ghost",
};

export type CardTagProps = {
  role: DeckRole;
  className?: string;
};

export function CardTag({ role, className }: CardTagProps) {
  return (
    <Tag variant={ROLE_VARIANT[role]} className={className}>
      {role}
    </Tag>
  );
}
