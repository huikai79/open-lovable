import { NextRequest, NextResponse } from 'next/server';
import { SandboxFactory } from '@/lib/sandbox/factory';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getWorkspaceRuntimeForRequest } from '@/lib/sandbox/workspace-runtime';

export async function POST(request: NextRequest) {
  const runtime = getWorkspaceRuntimeForRequest(request);
  let provider: any = null;

  try {
    console.log('[create-ai-sandbox-v2] Creating sandbox for workspace:', runtime.workspaceKey);

    if (runtime.sandboxData?.sandboxId) {
      await sandboxManager.terminateSandbox(runtime.sandboxData.sandboxId);
    } else if (runtime.provider) {
      await runtime.provider.terminate();
    }

    runtime.provider = null;
    runtime.sandbox = null;
    runtime.sandboxData = null;
    runtime.fileCache = null;
    runtime.existingFiles.clear();

    provider = SandboxFactory.create();
    const sandboxInfo = await provider.createSandbox();

    console.log('[create-ai-sandbox-v2] Setting up Vite React app...');
    await provider.setupViteApp();

    sandboxManager.registerSandbox(sandboxInfo.sandboxId, provider);

    runtime.provider = provider;
    runtime.sandbox = provider;
    runtime.sandboxData = {
      sandboxId: sandboxInfo.sandboxId,
      url: sandboxInfo.url,
    };
    runtime.fileCache = {
      files: {},
      lastSync: Date.now(),
      sandboxId: sandboxInfo.sandboxId,
    };
    runtime.lastAccessed = Date.now();

    console.log('[create-ai-sandbox-v2] Sandbox ready at:', sandboxInfo.url);

    return NextResponse.json({
      success: true,
      workspaceKey: runtime.workspaceKey,
      sandboxId: sandboxInfo.sandboxId,
      url: sandboxInfo.url,
      provider: sandboxInfo.provider,
      message: 'Sandbox created and Vite React app initialized',
    });
  } catch (error) {
    console.error('[create-ai-sandbox-v2] Error:', error);

    if (provider) {
      try {
        await provider.terminate();
      } catch (cleanupError) {
        console.error('[create-ai-sandbox-v2] Cleanup failed:', cleanupError);
      }
    }

    runtime.provider = null;
    runtime.sandbox = null;
    runtime.sandboxData = null;
    runtime.fileCache = null;
    runtime.existingFiles.clear();

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
