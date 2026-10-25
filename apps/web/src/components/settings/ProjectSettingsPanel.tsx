import { useComposerMenuState } from "../chat/useComposerMenuState";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { AuthOrchestrationOperateScope } from "@t3tools/contracts";
import { useEnvironmentsWithScope, readEnvironmentScope } from "../../state/session";
import {
  isAtomCommandInterrupted,
  mapAtomCommandResult,
  settlePromise,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  planProjectRemoval,
  resolveProjectPathForDispatch,
} from "@t3tools/client-runtime/state/projects";
import { AsyncResult } from "effect/reactivity";
import { type EnvironmentId, type ProjectIconOverride } from "@t3tools/contracts";
import { useLocation, useNavigate } from "@tanstack/react-router";
import * as Cause from "effect/Cause";
import { InfoIcon, Trash2Icon } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";

import { useComposerDraftStore } from "../../composerDraftStore";
import { persistClientSettingsUpdate } from "../../hooks/useSettings";
import { releaseProjectDraftUploads } from "../../lib/composerDraftUploads";
import { readLocalApi } from "../../localApi";
import {
  type SidebarProjectGroupMember,
  type SidebarProjectSnapshot,
} from "../../sidebarProjectGrouping";
import { useEnvironments, usePrimaryEnvironmentId } from "../../state/environments";
import { useThreadShells, waitForProjectRemoval } from "../../state/entities";
import { projectEnvironment } from "../../state/projects";
import { renamePreferenceRecord, useUiStateStore } from "../../uiStateStore";
import { ProjectFavicon } from "../ProjectFavicon";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { stackedThreadToast, toastManager } from "../ui/toast";
import {
  SettingResetButton,
  SettingsPageContainer,
  SettingsRow,
  SettingsSection,
} from "./settingsLayout";
import {
  canPickExternalProjectFavicon,
  ProjectFaviconPickerDialog,
} from "./ProjectFaviconPickerDialog";
import { ProjectActionsSettings } from "./ProjectActionsSettings";
import { ProjectDefaultsSettings } from "./ProjectDefaultsSettings";
import {
  projectFolderKeyRenames,
  projectGroupTitleNeedsUpdate,
} from "./ProjectSettingsPanel.logic";
import { useSettingsProjectGroups } from "./useSettingsProjectGroups";
import { settingsScopeEnvironmentLabels } from "./settingsScopeAxis";

const ProjectIconPickerDialog = lazy(() =>
  import("./ProjectIconPickerDialog").then((module) => ({
    default: module.ProjectIconPickerDialog,
  })),
);

function memberKey(member: { environmentId: string; id: string }): string {
  return `${member.environmentId}:${member.id}`;
}

export type ProjectSettingsCategory = "general" | "source-control" | "project";

