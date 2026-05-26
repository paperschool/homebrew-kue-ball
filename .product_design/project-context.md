# Engineering Standards

This document defines the software engineering principles, conventions, and architectural expectations for this project. All contributors are expected to understand and apply these standards throughout development.

---

## 1. Core Design Principles

### SOLID

These principles apply across both the React frontend and the backend API layer.

- **Single Responsibility (SRP)** — Every module, component, class, or function has exactly one reason to change. A React component either fetches data or renders UI — not both. A service class handles one domain concern.
- **Open/Closed** — Code is open for extension, closed for modification. Prefer composition and configuration over editing existing internals. New filter types or export formats should slot in without requiring rewrites.
- **Liskov Substitution** — Subtypes and implementations must be substitutable for their base type or interface without breaking consumers. All implementations of an `IExperimentRepository` must behave consistently.
- **Interface Segregation** — Prefer narrow, purpose-built interfaces over large monolithic ones. A component should not depend on props it does not use.
- **Dependency Inversion** — High-level modules must not depend on low-level modules — both depend on abstractions. Use dependency injection on the backend; use context providers and hooks on the frontend rather than direct singleton imports.

### DRY — Don't Repeat Yourself

Every piece of logic, business rule, or configuration exists in exactly one canonical location. If the same condition, calculation, or string appears in more than one place, it is extracted. The exception is test assertions — duplication in tests is acceptable when it keeps tests independent and readable.

### YAGNI — You Aren't Gonna Need It

Do not build speculative features, hooks, or abstractions for use cases that do not yet exist. Every added layer of indirection must earn its place against a real, present requirement.

### KISS — Keep It Simple

Prefer the simpler solution that satisfies the requirement. Cleverness is a liability. A junior engineer should be able to follow any code path without a verbal explanation.

### STUPID — Anti-patterns to Actively Avoid

- **Singleton abuse** — Avoid global mutable state. Use dependency injection and providers.
- **Tight coupling** — Modules should not reach into the internals of other modules. Communicate through defined interfaces or events.
- **Untestability** — Code that cannot be unit tested in isolation is poorly designed. If a dependency cannot be injected, the architecture is wrong.
- **Premature optimisation** — Measure before optimising. Never sacrifice readability for hypothetical performance gains.
- **Indescriptive naming** — Names like `data`, `result`, `temp`, `handleClick`, or `doThing` are banned. Names must describe intent.
- **Duplication** — No copied logic across files unless intentionally isolated for testing purposes.

---

## 2. Architecture

### Separation of Concerns

- Data fetching and UI rendering are never co-located in the same unit. Use custom hooks (`useExperiments`, `useSyncStatus`) to own async state; components consume and render.
- Authentication concerns live exclusively in `features/auth`. No auth logic bleeds into feature components — they consume a `useCurrentUser` hook and read role claims from it.
- All Optimizely API interaction lives in the Optimizely infrastructure adapter. No component or use-case knows the shape of the external API response.

### High Cohesion, Low Coupling

- Related code travels together. A feature's component, hook, types, and fetch logic sit in the same folder.
- Unrelated systems communicate through the narrowest possible interface — a typed DTO, a function signature, or a domain event.
- Changes to one module should not ripple through unrelated modules. If they do, the coupling is too tight.

---

## 3. Naming Conventions

Naming is the primary documentation mechanism. Names must communicate intent without requiring a comment.

### General Rules

- Names describe what the thing **is** or **does** — never how it does it.
- Booleans use `is`, `has`, `can`, or `should` prefixes: `isLoading`, `hasEditPermission`, `canSync`.
- Functions use verb phrases: `fetchExperiments`, `parseGeoAudience`, `buildExportPayload`.
- Abbreviations are avoided unless universally understood in context (`id`, `url`, `api` are fine; `exp`, `tbl`, `mgr` are not).
- Generic names at any scope above a three-line lambda are banned: `data`, `result`, `item`, `obj`, `temp`.

### TypeScript / Node

