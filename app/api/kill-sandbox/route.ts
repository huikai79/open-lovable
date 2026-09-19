import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getWorkspaceRuntimeForRequest } from '@/lib/sandbox/workspace-runtime';

export async function POST(request: NextRequest) {
  const runtime = getWorkspaceRuntimeForRequest(request);

  try {
    console.log('[kill-sandbox] Stopping workspace sandbox:', runtime.workspaceKey);
    let sandboxKilled = false;

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

    return NextResponse.json({
      success: true,
      workspaceKey: runtime.workspaceKey,
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
