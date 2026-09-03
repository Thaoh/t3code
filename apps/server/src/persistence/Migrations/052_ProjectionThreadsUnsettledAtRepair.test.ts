import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("052_ProjectionThreadsUnsettledAtRepair", (it) => {
  it.effect("restores unsettled_at when id 43 was recorded as ProjectionThreadsPinnedRepair", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      // Pre-merge parking builds used id 43 for pinned repair. Simulate that
      // history so the real ProjectionThreadsUnsettledAt migration is skipped.
      yield* runMigrations({ toMigrationInclusive: 42 });
      yield* sql`
        INSERT INTO effect_sql_migrations (migration_id, name)
        VALUES (43, 'ProjectionThreadsPinnedRepair')
      `;

      const before = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_threads)
      `;
      assert.ok(!before.some((column) => column.name === "unsettled_at"));

      yield* runMigrations();

      const columns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_threads)
      `;
      assert.ok(columns.some((column) => column.name === "unsettled_at"));

      const repairs = yield* sql<{
        readonly migration_id: number;
        readonly name: string;
      }>`
        SELECT migration_id, name
        FROM effect_sql_migrations
        WHERE migration_id = 52
      `;
      assert.deepStrictEqual(repairs, [
        {
          migration_id: 52,
          name: "ProjectionThreadsUnsettledAtRepair",
        },
      ]);
    }),
  );
});
