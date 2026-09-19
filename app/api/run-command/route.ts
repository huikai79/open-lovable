import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceRuntimeForRequest } from '@/lib/sandbox/workspace-runtime';

export async function POST(request: NextRequest) {
  const runtime = getWorkspaceRuntimeForRequest(request);

  try {
    const { command } = await request.json();

    if (!command) {
      return NextResponse.json(
        { success: false, error: 'Command is required' },
        { status: 400 },
      );
    }

    const provider = runtime.provider;
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'No active sandbox for this workspace' },
        { status: 400 },
      );
    }

    console.log(`[run-command] [${runtime.workspaceKey}] Executing: ${command}`);
    const result = await provider.runCommand(command);

    const output = [
      result.stdout ? `STDOUT:\n${result.stdout}` : '',
      result.stderr ? `\nSTDERR:\n${result.stderr}` : '',
      `\nExit code: ${result.exitCode}`,
    ].filter(Boolean).join('');

    return NextResponse.json({
      success: result.success,
      output,
      exitCode: result.exitCode,
      message: result.success
        ? 'Command executed successfully'
        : 'Command completed with non-zero exit code',
    });
  } catch (error) {
    console.error('[run-command] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
