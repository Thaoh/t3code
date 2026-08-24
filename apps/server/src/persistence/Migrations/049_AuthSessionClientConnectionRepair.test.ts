import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const makeLayer = () => it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

makeLayer()("049_AuthSessionClientConnectionRepair", (it) => {
  it.effect(
    "restores client connection columns when id 41 was recorded as ProjectionThreadsParkedNote",
    () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        // Pre-merge parking builds used id 41 for parked notes. Simulate that
        // history so the real AuthSessionClientConnection migration is skipped.
        yield* runMigrations({ toMigrationInclusive: 40 });
        yield* sql`
          ALTER TABLE projection_threads
          ADD COLUMN parked_note_json TEXT
        `;
        yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES (41, 'ProjectionThreadsParkedNote')
        `;

        const before = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(auth_sessions)
        `;
        assert.ok(!before.some((column) => column.name === "client_surface"));
        assert.ok(!before.some((column) => column.name === "client_app_version"));

        yield* runMigrations();

        const columns = yield* sql<{ readonly name: string; readonly notnull: number }>`
          PRAGMA table_info(auth_sessions)
        `;
        const surface = columns.find((column) => column.name === "client_surface");
        const appVersion = columns.find((column) => column.name === "client_app_version");

        assert.equal(surface?.name, "client_surface");
        assert.equal(surface?.notnull, 0);
        assert.equal(appVersion?.name, "client_app_version");
        assert.equal(appVersion?.notnull, 0);

        const threadColumns = yield* sql<{ readonly name: string }>`
          PRAGMA table_info(projection_threads)
        `;
        assert.ok(threadColumns.some((column) => column.name === "parked_note_json"));

        const repairs = yield* sql<{
          readonly migration_id: number;
          readonly name: string;
        }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id = 49
        `;
        assert.deepStrictEqual(repairs, [
          {
            migration_id: 49,
            name: "AuthSessionClientConnectionRepair",
          },
        ]);
      }),
  );
});

makeLayer()("049_AuthSessionClientConnectionRepair idempotent", (it) => {
  it.effect("is a no-op when client connection columns already exist from migration 41", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations();

      const columns = yield* sql<{ readonly name: string }>`
        PRAGMA table_info(auth_sessions)
      `;
      assert.ok(columns.some((column) => column.name === "client_surface"));
      assert.ok(columns.some((column) => column.name === "client_app_version"));

      const recorded = yield* sql<{
        readonly migration_id: number;
        readonly name: string;
      }>`
        SELECT migration_id, name
        FROM effect_sql_migrations
        WHERE migration_id IN (41, 48, 49)
        ORDER BY migration_id
      `;
      assert.deepStrictEqual(recorded, [
        {
          migration_id: 41,
          name: "AuthSessionClientConnection",
        },
        {
          migration_id: 48,
          name: "ProjectionThreadsParkedNote",
        },
        {
          migration_id: 49,
          name: "AuthSessionClientConnectionRepair",
        },
      ]);
    }),
  );
});
