import type { TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui"
import type { MouseEvent } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { buildQuestions, preview, truncate, type Question } from "./conversation"
import { jumpToMessage } from "./navigation"
import { deleteTurn, turnMessageIDs, TurnDeletionError } from "./deletion"

const ID = "mapa-conversacion"

function currentSession(api: TuiPluginApi): string | undefined {
  const route = api.route.current
  return route.name === "session" && typeof route.params?.sessionID === "string"
    ? route.params.sessionID : undefined
}

function questions(api: TuiPluginApi, sessionID: string): Question[] {
  return buildQuestions(api.state.session.messages(sessionID),
    (id) => api.state.part(id), api.state.session.get(sessionID)?.revert?.messageID)
}

function navigate(api: TuiPluginApi, sessionID: string, id: string) {
  if (currentSession(api) !== sessionID) return
  api.ui.dialog.clear()
  if (!jumpToMessage(api.renderer.root, id)) {
    api.ui.toast({ title: "Mapa de conversación",
      message: "No se encontró el mensaje en el historial visible. Prueba /timeline.", variant: "warning" })
  }
}

function MapPanel(props: { api: TuiPluginApi; sessionID: string; hide: () => void }) {
  const api = props.api
  const dimensions = useTerminalDimensions()
  const items = createMemo(() => questions(api, props.sessionID))
  const [hoverID, setHoverID] = createSignal<string>()
  const [selectedID, setSelectedID] = createSignal<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const active = createMemo(() => items().find((item) => item.id === hoverID()))
  const width = createMemo(() => Math.max(10, Math.min(76, dimensions().width - 12)))
  const rows = createMemo(() => Math.min(4, Math.max(1, items().length)))

  function cancelHover() {
    clearTimeout(timer)
    timer = undefined
    setHoverID(undefined)
  }

  function hover(id: string) {
    clearTimeout(timer)
    setHoverID(undefined)
    timer = setTimeout(() => setHoverID(id), 250)
  }

  onCleanup(() => clearTimeout(timer))
  createEffect(() => {
    props.sessionID
    cancelHover()
    setSelectedID(undefined)
  })

  return (
    <box flexShrink={0} flexDirection="column" marginBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={api.theme.current.accent}>{`Tus preguntas · ${items().length}`}</text>
        <text fg={api.theme.current.textMuted} onMouseUp={props.hide}>{"/mapa · ocultar [×]"}</text>
      </box>
      <scrollbox height={rows()} scrollX={false} stickyScroll stickyStart="bottom"
        verticalScrollbarOptions={{ visible: items().length > rows() }} onMouseScroll={cancelHover}>
        <Show when={items().length} fallback={<text fg={api.theme.current.textMuted}>Aún no hay preguntas.</text>}>
          <For each={items().map((item) => item.id)}>
            {(id) => {
              const item = createMemo(() => items().find((question) => question.id === id)!)
              return (
              <box height={1} flexShrink={0}
                backgroundColor={hoverID() === id || selectedID() === id
                  ? api.theme.current.backgroundElement : api.theme.current.backgroundPanel}
                onMouseOver={() => hover(id)} onMouseOut={cancelHover}
                onMouseUp={(event: MouseEvent) => {
                  if (event.button !== 0) return
                  event.stopPropagation()
                  cancelHover()
                  setSelectedID(id)
                  navigate(api, props.sessionID, id)
                }}>
                <text fg={api.theme.current.text} wrapMode="none" truncate>
                  {`${String(item().number).padStart(2, "0")}  ${truncate(item().text, Math.max(10, dimensions().width - 16))}`}
                </text>
              </box>
              )
            }}
          </For>
        </Show>
      </scrollbox>
      <Show when={active()}>
        {(item) => (
          <box position="absolute" bottom={rows() + 1} left={0} width={width() + 4} zIndex={100}
            border borderStyle="rounded" borderColor={api.theme.current.accent}
            backgroundColor={api.theme.current.backgroundMenu} paddingLeft={1} paddingRight={1}>
            <text fg={api.theme.current.accent}>{`Pregunta ${item().number}`}</text>
            <text fg={api.theme.current.textMuted}>{preview(item().text, width(), 2).join("\n")}</text>
            <text fg={api.theme.current.accent}>Respuesta del agente</text>
            <text fg={api.theme.current.text} minHeight={6}>
              {preview(item().answer || "Esperando respuesta…", width(), 6).join("\n")}
            </text>
            <text fg={api.theme.current.textMuted}>Clic en la pregunta para ir al mensaje</text>
          </box>
        )}
      </Show>
    </box>
  )
}

export default {
  id: ID,
  async tui(api) {
    const [visible, setVisible] = createSignal(api.kv.get(`${ID}.visible`, true))
    let deleting = false
    function toggle() {
      setVisible((value) => !value)
      api.kv.set(`${ID}.visible`, visible())
      api.ui.dialog.clear()
    }

    function confirmDelete(sessionID: string, question: Question) {
      if (deleting || currentSession(api) !== sessionID) return
      const status = api.state.session.status(sessionID)
      if (status && status.type !== "idle") {
        api.ui.toast({ message: "Espera a que el agente termine antes de eliminar mensajes.", variant: "warning" })
        return
      }
      const ids = turnMessageIDs(api.state.session.messages(sessionID), question.id)
      if (!ids.length) return
      const session = api.state.session.get(sessionID)
      api.ui.dialog.replace(() => (
        <api.ui.DialogConfirm title="Eliminar pregunta y respuesta"
          message={`Pregunta ${question.number}: ${truncate(question.text, 300)}\n\nSe eliminará esta pregunta y ${ids.length - 1} mensaje(s) del agente asociados a ella (${ids.length} en total).\n\nEl borrado es permanente. No revierte los cambios realizados en archivos. Los demás turnos se conservarán.`}
          onConfirm={() => { void remove() }} />
      ))

      async function remove() {
        if (deleting || currentSession(api) !== sessionID) return
        const status = api.state.session.status(sessionID)
        const currentIDs = turnMessageIDs(api.state.session.messages(sessionID), question.id)
        if ((status && status.type !== "idle") || currentIDs.join("\n") !== ids.join("\n")) {
          api.ui.toast({ message: "La conversación cambió. Vuelve a seleccionar la pregunta para eliminarla.", variant: "warning" })
          return
        }
        deleting = true
        try {
          const count = await deleteTurn(ids, async (messageID) => {
            const response = await api.client.session.deleteMessage({
              sessionID, messageID, directory: session?.directory, workspace: session?.workspaceID,
            }, { throwOnError: true })
            return response.data === true
          })
          api.ui.toast({ message: `Pregunta y respuesta eliminadas (${count} mensajes).`, variant: "success" })
        } catch (error) {
          const count = error instanceof TurnDeletionError ? error.deletedCount : 0
          api.ui.toast({ title: "No se pudo completar el borrado",
            message: count ? `Se eliminaron ${count} mensajes. El resto se conserva; revisa el mapa antes de reintentar.`
              : "No se eliminó ningún mensaje. Comprueba la conexión y que el agente esté inactivo.",
            variant: "error", duration: 7000 })
        } finally {
          deleting = false
        }
      }
    }

    function open(deleteMode = false) {
      const sessionID = currentSession(api)
      if (!sessionID) {
        api.ui.toast({ message: "Abre una conversación para ver el mapa.", variant: "info" })
        return
      }
      const width = Math.max(10, Math.min(68, api.renderer.width - 12))
      api.ui.dialog.setSize("large")
      api.ui.dialog.replace(() => {
        const items = createMemo(() => questions(api, sessionID))
        const initialID = items().at(-1)?.id
        const [selectedID, setSelectedID] = createSignal(initialID)
        const selected = createMemo(() => items().find((item) => item.id === selectedID()))
        return (
          <box flexDirection="column">
            <api.ui.DialogSelect title={deleteMode ? "Elegir pregunta para eliminar" : "Mapa de tus preguntas"} placeholder="Buscar una pregunta…"
              current={initialID}
              options={items().map((item) => ({
                title: `${item.number}. ${truncate(item.text, width)}`,
                description: item.text.replace(/\s+/g, " "), value: item.id,
              }))}
              onFilter={() => setSelectedID(undefined)}
              onMove={(option) => setSelectedID(option.value)}
              onSelect={(option) => {
                const question = items().find((item) => item.id === option.value)
                if (deleteMode && question) confirmDelete(sessionID, question)
                else navigate(api, sessionID, option.value)
              }} />
            {/* In 1.18.35 option.footer is inserted into <text>. Render the
                preview separately so no BoxRenderable becomes a text child. */}
            <box paddingLeft={4} paddingRight={4} paddingBottom={1}>
              <text fg={api.theme.current.accent}>Respuesta del agente</text>
              <text fg={api.theme.current.text} minHeight={6}>
                {preview(selected()?.answer || (items().length ? "Esperando respuesta…" : "Aún no hay preguntas."), width, 6).join("\n")}
              </text>
              <Show when={selected()}>
                {(question) => (
                  <text fg={api.theme.current.error} marginTop={1}
                    onMouseUp={() => confirmDelete(sessionID, question())}>
                    Eliminar pregunta y respuesta…
                  </text>
                )}
              </Show>
              <text fg={api.theme.current.textMuted}>Para eliminar con teclado: /mapa-eliminar</text>
            </box>
          </box>
        )
      })
    }

    const unregister = api.keymap.registerLayer({
      commands: [
        { name: `${ID}.open`, namespace: "palette", title: "Mapa de preguntas: buscar y navegar",
          category: "Conversación", slashName: "mapa", run: () => open() },
        { name: `${ID}.delete`, namespace: "palette", title: "Mapa de preguntas: eliminar pregunta y respuesta",
          category: "Conversación", slashName: "mapa-eliminar", run: () => open(true) },
        { name: `${ID}.toggle`, namespace: "palette", title: "Mapa de preguntas: mostrar / ocultar",
          category: "Conversación", slashName: "mapa-toggle", run: toggle },
      ],
      bindings: [
        { key: "ctrl+alt+m", cmd: `${ID}.open` },
        { key: "ctrl+alt+h", cmd: `${ID}.toggle` },
      ],
    })
    api.lifecycle.onDispose(unregister)

    // In 1.18.35 this slot replaces the composer. Forward all host Prompt
    // properties and keep its right-hand extension slot intact.
    api.slots.register({
      slots: {
        session_prompt: (_context, props) => (
          <>
            <Show when={visible()}>
              <MapPanel api={api} sessionID={props.session_id} hide={toggle} />
            </Show>
            <api.ui.Prompt sessionID={props.session_id} visible={props.visible} disabled={props.disabled}
              onSubmit={props.on_submit} ref={props.ref}
              right={<api.ui.Slot name="session_prompt_right" session_id={props.session_id} />} />
          </>
        ),
      },
    })
  },
} satisfies TuiPluginModule
