import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const makeLayer = () => it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

makeLayer()("041_ProjectionThreadsParkedNote", (it) => {
  it.effect("adds parked_note_json column", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 40 });
      yield* runMigrations({ toMigrationInclusive: 41 });

      const columns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_threads)
      `;
      assert.ok(columns.some((column) => column.name === "parked_note_json"));
    }),
  );
});

makeLayer()("041_ProjectionThreadsParkedNote idempotent", (it) => {
  it.effect("continues when parked_note_json was already added", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations({ toMigrationInclusive: 40 });
      yield* sql`
        ALTER TABLE projection_threads
        ADD COLUMN parked_note_json TEXT
      `;

      yield* runMigrations({ toMigrationInclusive: 41 });

      const migrations = yield* sql<{
        readonly migration_id: number;
        readonly name: string;
      }>`
        SELECT migration_id, name
        FROM effect_sql_migrations
        WHERE migration_id = 41
      `;
      assert.deepStrictEqual(migrations, [
        {
          migration_id: 41,
          name: "ProjectionThreadsParkedNote",
        },
      ]);

      const columns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(projection_threads)
      `;
      assert.ok(columns.some((column) => column.name === "parked_note_json"));
    }),
  );
});
