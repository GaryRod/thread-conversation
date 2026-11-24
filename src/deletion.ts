import type { MapMessage } from "./conversation"

/** Delete answers first and the question last, retaining unrelated turns. */
export function turnMessageIDs(messages: readonly MapMessage[], questionID: string): string[] {
  if (!messages.some((message) => message.id === questionID && message.role === "user")) return []
  return [
    ...messages.filter((message) => message.role === "assistant" && message.parentID === questionID)
      .map((message) => message.id).reverse(),
    questionID,
  ]
}

export class TurnDeletionError extends Error {
  constructor(public readonly deletedCount: number, cause: unknown) {
    super(`Se eliminaron ${deletedCount} mensajes antes del error.`, { cause })
  }
}

// OpenCode deletes one message per request; a turn is not an atomic operation.
export async function deleteTurn(ids: readonly string[], remove: (id: string) => Promise<boolean>): Promise<number> {
  let deletedCount = 0
  for (const id of ids) {
    try {
      if (!await remove(id)) throw new Error("El servidor no confirmó la eliminación.")
      deletedCount++
    } catch (error) {
      throw new TurnDeletionError(deletedCount, error)
    }
  }
  return deletedCount
}