export function ProjectSettingsPanel({
  projectKey,
  environmentId = null,
  checkoutKey = null,
  unavailable,
}: {
  projectKey: string;
  environmentId?: EnvironmentId | null;
  checkoutKey?: string | null;
  unavailable?: ReactNode;
}) {
  const groups = useSettingsProjectGroups();
  const navigate = useNavigate({ from: "/settings" });
  const pathname = useLocation({ select: (location) => location.pathname });

  const selected = groups.find((group) => group.projectKey === projectKey) ?? null;
  const members =
    selected?.memberProjects.filter(
      (member) =>
        (environmentId === null || member.environmentId === environmentId) &&
        (checkoutKey === null || member.physicalProjectKey === checkoutKey),
    ) ?? [];

  // Retain group members so a grouping-rule change or a moved folder can follow the project.
  const lastSelectionRef = useRef<{
    key: string;
    environmentId: EnvironmentId | null;
    checkoutKey: string | null;
    memberKeys: string[];
  } | null>(null);
  useEffect(() => {
    if (!selected || members.length === 0) return;
    lastSelectionRef.current = {
      key: selected.projectKey,
      environmentId,
      checkoutKey,
      memberKeys: members.map(memberKey),
    };
  }, [selected, members, environmentId, checkoutKey]);

  useEffect(() => {
    if (members.length > 0) return;
    const last = lastSelectionRef.current;
    if (
      last?.key !== projectKey ||
      last.environmentId !== environmentId ||
      last.checkoutKey !== checkoutKey
    )
      return;
    const successor = groups
      .flatMap((group) => group.memberProjects.map((member) => ({ group, member })))
      .find(({ member }) => last.memberKeys.includes(memberKey(member)));
    if (successor) {
      void navigate({
        to: pathname,
        search: () => ({
          project: successor.group.projectKey,
          machine: environmentId ?? undefined,
          checkout: checkoutKey === null ? undefined : successor.member.physicalProjectKey,
        }),
        replace: true,
        hashScrollIntoView: false,
      });
    }
  }, [groups, navigate, pathname, projectKey, members.length, environmentId, checkoutKey]);

  if ((!selected || members.length === 0) && unavailable != null) return unavailable;

  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        {groups.length === 0
          ? "Add a project from the sidebar to configure it here."
          : "This project is no longer available."}
      </div>
    );
  }
  if (members.length === 0)
    return (
      <p className="p-8 text-sm text-muted-foreground">
        This checkout is no longer available in the selected project and environment.
      </p>
    );
  const scopedGroup = {
    ...selected,
    memberProjects: members,
    environmentId: members[0]!.environmentId,
    id: members[0]!.id,
  };
  return (
    <ProjectDetail
      key={`${selected.projectKey}:${environmentId ?? "all"}:${checkoutKey ?? "all"}`}
      group={scopedGroup}
      hasOtherMembers={members.length < selected.memberProjects.length}
    />
  );
}