| Construct          | Convention              | Example                                  |
| ------------------ | ----------------------- | ---------------------------------------- |
| React component    | PascalCase              | `ExperimentRow`, `SyncStatusBadge`       |
| Hook               | camelCase, `use` prefix | `useExperiments`, `useAuditLog`          |
| Type / Interface   | PascalCase              | `Experiment`, `SyncResult`               |
| Enum               | PascalCase, singular    | `ExperimentStatus`, `UserRole`           |
| Constant           | SCREAMING_SNAKE_CASE    | `MAX_SYNC_RETRIES`, `DEFAULT_PAGE_SIZE`  |
| Utility function   | camelCase, verb phrase  | `formatDateRange`, `parseAudienceGeo`    |
| Component file     | PascalCase `.tsx`       | `ExperimentTable.tsx`                    |
| Non-component file | kebab-case `.ts`        | `experiment-service.ts`, `geo-parser.ts` |

The backend is also TypeScript, so the same file, function, and type conventions above apply. Additional rules:

- Use cases and commands are named by intent: `syncExperimentsUseCase`, `getExperimentsByFilterQuery`.
- Repository interfaces are TypeScript interfaces named by role: `ExperimentRepository`, `AuditLogRepository`.
- DTOs are suffixed: `ExperimentDto`, `SyncResultDto`.
- No abbreviations on module, function, or type names.

---

## 4. File and Module Size

**No source file exceeds 150 lines of non-test code.**

When a file approaches this limit it is a signal that the unit has too many responsibilities. The correct response is to split — not to scroll.

- React components approaching 150 lines are decomposed into smaller, named sub-components.
- Hooks beyond 80 lines likely contain more than one concern and should be split.
- Service classes beyond 150 lines are split by sub-domain responsibility.
- Test files are exempt from the line limit but must remain focused on a single unit under test.

This limit is a design tool. When code is properly decomposed, files are naturally short.

---

## 5. No Magic Strings or Numbers

Every hardcoded string or number with semantic meaning is assigned a named constant.

```typescript
// Bad
if (user.role === 'admin') { ... }
const page = paginate(results, 50);

// Good
import { UserRole, DEFAULT_PAGE_SIZE } from '@/shared/constants';
if (user.role === UserRole.Admin) { ... }
const page = paginate(results, DEFAULT_PAGE_SIZE);
```

- Constants live in `src/shared/constants/` (frontend) or a `Constants/` module (backend).
- Constants are grouped by domain: `auth.constants.ts`, `sync.constants.ts`, `pagination.constants.ts`.
- Environment-specific values (API URLs, timeouts, feature flags) live in environment configuration — never hardcoded in source.
- Enum values are preferred over string unions for any finite set of states.

---

## 6. Self-Documenting Code

**Code does not require comments to explain what it does.** If a comment is needed to explain logic, the logic must be refactored until it is clear without one.

Acceptable comment forms:

- `// TODO: [ticket]` — acknowledged debt with a linked ticket reference.
- JSDoc on exported public API boundaries to describe parameters and return shape — not implementation detail.
- A brief `// why:` comment for a genuinely non-obvious external constraint (e.g. a workaround for a known Optimizely API quirk).

No commented-out code is ever committed. Version control is the history mechanism.

```typescript
// Bad — comment explains what the code does
// Check if the user has the admin role before allowing edit
if (user.role === 'admin') { ... }

// Good — the code reads as the explanation
const canEdit = currentUser.role === UserRole.Admin || currentUser.role === UserRole.Editor;
if (canEdit) { ... }
```

---

## 7. Strong Typing

TypeScript's type system is a first-class design tool — not optional decoration.

- `any` is banned. Use `unknown` with a type guard, or define a proper type.
- `as` casting is banned except at verified deserialisation boundaries (API response parsing), where the location is annotated with a `// trust:` comment and the reason stated.
- All function signatures have explicit parameter and return types.
- API response shapes are defined as types in the feature's `types.ts`. No raw response objects flow into business logic.
- Prefer interfaces for object shapes that may be extended; prefer type aliases for unions and computed types.
- Discriminated unions model state machines: `{ status: 'loading' } | { status: 'success'; data: Experiment[] } | { status: 'error'; error: string }`.

---

## 8. Abstractions and Interfaces

**Abstract over what changes, not over what exists.** A premature abstraction is worse than duplication.

