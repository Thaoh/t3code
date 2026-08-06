import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

// Databases created on feat/thread-parking before main's thread-pinning PR
// recorded migration ids 36-38 as settled/title repair migrations. After the
// merge, id 36 became ProjectionThreadsPinned, so those databases skip the
// pin migration and crash boot on listThreads selecting pinned_at. Re-run the
// same guarded ALTER at an id they have not seen; databases migrated from
// main already have the column and this is a no-op.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;

  if (!columns.some((column) => column.name === "pinned_at")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN pinned_at TEXT
    `;
  }
});
