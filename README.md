# sanitize-secrets

A Claude Code mod that keeps API keys and tokens out of what the model reads and what the transcript keeps.

When a tool's answer or something you type holds a key in a known format, the key is replaced with `[redacted: <kind>]` before the model reads it or the transcript stores it. A Bash command the model writes with a key in it is denied, so it does not run. The mod makes no network requests and writes no files.

## What it checks

Known formats only, listed in `hooks/patterns.ts`: private key blocks, AWS access keys, GitHub tokens, `sk-` API keys (Anthropic and OpenAI), Stripe keys, Slack tokens, Google API keys, and JSON Web Tokens.

## What it covers

- A tool's text and its structured record, such as a Bash command's stdout, at any depth.
- Anything you type in a prompt.
- A Bash command the model writes with a key in it. The command is denied.

## What it does not cover

- **The model's own tool calls.** The transcript keeps a tool call's input as the model wrote it. A key the model types into a command stays in the transcript, even though the command does not run.
- **Other tools' inputs**, such as file writes and edits. Only Bash commands are checked.
- **Transcripts from before the mod was installed.**
- **The model's own replies.**
- **Keys in formats not on the list**, and values that do not look like a key.
- **Images and other non-text content.**

## When the check fails

If the check throws, the result is withheld rather than passed through.

## Where it runs

Per the mods documentation, hooks run in the terminal, the Desktop app's Code tab (not in WSL sessions), the VS Code chat panel, `claude -p`, the Agent SDK and Remote Control. Notices appear as toasts only where something draws, so `claude -p` shows none. Cloud sessions run the mod only when the plugin reaches them.

## Install

Requires Claude Code 2.1.275 or later. The repository is private, so you need read access to `mitchellvanw/sanitize-secrets` and git credentials for GitHub on this machine (an SSH key, or `gh auth login`).

In Claude Code:

```
/plugin install sanitize-secrets --marketplace mitchellvanw/sanitize-secrets
```

Or from a terminal:

```sh
claude plugin install sanitize-secrets --marketplace mitchellvanw/sanitize-secrets
```

This installs for you, in user scope. To try it for one session from a clone instead:

```sh
claude --plugin-dir /path/to/sanitize-secrets
```

## Develop

```sh
claude plugin validate .
claude plugin test .
```

The tests cover the patterns, the redaction of structured records, and the Bash deny. The rest of the wiring was checked with headless runs using fake keys.

Version 0.1.0.
