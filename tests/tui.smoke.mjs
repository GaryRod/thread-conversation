// Run with Bun and the browser condition so Solid uses its reactive runtime.
import assert from "node:assert/strict"
import { RGBA } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { createElement, insert, render, setProp } from "@opentui/solid"
import { createSignal } from "solid-js"
import plugin from "../dist/tui.js"

const screen = await createTestRenderer({ width: 100, height: 36 })
const cleanup = []
let contribution
let history
let promptProps
let selectProps
let commands
let confirmProps
const notices = []
const requests = []
const [status, setStatus] = createSignal({ type: "idle" })
const [messages, setMessages] = createSignal([
  { id: "q1", role: "user", time: { created: 0 } },
  { id: "a1", role: "assistant", parentID: "q1", time: { created: 1 } },
  { id: "a1b", role: "assistant", parentID: "q1", time: { created: 1 } },
  { id: "q2", role: "user", time: { created: 2 } },
  { id: "a2", role: "assistant", parentID: "q2", time: { created: 3 } },
])
const [dialog, setDialog] = createSignal()
const [answer, setAnswer] = createSignal("Línea uno\nLínea dos\nLínea tres\nLínea cuatro\nLínea cinco\nLínea seis\nLínea siete")
const color = RGBA.fromHex("#eeeeee")
const theme = { current: new Proxy({}, { get: (_target, name) =>
  String(name).startsWith("background") ? RGBA.fromHex("#222222") : color }) }
const element = (tag, props = {}, children = []) => {
  const node = createElement(tag)
  for (const [key, value] of Object.entries(props)) setProp(node, key, value)
  insert(node, children)
  return node
}
const api = {
  renderer: screen.renderer, theme,
  route: { current: { name: "session", params: { sessionID: "session-test" } } },
  kv: { get: (_key, fallback) => fallback, set() {} },
  state: {
    session: {
      get: () => ({ id: "session-test", directory: "C:/fixture", workspaceID: "workspace-test" }),
      messages,
      status,
    },
    part: (id) => id === "a1b" ? [{ type: "tool" }] : [{ type: "text", text: ({ q1: "Mi primera consulta", q2: "Mi segunda consulta",
      a2: "Segunda respuesta\nSegunda dos\nSegunda tres\nSegunda cuatro\nSegunda cinco\nSegunda seis\nSegunda siete" })[id] ?? answer() }],
  },
  ui: {
    toast(value) { notices.push(value) },
    dialog: { clear() { setDialog(undefined) }, setSize() {}, replace(factory) { setDialog(() => factory) } },
    // OpenCode 1.18.35 renders option.footer INSIDE <text>, not a box.
    // Keep this constraint in the fixture to catch invalid JSX in that field.
    DialogSelect(props) {
      selectProps = props
      return element("box", {}, [
        element("text", { content: props.title }),
        ...props.options.map((option) => element("box", {}, [
          element("text", { content: option.title }),
          element("text", {}, [option.footer]),
        ])),
      ])
    },
    DialogConfirm(props) {
      confirmProps = props
      return element("box", {}, [
        element("text", { content: props.title }),
        element("text", { content: props.message }),
      ])
    },
    Prompt(props) { promptProps = props; return element("text", { content: "Escribe aquí" }) },
    Slot: () => null,
  },
  client: { session: { async deleteMessage(parameters, options) {
    requests.push(parameters)
    assert.equal(options.throwOnError, true)
    assert.equal(parameters.sessionID, "session-test")
    assert.equal(parameters.directory, "C:/fixture")
    assert.equal(parameters.workspace, "workspace-test")
    setMessages((items) => items.filter((item) => item.id !== parameters.messageID))
    return { data: true }
  } } },
  keymap: { registerLayer(layer) { commands = layer.commands; return () => {} } },
  slots: { register(value) { contribution = value.slots.session_prompt } },
  lifecycle: { onDispose(fn) { cleanup.push(fn) } },
}

