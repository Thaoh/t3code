import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { discoverCursorSkills } from "./CursorSkills.ts";

const writeSkill = Effect.fn(function* (
  skillsDir: string,
  directoryName: string,
  contents: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const skillDir = path.join(skillsDir, directoryName);
  yield* fs.makeDirectory(skillDir, { recursive: true });
  yield* fs.writeFileString(path.join(skillDir, "SKILL.md"), contents);
});

it.layer(NodeServices.layer)("discoverCursorSkills", (it) => {
  it.effect("discovers user agents and cursor skills; cursor wins the same name", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-cursor-skills-" });
      const home = path.join(tempDir, "home");

      yield* writeSkill(
        path.join(home, ".agents", "skills"),
        "stamp",
        ["---", "name: stamp", "description: Agents stamp.", "---", "", "# Agents"].join("\n"),
      );
      yield* writeSkill(
        path.join(home, ".cursor", "skills"),
        "stamp",
        ["---", "name: stamp", "description: Cursor stamp.", "---", "", "# Cursor"].join("\n"),
      );
      yield* writeSkill(
        path.join(home, ".agents", "skills"),
        "grill-me",
        ["---", "name: grill-me", "description: Grill a loose idea.", "---"].join("\n"),
      );

      const skills = yield* discoverCursorSkills(undefined, home);

      assert.deepEqual(skills, [
        {
          name: "grill-me",
          path: path.join(home, ".agents", "skills", "grill-me", "SKILL.md"),
          enabled: true,
          scope: "user",
          description: "Grill a loose idea.",
        },
        {
          name: "stamp",
          path: path.join(home, ".cursor", "skills", "stamp", "SKILL.md"),
          enabled: true,
          scope: "user",
          description: "Cursor stamp.",
        },
      ]);
    }),
  );

  it.effect("project .cursor beats user skills of the same name", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-cursor-skills-" });
      const home = path.join(tempDir, "home");
      const workspace = path.join(tempDir, "workspace");

      yield* writeSkill(
        path.join(home, ".agents", "skills"),
        "stamp",
        ["---", "name: stamp", "description: User stamp.", "---"].join("\n"),
      );
      yield* writeSkill(
        path.join(workspace, ".cursor", "skills"),
        "stamp",
        ["---", "name: stamp", "description: Project stamp.", "---"].join("\n"),
      );

      const skills = yield* discoverCursorSkills(workspace, home);

      assert.deepEqual(skills, [
        {
          name: "stamp",
          path: path.join(workspace, ".cursor", "skills", "stamp", "SKILL.md"),
          enabled: true,
          scope: "project",
          description: "Project stamp.",
        },
      ]);
    }),
  );

  it.effect("skips malformed frontmatter and missing SKILL.md", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempDir = yield* fs.makeTempDirectoryScoped({ prefix: "t3-cursor-skills-" });
      const home = path.join(tempDir, "home");
      const brokenDir = path.join(home, ".cursor", "skills", "broken");
      yield* fs.makeDirectory(brokenDir, { recursive: true });
      yield* fs.writeFileString(path.join(brokenDir, "SKILL.md"), "---\nname: [\n---\n");
      yield* fs.makeDirectory(path.join(home, ".cursor", "skills", "empty"), { recursive: true });

      const skills = yield* discoverCursorSkills(undefined, home);
      assert.deepEqual(skills, []);
    }),
  );
});
