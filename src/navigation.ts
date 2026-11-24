// OpenCode 1.18.35 does not expose scroll-to-message in its public plugin API.
// This adapter follows its own session timeline: message renderables have the
// message ID, and are direct children of the conversation ScrollBox.
// Source: packages/tui/src/routes/session/index.tsx at tag v1.18.35.
export interface VisualNode {
  id: string
  y: number
  isDestroyed?: boolean
  getChildren(): VisualNode[]
  scrollBy?: (delta: number) => void
}

export function jumpToMessage(root: VisualNode, messageID: string): boolean {
  const pending = [root]
  const visited = new Set<VisualNode>()
  while (pending.length) {
    const node = pending.pop()!
    if (visited.has(node) || node.isDestroyed) continue
    visited.add(node)
    const children = node.getChildren()
    if (typeof node.scrollBy === "function") {
      const message = children.find((child) => child.id === messageID)
      if (message) {
        node.scrollBy(message.y - node.y - 1)
        return true
      }
    }
    pending.push(...children)
  }
  return false
}
