import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

// Databases on feat/thread-parking recorded migration id 37 as
// ProjectionThreadsParkedNote before main claimed that id for
// ProjectionTurnsKeysetIndex. Those databases skip the keyset index migration
// and keep the slower turn pagination plan. Re-run the same IF NOT EXISTS
// CREATE INDEX at an id they have not seen; databases migrated from main
// already have the index and this is a no-op.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_turns_thread_keyset
    ON projection_turns(thread_id, requested_at, turn_id)
  `;
});
