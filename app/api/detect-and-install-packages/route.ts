import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceRuntimeForRequest } from '@/lib/sandbox/workspace-runtime';

const BUILTIN_MODULES = new Set([
  'fs', 'path', 'http', 'https', 'crypto', 'stream', 'util', 'os',
  'url', 'querystring', 'child_process'
]);

export async function POST(request: NextRequest) {
  const runtime = getWorkspaceRuntimeForRequest(request);

  try {
    const { files } = await request.json();

    if (!files || typeof files !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Files object is required' },
        { status: 400 },
      );
    }

    const provider = runtime.provider;
    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'No active sandbox for this workspace' },
        { status: 404 },
      );
    }

    const imports = new Set<string>();
    const importRegex =
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s*,?\s*)*(?:from\s+)?['"]([^'"]+)['"]/g;
    const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;

    for (const [filePath, fileContent] of Object.entries(files)) {
      if (typeof fileContent !== 'string' || !filePath.match(/\.(jsx?|tsx?)$/)) {
        continue;
      }

      let match;
      while ((match = importRegex.exec(fileContent)) !== null) {
        imports.add(match[1]);
      }
      while ((match = requireRegex.exec(fileContent)) !== null) {
        imports.add(match[1]);
      }
    }

    const uniquePackages = [
      ...new Set(
        Array.from(imports)
          .filter((item) => !item.startsWith('.') && !item.startsWith('/'))
          .filter((item) => !BUILTIN_MODULES.has(item))
          .map((item) => {
            if (item.startsWith('@')) {
              return item.split('/').slice(0, 2).join('/');
            }
            return item.split('/')[0];
          }),
      ),
    ];

    if (uniquePackages.length === 0) {
      return NextResponse.json({
        success: true,
        packagesInstalled: [],
        packagesAlreadyInstalled: [],
        packagesFailed: [],
        message: 'No new packages to install',
      });
    }

    const installed: string[] = [];
    const missing: string[] = [];

    for (const packageName of uniquePackages) {
      const result = await provider.runCommand(
        `test -d node_modules/${packageName}`,
      );
      if (result.success) {
        installed.push(packageName);
      } else {
        missing.push(packageName);
      }
    }

    if (missing.length === 0) {
      return NextResponse.json({
        success: true,
        packagesInstalled: [],
        packagesAlreadyInstalled: installed,
        packagesFailed: [],
        message: 'All packages already installed',
      });
    }

    console.log(
      `[detect-and-install-packages] [${runtime.workspaceKey}] Installing:`,
      missing,
    );

    const installResult = await provider.installPackages(missing);
    const finalInstalled: string[] = [];
    const failed: string[] = [];

    for (const packageName of missing) {
      const verifyResult = await provider.runCommand(
        `test -d node_modules/${packageName}`,
      );
      if (verifyResult.success) {
        finalInstalled.push(packageName);
      } else {
        failed.push(packageName);
      }
    }

    return NextResponse.json({
      success: failed.length === 0 && installResult.success,
      packagesInstalled: finalInstalled,
      packagesFailed: failed,
      packagesAlreadyInstalled: installed,
      message: `Installed ${finalInstalled.length} packages`,
      logs: installResult.stdout,
      error: installResult.stderr || undefined,
    });
  } catch (error) {
    console.error('[detect-and-install-packages] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
