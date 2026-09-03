import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("050_ProjectionThreadsSettledRepair", (it) => {
  it.effect("restores settled columns when id 33 was recorded as ProjectionThreadsParkedNote", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      // Pre-merge thread-handoff builds used id 33 for parked notes. Simulate
      // that history so the real ProjectionThreadsSettled migration is skipped.
      yield* runMigrations({ toMigrationInclusive: 32 });
      yield* sql`
          ALTER TABLE projection_threads
          ADD COLUMN parked_note_json TEXT
        `;
      yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES (33, 'ProjectionThreadsParkedNote')
        `;

      yield* runMigrations();

      const columns = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_threads)
        `;
      const names = new Set(columns.map((column) => column.name));
      assert.ok(names.has("settled_override"));
      assert.ok(names.has("settled_at"));
      assert.ok(names.has("parked_note_json"));
      assert.ok(names.has("pin_order_key"));

      const repairs = yield* sql<{
        readonly migration_id: number;
        readonly name: string;
      }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id IN (50, 59)
          ORDER BY migration_id
        `;
      assert.deepStrictEqual(repairs, [
        {
          migration_id: 50,
          name: "ProjectionThreadsSettledRepair",
        },
        {
          migration_id: 59,
          name: "ProjectionThreadsPinOrderKeyRepair",
        },
      ]);
    }),
  );
});