function ProjectDetail({
  group,
  hasOtherMembers,
}: {
  group: SidebarProjectSnapshot;
  hasOtherMembers: boolean;
}) {
  const navigate = useNavigate({ from: "/settings" });
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const { environments } = useEnvironments();
  const environmentById = new Map(
    environments.map((environment) => [environment.environmentId, environment]),
  );
  const editableIds = useEnvironmentsWithScope(group.memberProjects, AuthOrchestrationOperateScope);
  const canEditGroup = group.memberProjects.every((member) =>
    editableIds.has(member.environmentId),
  );
  const representative =
    group.memberProjects.find(
      (member) => environmentById.get(member.environmentId)?.serverConfig != null,
    ) ?? group.memberProjects[0]!;
  const threads = useThreadShells();
  const updateProject = useOrchestrationCommand(projectEnvironment.update, {
    reportFailure: false,
  });
  const deleteProject = useOrchestrationCommand(projectEnvironment.delete, {
    reportFailure: false,
  });
  const projectNameEditedRef = useRef(false);

  const faviconPath = representative.faviconPath ?? null;
  const projectIcon = representative.projectIcon ?? null;
  const pickProjectFavicon =
    typeof window !== "undefined" &&
    group.memberProjects.every(
      (member) =>
        member.environmentId === primaryEnvironmentId &&
        canPickExternalProjectFavicon(member.workspaceRoot, navigator.platform),
    )
      ? window.desktopBridge?.pickProjectFavicon
      : undefined;

  const reportFailure = (title: string, result: AtomCommandResult<void, unknown>) => {
    if (result._tag !== "Failure" || isAtomCommandInterrupted(result)) return;
    const error = squashAtomCommandFailure(result);
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title,
        description: error instanceof Error ? error.message : "An error occurred.",
      }),
    );
  };

  const checkProjectAccess = (
    members: ReadonlyArray<SidebarProjectGroupMember>,
    failureTitle: string,
  ) => {
    const denied = members.find(
      (member) => !readEnvironmentScope(member.environmentId, AuthOrchestrationOperateScope),
    );
    if (!denied) return null;
    const result = AsyncResult.failure<void, Error>(
      Cause.fail(
        new Error(
          `This connection cannot change projects in ${denied.environmentLabel ?? "this environment"}.`,
        ),
      ),
    );
    reportFailure(failureTitle, result);
    return result;
  };

  const updateAllMembers = async (
    input: Partial<{
      title: string;
      faviconPath: string | null;
      projectIcon: ProjectIconOverride | null;
    }>,
    failureTitle: string,
  ): Promise<AtomCommandResult<void, unknown>> => {
    const denied = checkProjectAccess(group.memberProjects, failureTitle);
    if (denied) return denied;
    const unavailable = group.memberProjects.find((member) => {
      const environment = environmentById.get(member.environmentId);
      return environment?.connection.phase !== "connected" || !environment.serverConfig;
    });
    if (unavailable) {
      const error = new Error(
        `Connect ${unavailable.environmentLabel ?? "the selected environment"} and try again.`,
      );
      const result: AtomCommandResult<void, unknown> = AsyncResult.failure(Cause.fail(error));
      reportFailure(failureTitle, result);
      return result;
    }
    for (const member of group.memberProjects) {
      const revoked = checkProjectAccess([member], failureTitle);
      if (revoked) return revoked;
      const result = mapAtomCommandResult(
        await updateProject({
          environmentId: member.environmentId,
          input: { projectId: member.id, ...input },
        }),
        () => undefined,
      );
      if (result._tag === "Failure") {
        reportFailure(
          group.memberProjects.length > 1
            ? `${failureTitle} on ${member.environmentLabel ?? "the current environment"}`
            : failureTitle,
          result,
        );
        return result;
      }
    }
    return AsyncResult.success(undefined);
  };

  const renameGroup = async (nextTitle: string, wasEdited: boolean) => {
    const title = nextTitle.trim();
    if (!title) {
      toastManager.add({ type: "warning", title: "Project title cannot be empty" });
      return;
    }
    if (
      !projectGroupTitleNeedsUpdate(
        group.memberProjects.map((member) => member.title),
        title,
        wasEdited,
      )
    ) {
      return;
    }
    await updateAllMembers({ title }, "Failed to rename project");
  };

  const [faviconPickerOpen, setFaviconPickerOpen] = useComposerMenuState(!canEditGroup);
  const [iconPickerOpen, setIconPickerOpen] = useComposerMenuState(!canEditGroup);
  const [isSavingFavicon, setIsSavingFavicon] = useState(false);
  const savingFaviconRef = useRef(false);
  const setProjectIcon = async (input: {
    faviconPath: string | null;
    projectIcon: ProjectIconOverride | null;
  }) => {
    if (savingFaviconRef.current) return;
    savingFaviconRef.current = true;
    setIsSavingFavicon(true);
    await updateAllMembers(input, "Failed to update project icon");
    savingFaviconRef.current = false;
    setIsSavingFavicon(false);
  };

  const hasMultipleCheckouts = group.memberProjects.length > 1;

  // Points one checkout at its folder after it moved on disk. Resolves to
  // whether the checkout now uses the requested folder.
  const moveMember = async (
    member: SidebarProjectGroupMember,
    nextRoot: string,
  ): Promise<boolean> => {
    // `../renamed` means next to the old folder, as when adding a project.
    const workspaceRoot = resolveProjectPathForDispatch(nextRoot, member.workspaceRoot);
    if (!workspaceRoot) return false;
    if (checkProjectAccess([member], "Failed to change project folder")) return false;
    if (workspaceRoot === member.workspaceRoot) return true;
    const result = await updateProject({
      environmentId: member.environmentId,
      input: { projectId: member.id, workspaceRoot },
    });
    if (result._tag === "Success") {
      // Sidebar order, expansion, scope and grouping are keyed by the folder.
      const renames = projectFolderKeyRenames(
        member.environmentId,
        member.workspaceRoot,
        result.value.workspaceRoot,
      );
      useUiStateStore.getState().renameProjectPreferenceKeys(renames);
      void persistClientSettingsUpdate((current) =>
        current.sidebarProjectGroupingOverrides === undefined
          ? current
          : {
              ...current,
              sidebarProjectGroupingOverrides: renamePreferenceRecord(
                current.sidebarProjectGroupingOverrides,
                renames,
              ),
            },
      );
    }
    reportFailure(
      "Failed to change project folder",
      mapAtomCommandResult(result, () => undefined),
    );
    return result._tag === "Success";
  };
  const folderControl = (member: SidebarProjectGroupMember) => (
    <ProjectFolderControl
      member={member}
      disabled={!editableIds.has(member.environmentId)}
      canBrowse={
        member.environmentId === primaryEnvironmentId &&
        typeof window !== "undefined" &&
        window.desktopBridge !== undefined &&
        canPickExternalProjectFavicon(member.workspaceRoot, navigator.platform)
      }
      onMove={(nextRoot) => moveMember(member, nextRoot)}
    />
  );

  const removeMembers = async (members: ReadonlyArray<SidebarProjectGroupMember>) => {
    if (checkProjectAccess(members, "Failed to remove project")) return;
    const api = readLocalApi();
    if (!api) return;

    const { projectThreads, isWholeGroup, confirmationMessage } = planProjectRemoval({
      members,
      groupMemberCount: group.memberProjects.length,
      hasOtherMembers,
      displayName: group.displayName,
      threads,
    });
    const confirmed = await settlePromise(() =>
      api.dialogs.confirm(confirmationMessage, { variant: "destructive" }),
    );
    if (confirmed._tag === "Failure" || !confirmed.value) return;
    if (checkProjectAccess(members, "Failed to remove project")) return;

    const draftStore = useComposerDraftStore.getState();
    for (const member of members) {
      if (checkProjectAccess([member], "Failed to remove project")) return;
      const memberThreads = projectThreads.filter(
        (thread) => thread.environmentId === member.environmentId && thread.projectId === member.id,
      );
      const result = mapAtomCommandResult(
        await deleteProject({
          environmentId: member.environmentId,
          input: {
            projectId: member.id,
            force: true,
          },
        }),
        () => undefined,
      );
      if (result._tag === "Failure") {
        reportFailure(`Failed to remove "${member.title}"`, result);
        return;
      }
      const projectRef = scopeProjectRef(member.environmentId, member.id);
      await waitForProjectRemoval(projectRef);
      releaseProjectDraftUploads(
        projectRef,
        memberThreads.map((thread) => scopeThreadRef(thread.environmentId, thread.id)),
      );
      const projectDraftThread = draftStore.getDraftThreadByProjectRef(projectRef);
      if (projectDraftThread) {
        draftStore.clearDraftThread(projectDraftThread.draftId);
      }
      draftStore.clearProjectDraftThreadId(projectRef);
    }

    if (isWholeGroup && !hasOtherMembers) {
      void navigate({
        to: "/settings/projects",
        search: ({ machine }) => ({ project: undefined, machine, checkout: undefined }),
        replace: true,
      });
    }
  };

  const checkoutsByEnvironment = new Map<EnvironmentId, SidebarProjectGroupMember[]>();
  for (const member of group.memberProjects) {
    const members = checkoutsByEnvironment.get(member.environmentId);
    if (members) members.push(member);
    else checkoutsByEnvironment.set(member.environmentId, [member]);
  }
  const checkoutControls = (member: SidebarProjectGroupMember) => (
    <div className="flex items-center gap-2">
      {folderControl(member)}
      <Button
        size="sm"
        variant="outline"
        disabled={!editableIds.has(member.environmentId)}
        onClick={() => void removeMembers([member])}
        aria-label={`Remove checkout ${member.workspaceRoot}`}
      >
        Remove
      </Button>
    </div>
  );
  const checkoutChoices = (
    <SettingsSection title="Checkouts">
      {Array.from(checkoutsByEnvironment, ([environmentId, members]) => {
        if (checkoutsByEnvironment.size === 1) {
          return members.map((member) => (
            <SettingsRow
              key={member.physicalProjectKey}
              title={member.environmentLabel ?? "Environment"}
              description="Change the folder if this checkout moved on disk."
              control={checkoutControls(member)}
            />
          ));
        }
        const firstMember = members[0]!;
        const hasMultiple = members.length > 1;
        const environment = environmentById.get(environmentId);
        const labels = environment
          ? settingsScopeEnvironmentLabels(environment, environments)
          : { primary: firstMember.environmentLabel ?? "Environment", secondary: environmentId };
        return (
          <SettingsRow
            key={environmentId}
            title={labels.primary}
            description={
              labels.secondary ? <span className="block truncate">{labels.secondary}</span> : null
            }
            control={hasMultiple ? undefined : checkoutControls(firstMember)}
          >
            {hasMultiple ? (
              <div className="space-y-3 pb-2 pt-1">
                {members.map((member) => (
                  <div key={member.physicalProjectKey} className="flex min-w-0 justify-end">
                    {checkoutControls(member)}
                  </div>
                ))}
              </div>
            ) : null}
          </SettingsRow>
        );
      })}
    </SettingsSection>
  );

  return (
    <>
      <SettingsPageContainer className="gap-6">
        <Alert variant="info">
          <InfoIcon aria-hidden />
          <AlertDescription>
            Can't find a setting? Keep this project picked above and hop to any other settings page.
          </AlertDescription>
        </Alert>
        <SettingsSection id="project-overview" title="Project" hideTitle>
          {!canEditGroup ? (
            <p className="px-3 py-2 text-sm text-muted-foreground sm:px-4">
              {group.memberProjects.length > 1
                ? "Shared settings require permission to change every checkout in this group."
                : "This connection cannot change this project."}
            </p>
          ) : null}
          <SettingsRow
            title="Name"
            description="The shared name for this project group in the sidebar and thread lists."
            control={
              <Input
                key={`${group.projectKey}:${group.displayName}`}
                size="sm"
                className="w-full sm:w-64"
                aria-label="Project name"
                disabled={!canEditGroup}
                defaultValue={group.displayName}
                onChange={() => {
                  projectNameEditedRef.current = true;
                }}
                onBlur={(event) => {
                  const wasEdited = projectNameEditedRef.current;
                  projectNameEditedRef.current = false;
                  void renameGroup(event.currentTarget.value, wasEdited);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            }
          />
          <SettingsRow
            title="Project icon"
            description={
              projectIcon?.kind === "lucide"
                ? `${projectIcon.name} · ${projectIcon.color}`
                : projectIcon?.kind === "monogram"
                  ? `${projectIcon.text} · ${projectIcon.color}`
                  : projectIcon?.kind === "emoji"
                    ? projectIcon.emoji
                    : (faviconPath ?? "Automatic")
            }
            resetAction={
              group.memberProjects.some(
                (member) => member.faviconPath != null || member.projectIcon != null,
              ) ? (
                <SettingResetButton
                  label="project icon"
                  disabled={isSavingFavicon || !canEditGroup}
                  onClick={() => void setProjectIcon({ faviconPath: null, projectIcon: null })}
                />
              ) : null
            }
            control={
              <div className="flex items-center gap-2">
                <ProjectFavicon project={representative} className="size-6" />
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  aria-label="Choose a project icon"
                  disabled={isSavingFavicon || !canEditGroup}
                  onClick={() => setIconPickerOpen(true)}
                >
                  Choose icon
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  aria-label="Choose a project icon file"
                  disabled={isSavingFavicon || !canEditGroup}
                  onClick={() => setFaviconPickerOpen(true)}
                >
                  Choose file
                </Button>
              </div>
            }
          />
          {hasMultipleCheckouts ? null : (
            <SettingsRow
              title="Folder"
              description="Where this project lives on disk. Change it after moving the folder."
              control={folderControl(representative)}
            />
          )}
        </SettingsSection>
        <ProjectDefaultsSettings category="project" />
        <ProjectActionsSettings />
        {hasMultipleCheckouts ? checkoutChoices : null}
        <SettingsSection title="Danger">
          <SettingsRow
            title={
              hasOtherMembers
                ? "Remove checkout"
                : group.memberProjects.length > 1
                  ? "Remove this project everywhere"
                  : "Remove project"
            }
            description={
              hasOtherMembers
                ? "Deletes the selected machine's checkout entries and their threads. Other machines and files on disk are not touched."
                : group.memberProjects.length > 1
                  ? `Deletes all ${group.memberProjects.length} checkout entries and their threads on every machine. Files on disk are not touched.`
                  : "Deletes the project entry and its threads. Files on disk are not touched."
            }
            control={
              <Button
                size="sm"
                variant="destructive-outline"
                disabled={!canEditGroup}
                onClick={() => void removeMembers(group.memberProjects)}
              >
                <Trash2Icon />
                {hasOtherMembers
                  ? "Remove checkout"
                  : group.memberProjects.length > 1
                    ? "Remove all entries"
                    : "Remove project"}
              </Button>
            }
          />
        </SettingsSection>
      </SettingsPageContainer>

      <ProjectFaviconPickerDialog
        key={`${representative.environmentId}:${representative.workspaceRoot}:${faviconPickerOpen}`}
        cwd={representative.workspaceRoot}
        environmentId={representative.environmentId}
        onOpenChange={setFaviconPickerOpen}
        {...(pickProjectFavicon
          ? { onPickExternal: () => pickProjectFavicon(representative.workspaceRoot) }
          : {})}
        onSelect={(path) => void setProjectIcon({ faviconPath: path, projectIcon: null })}
        open={faviconPickerOpen && canEditGroup}
        projectName={group.displayName}
      />
      {iconPickerOpen && canEditGroup ? (
        <Suspense fallback={null}>
          <ProjectIconPickerDialog
            current={projectIcon}
            projectName={representative.title}
            open
            onOpenChange={setIconPickerOpen}
            onSelect={(icon) => void setProjectIcon({ faviconPath: null, projectIcon: icon })}
          />
        </Suspense>
      ) : null}
    </>
  );
}

/** Edits a checkout's folder: type a path, or Browse when the native picker reaches its machine. */
function ProjectFolderControl({
  member,
  disabled,
  canBrowse,
  onMove,
}: {
  member: SidebarProjectGroupMember;
  disabled: boolean;
  canBrowse: boolean;
  onMove: (nextRoot: string) => Promise<boolean>;
}) {
  const browse = async () => {
    const picked = await settlePromise(
      async () => (await readLocalApi()?.dialogs.pickFolder()) ?? null,
    );
    if (picked._tag === "Success" && picked.value) await onMove(picked.value);
  };
  return (
    <div className="flex items-center gap-2">
      <Input
        key={member.workspaceRoot}
        size="sm"
        className="w-full sm:w-72"
        aria-label={`Folder for ${member.environmentLabel ?? member.title}`}
        defaultValue={member.workspaceRoot}
        disabled={disabled}
        spellCheck={false}
        onBlur={(event) => {
          // An emptied field or a rejected path (the toast names it) puts the current folder back.
          const input = event.currentTarget;
          if (!input.value.trim()) {
            input.value = member.workspaceRoot;
            return;
          }
          void onMove(input.value).then((moved) => {
            if (!moved) input.value = member.workspaceRoot;
          });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
      {canBrowse ? (
        <Button
          size="sm"
          variant="outline"
          type="button"
          // Keep focus in the field so a half-typed path is not saved on blur.
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void browse()}
        >
          Browse
        </Button>
      ) : null}
    </div>
  );
}
