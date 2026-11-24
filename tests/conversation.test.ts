import assert from "node:assert/strict"
import { test } from "node:test"
import stringWidth from "string-width"
import { buildQuestions, preview, truncate, type MapMessage, type MapPart } from "../src/conversation"
import { jumpToMessage, type VisualNode } from "../src/navigation"

const user = (id: string): MapMessage => ({ id, role: "user", time: { created: 0 } })
const agent = (id: string, parentID: string, summary = false): MapMessage =>
  ({ id, parentID, role: "assistant", summary, time: { created: 1 } })

test("asocia respuestas por parentID incluso con preguntas en cola y excluye herramientas y razonamiento", () => {
  const messages = [user("q1"), user("q2"), agent("a1", "q1"), agent("a2", "q2"), agent("a3", "q1")]
  const data: Record<string, MapPart[]> = {
    q1: [{ type: "text", text: "Primera pregunta" }],
    q2: [{ type: "text", text: "Segunda pregunta" }],
    a1: [{ type: "reasoning", text: "privado" }, { type: "tool" }, { type: "text", text: "Respuesta uno" }],
    a2: [{ type: "text", text: "Respuesta dos" }],
    a3: [{ type: "text", text: "Continuación" }],
  }
  const result = buildQuestions(messages, (id) => data[id] ?? [])
  assert.equal(result.length, 2)
  assert.equal(result[0].answer, "Respuesta uno\n\nContinuación")
  assert.equal(result[1].answer, "Respuesta dos")
})

test("oculta prompts sintéticos, resúmenes de compactación y mensajes revertidos", () => {
  const messages = [user("q1"), user("synthetic"), agent("summary", "q1", true), user("revert"), user("q3")]
  const result = buildQuestions(messages, (id) => [{ type: "text", text: id, synthetic: id === "synthetic" }], "revert")
  assert.deepEqual(result, [{ id: "q1", number: 1, text: "q1", answer: "" }])
})

test("la vista previa conserva seis líneas y marca texto adicional", () => {
  assert.deepEqual(preview("1\n2\n3\n4\n5\n6\n7", 20), ["1", "2", "3", "4", "5", "6 …"])
  assert.deepEqual(preview("Respuesta breve", 40), ["Respuesta breve"])
  assert.deepEqual(preview("a\nb\nc\nd\ne\nf", 20), ["a", "b", "c", "d", "e", "f"])
})

test("ajusta emoji y texto ancho a las columnas reales de la terminal", () => {
  const lines = preview("你好🙂你好🙂你好🙂你好🙂", 6)
  assert.ok(lines.every((line) => stringWidth(line) <= 6))
  assert.ok(stringWidth(truncate("Pregunta 👨‍👩‍👧‍👦 muy larga", 12)) <= 12)
  assert.equal(truncate("\x1b[31mHola\x1b[0m", 8), "Hola")
})

test("el salto usa la posición del mensaje dentro del scroll de conversación", () => {
  let delta: number | undefined
  const message: VisualNode = { id: "q1", y: 35, getChildren: () => [] }
  const scroll: VisualNode = { id: "history", y: 4, getChildren: () => [message], scrollBy: (n) => { delta = n } }
  const root: VisualNode = { id: "root", y: 0, getChildren: () => [scroll] }
  assert.equal(jumpToMessage(root, "q1"), true)
  assert.equal(delta, 30)
  assert.equal(jumpToMessage(root, "missing"), false)
})
