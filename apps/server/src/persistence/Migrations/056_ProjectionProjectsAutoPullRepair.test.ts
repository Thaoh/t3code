import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("056_ProjectionProjectsAutoPullRepair", (it) => {
  it.effect("adds auto_pull when id 45 was recorded as ProjectionThreadsPinOrderKeyRepair", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      // Pre-merge parking builds used id 45 for pin-order repair. Simulate that
      // history so the real ProjectionProjectsAutoPull migration is skipped.
      yield* runMigrations({ toMigrationInclusive: 44 });
      yield* sql`
        INSERT INTO effect_sql_migrations (migration_id, name)
        VALUES (45, 'ProjectionThreadsPinOrderKeyRepair')
      `;

      const before = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_projects)
      `;
      assert.ok(!before.some((column) => column.name === "auto_pull"));

      yield* runMigrations();

      const columns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_projects)
      `;
      assert.ok(columns.some((column) => column.name === "auto_pull"));

      const repairs = yield* sql<{
        readonly migration_id: number;
        readonly name: string;
      }>`
        SELECT migration_id, name
        FROM effect_sql_migrations
        WHERE migration_id = 56
      `;
      assert.deepStrictEqual(repairs, [
        {
          migration_id: 56,
          name: "ProjectionProjectsAutoPullRepair",
        },
      ]);
    }),
  );
});
