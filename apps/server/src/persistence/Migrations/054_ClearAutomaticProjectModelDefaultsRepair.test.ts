import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

const layer = it.layer(Layer.mergeAll(NodeSqliteClient.layerMemory()));

layer("054_ClearAutomaticProjectModelDefaultsRepair", (it) => {
  it.effect(
    "clears create-time seeds when id 44 was recorded as ProjectionTurnsKeysetIndexRepair",
    () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        // Pre-merge parking builds used id 44 for keyset-index repair. Simulate
        // that history so the real ClearAutomaticProjectModelDefaults
        // migration is skipped.
        yield* runMigrations({ toMigrationInclusive: 43 });
        yield* sql`
          INSERT INTO effect_sql_migrations (migration_id, name)
          VALUES (44, 'ProjectionTurnsKeysetIndexRepair')
        `;
        yield* sql`
          INSERT INTO projection_projects (
            project_id,
            title,
            workspace_root,
            default_model_selection_json,
            default_thread_env_mode,
            favicon_path,
            scripts_json,
            created_at,
            updated_at,
            deleted_at
          )
          VALUES
            ('project-auto', 'Auto', '/tmp/auto', '{"instanceId":"codex","model":"gpt-5.6-sol"}', NULL, NULL, '[]', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z', NULL)
        `;
        yield* sql`
          INSERT INTO orchestration_events (
            event_id,
            aggregate_kind,
            stream_id,
            stream_version,
            event_type,
            occurred_at,
            command_id,
            causation_event_id,
            correlation_id,
            actor_kind,
            payload_json,
            metadata_json
          )
          VALUES
            ('event-auto-create', 'project', 'project-auto', 0, 'project.created', '2026-08-01T00:00:00.000Z', 'command-auto-create', NULL, 'command-auto-create', 'client', '{"defaultModelSelection":{"instanceId":"codex","model":"gpt-5.6-sol"}}', '{}')
        `;

        const before = yield* sql<{ readonly selection: string | null }>`
          SELECT default_model_selection_json AS "selection"
          FROM projection_projects
          WHERE project_id = 'project-auto'
        `;
        assert.deepStrictEqual(before, [
          { selection: '{"instanceId":"codex","model":"gpt-5.6-sol"}' },
        ]);

        yield* runMigrations();

        const projects = yield* sql<{ readonly selection: string | null }>`
          SELECT default_model_selection_json AS "selection"
          FROM projection_projects
          WHERE project_id = 'project-auto'
        `;
        assert.deepStrictEqual(projects, [{ selection: null }]);

        const createdEvents = yield* sql<{ readonly model: string | null }>`
          SELECT json_extract(payload_json, '$.defaultModelSelection.model') AS "model"
          FROM orchestration_events
          WHERE event_id = 'event-auto-create'
        `;
        assert.deepStrictEqual(createdEvents, [{ model: null }]);

        const repairs = yield* sql<{
          readonly migration_id: number;
          readonly name: string;
        }>`
          SELECT migration_id, name
          FROM effect_sql_migrations
          WHERE migration_id = 54
        `;
        assert.deepStrictEqual(repairs, [
          {
            migration_id: 54,
            name: "ClearAutomaticProjectModelDefaultsRepair",
          },
        ]);
      }),
  );
});
