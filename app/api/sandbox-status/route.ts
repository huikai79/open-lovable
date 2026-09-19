import { NextRequest, NextResponse } from 'next/server';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getWorkspaceRuntimeForRequest } from '@/lib/sandbox/workspace-runtime';

export async function GET(request: NextRequest) {
  try {
    const runtime = getWorkspaceRuntimeForRequest(request);
    const provider =
      runtime.provider ||
      (runtime.sandboxData?.sandboxId
        ? sandboxManager.getProvider(runtime.sandboxData.sandboxId)
        : null);
    const sandboxExists = !!provider;

    let sandboxHealthy = false;
    let sandboxInfo = null;

    if (provider) {
      try {
        const providerInfo = provider.getSandboxInfo();
        sandboxHealthy = !!providerInfo;
        sandboxInfo = {
          workspaceKey: runtime.workspaceKey,
          sandboxId: providerInfo?.sandboxId || runtime.sandboxData?.sandboxId,
          url: providerInfo?.url || runtime.sandboxData?.url,
          filesTracked: Array.from(runtime.existingFiles),
          lastHealthCheck: new Date().toISOString(),
        };
      } catch (error) {
        console.error('[sandbox-status] Health check failed:', error);
      }
    }

    return NextResponse.json({
      success: true,
      active: sandboxExists,
      healthy: sandboxHealthy,
      sandboxData: sandboxInfo,
      message: sandboxHealthy
        ? 'Sandbox is active and healthy'
        : sandboxExists
          ? 'Sandbox exists but is not responding'
          : 'No active sandbox',
    });
  } catch (error) {
    console.error('[sandbox-status] Error:', error);
    return NextResponse.json(
      {
        success: false,
        active: false,
        error: (error as Error).message,
      },
      { status: 500 },
    );
  }
}
