import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_threads)
  `;

  // Pre-merge feat/thread-handoff builds shipped this migration as id 33 and
  // already added the column; their databases reach this id-35 copy with the
  // column present.
  if (!columns.some((column) => column.name === "parked_note_json")) {
    yield* sql`
      ALTER TABLE projection_threads
      ADD COLUMN parked_note_json TEXT
    `;
  }
});
