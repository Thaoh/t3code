import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "@t3tools/shared/nodeSqliteClient";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

const MODEL_SELECTION = '{"instanceId":"codex","model":"gpt-5.6-sol"}';

layer("057_RepairAutomaticSettlementTimestampsRepair", (it) => {
  it.effect(
    "repairs automatic stamps when id 46 was recorded as ProjectionProjectsDefaultThreadEnvModeRepair",
    () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        yield* runMigrations({ toMigrationInclusive: 45 });
        yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES (46, 'ProjectionProjectsDefaultThreadEnvModeRepair')
        `;

        yield* sql`
          INSERT INTO projection_threads (
            thread_id, project_id, title, model_selection_json, latest_turn_id,
            created_at, updated_at, latest_user_message_at, settled_override, settled_at, deleted_at
          )
          VALUES (
            'thread-auto', 'project-1', 'Automatic', ${MODEL_SELECTION}, 'turn-auto',
            '2026-05-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z',
            'settled', '2026-09-01T00:00:00.000Z', NULL
          )
        `;
        yield* sql`
          INSERT INTO projection_thread_messages (
            message_id, thread_id, turn_id, role, text, is_streaming, created_at, updated_at
          )
          VALUES (
            'message-auto', 'thread-auto', 'turn-auto', 'user', 'Prompt', 0,
            '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'
          )
        `;
        yield* sql`
          INSERT INTO projection_turns (
            thread_id, turn_id, state, requested_at, started_at, completed_at, checkpoint_files_json
          )
          VALUES (
            'thread-auto', 'turn-auto', 'completed',
            '2026-06-02T00:00:00.000Z', '2026-06-02T00:01:00.000Z', '2026-06-03T00:00:00.000Z', '[]'
          )
        `;
        yield* sql`
          INSERT INTO orchestration_events (
            event_id, aggregate_kind, stream_id, stream_version, event_type, occurred_at,
            command_id, causation_event_id, correlation_id, actor_kind, payload_json, metadata_json
          )
          VALUES (
            'event-auto', 'thread', 'thread-auto', 0, 'thread.settled', '2026-09-01T00:00:00.000Z',
            'server:auto-settle:thread-auto:uuid', NULL, 'server:auto-settle:thread-auto:uuid',
            'server', '{"threadId":"thread-auto","settledAt":"2026-09-01T00:00:00.000Z","updatedAt":"2026-09-01T00:00:00.000Z"}', '{}'
          )
        `;

        yield* runMigrations();

        const threads = yield* sql<{ readonly settledAt: string }>`
          SELECT settled_at AS "settledAt"
          FROM projection_threads
          WHERE thread_id = 'thread-auto'
        `;
        assert.deepStrictEqual(threads, [{ settledAt: "2026-06-03T00:00:00.000Z" }]);

        const repairs = yield* sql<{
          readonly migration_id: number;
          readonly name: string;
        }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id = 57
        `;
        assert.deepStrictEqual(repairs, [
          {
            migration_id: 57,
            name: "RepairAutomaticSettlementTimestampsRepair",
          },
        ]);
      }),
  );
});
