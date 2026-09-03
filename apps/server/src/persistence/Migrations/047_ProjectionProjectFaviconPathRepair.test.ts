import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("047_ProjectionProjectFaviconPathRepair", (it) => {
  it.effect("restores favicon_path when id 40 was recorded as ProjectionThreadsSettledRepair", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      // Pre-merge parking builds used id 40 for settled repair. Simulate that
      // history so the real FaviconPath migration is skipped.
      yield* runMigrations({ toMigrationInclusive: 39 });
      yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES (40, 'ProjectionThreadsSettledRepair')
        `;

      const before = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_projects)
        `;
      assert.ok(!before.some((column) => column.name === "favicon_path"));

      yield* runMigrations();

      const columns = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_projects)
        `;
      assert.ok(columns.some((column) => column.name === "favicon_path"));

      const repairs = yield* sql<{
        readonly migration_id: number;
        readonly name: string;
      }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id = 61
        `;
      assert.deepStrictEqual(repairs, [
        {
          migration_id: 61,
          name: "ProjectionProjectFaviconPathRepair",
        },
      ]);
    }),
  );
});
