import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import {
  clearWorkspaceRuntime,
  getWorkspaceRuntimeForRequest,
  requestWorkspaceTermination,
  type WorkspaceRuntime,
} from '@/lib/sandbox/workspace-runtime';

export async function POST(request: NextRequest) {
  let runtime: WorkspaceRuntime;
  try {
    runtime = getWorkspaceRuntimeForRequest(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 },
    );
  }

  const workspaceKey = runtime.workspaceKey;
  requestWorkspaceTermination(runtime);

  let sandboxKilled = false;
  let terminationError: Error | null = null;

  console.log('[kill-sandbox] Stopping workspace sandbox:', workspaceKey);

  if (runtime.creationPromise) {
    try {
      await runtime.creationPromise;
    } catch {
      // Failed/cancelled creation performs its own provider cleanup.
    }
  }

  try {
    if (runtime.sandboxData?.sandboxId) {
      await sandboxManager.terminateSandbox(runtime.sandboxData.sandboxId);
      sandboxKilled = true;
    } else if (runtime.provider) {
      await runtime.provider.terminate();
      sandboxKilled = true;
    }
  } catch (error) {
    terminationError =
      error instanceof Error ? error : new Error(String(error));
    console.error('[kill-sandbox] Remote termination failed:', terminationError);
  } finally {
    runtime.creationPromise = null;
    runtime.provider = null;
    runtime.sandbox = null;
    runtime.sandboxData = null;
    runtime.fileCache = null;
    runtime.existingFiles.clear();
    runtime.conversationState = null;
    runtime.viteRestartInProgress = false;
    runtime.lastViteRestartTime = 0;
    clearWorkspaceRuntime(workspaceKey);
  }

  if (terminationError) {
    return NextResponse.json(
      {
        success: false,
        workspaceKey,
        sandboxKilled: false,
        localStateCleared: true,
        error: terminationError.message,
        message:
          'Local workspace state was cleared, but remote sandbox termination failed',
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    workspaceKey,
    sandboxKilled,
    localStateCleared: true,
    message: 'Sandbox cleaned up successfully',
  });
}
