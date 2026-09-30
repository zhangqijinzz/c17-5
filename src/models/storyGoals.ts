import { createEmptyGoals, type StoryDocument, type StoryGoals } from './story';

const sortScenes = (story: StoryDocument) => [...story.scenes].sort((a, b) => a.order - b.order);

export type GoalStatus = 'met' | 'open';

export interface GoalItem {
  key: string;
  kind: 'clue' | 'character' | 'sceneCount';
  label: string;
  detail: string;
  status: GoalStatus;
  sceneId?: string;
}

export interface GoalReport {
  enabled: boolean;
  items: GoalItem[];
  metCount: number;
  total: number;
  sceneHints: Record<string, string[]>;
}

export function sanitizeGoals(input: unknown): StoryGoals {
  const fallback = createEmptyGoals();
  if (!input || typeof input !== 'object') return fallback;
  const candidate = input as Partial<StoryGoals>;
  const toIdList = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  const toBound = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
    return null;
  };
  const min = toBound(candidate.sceneCountMin);
  const max = toBound(candidate.sceneCountMax);
  return {
    requiredClueIds: toIdList(candidate.requiredClueIds),
    requiredCharacterIds: toIdList(candidate.requiredCharacterIds),
    sceneCountMin: min,
    sceneCountMax: max,
  };
}

// 结构目标核对是纯函数：每次编辑或调整目标都重新计算，不保留任何历史判断。
export function evaluateGoals(story: StoryDocument): GoalReport {
  const goals = story.goals ?? createEmptyGoals();

  const sceneHints: Record<string, string[]> = {};
  const pushHint = (sceneId: string | undefined, message: string) => {
    if (!sceneId) return;
    (sceneHints[sceneId] ??= []).push(message);
  };
  const items: GoalItem[] = [];

  for (const clueId of goals.requiredClueIds) {
    const clue = story.clues.find((entry) => entry.id === clueId);
    if (!clue) continue; // 目标引用已删除的元素时静默忽略，由作者重新设定
    const met = clue.payoffSceneId !== '';
    const setupScene = story.scenes.find((scene) => scene.id === clue.setupSceneId);
    const setupLabel = setupScene ? `埋设于「${setupScene.title}」` : '埋设场景已删除';
    items.push({
      key: `clue-${clue.id}`,
      kind: 'clue',
      label: `回收伏笔「${clue.title}」`,
      detail: met
        ? `已在「${story.scenes.find((scene) => scene.id === clue.payoffSceneId)?.title ?? '未知场景'}」回收`
        : `${setupLabel}，尚未安排回收`,
      status: met ? 'met' : 'open',
      sceneId: met ? clue.payoffSceneId : clue.setupSceneId,
    });
    if (!met) pushHint(clue.setupSceneId, `目标伏笔「${clue.title}」尚未回收`);
  }

  for (const characterId of goals.requiredCharacterIds) {
    const character = story.characters.find((entry) => entry.id === characterId);
    if (!character) continue;
    const appearingScenes = sortScenes(story).filter((scene) => scene.characterIds.includes(characterId));
    const met = appearingScenes.length > 0;
    items.push({
      key: `character-${character.id}`,
      kind: 'character',
      label: `核心人物「${character.name}」出场`,
      detail: met ? `已在 ${appearingScenes.length} 幕中出场` : '还没有安排任何出场场景',
      status: met ? 'met' : 'open',
      sceneId: appearingScenes[0]?.id,
    });
    // 人物完全没有出场时没有可挂靠的那一幕，提示只在收尾清单中呈现。
  }

  const sceneCount = story.scenes.length;
  const { sceneCountMin, sceneCountMax } = goals;
  if (sceneCountMin !== null || sceneCountMax !== null) {
    const under = sceneCountMin !== null && sceneCount < sceneCountMin;
    const over = sceneCountMax !== null && sceneCount > sceneCountMax;
    const met = !under && !over;
    const rangeLabel =
      sceneCountMin !== null && sceneCountMax !== null
        ? `${sceneCountMin}–${sceneCountMax} 幕`
        : sceneCountMin !== null
          ? `不少于 ${sceneCountMin} 幕`
          : `不超过 ${sceneCountMax ?? 0} 幕`;
    items.push({
      key: 'scene-count',
      kind: 'sceneCount',
      label: `场景数量保持在 ${rangeLabel}`,
      detail: under
        ? `当前 ${sceneCount} 幕，还差 ${sceneCountMin! - sceneCount} 幕`
        : over
          ? `当前 ${sceneCount} 幕，超出 ${sceneCount - sceneCountMax!} 幕`
          : `当前 ${sceneCount} 幕，符合区间`,
      status: met ? 'met' : 'open',
    });
    if (over) {
      // 超出上限的每一幕都提示，作者删掉任意一幕后提示自动重算。
      sortScenes(story)
        .slice(sceneCountMax!)
        .forEach((scene) => pushHint(scene.id, `场景数量已超过目标上限 ${sceneCountMax} 幕`));
    }
  }

  const metCount = items.filter((item) => item.status === 'met').length;
  // enabled 基于实际可核对的条目：引用已删除人物/伏笔的残留目标不产生任何结论。
  return { enabled: items.length > 0, items, metCount, total: items.length, sceneHints };
}
