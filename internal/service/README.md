# Service Layer

This package contains the application's service layer (business logic).

Pattern: Handler -> Service -> Repository

- Handlers: I/O, validation, serialization
- Services: business rules, orchestration, transactions
- Repositories: data access

Current contents:
- `service.go` — a minimal `UserService` interface and placeholder implementation.

Next steps:
- Wire repository implementations into `New*Service` constructors
- Move business logic from handlers into services
- Add unit tests for service methods
