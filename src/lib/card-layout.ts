export type FaceDisplayMode = "tabs" | "inline" | "single";

/** Layouts where each face has its own image (separate front/back art). */
const DUAL_IMAGE_LAYOUTS = new Set(["transform", "modal_dfc", "battle"]);

/** Layouts where both faces share a single card image. */
const SHARED_IMAGE_LAYOUTS = new Set(["adventure", "split", "flip"]);

/**
 * Returns the display mode for a card's faces based on its Scryfall layout.
 *
 * - "tabs"   — dual-image layouts (transform, modal_dfc, battle): show face tabs
 * - "inline" — shared-image layouts (adventure, split, flip): show faces stacked
 * - "single" — normal and everything else: render as today
 */
export function getFaceDisplayMode(layout: string): FaceDisplayMode {
  if (DUAL_IMAGE_LAYOUTS.has(layout)) return "tabs";
  if (SHARED_IMAGE_LAYOUTS.has(layout)) return "inline";
  return "single";
}
