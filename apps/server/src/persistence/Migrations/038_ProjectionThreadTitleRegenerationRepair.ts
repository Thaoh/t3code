import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

// Pre-merge feat/thread-parking builds recorded ids 35 and 36 as
// ProjectionThreadsParkedNote and ProjectionThreadsSettledRepair, so the id-35
// ProjectionThreadTitleRegeneration migration from main is skipped by the
// migrator and its columns never get added. Re-run the same guarded ALTERs at
// an id those databases have not seen; databases migrated from main already
// have the columns and this is a no-op.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;

  if (!columns.some((column) => column.name === "title_regeneration_request_id")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN title_regeneration_request_id TEXT
    `;
  }

  if (!columns.some((column) => column.name === "title_regeneration_started_at")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN title_regeneration_started_at TEXT
    `;
  }
});
