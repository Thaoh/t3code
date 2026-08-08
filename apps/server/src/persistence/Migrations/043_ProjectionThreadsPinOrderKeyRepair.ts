import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

// Databases on feat/thread-parking recorded migration id 38 as
// ProjectionThreadsParkedNote before main claimed that id for
// ProjectionThreadsPinOrderKey. Those databases skip the pin-order migration
// and crash boot when listThreads selects pin_order_key. Re-run the same
// guarded ALTER at an id they have not seen; databases migrated from main
// already have the column and this is a no-op.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;

  if (!columns.some((column) => column.name === "pin_order_key")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN pin_order_key TEXT
    `;
  }
});
