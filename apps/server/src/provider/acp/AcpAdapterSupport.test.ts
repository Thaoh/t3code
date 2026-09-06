import { describe, expect, it } from "vite-plus/test";
import * as EffectAcpErrors from "effect-acp/errors";
import * as PlatformError from "effect/PlatformError";
import { ProviderDriverKind, ThreadId, workspaceRootMissingMessage } from "@t3tools/contracts";

import {
  acpPermissionOutcome,
  mapAcpSessionStartError,
  mapAcpToAdapterError,
} from "./AcpAdapterSupport.ts";

describe("AcpAdapterSupport", () => {
  it("maps ACP approval decisions to permission outcomes", () => {
    expect(acpPermissionOutcome("accept")).toBe("allow-once");
    expect(acpPermissionOutcome("acceptForSession")).toBe("allow-always");
    expect(acpPermissionOutcome("decline")).toBe("reject-once");
  });

  it("maps ACP request errors to provider adapter request errors", () => {
    const error = mapAcpToAdapterError(
      ProviderDriverKind.make("cursor"),
      "thread-1" as never,
      "session/prompt",
      new EffectAcpErrors.AcpRequestError({
        code: -32602,
        errorMessage: "Invalid params",
      }),
    );

    expect(error._tag).toBe("ProviderAdapterRequestError");
    expect(error.message).toContain("Invalid params");
  });

  it("maps a missing project directory to a workspace-missing error", () => {
    const cwd = "C:\\Projects\\Web\\teachup-nuxt";
    const error = mapAcpSessionStartError(
      ProviderDriverKind.make("cursor"),
      ThreadId.make("thread-1"),
      cwd,
      new EffectAcpErrors.AcpSpawnError({
        command: "cursor-agent",
        cause: PlatformError.systemError({
          _tag: "NotFound",
          module: "FileSystem",
          method: "access",
          pathOrDescriptor: cwd,
        }),
      }),
    );

    expect(error._tag).toBe("ProviderWorkspaceMissingError");
    expect(error.message).toBe(workspaceRootMissingMessage(cwd));
  });

  it("keeps a missing provider executable as a process error", () => {
    const error = mapAcpSessionStartError(
      ProviderDriverKind.make("cursor"),
      ThreadId.make("thread-1"),
      "/tmp/project",
      new EffectAcpErrors.AcpSpawnError({
        command: "cursor-agent",
        cause: PlatformError.systemError({
          _tag: "NotFound",
          module: "ChildProcess",
          method: "spawn",
          pathOrDescriptor: "cursor-agent",
        }),
      }),
    );

    expect(error._tag).toBe("ProviderAdapterProcessError");
    expect(error.message).toContain("Failed to spawn ACP process for command: cursor-agent");
  });
});
