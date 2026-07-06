// Converts client (screen) coordinates → SVG user-unit coordinates.
// The game SVG uses viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice"
// inside a container that may be smaller/larger than 390×844 CSS pixels.

const VB_W = 390
const VB_H = 844

export function screenToSvg(clientX, clientY, containerEl) {
  const rect  = containerEl.getBoundingClientRect()
  const cw    = rect.width
  const ch    = rect.height
  // "slice" scales uniformly so the SVG covers the container, cropping excess
  const scale = Math.max(cw / VB_W, ch / VB_H)
  // How much of the SVG is hidden (centered clip)
  const offsetX = (VB_W * scale - cw) / 2
  const offsetY = (VB_H * scale - ch) / 2
  return {
    x: (clientX - rect.left  + offsetX) / scale,
    y: (clientY - rect.top   + offsetY) / scale,
  }
}
