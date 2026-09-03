import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("058_ProjectionProjectIconRepair", (it) => {
  it.effect(
    "adds project_icon_json when id 47 was recorded as ProjectionProjectFaviconPathRepair",
    () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        yield* runMigrations({ toMigrationInclusive: 46 });
        yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES (47, 'ProjectionProjectFaviconPathRepair')
        `;

        const before = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_projects)
        `;
        assert.ok(!before.some((column) => column.name === "project_icon_json"));

        yield* runMigrations();

        const columns = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_projects)
        `;
        assert.ok(columns.some((column) => column.name === "project_icon_json"));

        const repairs = yield* sql<{
          readonly migration_id: number;
          readonly name: string;
        }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id = 58
        `;
        assert.deepStrictEqual(repairs, [
          {
            migration_id: 58,
            name: "ProjectionProjectIconRepair",
          },
        ]);
      }),
  );
});
