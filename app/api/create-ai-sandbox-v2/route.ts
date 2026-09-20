import { NextRequest, NextResponse } from 'next/server';
import { SandboxFactory } from '@/lib/sandbox/factory';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import {
  finishWorkspaceCreation,
  getOrStartWorkspaceCreation,
  getWorkspaceRuntimeForRequest,
  type WorkspaceRuntime,
  type WorkspaceSandboxDescriptor,
} from '@/lib/sandbox/workspace-runtime';

async function createWorkspaceSandbox(
  runtime: WorkspaceRuntime,
): Promise<WorkspaceSandboxDescriptor> {
  let provider: any = null;

  try {
    if (runtime.terminationRequested) {
      throw new Error('Workspace creation cancelled by termination');
    }

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

    if (runtime.terminationRequested) {
      throw new Error('Workspace creation cancelled by termination');
    }

    console.log('[create-ai-sandbox-v2] Setting up Vite React app...');
    await provider.setupViteApp();

    if (runtime.terminationRequested) {
      throw new Error('Workspace creation cancelled by termination');
    }

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

    return {
      sandboxId: sandboxInfo.sandboxId,
      url: sandboxInfo.url,
      provider: sandboxInfo.provider,
    };
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

    throw error;
  }
}

export async function POST(request: NextRequest) {
  let runtime: WorkspaceRuntime;

  try {
    runtime = getWorkspaceRuntimeForRequest(request);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Invalid workspace request',
      },
      { status: 400 },
    );
  }

  let creationPromise: Promise<WorkspaceSandboxDescriptor> | null = null;

  try {
    if (runtime.terminationRequested) {
      return NextResponse.json(
        { error: 'Workspace termination is in progress' },
        { status: 409 },
      );
    }

    if (runtime.provider && runtime.sandboxData?.sandboxId && runtime.sandboxData?.url) {
      return NextResponse.json({
        success: true,
        workspaceKey: runtime.workspaceKey,
        sandboxId: runtime.sandboxData.sandboxId,
        url: runtime.sandboxData.url,
        provider: runtime.provider.getSandboxInfo?.()?.provider,
        message: 'Existing workspace sandbox is already active',
        reused: true,
      });
    }

    const hadInFlightCreation = Boolean(runtime.creationPromise);
    creationPromise = getOrStartWorkspaceCreation(
      runtime,
      () => createWorkspaceSandbox(runtime),
    );

    if (hadInFlightCreation) {
      console.log(
        '[create-ai-sandbox-v2] Reusing in-flight creation for workspace:',
        runtime.workspaceKey,
      );
    }

    const sandboxInfo = await creationPromise;

    if (runtime.terminationRequested) {
      return NextResponse.json(
        { error: 'Workspace was terminated while sandbox creation completed' },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      workspaceKey: runtime.workspaceKey,
      sandboxId: sandboxInfo.sandboxId,
      url: sandboxInfo.url,
      provider: sandboxInfo.provider,
      message: 'Sandbox created and Vite React app initialized',
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create sandbox';
    const status = message.toLowerCase().includes('termination') ? 409 : 500;

    return NextResponse.json(
      {
        error: message,
        details: error instanceof Error ? error.stack : undefined,
      },
      { status },
    );
  } finally {
    if (creationPromise) {
      finishWorkspaceCreation(runtime, creationPromise);
    }
  }
}
