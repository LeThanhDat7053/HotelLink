import type { Vr360SceneItem } from '../types/settings';

const VR360_BASE_PATH_CANDIDATES = ['/assets/vr-data', '/dist/assets/vr-data'];
const HTML_SHELL_MARKERS = ['<div id="root"', '/@vite/client', '<!doctype html'];
const VR360_RUNTIME_SCRIPT_CANDIDATES = ['script_general.js', 'script.js'];
// Some project layouts ship the 3DVista runtime (playlist data) outside vr-data,
// e.g. bundled at /assets/js/panorama.js. These are tried as extra script sources
// so scene order can still be recovered when the export root has no script file.
const VR360_EXTERNAL_RUNTIME_SCRIPT_CANDIDATES = [
  '/assets/js/panorama.js',
  '/dist/assets/js/panorama.js',
];


const isHtmlShellResponse = (value: string): boolean => {
  const lower = value.toLowerCase();
  return HTML_SHELL_MARKERS.some((marker) => lower.includes(marker));
};

const fetchText = async (path: string): Promise<string> => {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Unable to load ${path}`);
  }

  const text = await response.text();
  if (isHtmlShellResponse(text)) {
    throw new Error(`Received HTML shell instead of runtime file at ${path}`);
  }

  return text;
};

const resolveRuntimeScriptPaths = (viewerHtml: string): string[] => {
  const scriptMatches = [
    ...viewerHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/gi),
  ];
  const runtimePaths = scriptMatches
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value))
    .map((value) => value.split('?')[0].split('#')[0])
    .filter((value) =>
      VR360_RUNTIME_SCRIPT_CANDIDATES.some((candidate) => value.endsWith(candidate)),
    );

  return [...new Set(runtimePaths)];
};

const parseLocaleSceneMeta = (
  content: string,
): Map<string, { name?: string; subtitle?: string }> => {
  const sceneMeta = new Map<string, { name?: string; subtitle?: string }>();
  const lineRegex = /^([^=\r\n]+)\s*=\s*(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = lineRegex.exec(content)) !== null) {
    const rawKey = match[1].trim();
    const value = match[2].trim();
    const sceneKeyMatch = rawKey.match(/^(panorama_[^.]+)\.(label|subtitle)$/i);
    if (!sceneKeyMatch || !value) {
      continue;
    }

    const [, sceneId, field] = sceneKeyMatch;
    const current = sceneMeta.get(sceneId) ?? {};
    if (field.toLowerCase() === 'label') {
      current.name = value;
    } else if (field.toLowerCase() === 'subtitle') {
      current.subtitle = value;
    }
    sceneMeta.set(sceneId, current);
  }

  return sceneMeta;
};

const parseOrderedSceneIdsFromLocale = (content: string): string[] => {
  const orderedSceneIds: string[] = [];
  const labelRegex = /^(panorama_[^.]+)\.label\s*=/gim;
  let match: RegExpExecArray | null;

  while ((match = labelRegex.exec(content)) !== null) {
    orderedSceneIds.push(match[1]);
  }

  return [...new Set(orderedSceneIds)];
};

// 3DVista exports locale labels sorted by panorama_id (hex), not by tour order.
// If the scene names follow a pattern like "name_1", "name_2"... we re-sort them
// numerically so the list matches the intended tour sequence.
const sortScenesByName = (scenes: Vr360SceneItem[]): Vr360SceneItem[] => {
  const trailNumber = (name: string): number => {
    const m = name.match(/_(\d+)$/);
    return m ? parseInt(m[1], 10) : -1;
  };

  const hasNumericTrail = scenes.every((s) => trailNumber(s.name) !== -1);
  if (!hasNumericTrail) {
    return scenes;
  }

  return [...scenes]
    .sort((a, b) => trailNumber(a.name) - trailNumber(b.name))
    .map((scene, index) => ({ ...scene, order: index }));
};

const parsePlayListSceneIds = (scriptContent: string): string[] => {
  const playlistMatch = scriptContent.match(
    /"id":"mainPlayList","items":\[(.*?)\],"class":"PlayList"/s,
  );
  if (!playlistMatch) {
    return [];
  }

  const mediaMatches = [...playlistMatch[1].matchAll(/"media":"this\.(panorama_[^"]+)"/g)];
  return mediaMatches.map((match) => match[1]);
};

const parseSceneIdsFallback = (scriptContent: string): string[] => {
  return [...scriptContent.matchAll(/"id":"(panorama_[^"]+)"/g)].map((match) => match[1]);
};

const buildScenes = (
  orderedSceneIds: string[],
  sceneMeta: Map<string, { name?: string; subtitle?: string }>,
): Vr360SceneItem[] => {
  const scenes = orderedSceneIds
    .map((sceneId, index) => {
      const meta = sceneMeta.get(sceneId);
      const name = meta?.name?.trim();
      if (!name) {
        return null;
      }

      return {
        id: sceneId,
        name,
        subtitle: meta?.subtitle?.trim() || undefined,
        panorama_url: `/?viewer=vr360&scene=${encodeURIComponent(name)}`,
        order: index,
      } satisfies Vr360SceneItem;
    })
    .filter((scene) => scene !== null);

  return scenes as Vr360SceneItem[];
};

const fetchTextOrNull = async (path: string): Promise<string | null> => {
  try {
    return await fetchText(path);
  } catch {
    return null;
  }
};

const discoverScenesFromBasePath = async (basePath: string): Promise<Vr360SceneItem[]> => {
  // locale/en.txt is the source of truth: every 3DVista export ships it, and it
  // contains the full ordered scene list (panorama_*.label). It must load.
  const localeContent = await fetchText(`${basePath}/locale/en.txt`);

  const sceneMeta = parseLocaleSceneMeta(localeContent);
  const localeOrderedSceneIds = parseOrderedSceneIdsFromLocale(localeContent);
  const localeScenes = sortScenesByName(buildScenes(localeOrderedSceneIds, sceneMeta));

  // index.htm only helps us discover the runtime script name. It is optional:
  // when it is missing (or the dev server hands back the SPA shell), we fall back
  // to the well-known script candidates instead of failing the whole parse.
  const viewerHtml = await fetchTextOrNull(`${basePath}/index.htm`);
  const runtimeScriptPaths = viewerHtml ? resolveRuntimeScriptPaths(viewerHtml) : [];
  const scriptPathCandidates = [
    ...runtimeScriptPaths.map((path) => (path.startsWith('/') ? path : `${basePath}/${path}`)),
    ...VR360_RUNTIME_SCRIPT_CANDIDATES.map((fileName) => `${basePath}/${fileName}`),
    ...VR360_EXTERNAL_RUNTIME_SCRIPT_CANDIDATES,
  ];

  let scriptContent: string | null = null;

  for (const scriptPath of [...new Set(scriptPathCandidates)]) {
    scriptContent = await fetchTextOrNull(scriptPath);
    if (scriptContent) {
      console.log('[vr360] loaded script from:', scriptPath);
      break;
    }
    // Some exports reference runtime scripts in metadata but don't ship them at the
    // served root. For scene-sync we can still derive scene order from locale labels.
  }

  if (scriptContent) {
    const orderedSceneIds = parsePlayListSceneIds(scriptContent);
    const primaryScenes = buildScenes(orderedSceneIds, sceneMeta);
    if (primaryScenes.length > 0 && primaryScenes.length >= localeScenes.length) {
      return sortScenesByName(primaryScenes);
    }

    const fallbackSceneIds = parseSceneIdsFallback(scriptContent);
    const dedupedFallbackIds = [...new Set(fallbackSceneIds)];
    const fallbackScenes = buildScenes(dedupedFallbackIds, sceneMeta);
    if (fallbackScenes.length > 0 && fallbackScenes.length >= localeScenes.length) {
      return sortScenesByName(fallbackScenes);
    }
  }

  if (localeScenes.length > 0) {
    return localeScenes;
  }

  throw new Error(`No scenes parsed from ${basePath}`);
};

export const getVr360BasePathCandidates = (): string[] => [...VR360_BASE_PATH_CANDIDATES];

export interface LoadVr360ScenesResult {
  scenes: Vr360SceneItem[];
  basePath: string;
}

export const loadVr360Scenes = async (): Promise<Vr360SceneItem[]> => {
  const result = await loadVr360ScenesWithMeta();
  return result.scenes;
};

export const loadVr360ScenesWithMeta = async (): Promise<LoadVr360ScenesResult> => {
  const errors: string[] = [];

  for (const basePath of VR360_BASE_PATH_CANDIDATES) {
    try {
      const scenes = await discoverScenesFromBasePath(basePath);
      if (scenes.length > 0) {
        return { scenes, basePath };
      }
      errors.push(`No scenes parsed from ${basePath}`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  throw new Error(errors.join(' | '));
};
