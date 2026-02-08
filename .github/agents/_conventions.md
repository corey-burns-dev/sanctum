# Sanctum – Shared AI Conventions

This file defines **repo-wide rules** shared by all agents.
All agents MUST follow these conventions unless explicitly overridden.

---

## 🧠 Core Principles

- Extend the existing codebase — do not redesign it.
- Prefer small, incremental changes over large rewrites.
- Match existing patterns exactly before introducing new ones.
- Optimize for readability, correctness, and maintainability.

---

## 🛠️ Tooling & Formatting

### Formatting & Linting

- **Biome is authoritative** for frontend formatting and linting.
- **golangci-lint** rules apply for Go.
- Never fight the formatter — change code to comply.

### Dependencies

- Do not add new npm or Go dependencies unless absolutely necessary.
- Any new dependency must be justified in the output summary.

---

## 🎨 Frontend Conventions (React / TS / Tailwind)

### Components

- Functional components only.
- **Named exports only** — never default exports.
- Keep components small and single-purpose.

### TypeScript

- Strict typing.
- Avoid `any`.
- Prefer `interface` for public APIs.
- Preserve existing import style (non-relative imports if configured).

### Tailwind CSS

- Mobile-first (`block md:flex`).
- Minimalist UI — spacing and typography over heavy borders.
- Avoid long class strings:
  - If > ~2 lines, extract to a variable/helper.
- **Dynamic classes must use `cn()` or `clsx()`**.
- Never use template literals for class merging.

### State

- Prefer local state first.
- Avoid duplicating server state into client state.
- Introduce global state only when unavoidable.

### Accessibility (Minimum Bar)

- Keyboard operable controls.
- Focus-visible styles.
- Inputs have labels or aria-labels.
- Errors associated with inputs.

---

## ⚙️ Backend Conventions (Go)

### Architecture

- Follow existing layering (handler → service → store).
- No business logic in handlers.
- Do not invent new architectural patterns.

### Error Handling

- Idiomatic `if err != nil`.
- Never ignore errors.
- No panics in normal operation.

### API Contracts

- Preserve existing routes, status codes, and JSON shapes unless explicitly asked.
- Consistent error responses.
- User-safe messages in responses; details in logs only.

### Auth & Security

- Never trust client ownership claims.
- Always verify permissions for user-owned resources.
- Do not log secrets or tokens.

### Database

- Prefer simple, indexed queries.
- Avoid N+1.
- Keep transactions small and justified.

### Caching

Cache only if:

- key format defined
- TTL defined
- invalidation strategy clear  
  Otherwise, do not cache.

---

## 🚀 Performance & Safety

- Prefer early returns / guard clauses.
- Avoid unnecessary allocations and re-renders.
- No premature optimization.
- Do not change behavior during refactors.

---

## 🛑 Absolute Don’ts

- Do not remove or rewrite existing comments.
- Do not change architecture unless explicitly requested.
- Do not introduce breaking API changes unintentionally.
- Do not perform “cleanup” that alters behavior.

---

## ✅ Output Expectations (All Agents)

Every completed task must include:

- **What changed** (files + intent)
- **How to test** (commands + steps)
- **Confirmation of behavior** (especially for refactors)
- **Followups / edge cases** (short list)
