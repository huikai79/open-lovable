import { NextRequest, NextResponse } from 'next/server';
import { parseJavaScriptFile, buildComponentTree } from '@/lib/file-parser';
import { FileManifest, FileInfo, RouteInfo } from '@/types/file-manifest';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { getWorkspaceRuntimeForRequest } from '@/lib/sandbox/workspace-runtime';

const RELEVANT_FILE = /\.(jsx?|tsx?|css|json)$/i;
const MAX_CONTEXT_FILE_CHARS = 10_000;
const MAX_FILES = 500;

export async function GET(request: NextRequest) {
  const runtime = getWorkspaceRuntimeForRequest(request);

  try {
    const provider =
      runtime.provider ||
      (runtime.sandboxData?.sandboxId
        ? sandboxManager.getProvider(runtime.sandboxData.sandboxId)
        : null);

    if (!provider) {
      return NextResponse.json(
        { success: false, error: 'No active sandbox for this workspace' },
        { status: 404 },
      );
    }

    runtime.provider = provider;
    console.log('[get-sandbox-files] Fetching workspace files:', runtime.workspaceKey);

    const listedFiles = (await provider.listFiles())
      .map((filePath: string) => filePath.replace(/^\.\//, '').replace(/^\//, ''))
      .filter((filePath: string) => RELEVANT_FILE.test(filePath))
      .slice(0, MAX_FILES);

    const filesContent: Record<string, string> = {};

    for (const relativePath of listedFiles) {
      try {
        const content = await provider.readFile(relativePath);
        if (content.length <= MAX_CONTEXT_FILE_CHARS) {
          filesContent[relativePath] = content;
          runtime.existingFiles.add(relativePath);
        }
      } catch (readError) {
        console.debug('[get-sandbox-files] Skipping unreadable file:', relativePath, readError);
      }
    }

    const directories = new Set<string>();
    for (const filePath of Object.keys(filesContent)) {
      const parts = filePath.split('/');
      for (let index = 1; index < parts.length; index += 1) {
        directories.add(parts.slice(0, index).join('/'));
      }
    }
    const structure = Array.from(directories).sort().slice(0, 100).join('\n');

    const fileManifest: FileManifest = {
      files: {},
      routes: [],
      componentTree: {},
      entryPoint: '',
      styleFiles: [],
      timestamp: Date.now(),
    };

    for (const [relativePath, fileContent] of Object.entries(filesContent)) {
      const fullPath = `/${relativePath}`;
      const fileInfo: FileInfo = {
        content: fileContent,
        type: 'utility',
        path: fullPath,
        relativePath,
        lastModified: Date.now(),
      };

      if (relativePath.match(/\.(jsx?|tsx?)$/)) {
        Object.assign(fileInfo, parseJavaScriptFile(fileContent, fullPath));

        if (
          relativePath === 'src/main.jsx' ||
          relativePath === 'src/index.jsx' ||
          relativePath === 'src/App.jsx' ||
          relativePath === 'App.jsx'
        ) {
          fileManifest.entryPoint = fileManifest.entryPoint || fullPath;
        }
      }

      if (relativePath.endsWith('.css')) {
        fileManifest.styleFiles.push(fullPath);
        fileInfo.type = 'style';
      }

      fileManifest.files[fullPath] = fileInfo;
    }

    fileManifest.componentTree = buildComponentTree(fileManifest.files);
    fileManifest.routes = extractRoutes(fileManifest.files);

    const sandboxId =
      runtime.sandboxData?.sandboxId ||
      provider.getSandboxInfo()?.sandboxId ||
      'unknown';

    runtime.fileCache = {
      files: Object.fromEntries(
        Object.entries(filesContent).map(([path, fileContent]) => [
          path,
          { content: fileContent, lastModified: Date.now() },
        ]),
      ),
      lastSync: Date.now(),
      sandboxId,
      manifest: fileManifest,
    };
    runtime.lastAccessed = Date.now();

    return NextResponse.json({
      success: true,
      workspaceKey: runtime.workspaceKey,
      files: filesContent,
      structure,
      fileCount: Object.keys(filesContent).length,
      manifest: fileManifest,
    });
  } catch (error) {
    console.error('[get-sandbox-files] Error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}

function extractRoutes(files: Record<string, FileInfo>): RouteInfo[] {
  const routes: RouteInfo[] = [];

  for (const [path, fileInfo] of Object.entries(files)) {
    if (
      fileInfo.content.includes('<Route') ||
      fileInfo.content.includes('createBrowserRouter')
    ) {
      const routeMatches = fileInfo.content.matchAll(
        /path=["']([^"']+)["'].*(?:element|component)={([^}]+)}/g,
      );

      for (const match of routeMatches) {
        routes.push({
          path: match[1],
          component: path,
        });
      }
    }

    if (
      fileInfo.relativePath.startsWith('pages/') ||
      fileInfo.relativePath.startsWith('src/pages/')
    ) {
      const routePath =
        '/' +
        fileInfo.relativePath
          .replace(/^(src\/)?pages\//, '')
          .replace(/\.(jsx?|tsx?)$/, '')
          .replace(/index$/, '');

      routes.push({
        path: routePath,
        component: path,
      });
    }
  }

  return routes;
}