- Introduce an abstraction only when two distinct implementations exist, or when testability explicitly requires it.
- Abstractions must be narrower than the thing they wrap. A `SyncClient` interface exposes `sync(): Promise<SyncResult>` — not an entire HTTP client surface.
- Avoid "helper", "manager", "processor", "handler" as primary class names — these describe nothing. Name by domain role.
- Layer-crossing boundaries always go through a defined interface. The frontend never constructs raw HTTP requests inline in components — it calls a typed service function.

---

## 9. Configuration as Code

All infrastructure, environment configuration, and deployment definitions are expressed as versioned code alongside application source.

- Infrastructure is provisioned via Bicep stored in `/infra`. No resources are created manually through the Azure portal.
- CI/CD pipelines are defined in YAML under `.github/workflows/` or `.azure-pipelines/`. No pipeline steps are configured through a GUI.
- Application configuration uses named environment variables resolved at runtime. No configuration values are baked into build artefacts.
- Azure Key Vault is the canonical source for secrets. Applications reference vault-backed configuration names — they never receive secret values as raw environment variables in staging or production.
- Feature flags and environment-specific toggles are defined in a single `config/` directory and resolved at startup, not scattered across the codebase.

---

## 10. Testing Standards

Tests are first-class code. They follow all naming, structure, and quality standards applied to production code.

### Mockist Approach (London School)

This codebase follows the **mockist** (London School) style of TDD. Every unit under test is isolated from all collaborators. All dependencies — repositories, API clients, external services, clocks — are replaced with test doubles (mocks, stubs, or fakes).

- **Never use real infrastructure in unit tests.** No database connections, no HTTP calls, no file system access. If a test touches real I/O, it is an integration or E2E test and belongs in a separate suite.
- **Mock at the boundary you own.** The `ExperimentRepository` interface is mocked in application-layer tests; the Optimizely HTTP client is mocked in infrastructure adapter tests. Tests verify *behaviour through the interface*, not internal wiring.
- **Verify interactions, not state, where appropriate.** When the observable result is a side-effect (a write was persisted, a notification was dispatched), assert that the collaborator was called with the correct arguments — don't reach into the database to check the row.
- **Fakes over mocks for complex collaborators.** For anything with non-trivial stateful behaviour (e.g. an in-memory repository), use a hand-written fake that implements the interface correctly rather than a fragile mock with many `.returns()` chains.
- Test doubles are defined alongside their test files, not in a shared `__mocks__` tree unless they are reused across more than two test suites.

### Coverage Expectations

| Layer                                           | Approach                                      | Target                       |
| ----------------------------------------------- | --------------------------------------------- | ---------------------------- |
| Domain logic (pure functions, business rules)   | Unit tests, no doubles needed                 | 100%                         |
| Application use cases                           | Unit tests, all collaborators doubled         | 90%+                         |
| Infrastructure adapters (Optimizely, DB, Teams) | Unit tests, HTTP/DB client doubled            | All adapters                 |
| API route handlers                              | Unit tests, use case doubled                  | All routes                   |
| React hooks                                     | Unit tests with `renderHook`, service doubled | All data-fetching paths      |
| React components                                | Component tests (Testing Library)             | All user-facing interactions |
| Critical user journeys                          | Playwright E2E against real stack             | Auth, sync, edit, export     |

### Test Naming

Test names describe the scenario and expected outcome in plain language:

```typescript
it('returns an empty array when no experiments match the applied filters')
it('throws an UnauthorisedError when a Viewer attempts to edit a manual field')
it('retries the Optimizely API call up to three times before marking sync as failed')
```

No test is named `test1`, `happyPath`, `works`, or `edge case`.

### Test Structure

Every test follows **Arrange / Act / Assert** with a blank line separating each phase. No assertion logic outside the Assert phase.

---

## 11. Git and Version Control

- Branches are scoped to a single feature, fix, or story. Branch names follow: `feature/EXP-123-short-description`, `fix/EXP-456-sync-retry`, `chore/update-dependencies`.
- Every pull request is linked to a ticket and has a description explaining the *why*.
- Commits use Conventional Commits format: `feat:`, `fix:`, `chore:`, `test:`, `refactor:`. The commit body explains the *why*, not the *what*.
- No commit contains commented-out code, debugging statements (`console.log`, `debugger`), or unresolved merge markers.
- PRs require at least one approving review and a passing CI pipeline before merge.
- `main` is always deployable. All feature work occurs on branches.

---

