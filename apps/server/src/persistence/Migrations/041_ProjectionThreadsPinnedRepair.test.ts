import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const makeLayer = () => it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

makeLayer()("041_ProjectionThreadsPinnedRepair", (it) => {
  it.effect("restores pinned_at when id 36 was recorded as a repair migration", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      // feat/thread-parking builds recorded ids 36-38 as settled/title repair
      // migrations before main's thread-pinning PR claimed id 36 for
      // ProjectionThreadsPinned. Those databases skip the pin migration and
      // crash boot on listThreads selecting pinned_at.
      yield* runMigrations({ toMigrationInclusive: 35 });
      yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES
            (36, 'ProjectionThreadsSettledRepair'),
            (37, 'ProjectionThreadsSettledRepair'),
            (38, 'ProjectionThreadTitleRegenerationRepair')
        `;

      const before = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_threads)
        `;
      assert.ok(!before.some((column) => column.name === "pinned_at"));

      yield* runMigrations();

      const columns = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_threads)
        `;
      assert.ok(columns.some((column) => column.name === "pinned_at"));

      const repairs = yield* sql<{
        readonly migration_id: number;
        readonly name: string;
      }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id = 41
        `;
      assert.deepStrictEqual(repairs, [
        {
          migration_id: 41,
          name: "ProjectionThreadsPinnedRepair",
        },
      ]);
    }),
  );
});

makeLayer()("041_ProjectionThreadsPinnedRepair idempotent", (it) => {
  it.effect("is a no-op when pinned_at already exists from migration 36", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations();

      const columns = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_threads)
        `;
      assert.ok(columns.some((column) => column.name === "pinned_at"));

      const repairs = yield* sql<{
        readonly migration_id: number;
        readonly name: string;
      }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id IN (36, 41)
          ORDER BY migration_id
        `;
      assert.deepStrictEqual(repairs, [
        {
          migration_id: 36,
          name: "ProjectionThreadsPinned",
        },
        {
          migration_id: 41,
          name: "ProjectionThreadsPinnedRepair",
        },
      ]);
    }),
  );
});