try {
  await plugin.tui(api)
  const onSubmit = () => {}
  let receivedRef
  const promptRef = (value) => { receivedRef = value }
  await render(() => {
    history = element("scrollbox", { height: 20, scrollX: false }, [
      element("text", { id: "q1", content: "Pregunta original", height: 1 }),
      element("text", { content: Array.from({ length: 50 }, (_, i) => `Historial ${i}`).join("\n") }),
    ])
    return element("box", { flexDirection: "column", width: "100%", height: "100%" }, [
      history,
      contribution({ theme }, { session_id: "session-test", visible: true,
        disabled: false, on_submit: onSubmit, ref: promptRef }),
      element("box", { position: "absolute", top: 0, left: 0, width: "100%",
        backgroundColor: theme.current.backgroundPanel, zIndex: 200 }, [() => dialog()?.()]),
    ])
  }, screen.renderer)
  await screen.flush()
  assert.equal(promptProps.onSubmit, onSubmit)
  promptProps.ref("ref-test")
  assert.equal(receivedRef, "ref-test")
  let frame = screen.captureCharFrame()
  assert.match(frame, /Tus preguntas · 2/)
  assert.match(frame, /01  Mi primera consulta/)
  assert.match(frame, /Escribe aquí/)
  const row = frame.split("\n").findIndex((line) => line.includes("01  Mi primera consulta"))
  await screen.mockMouse.moveTo(4, row)
  await new Promise((resolve) => setTimeout(resolve, 300))
  await screen.flush()
  frame = screen.captureCharFrame()
  assert.match(frame, /Respuesta del agente/)
  assert.match(frame, /Línea uno/)
  assert.match(frame, /Línea seis/)
  assert.doesNotMatch(frame, /Línea siete/)

  setAnswer("Respuesta actualizada\n2\n3\n4\n5\n6\n7")
  await screen.flush()
  assert.match(screen.captureCharFrame(), /Respuesta actualizada/)

  await screen.mockMouse.moveTo(95, 34)
  await screen.flush()
  assert.doesNotMatch(screen.captureCharFrame(), /Respuesta del agente/)
  history.scrollTo(45)
  await screen.flush()
  assert.ok(history.scrollTop > 0)
  await screen.mockMouse.click(4, row)
  await screen.flush()
  assert.equal(history.scrollTop, 0, "el clic debe desplazar la conversación hasta la pregunta")

  screen.resize(70, 30)
  await screen.flush()
  assert.match(screen.captureCharFrame(), /Tus preguntas/)
  const open = commands.find((command) => command.slashName === "mapa")
  assert.ok(open, "debe registrar /mapa")
  open.run()
  await screen.flush()
  frame = screen.captureCharFrame()
  assert.match(frame, /Mapa de tus preguntas/)
  assert.match(frame, /Segunda respuesta/)
  assert.match(frame, /Segunda seis/)
  assert.doesNotMatch(frame, /Segunda siete/)
  selectProps.onMove(selectProps.options[0])
  await screen.flush()
  assert.match(screen.captureCharFrame(), /Respuesta actualizada/)
  assert.doesNotMatch(screen.captureCharFrame(), /Segunda respuesta/)
  history.scrollTo(45)
  selectProps.onSelect(selectProps.options[0])
  await screen.flush()
  assert.equal(history.scrollTop, 0)
  assert.doesNotMatch(screen.captureCharFrame(), /Mapa de tus preguntas/)
  const deleteCommand = commands.find((command) => command.slashName === "mapa-eliminar")
  assert.ok(deleteCommand)
  deleteCommand.run()
  await screen.flush()
  assert.match(screen.captureCharFrame(), /Elegir pregunta para eliminar/)
  selectProps.onSelect(selectProps.options[0])
  await screen.flush()
  assert.match(confirmProps.message, /2 mensaje\(s\) del agente/)
  assert.match(confirmProps.message, /Mi primera consulta/)
  assert.equal(requests.length, 0, "no debe borrar antes de confirmar")
  api.ui.dialog.clear() // Simulates Escape/cancel.
  await screen.flush()
  assert.equal(requests.length, 0, "cancelar no debe borrar")

  deleteCommand.run()
  await screen.flush()
  setStatus({ type: "busy" })
  selectProps.onSelect(selectProps.options[0])
  assert.equal(notices.at(-1).variant, "warning")
  assert.equal(requests.length, 0)
  setStatus({ type: "idle" })
  selectProps.onSelect(selectProps.options[0])
  await screen.flush()
  setStatus({ type: "busy" })
  confirmProps.onConfirm()
  assert.equal(requests.length, 0, "debe volver a comprobar el estado al confirmar")
  setStatus({ type: "idle" })
  confirmProps.onConfirm()
  confirmProps.onConfirm() // Double clicks must not duplicate requests.
  api.ui.dialog.clear()
  await screen.waitFor(() => notices.some((notice) => notice.variant === "success"))
  await screen.flush()
  assert.deepEqual(requests.map((request) => request.messageID), ["a1b", "a1", "q1"])
  assert.deepEqual(messages().map((item) => item.id), ["q2", "a2"])
  assert.match(screen.captureCharFrame(), /Tus preguntas · 1/)
  assert.doesNotMatch(screen.captureCharFrame(), /Mi primera consulta/)
  assert.ok(!notices.some((notice) => notice.variant === "error"))
  console.log("TUI OK: mapa, hover, /mapa, navegación y borrado confirmado; conserva otros turnos y respeta cancelar/estado ocupado/doble clic.")
} finally {
  for (const dispose of cleanup) await dispose()
  screen.renderer.destroy()
}
