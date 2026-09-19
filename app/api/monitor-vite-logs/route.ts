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

    const errors: any[] = [];

    try {
      const errorResult = await provider.runCommand('cat /tmp/vite-errors.json');
      if (errorResult.success && errorResult.stdout) {
        const data = JSON.parse(errorResult.stdout);
        errors.push(...(data.errors || []));
      }
    } catch {
      // Optional error cache may not exist.
    }

    try {
      const logResult = await provider.runCommand('tail -n 200 /tmp/vite.log');
      if (logResult.success && logResult.stdout) {
        for (const line of logResult.stdout.split('\n')) {
          if (!line.toLowerCase().includes('failed to resolve import')) continue;
          const importMatch = line.match(/"([^"]+)"/);
          if (!importMatch) continue;

          const importPath = importMatch[1];
          if (importPath.startsWith('.')) continue;

          const packageName = importPath.startsWith('@')
            ? importPath.split('/').slice(0, 2).join('/')
            : importPath.split('/')[0];

          errors.push({
            type: 'npm-missing',
            package: packageName,
            message: `Failed to resolve import "${importPath}"`,
            file: 'Unknown',
          });
        }
      }
    } catch {
      // Vite log may not exist yet.
    }

    const uniqueErrors: any[] = [];
    const seenPackages = new Set<string>();
    for (const error of errors) {
      const key = error.package || JSON.stringify(error);
      if (seenPackages.has(key)) continue;
      seenPackages.add(key);
      uniqueErrors.push(error);
    }

    return NextResponse.json({
      success: true,
      workspaceKey: runtime.workspaceKey,
      hasErrors: uniqueErrors.length > 0,
      errors: uniqueErrors,
    });
  } catch (error) {
    console.error('[monitor-vite-logs] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
