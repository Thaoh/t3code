import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

const makeLayer = () => it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

makeLayer()("066_ProjectionThreadTitleState", (it) => {
  it.effect("adds title_state_json column", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 65 });
      yield* runMigrations({ toMigrationInclusive: 66 });

      const columns = yield* sql<{ readonly name: string; readonly notnull: number }>`
        PRAGMA table_info(projection_threads)
      `;
      const titleState = columns.find((column) => column.name === "title_state_json");
      const migrations = yield* sql<{ readonly migration_id: number; readonly name: string }>`
        SELECT migration_id, name
        FROM effect_sql_migrations
        WHERE migration_id = 66
      `;

      assert.equal(titleState?.name, "title_state_json");
      assert.equal(titleState?.notnull, 0);
      assert.deepStrictEqual(migrations, [
        {
          migration_id: 66,
          name: "ProjectionThreadTitleState",
        },
      ]);
    }),
  );
});

makeLayer()("066_ProjectionThreadTitleState idempotent", (it) => {
  it.effect("accepts title state added by an earlier development migration", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 65 });
      yield* sql`
        ALTER TABLE projection_threads
        ADD COLUMN title_state_json TEXT
      `;

      yield* runMigrations({ toMigrationInclusive: 66 });

      const columns = yield* sql<{ readonly name: string; readonly notnull: number }>`
        PRAGMA table_info(projection_threads)
      `;
      const titleState = columns.find((column) => column.name === "title_state_json");
      const migrations = yield* sql<{ readonly migration_id: number }>`
        SELECT migration_id
        FROM effect_sql_migrations
        WHERE migration_id = 66
      `;

      assert.equal(titleState?.name, "title_state_json");
      assert.equal(titleState?.notnull, 0);
      assert.equal(migrations.length, 1);
    }),
  );
});
