import { expect, test } from 'claude-code/testing'
import { redact, redactBlock, redactDeep, secretKinds } from './patterns'

// Built from parts, so this file holds no whole key for a secret scanner to flag.
const GITHUB = 'ghp_' + 'a'.repeat(36)
const AWS = 'AKIA' + 'B'.repeat(16)
const ANTHROPIC = 'sk-ant-' + 'c'.repeat(30)

test('a token is replaced by its kind', () => {
  expect(redact(`token ${GITHUB} here`)).toBe('token [redacted: GitHub token] here')
})

test('each secret in one text is named, in order', () => {
  expect(secretKinds(`${AWS} and ${ANTHROPIC}`)).toEqual(['AWS access key', 'API key'])
})

test('a word that starts like a key prefix is left alone', () => {
  const text = 'task-management and the ghost_town_plan'

  expect(redact(text)).toBe(text)
})

test('a private key block is replaced whole', () => {
  const pem = ['-----BEGIN RSA ' + 'PRIVATE KEY-----', 'MIIB', '-----END RSA ' + 'PRIVATE KEY-----'].join('\n')

  expect(redact(`key:\n${pem}\nend`)).toBe('key:\n[redacted: private key]\nend')
})

test('an unsigned JWT, which ends in a dot, is replaced whole', () => {
  const unsigned = 'eyJ' + 'h'.repeat(20) + '.' + 'p'.repeat(20) + '.'

  expect(redact(`token ${unsigned} here`)).toBe('token [redacted: JSON Web Token] here')
})

test('a JWT whose signature ends in a dash is replaced whole', () => {
  const jwt = 'eyJ' + 'h'.repeat(20) + '.' + 'p'.repeat(20) + '.' + 's'.repeat(20) + '-'

  expect(redact(`token ${jwt} here`)).toBe('token [redacted: JSON Web Token] here')
})

test('a five-part JWE is replaced whole, with or without an empty key part', () => {
  const jwe = ['eyJ' + 'h'.repeat(20), 'k'.repeat(20), 'i'.repeat(12), 'c'.repeat(24), 't'.repeat(16)]
  const direct = ['eyJ' + 'h'.repeat(20), '', 'i'.repeat(12), 'c'.repeat(24), 't'.repeat(16)]

  expect(redact(jwe.join('.'))).toBe('[redacted: JSON Web Token]')
  expect(redact(direct.join('.'))).toBe('[redacted: JSON Web Token]')
})

test('an eyJ word with no long header is left alone', () => {
  const text = 'eyJ.short.part and eyes.open.wide'

  expect(redact(text)).toBe(text)
})

test('a tool result keeps its id and its error flag', () => {
  const kinds: string[] = []
  const block = { type: 'tool_result', tool_use_id: 'toolu_1', is_error: true, content: `AWS ${AWS}` }

  expect(redactBlock(block, kinds)).toEqual({ ...block, content: 'AWS [redacted: AWS access key]' })
  expect(kinds).toEqual(['AWS access key'])
})

test('a tool result made of text blocks is redacted block by block', () => {
  const block = { type: 'tool_result', tool_use_id: 'toolu_2', content: [{ type: 'text', text: GITHUB }] }

  expect(redactBlock(block, [])).toEqual({
    ...block,
    content: [{ type: 'text', text: '[redacted: GitHub token]' }],
  })
})

test('a block that is neither text nor a tool result passes through', () => {
  const block = { type: 'image', source: { data: GITHUB } }

  expect(redactBlock(block, [])).toBe(block)
})

test('every string in a structured record is redacted, at any depth', () => {
  const kinds: string[] = []
  const record = { stdout: `out ${GITHUB}`, files: [{ path: 'a.txt', body: AWS }], exitCode: 0 }

  expect(redactDeep(record, kinds)).toEqual({
    stdout: 'out [redacted: GitHub token]',
    files: [{ path: 'a.txt', body: '[redacted: AWS access key]' }],
    exitCode: 0,
  })
  expect(kinds).toEqual(['GitHub token', 'AWS access key'])
})
