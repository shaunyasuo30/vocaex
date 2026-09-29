type Anchor = Pick<DOMRect, "top" | "bottom" | "left">
type Size = { width: number; height: number }

export function floatingPosition(anchor: Anchor, panel: Size, viewport: Size, margin = 8) {
  const width = panel.width || 170
  const height = panel.height || 40
  const left = Math.max(margin, Math.min(viewport.width - width - margin, anchor.left))
  const below = anchor.bottom + margin
  const above = anchor.top - height - margin
  const preferredTop = below + height <= viewport.height - margin || above < margin ? below : above
  const top = Math.max(margin, Math.min(viewport.height - height - margin, preferredTop))
  return { top, left }
}
