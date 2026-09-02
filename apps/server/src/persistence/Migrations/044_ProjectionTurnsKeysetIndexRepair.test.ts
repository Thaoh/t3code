import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const makeLayer = () => it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

makeLayer()("044_ProjectionTurnsKeysetIndexRepair", (it) => {
  it.effect("restores keyset index when id 37 was recorded as ProjectionThreadsParkedNote", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      // feat/thread-parking builds recorded id 37 as parked notes before main
      // claimed that id for ProjectionTurnsKeysetIndex. Those databases skip
      // the keyset index migration.
      yield* runMigrations({ toMigrationInclusive: 36 });
      yield* sql`
          ALTER TABLE projection_threads
          ADD COLUMN parked_note_json TEXT
        `;
      yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES (37, 'ProjectionThreadsParkedNote')
        `;

      const before = yield* sql<{ readonly name: string }>`
          SELECT name
          FROM sqlite_master
          WHERE type = 'index' AND name = 'idx_projection_turns_thread_keyset'
        `;
      assert.deepStrictEqual(before, []);

      yield* runMigrations();

      const indexes = yield* sql<{ readonly name: string }>`
          SELECT name
          FROM sqlite_master
          WHERE type = 'index' AND name = 'idx_projection_turns_thread_keyset'
        `;
      assert.deepStrictEqual(indexes, [{ name: "idx_projection_turns_thread_keyset" }]);

      const repairs = yield* sql<{
        readonly migration_id: number;
        readonly name: string;
      }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id = 55
        `;
      assert.deepStrictEqual(repairs, [
        {
          migration_id: 55,
          name: "ProjectionTurnsKeysetIndexRepair",
        },
      ]);
    }),
  );
});

makeLayer()("044_ProjectionTurnsKeysetIndexRepair idempotent", (it) => {
  it.effect("is a no-op when the keyset index already exists from migration 37", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations();

      const indexes = yield* sql<{ readonly name: string }>`
          SELECT name
          FROM sqlite_master
          WHERE type = 'index' AND name = 'idx_projection_turns_thread_keyset'
        `;
      assert.deepStrictEqual(indexes, [{ name: "idx_projection_turns_thread_keyset" }]);

      const migrations = yield* sql<{
        readonly migration_id: number;
        readonly name: string;
      }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id IN (37, 44, 55)
          ORDER BY migration_id
        `;
      assert.deepStrictEqual(migrations, [
        {
          migration_id: 37,
          name: "ProjectionTurnsKeysetIndex",
        },
        {
          migration_id: 44,
          name: "ClearAutomaticProjectModelDefaults",
        },
        {
          migration_id: 55,
          name: "ProjectionTurnsKeysetIndexRepair",
        },
      ]);
    }),
  );
});
