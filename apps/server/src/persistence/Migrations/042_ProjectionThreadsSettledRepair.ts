import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

// Databases created by pre-merge feat/thread-handoff builds recorded
// migration id 33 as ProjectionThreadsParkedNote, so the id-33
// ProjectionThreadsSettled migration from main is skipped by the migrator and
// its columns never get added. Re-run the same guarded ALTERs at an id those
// databases have not seen; databases migrated from main already have the
// columns and this is a no-op.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;

  if (!columns.some((column) => column.name === "settled_override")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN settled_override TEXT
    `;
  }

  if (!columns.some((column) => column.name === "settled_at")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN settled_at TEXT
    `;
  }
});
