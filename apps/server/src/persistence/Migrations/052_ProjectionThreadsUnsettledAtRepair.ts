import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

// Databases on feat/thread-parking recorded migration id 43 as
// ProjectionThreadsPinnedRepair before main claimed that id for
// ProjectionThreadsUnsettledAt. Those databases skip the real
// migration; re-run the same guarded ALTER at an id they have not seen.
// Databases migrated from main already have the column and this is a no-op.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;

  if (!columns.some((column) => column.name === "unsettled_at")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN unsettled_at TEXT
    `;
  }
});
