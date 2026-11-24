import stringWidth from "string-width"

// Structural types also let the model run independently of the TUI runtime.
export interface MapMessage {
  id: string
  role: "user" | "assistant"
  parentID?: string
  summary?: unknown
  time: { created: number; completed?: number }
}

export interface MapPart {
  type: string
  text?: string
  synthetic?: boolean
  ignored?: boolean
  filename?: string
}

export interface Question {
  id: string
  number: number
  text: string
  answer: string
}

export function plainText(text: string): string {
  return text
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "")
    .replace(/\r\n?/g, "\n")
}

function visibleText(parts: readonly MapPart[]): string {
  return parts
    .filter((part) => part.type === "text" && !part.synthetic && !part.ignored)
    .map((part) => plainText(part.text ?? ""))
    .join("\n\n")
    .trim()
}

export function buildQuestions(
  messages: readonly MapMessage[],
  parts: (id: string) => readonly MapPart[],
  revertID?: string,
): Question[] {
  const result: Question[] = []
  const byID = new Map<string, Question>()
  // OpenCode supplies messages in chronological order, including queued prompts.
  for (const message of messages) {
    if (message.id === revertID) break
    if (message.role === "user") {
      const text = visibleText(parts(message.id))
      // Synthetic compaction prompts must not appear as user questions.
      if (!text) continue
      const question = { id: message.id, number: result.length + 1, text, answer: "" }
      result.push(question)
      byID.set(message.id, question)
    } else if (!message.summary && message.parentID) {
      const question = byID.get(message.parentID)
      const text = visibleText(parts(message.id))
      if (question && text) question.answer += (question.answer ? "\n\n" : "") + text
    }
  }
  return result
}

const graphemes = new Intl.Segmenter("es", { granularity: "grapheme" })

export function truncate(text: string, width: number): string {
  const clean = plainText(text).replace(/\s+/g, " ").trim()
  if (stringWidth(clean) <= width) return clean
  let output = ""
  for (const { segment } of graphemes.segment(clean)) {
    if (stringWidth(output + segment) > Math.max(0, width - 1)) break
    output += segment
  }
  return output + "…"
}

/** Wrap by terminal columns, including CJK and emoji, rather than JS length. */
export function preview(text: string, width: number, count = 6): string[] {
  const lines: string[] = []
  let line = ""
  const clean = plainText(text).replace(/\t/g, "    ").trim()
  for (const { segment } of graphemes.segment(clean)) {
    if (segment === "\n") {
      lines.push(line)
      line = ""
    } else {
      if (line && stringWidth(line + segment) > width) {
        lines.push(line)
        line = ""
      }
      line += segment
    }
    if (lines.length > count) break
  }
  if (line) lines.push(line)
  const output = lines.slice(0, count)
  if (lines.length > count) output[count - 1] = truncate(output[count - 1] + " …", width)
  return output
}
