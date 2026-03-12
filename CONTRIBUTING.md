# Contributing to SkillDeck

First off, thank you for considering contributing to SkillDeck! It's people like you that make SkillDeck such a great tool.

## 📜 Code of Conduct

This project and everyone participating in it is governed by our commitment to providing a welcoming and inspiring community for all. By participating, you are expected to uphold this code. Please report unacceptable behavior to [elcoosp@gmail.com](mailto:elcoosp@gmail.com).

## 🤔 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed and the behavior you expected**
* **Include screenshots or animated GIFs**
* **Include system details (OS, version)**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior and explain the behavior you expected**
* **Explain why this enhancement would be useful**

### Pull Requests

* Fill in the required template
* Do not include issue numbers in the PR title
* Include screenshots and animated GIFs in your pull request whenever possible
* Follow the style guidelines
* Follow the commit message convention

## 🛠️ Development Setup

### Prerequisites

* **Node.js 20+**
* **pnpm 9+**
* **Rust (latest stable)**
* **System Dependencies** (see [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))

### Installation

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/skilldeck.git
   cd skilldeck
   ```
3. **Install dependencies**:
   ```bash
   pnpm install
   ```
4. **Run the development server**:
   ```bash
   pnpm tauri dev
   ```

## 📏 Style Guidelines

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line
* Consider starting the commit message with an applicable emoji:
   * 🎨 `:art:` when improving the format/structure of the code
   * 🐎 `:racehorse:` when improving performance
   * 🚱 `:non-potable_water:` when plugging memory leaks
   * 📝 `:memo:` when writing docs
   * 🐧 `:penguin:` when fixing something on Linux
   * 🍎 `:apple:` when fixing something on macOS
   * 🏁 `:checkered_flag:` when fixing something on Windows
   * 🐛 `:bug:` when fixing a bug
   * 🔥 `:fire:` when removing code or files
   * 💚 `:green_heart:` when fixing the CI build
   * ✨ `:sparkles:` when adding a new feature
   * 📌 `:pushpin:` when pinning dependencies
   * 👷 `:construction_worker:` when adding CI build system
   * 📈 `:chart_with_upwards_trend:` when adding analytics
   * ♻️ `:recycle:` when refactoring code
   * ➖ `:heavy_minus_sign:` when removing a dependency
   * ➕ `:heavy_plus_sign:` when adding a dependency
   * 🔧 `:wrench:` when changing configuration files
   * 🌐 `:globe_with_meridians:` when dealing with internationalization

**Conventional Commits Format:**
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types:**
* `feat`: A new feature
* `fix`: A bug fix
* `docs`: Documentation only changes
* `style`: Changes that do not affect the meaning of the code
* `refactor`: A code change that neither fixes a bug nor adds a feature
* `perf`: A code change that improves performance
* `test`: Adding missing tests
* `chore`: Changes to the build process or auxiliary tools

### Code Style

#### TypeScript/JavaScript

We use **Biome** for formatting and linting. Configuration is in `biome.json`.

```bash
# Check for issues
pnpm lint

# Fix issues automatically
pnpm lint:fix

# Format code
pnpm format
```

**Key conventions:**
* Use double quotes for strings
* Semicolons required
* 2-space indentation
* No unused imports or variables

#### Rust

We use `rustfmt` and `clippy`.

```bash
# Format code
cargo fmt

# Check for issues
cargo clippy -- -D warnings
```

**Key conventions:**
* Follow standard Rust naming conventions
* Document public APIs with doc comments
* Use `Result<T, E>` for error handling
* Prefer `thiserror` for custom errors

### Architecture Guidelines

#### Three-Layer Architecture

SkillDeck follows a strict three-layer architecture:

```
┌─────────────────────┐
│    React Frontend   │  ← Pure view layer (no business logic)
├─────────────────────┤
│    Tauri Shell      │  ← OS integration (thin, no logic)
├─────────────────────┤
│    Rust Core        │  ← All business logic (Tauri-independent)
└─────────────────────┘
```

**Rules:**
1. Frontend communicates ONLY via IPC
2. Tauri Shell is a thin wrapper
3. Rust Core has zero Tauri dependencies
4. All state owned by Rust Core

#### IPC Boundary

When adding features:

1. **Define the command in Rust** (`src-tauri/src/commands.rs`)
2. **Add `#[specta]` attribute** for type generation
3. **Export types** (automatic in dev mode)
4. **Implement frontend hook** using typed API

### Testing

#### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# With UI
pnpm test:ui

# Rust tests
cargo test

# Rust tests for core only
cargo test --package skilldeck-core
```

#### Writing Tests

* **Unit tests**: For pure logic and utility functions
* **Component tests**: For React components (Browser Mode)
* **Integration tests**: For IPC commands and workflows

**Naming conventions:**
* Unit tests: `*.unit.test.ts`
* Browser tests: `*.browser.test.tsx`

### Branch Naming

Use descriptive branch names:

* `feat/your-feature-name` - for new features
* `fix/your-bug-fix` - for bug fixes
* `docs/what-youre-documenting` - for documentation
* `refactor/what-youre-refactoring` - for refactoring
* `test/what-youre-testing` - for tests

## 🌐 Internationalization

SkillDeck uses **Lingui** for internationalization:

```bash
# Extract messages from source code
pnpm i18n:extract

# Compile messages for runtime
pnpm i18n:compile
```

### Adding a New Language

1. Add the locale to `lingui.config.ts`
2. Run `pnpm i18n:extract`
3. Translate messages in `src/locales/{locale}/messages.po`
4. Run `pnpm i18n:compile`

## 🔒 Security

- **Never commit API keys or secrets**
- **Never commit sensitive user data**
- Use the OS keychain for credential storage
- Report security issues privately to [elcoosp@gmail.com](mailto:elcoosp@gmail.com)

## 📚 Additional Resources

- [Tauri Documentation](https://tauri.app)
- [React Documentation](https://react.dev)
- [Rust Book](https://doc.rust-lang.org/book/)
- [Lingui Documentation](https://lingui.dev/)
- [SeaORM Documentation](https://www.sea-ql.org/SeaORM/)

---

Thank you for contributing! 🙏
