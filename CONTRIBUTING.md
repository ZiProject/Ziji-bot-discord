# Contributing to Ziji Bot

Thank you for your interest in contributing to Ziji Bot. This guide covers the project setup, contribution workflow, and checks to
run before opening a pull request.

## Code of Conduct

Participation in this project is covered by our [Code of Conduct](CODE_OF_CONDUCT.md). Please report concerns privately to a
maintainer through the [Discord support server](https://discord.gg/wbhBExpMNj).

## Getting Started

### Prerequisites

- Node.js 24.x (the version used by the test workflow)
- npm
- A Discord application and bot token for running the bot locally
- MongoDB is optional; the bot can fall back to SQLite or its in-memory database

### Setup

```bash
git clone https://github.com/ZiProject/Ziji-bot-discord.git
cd Ziji-bot-discord
npm install
```

Copy `.env.example` to `.env` and `config.js.example` to `config.js`. Add the required Discord `TOKEN` to `.env`. Configure
`MONGO` if you want to use MongoDB; include a database name in the connection URI. Keep `.env` and `config.js` local and never
include tokens, credentials, or other secrets in issues, logs, or pull requests.

Start the bot in development mode with:

```bash
npm run dev
```

See [AGENTS.md](AGENTS.md) for the architecture, module conventions, and additional project commands.

## Project Structure

| Directory     | Purpose                                                          |
| ------------- | ---------------------------------------------------------------- |
| `commands/`   | Slash, context-menu, and message commands, organized by category |
| `events/`     | Discord client, process, console, and player event handlers      |
| `extensions/` | Modules that run during startup                                  |
| `functions/`  | Button, modal, select-menu, and other interaction handlers       |
| `lang/`       | Language modules                                                 |
| `startup/`    | Startup sequence, module loading, and persistence                |
| `test/`       | Node.js test suite                                               |
| `utility/`    | Utility modules, including canvas generators                     |
| `utils/`      | Shared helper functions                                          |

Modules are discovered by the loader. Add a module in the appropriate directory, follow the examples and metadata requirements in
[AGENTS.md](AGENTS.md), and do not add manual registration unless the existing module pattern requires it.

## Development Checks

Run the tests and formatting check before submitting changes:

```bash
npm test
npm run check
```

If `npm run check` reports formatting issues, run `npm run format` and review the resulting diff. If a change needs Discord or
database services to verify manually, describe what you tested and what could not be run in the pull request.

## Commit and Pull Request Guidelines

Keep each pull request focused on one change. Before opening it:

- Run `npm test` and `npm run check`.
- Update relevant documentation when behavior or setup instructions change.
- Remove secrets, local configuration, and generated files from the proposed diff.
- Fill out the repository's [pull request template](.github/PULL_REQUEST_TEMPLATE.md).

Use a concise commit message describing the change. Conventional prefixes such as `feat:`, `fix:`, `refactor:`, `docs:`, and
`chore:` are welcome.

## Reporting Bugs

Open a [bug report](.github/ISSUE_TEMPLATE/bug_report.md) and include:

- Steps to reproduce the issue
- Expected and actual behavior
- Node.js version and relevant environment details
- Relevant error messages or logs, with credentials and personal information removed

## Requesting Features

Open a [feature request](.github/ISSUE_TEMPLATE/feature_request.md). Explain the problem the feature would solve and include
examples or context that could help evaluate the request.

For questions, use the [Discord support server](https://discord.gg/wbhBExpMNj).
