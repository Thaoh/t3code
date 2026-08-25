import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("051_ProjectionThreadLinkedPullRequestRepair", (it) => {
  it.effect(
    "restores linked pull request column when id 42 was recorded as ProjectionThreadsSettledRepair",
    () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        // Pre-merge parking builds used id 42 for settled repair. Simulate that
        // history so the real LinkedPullRequest migration is skipped.
        yield* runMigrations({ toMigrationInclusive: 41 });
        yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES (42, 'ProjectionThreadsSettledRepair')
        `;

        const before = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_threads)
        `;
        assert.ok(!before.some((column) => column.name === "linked_pull_request_json"));

        yield* runMigrations();

        const columns = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_threads)
        `;
        assert.ok(columns.some((column) => column.name === "linked_pull_request_json"));

        const repairs = yield* sql<{
          readonly migration_id: number;
          readonly name: string;
        }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id = 51
        `;
        assert.deepStrictEqual(repairs, [
          {
            migration_id: 51,
            name: "ProjectionThreadLinkedPullRequestRepair",
          },
        ]);
      }),
  );
});