## 12. Security Standards

Security is not a phase — it is a continuous requirement on every piece of code shipped.

- All OWASP Top 10 categories are considered during design and code review.
- No secret, credential, or connection string is committed to the repository under any circumstance. Pre-commit hooks enforce this.
- All API endpoints validate authentication and authorise against the caller's role before processing any request.
- User-supplied input is never trusted: validate and sanitise at every API boundary using a schema validation library.
- CORS is configured explicitly — wildcard origins are not permitted in staging or production.
- Dependencies are pinned and audited. Dependency scanning runs in CI on every push.
- Azure Managed Identity is used for service-to-service authentication wherever supported. Stored credentials are the last resort.
- Role checks are enforced in the API layer — not just in the UI. Frontend role-gating is a UX convenience, not a security control.

---

## 13. Error Handling

- Errors are handled at explicit boundaries — not silently swallowed, not permitted to bubble to the runtime unhandled.
- The frontend distinguishes between recoverable UI states (loading, empty, error) and unrecoverable application errors (boundary-caught crashes). Every async operation accounts for all three.
- API errors are returned as structured problem responses (RFC 7807 format): `{ type, title, status, detail, instance }`.
- Retry logic with exponential backoff applies to all external calls (Optimizely API, Microsoft Graph). Retry attempts and ultimate failures are logged.
- Log entries are structured (JSON), include a correlation ID, and never contain PII or secrets.

---

## 14. Performance Expectations

**APPLY WHERE RELEVANT**
- The dashboard renders within 2 seconds on desktop. Paginated experiment list API responses return within 500ms under normal load.
- The Optimizely sync completes within 5 minutes for 500 experiments. Rate-limit backoff is respected without polling aggressively.
- Database queries are parameterised, indexed, and reviewed before merging. No full-table scans on the experiments table.
- Frontend bundle size is monitored in CI. Large dependency additions require explicit justification before introduction.

---

## 15. Established Patterns

Before writing new structural or behavioural code, consult this catalogue. These patterns have well-understood names, trade-offs, and implementations. Using them avoids reinvention, gives collaborators a shared vocabulary, and makes code review faster.

When a pattern fits, use it — and name the thing after it so the intent is immediately clear to anyone who reads the code.

Some good sites with pattern articles and general software design explanations: 
- https://www.developertoarchitect.com/lessons/
- https://martinfowler.com/eaaCatalog/
- https://12factor.net/

---

### Repository

**Use for:** all database access.

Abstracts persistence behind a typed interface (`ExperimentRepository`, `AuditLogRepository`). The application layer never writes a query — it calls a repository method. This makes the storage engine swappable and every database call trivially mockable in unit tests.

```typescript
interface ExperimentRepository {
  findById(id: string): Promise<Experiment | null>;
  findByFilter(filter: ExperimentFilter): Promise<Experiment[]>;
  save(experiment: Experiment): Promise<void>;
}
```

---

### Adapter

**Use for:** all third-party and external API integrations (Optimizely, Microsoft Graph / Teams).

Wraps an external API in an interface defined by *this* system. The adapter translates between the external shape and the internal domain model. No domain or application code ever sees raw Optimizely response shapes.

```typescript
interface OptimizlyClient {
  fetchExperiments(projectId: string): Promise<Experiment[]>;
}
// OptimizelyHttpAdapter implements OptimizelyClient
```

---

### Strategy

**Use for:** interchangeable behaviours — export formats, GEO parsing rules, filter logic.

Define a common interface for a family of algorithms and inject the chosen implementation at call time. Adding a new export format (e.g. CSV) means adding a new strategy, not editing existing code.

```typescript
interface ExportStrategy {
  export(experiments: Experiment[]): Promise<Buffer>;
}
// ExcelExportStrategy, PdfExportStrategy implement ExportStrategy
```

---

### Command / Query Separation (CQS)

**Use for:** all application-layer use cases.

Operations that change state (commands) are separated from operations that read state (queries). A command handler returns nothing or a minimal acknowledgement; a query handler returns data and changes nothing. This makes intent explicit and side-effects traceable.

```
syncExperimentsCommand   → writes, returns void
updateManualFieldCommand → writes, returns void
getExperimentsByFilter   → reads, returns ExperimentDto[]
```

---

