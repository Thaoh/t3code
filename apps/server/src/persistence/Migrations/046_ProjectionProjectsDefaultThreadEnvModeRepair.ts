import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

// Databases on feat/thread-parking recorded migration id 39 as
// ProjectionThreadsParkedNote before main claimed that id for
// ProjectionProjectsDefaultThreadEnvMode. Those databases skip the real
// migration; re-run the same guarded ALTER at an id they have not seen.
// Databases migrated from main already have the column and this is a no-op.
export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const columns = yield* sql<{ readonly name: string }>`
    PRAGMA table_info(projection_projects)
  `;

  if (!columns.some((column) => column.name === "default_thread_env_mode")) {
    yield* sql`
      ALTER TABLE projection_projects
      ADD COLUMN default_thread_env_mode TEXT
    `;
  }
});
