import { expect, test } from 'claude-code/testing'

// Built from parts, so this file holds no whole key for a secret scanner to flag.
const GITHUB = 'ghp_' + 'a'.repeat(36)

test('a Bash command holding a token is denied', async ($, on) => {
  // Stands in for the engine beneath the plugin: a call that gets this far would run.
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const answer = await $.tool.call({ tool: 'Bash', command: `echo ${GITHUB}` })

  expect(answer.deny).toContain('did not run')
})

test('a Bash command with no secret runs', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const answer = await $.tool.call({ tool: 'Bash', command: 'ls' })

  expect(answer.deny).toBeUndefined()
})

test("a tool's structured record is redacted, not only its text", async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: { stdout: GITHUB, stderr: '' }, text: GITHUB }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const answer = await $.tool.call({ tool: 'Bash', command: 'printf x' })

  expect(answer.result).toEqual({ stdout: '[redacted: GitHub token]', stderr: '' })
  expect(answer.text).toBe('[redacted: GitHub token]')
})

test('a typed prompt is redacted before the history and the queue record keep it', async ($, on) => {
  const arrived: string[] = []
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => {
    arrived.push(e.text)
    return { text: e.text }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  await $.prompt.submit({ text: `my token is ${GITHUB}`, origin: { kind: 'composer' }, wait: false })

  expect(arrived).toEqual(['my token is [redacted: GitHub token]'])
})

test("a slash command's arguments are redacted before it runs", async ($, on) => {
  const arrived: string[] = []
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', (_, e) => {
    arrived.push(e.args)
    return { text: '' }
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  await $.command.run({
    command: 'note',
    args: `remember ${GITHUB}`,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })

  expect(arrived).toEqual(['remember [redacted: GitHub token]'])
})