### Result / Either

**Use for:** typed error handling in place of thrown exceptions for expected failure paths.

Return a discriminated union `{ ok: true; value: T } | { ok: false; error: AppError }` rather than throwing. The caller is forced to handle both paths explicitly. Reserve thrown errors for genuinely unexpected, unrecoverable conditions.

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };

async function syncExperiments(): Promise<Result<SyncSummary>> { ... }
```

---

### Circuit Breaker

**Use for:** calls to external services with availability risk (Optimizely API, Teams webhook).

After a configurable number of consecutive failures the circuit opens and subsequent calls fail fast without hitting the external service. After a recovery window, a probe call is allowed through. This prevents cascading failures and respects upstream rate limits during outages.

Use an existing implementation (e.g. `cockatiel`, `opossum`) — do not hand-roll.

---

### Decorator (Middleware)

**Use for:** cross-cutting concerns on route handlers — authentication, authorisation, request logging, input validation, correlation ID injection.

Each concern is a discrete middleware function composed around the route handler. Route handlers remain clean and focused on their single responsibility.

```typescript
router.patch(
  '/experiments/:id/fields',
  requireAuthentication,
  requireRole(UserRole.Editor),
  validateBody(updateFieldSchema),
  updateManualFieldHandler,
);
```

---

### Factory

**Use for:** constructing objects whose concrete type is determined at runtime — export strategies, notification payloads, filter builders.

Centralise construction logic so call sites are not burdened with conditional instantiation.

```typescript
function createExportStrategy(format: ExportFormat): ExportStrategy {
  const strategies: Record<ExportFormat, ExportStrategy> = {
    [ExportFormat.Excel]: new ExcelExportStrategy(),
    [ExportFormat.Pdf]:   new PdfExportStrategy(),
  };
  return strategies[format];
}
```

---

### Facade

**Use for:** simplifying a complex subsystem behind a single entry point.

The sync engine orchestrates Optimizely pagination, GEO parsing, rate-limit backoff, database writes, and audit logging. All of that complexity lives behind a `SyncFacade` with a single `run()` method. Callers — the scheduler, the manual trigger endpoint — call `sync.run()` and know nothing of the internals.

---

### Observer / Event Emitter

**Use for:** decoupled reactions to state changes — experiment status transitions triggering Teams notifications, audit log entries being written on field edits.

The component that performs the change emits a domain event. Listeners are registered independently and react without the emitter knowing they exist. This keeps the write path clean and notification logic out of core business logic.

```typescript
experimentEvents.on('statusChanged', sendTeamsNotification);
experimentEvents.on('fieldEdited',   writeAuditLogEntry);
```

---

### Null Object

**Use for:** removing null / undefined guards throughout the codebase.

Instead of returning `null` and forcing every caller to check, return a typed empty object that implements the same interface with safe no-op defaults. Common examples: an unauthenticated user represented as a `GuestUser` with `role: UserRole.None`, an empty filter set returning all experiments rather than null.

---

### Stale-While-Revalidate

**Use for:** frontend data fetching via React Query.

Return the cached (stale) data immediately so the UI never blocks, then revalidate in the background. The sync status indicator and experiment list should always have something to render — never a blank loading state when data was previously loaded. Configure via React Query's `staleTime` and `gcTime`.

---

### Optimistic Update

**Use for:** the auto-save behaviour on manual field edits.

Apply the change to local UI state immediately on blur, then persist asynchronously. If the API call fails, roll back to the previous value and surface an error. This gives instant feedback without a loading spinner on every keystroke.

```typescript
// via React Query's useMutation + onMutate / onError rollback
```

---

### Retry with Exponential Backoff

**Use for:** all retryable external calls — Optimizely API (rate-limited at 60 req/min), Teams webhook delivery.

Do not hand-roll. Use `cockatiel` or equivalent. Configure: max attempts (3), base delay, jitter, and which HTTP status codes are retryable (429, 502, 503, 504). Log each retry attempt with the correlation ID and remaining attempt count.

---

### Append-Only Log

**Use for:** the audit trail.

Audit records are never updated or deleted. Every change produces a new immutable row. This is not just a business rule but an architectural constraint enforced at the repository layer — the `AuditLogRepository` exposes only `append()`, never `update()` or `delete()`.
