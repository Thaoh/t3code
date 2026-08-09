import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("046_ProjectionProjectsDefaultThreadEnvModeRepair", (it) => {
  it.effect(
    "restores default_thread_env_mode when id 39 was recorded as ProjectionThreadsParkedNote",
    () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        // Pre-merge parking builds used id 39 for parked notes. Simulate that
        // history so the real DefaultThreadEnvMode migration is skipped.
        yield* runMigrations({ toMigrationInclusive: 38 });
        yield* sql`
          ALTER TABLE projection_threads
          ADD COLUMN parked_note_json TEXT
        `;
        yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES (39, 'ProjectionThreadsParkedNote')
        `;

        yield* runMigrations();

        const columns = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_projects)
        `;
        assert.ok(columns.some((column) => column.name === "default_thread_env_mode"));

        const repairs = yield* sql<{
          readonly migration_id: number;
          readonly name: string;
        }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id = 46
        `;
        assert.deepStrictEqual(repairs, [
          {
            migration_id: 46,
            name: "ProjectionProjectsDefaultThreadEnvModeRepair",
          },
        ]);
      }),
  );
});
