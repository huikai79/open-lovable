import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceRuntimeForRequest } from '@/lib/sandbox/workspace-runtime';

export async function GET(request: NextRequest) {
  const runtime = getWorkspaceRuntimeForRequest(request);

  try {
    const provider = runtime.provider;
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'No active sandbox for this workspace' },
        { status: 400 },
      );
    }

    const logContent: string[] = [];
    let viteRunning = false;

    const psResult = await provider.runCommand('ps aux');
    if (psResult.success) {
      const viteProcesses = psResult.stdout
        .split('\n')
        .filter((line: string) => {
          const lower = line.toLowerCase();
          return lower.includes('vite') || lower.includes('npm run dev');
        });

      viteRunning = viteProcesses.length > 0;
      logContent.push(viteRunning ? 'Vite is running' : 'Vite process not found');
      logContent.push(...viteProcesses.slice(0, 3));
    }

    try {
      const logResult = await provider.runCommand('tail -n 50 /tmp/vite.log');
      if (logResult.success && logResult.stdout) {
        logContent.push('--- /tmp/vite.log ---');
        logContent.push(logResult.stdout);
      }
    } catch {
      // Log file is optional.
    }

    return NextResponse.json({
      success: true,
      workspaceKey: runtime.workspaceKey,
      hasErrors: false,
      logs: logContent,
      status: viteRunning ? 'running' : 'stopped',
    });
  } catch (error) {
    console.error('[sandbox-logs] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
