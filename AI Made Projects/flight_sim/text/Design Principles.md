# Flight Sim Design Principles

- Favor runtime-agnostic logic. Core game systems should not rely on implicit browser globals so we can run and test them in isolation without DOM or Web APIs.
- Communicate via `eventBus` instead of direct coupling. Emitting well-defined events keeps UI, gameplay, and systems modular and testable.
- Clamp inputs and expose state helpers. Constraining physics/timers and providing read-only snapshots simplifies debugging and reduces flaky behaviour.
- Keep gameplay data deterministic where possible. Prefer seeded or injectable randomness in logic you plan to verify, and document any non-deterministic behavior.
- Use instanced meshes for performance. When rendering a large number of similar objects, always use instanced meshes to reduce draw calls and improve performance.
