import { assert, it } from "@effect/vitest";
import { ProjectId } from "@t3tools/contracts";

import { WorkspaceRootNotExistsError } from "../workspace/WorkspacePaths.ts";
import { projectMutationFailureMessage } from "./ProjectMutation.ts";
import { ProjectOperationError } from "./ProjectService.ts";

const projectId = ProjectId.make("project:mutation-mapping");

it("explains a missing folder and hides other failures", () => {
  const missing = new ProjectOperationError({
    operation: "normalize-workspace",
    projectId,
    workspaceRoot: "/work/moved",
    cause: new WorkspaceRootNotExistsError({
      workspaceRoot: "/work/moved",
      normalizedWorkspaceRoot: "/work/moved",
    }),
  });
  const dispatch = new ProjectOperationError({
    operation: "dispatch-project-command",
    projectId,
    cause: new Error("database is locked"),
  });

  assert.equal(
    projectMutationFailureMessage(missing),
    "Workspace root does not exist: /work/moved",
  );
  assert.equal(projectMutationFailureMessage(dispatch), "Failed to mutate project.");
});
