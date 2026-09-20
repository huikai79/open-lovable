import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import {
  clearWorkspaceRuntime,
  getWorkspaceRuntimeForRequest,
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

  try {
    console.log('[kill-sandbox] Stopping workspace sandbox:', runtime.workspaceKey);
    let sandboxKilled = false;

    if (runtime.creationPromise) {
      try {
        await runtime.creationPromise;
      } catch {
        // Failed creation has already performed its own cleanup.
      } finally {
        runtime.creationPromise = null;
      }
    }

    if (runtime.sandboxData?.sandboxId) {
      await sandboxManager.terminateSandbox(runtime.sandboxData.sandboxId);
      sandboxKilled = true;
    } else if (runtime.provider) {
      await runtime.provider.terminate();
      sandboxKilled = true;
    }

    runtime.provider = null;
    runtime.sandbox = null;
    runtime.sandboxData = null;
    runtime.fileCache = null;
    runtime.existingFiles.clear();
    runtime.viteRestartInProgress = false;
    runtime.lastViteRestartTime = 0;

    const workspaceKey = runtime.workspaceKey;
    clearWorkspaceRuntime(workspaceKey);

    return NextResponse.json({
      success: true,
      workspaceKey,
      sandboxKilled,
      message: 'Sandbox cleaned up successfully',
    });
  } catch (error) {
    console.error('[kill-sandbox] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
