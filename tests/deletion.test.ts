import assert from "node:assert/strict"
import { test } from "node:test"
import type { MapMessage } from "../src/conversation"
import { deleteTurn, turnMessageIDs, TurnDeletionError } from "../src/deletion"

const messages: MapMessage[] = [
  { id: "q1", role: "user", time: { created: 0 } },
  { id: "q2", role: "user", time: { created: 1 } },
  { id: "a1", role: "assistant", parentID: "q1", time: { created: 2 } },
  { id: "a2", role: "assistant", parentID: "q2", time: { created: 3 } },
  { id: "a3", role: "assistant", parentID: "q1", time: { created: 4 } },
]

test("el borrado agrupa por parentID y conserva otros turnos, incluso preguntas en cola", async () => {
  const remaining = new Set(messages.map((message) => message.id))
  const ids = turnMessageIDs(messages, "q1")
  assert.deepEqual(ids, ["a3", "a1", "q1"])
  assert.equal(await deleteTurn(ids, async (id) => remaining.delete(id)), 3)
  assert.deepEqual([...remaining], ["q2", "a2"])
})

test("permite eliminar una pregunta sin respuesta y rechaza IDs que no son preguntas", () => {
  assert.deepEqual(turnMessageIDs([messages[0]], "q1"), ["q1"])
  assert.deepEqual(turnMessageIDs(messages, "a1"), [])
  assert.deepEqual(turnMessageIDs(messages, "missing"), [])
})

test("un error parcial detiene el borrado antes de eliminar la pregunta", async () => {
  const requests: string[] = []
  await assert.rejects(deleteTurn(["a3", "a1", "q1"], async (id) => {
    requests.push(id)
    if (id === "a1") throw new Error("Conexión interrumpida")
    return true
  }), (error: unknown) => error instanceof TurnDeletionError && error.deletedCount === 1)
  assert.deepEqual(requests, ["a3", "a1"])
})

test("una respuesta negativa del servidor no se considera eliminación exitosa", async () => {
  await assert.rejects(deleteTurn(["q1"], async () => false),
    (error: unknown) => error instanceof TurnDeletionError && error.deletedCount === 0)
})
