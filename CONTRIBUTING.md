# Contributing to SkillDeck

First off, thank you for considering contributing to SkillDeck! It's people like you that make SkillDeck such a great tool. We welcome contributions of all kinds – not just code – including documentation, bug reports, feature suggestions, and community support.

## Code of Conduct

This project and everyone participating in it is governed by the [SkillDeck Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [conduct@skilldeck.dev](mailto:conduct@skilldeck.dev).

## How Can I Contribute?

### Reporting Bugs

- **Ensure the bug was not already reported** by searching on GitHub under [Issues](https://github.com/skilldeck/skilldeck/issues).
- If you're unable to find an open issue addressing the problem, [open a new one](https://github.com/skilldeck/skilldeck/issues/new). Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample** or an **executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

- Open a new issue with a clear title and detailed description.
- Explain why this enhancement would be useful to most SkillDeck users.
- If you're proposing a new feature, you may want to read the [Vision Document](https://github.com/skilldeck/skilldeck/blob/main/docs/VISION.md) first to understand the project's goals.

### Your First Code Contribution

Unsure where to begin? You can start by looking through `help-wanted` and `good-first-issue` issues:

- [Good first issues](https://github.com/skilldeck/skilldeck/labels/good%20first%20issue) – small changes ideal for newcomers.
- [Help wanted issues](https://github.com/skilldeck/skilldeck/labels/help%20wanted) – a bit more involved.

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints (Rustfmt, Clippy, ESLint, Prettier).
6. Issue that pull request!

## Development Setup

### Prerequisites

- **Rust** (latest stable) – install via [rustup](https://rustup.rs/)
- **Node.js** (v20 or later) – install via [nvm](https://github.com/nvm-sh/nvm) or from [nodejs.org](https://nodejs.org/)
- **Tauri CLI** – `cargo install tauri-cli`
- **pnpm** (package manager) – `npm install -g pnpm`

### Building and Running

1. Clone the repository:
   ```bash
   git clone https://github.com/skilldeck/skilldeck.git
   cd skilldeck
   ```

2. Install frontend dependencies:
   ```bash
   pnpm install
   ```

3. Run in development mode:
   ```bash
   pnpm tauri dev
   ```

This will start the Rust backend and the Vite dev server, and open the Tauri window.

### Running Tests

- **Rust unit tests**: `cargo test --workspace`
- **Rust integration tests**: `cargo test --test integration`
- **React component tests**: `pnpm test`
- **End-to-end tests**: (coming soon)

### Coding Style

- **Rust**: We use `rustfmt` and `clippy`. Run `cargo fmt` and `cargo clippy` before committing.
- **TypeScript/React**: We use ESLint and Prettier. Run `pnpm lint` and `pnpm format`.

### Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for an overview of the codebase organization.

## Community

- **Discord**: [Join our Discord server](https://discord.gg/skilldeck) for real-time chat.
- **GitHub Discussions**: Use [Discussions](https://github.com/skilldeck/skilldeck/discussions) for questions, ideas, and general conversation.

Thank you for contributing! 🚀
