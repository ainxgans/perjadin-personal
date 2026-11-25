import { createSignal, createMemo } from 'solid-js';
import {
  Workspace,
  CurrentWorkspaceData,
  getWorkspaces,
  getCurrentWorkspace,
  createWorkspace as apiCreateWorkspace,
  joinWorkspace as apiJoinWorkspace,
  regenerateJoinCode as apiRegenerateJoinCode,
  removeWorkspaceMember as apiRemoveWorkspaceMember,
} from '../api';

const ACTIVE_WS_KEY = 'active_workspace_id';

const [workspaces, setWorkspaces] = createSignal<Workspace[]>([]);
const [currentWorkspaceData, setCurrentWorkspaceData] = createSignal<CurrentWorkspaceData | null>(null);
const [activeWorkspaceId, setActiveWorkspaceIdState] = createSignal<string>(
  typeof localStorage !== 'undefined' ? localStorage.getItem(ACTIVE_WS_KEY) || '' : ''
);
const [isLoading, setIsLoading] = createSignal<boolean>(false);

export const activeWorkspace = createMemo(() => {
  const current = currentWorkspaceData()?.workspace;
  if (current) return current;
  const list = workspaces();
  const id = activeWorkspaceId();
  if (id) {
    const found = list.find((w) => w.id === id);
    if (found) return found;
  }
  return list[0] || null;
});

export const workspaceMembers = createMemo(() => {
  return currentWorkspaceData()?.members || [];
});

export const isWorkspaceOwner = createMemo(() => {
  const ws = activeWorkspace();
  return ws?.role === 'owner';
});

export async function refreshWorkspaces() {
  setIsLoading(true);
  try {
    const list = await getWorkspaces();
    setWorkspaces(list);

    let activeId = activeWorkspaceId();
    if (!activeId || !list.some((w) => w.id === activeId)) {
      if (list.length > 0) {
        activeId = list[0].id;
        setActiveWorkspaceId(activeId);
      }
    }

    if (activeId) {
      const current = await getCurrentWorkspace();
      setCurrentWorkspaceData(current);
    }
  } catch (err) {
    console.error('Failed to load workspaces:', err);
  } finally {
    setIsLoading(false);
  }
}

export function setActiveWorkspaceId(id: string) {
  setActiveWorkspaceIdState(id);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(ACTIVE_WS_KEY, id);
  }
}

export async function switchWorkspace(id: string) {
  setActiveWorkspaceId(id);
  try {
    const current = await getCurrentWorkspace();
    setCurrentWorkspaceData(current);
  } catch (err) {
    console.error('Failed to switch workspace:', err);
  }
}

export async function createNewWorkspace(nama: string) {
  const ws = await apiCreateWorkspace({ nama });
  setActiveWorkspaceId(ws.id);
  await refreshWorkspaces();
  return ws;
}

export async function joinWorkspaceByCode(code: string) {
  const ws = await apiJoinWorkspace(code);
  setActiveWorkspaceId(ws.id);
  await refreshWorkspaces();
  return ws;
}

export async function regenerateCode() {
  const res = await apiRegenerateJoinCode();
  const current = currentWorkspaceData();
  if (current) {
    setCurrentWorkspaceData({
      ...current,
      join_code: res.join_code,
      workspace: {
        ...current.workspace,
        join_code: res.join_code,
      },
    });
  }
  return res.join_code;
}

export async function removeMember(userId: string) {
  const ws = activeWorkspace();
  if (!ws) return;
  await apiRemoveWorkspaceMember(ws.id, userId);
  const current = await getCurrentWorkspace();
  setCurrentWorkspaceData(current);
}

export {
  workspaces,
  currentWorkspaceData,
  activeWorkspaceId,
  isLoading,
};
