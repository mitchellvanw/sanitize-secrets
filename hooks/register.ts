import type { Register } from 'claude-code'
import { redactBlock, redactDeep, secretKinds, withhold } from './patterns'

export const register: Register = on => {
  // A tool's answer, before the model reads it and before the transcript keeps its structured record.
  on('tool.call', async ($, e, next) => {
    if (e.tool === 'Bash') {
      const kinds = secretKinds(e.command)

      // A command that holds a key would send it somewhere or write it down, so it does not run.
      if (kinds.length > 0) {
        $.ui.toast(`Blocked a Bash command holding a ${kinds[0]}`)
        return {
          deny: `${$.plugin.name}: the command holds what looks like a ${kinds[0]}, so it did not run. Leave the value out of the command.`,
        }
      }
    }

    const ran = await next(e)

    if (ran.deny !== undefined) return ran

    const kinds: string[] = []
    const answer = {
      ...ran,
      text: redactDeep(ran.text, kinds) as typeof ran.text,
      result: redactDeep(ran.result, kinds) as typeof ran.result,
    }

    if (kinds.length > 0) {
      $.ui.toast(`Redacted ${kinds.length} secret${kinds.length === 1 ? '' : 's'} from ${e.tool}: ${kinds.join(', ')}`)
    }

    return answer
  }).catch($ => ({ deny: `${$.plugin.name}: its check failed, so this call's result is withheld.` }))

  // The rows the model reads and the transcript keeps: what the person typed, and any tool result the hook above did not reach.
  for (const door of ['tool-result', 'prompt'] as const) {
    on('session.append', { door }, ($, e, next) => {
      const kinds: string[] = []
      const content = e.message.content.map(block => redactBlock(block, kinds))

      if (kinds.length === 0) return next(e)

      $.ui.toast(`Redacted ${kinds.length} secret${kinds.length === 1 ? '' : 's'}: ${kinds.join(', ')}`)
      return next({ ...e, message: { ...e.message, content } })
    }).catch(($, e, next) =>
      // The check failed before it could read the row, so the row keeps nothing it did not read.
      next.called ? next(e) : next({ ...e, message: { ...e.message, content: e.message.content.map(withhold) } }),
    )
  }
}
