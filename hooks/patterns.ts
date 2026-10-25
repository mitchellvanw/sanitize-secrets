// Known key and token formats. Each pattern starts at a word boundary, so an
// ordinary word such as "task-management" does not match.
const PATTERNS: readonly { kind: string; re: RegExp }[] = [
  { kind: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { kind: 'AWS access key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { kind: 'GitHub token', re: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g },
  { kind: 'API key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { kind: 'Stripe key', re: /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { kind: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { kind: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  // A JWT's header, then two to four more parts. Those parts may be empty: an unsigned token ends in '.', and a JWE has five.
  { kind: 'JSON Web Token', re: /\beyJ[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]*){2,4}/g },
]

export type Block = { type: string; [field: string]: unknown }

const WITHHELD = '[withheld: sanitize-secrets could not check this]'

// Replaces each secret in `text` with its kind, and records the kind in `kinds`.
export function redact(text: string, kinds: string[] = []): string {
  return PATTERNS.reduce(
    (out, { kind, re }) =>
      out.replace(re, () => {
        kinds.push(kind)
        return `[redacted: ${kind}]`
      }),
    text,
  )
}

// The kind of each secret `text` holds, one entry per match.
export function secretKinds(text: string): string[] {
  const kinds: string[] = []
  redact(text, kinds)
  return kinds
}

// A content block with its text redacted: a text block, or the text of a tool
// result, whether a string or the text blocks it holds. Other fields pass through.
export function redactBlock(block: Block, kinds: string[]): Block {
  if (block.type === 'text' && typeof block.text === 'string') {
    return { ...block, text: redact(block.text, kinds) }
  }

  if (block.type === 'tool_result') {
    const { content } = block

    if (typeof content === 'string') return { ...block, content: redact(content, kinds) }
    if (Array.isArray(content)) return { ...block, content: content.map(b => redactBlock(b as Block, kinds)) }
  }

  return block
}

// Every string in a value, at any depth, redacted: a tool's structured record has no fixed shape.
export function redactDeep(value: unknown, kinds: string[]): unknown {
  if (typeof value === 'string') return redact(value, kinds)
  if (Array.isArray(value)) return value.map(v => redactDeep(v, kinds))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, redactDeep(v, kinds)]))
  }

  return value
}

// The stand-in for a block the check could not read: its text, or a tool result's, replaced.
export function withhold(block: Block): Block {
  if (block.type === 'text') return { ...block, text: WITHHELD }
  if (block.type === 'tool_result') return { ...block, content: WITHHELD }

  return block
}
