import type { StoryDocument, StoryGoals, StoryScene, StoryStats } from './story';

export function orderedScenes(story: StoryDocument): StoryScene[] {
  return [...story.scenes].sort((a, b) => a.order - b.order);
}

export function getStats(story: StoryDocument): StoryStats {
  const unresolvedClues = story.clues.filter((clue) => clue.payoffSceneId === '').length;
  const totalSignals = story.characters.length + story.scenes.length + story.clues.length;
  const completedSignals = story.characters.length + story.scenes.length + (story.clues.length - unresolvedClues);
  const completion = totalSignals === 0 ? 0 : Math.round((completedSignals / totalSignals) * 100);
  return {
    characters: story.characters.length,
    scenes: story.scenes.length,
    clues: story.clues.length,
    unresolvedClues,
    completion,
  };
}

export function validateName(value: string): string {
  const cleanValue = value.trim();
  return cleanValue.length < 2 ? '至少输入 2 个字' : cleanValue;
}

export function getTimelineWarning(story: StoryDocument): string | null {
  const orders = story.scenes.map((scene) => scene.order);
  return new Set(orders).size !== orders.length ? '时间线存在重复顺序，请重新排列。' : null;
}

export interface GoalCheckItem {
  id: string;
  kind: 'scene-count' | 'character' | 'clue';
  label: string;
  ok: boolean;
  detail: string;
  hint: string;
  sceneIds: string[];
}

export interface GoalReport {
  items: GoalCheckItem[];
  unmet: GoalCheckItem[];
  total: number;
}

function sceneCountDetail(count: number, min: number | null, max: number | null, ok: boolean): string {
  const range = min !== null && max !== null ? `目标 ${min}–${max} 幕` : min !== null ? `目标不少于 ${min} 幕` : `目标不多于 ${max} 幕`;
  if (ok) return `当前 ${count} 幕，符合${range}`;
  if (min !== null && count < min) return `当前 ${count} 幕，还差 ${min - count} 幕才到目标下限`;
  return `当前 ${count} 幕，超出目标上限 ${count - (max ?? count)} 幕`;
}

export function checkStoryGoals(story: StoryDocument): GoalReport | null {
  const goals = story.goals;
  if (!goals) return null;
  const items: GoalCheckItem[] = [];

  if (goals.sceneCountMin !== null || goals.sceneCountMax !== null) {
    const count = story.scenes.length;
    const ok = (goals.sceneCountMin === null || count >= goals.sceneCountMin) && (goals.sceneCountMax === null || count <= goals.sceneCountMax);
    items.push({
      id: 'scene-count',
      kind: 'scene-count',
      label: '场景数量',
      ok,
      detail: sceneCountDetail(count, goals.sceneCountMin, goals.sceneCountMax, ok),
      hint: '',
      sceneIds: [],
    });
  }

  for (const characterId of goals.requiredCharacterIds) {
    const character = story.characters.find((item) => item.id === characterId);
    if (!character) continue;
    const appearances = story.scenes.filter((scene) => scene.characterIds.includes(characterId)).length;
    items.push({
      id: `character:${characterId}`,
      kind: 'character',
      label: character.name,
      ok: appearances > 0,
      detail: appearances > 0 ? `已出场 ${appearances} 幕` : '尚未在任何一幕出场',
      hint: '',
      sceneIds: [],
    });
  }

  for (const clueId of goals.requiredClueIds) {
    const clue = story.clues.find((item) => item.id === clueId);
    if (!clue) continue;
    const paidOff = clue.payoffSceneId !== '';
    const payoffScene = paidOff ? story.scenes.find((scene) => scene.id === clue.payoffSceneId) : undefined;
    items.push({
      id: `clue:${clueId}`,
      kind: 'clue',
      label: clue.title,
      ok: paidOff,
      detail: paidOff ? `已在「${payoffScene?.title ?? '未知场景'}」回收` : '埋下后尚未回收',
      hint: `伏笔「${clue.title}」按目标需要回收`,
      sceneIds: paidOff ? [] : [clue.setupSceneId],
    });
  }

  return { items, unmet: items.filter((item) => !item.ok), total: items.length };
}

export function sanitizeGoals(input: unknown): StoryGoals | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const candidate = input as Partial<StoryGoals>;
  const toCount = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : null);
  const toIds = (value: unknown): string[] => (Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []);
  return {
    sceneCountMin: toCount(candidate.sceneCountMin),
    sceneCountMax: toCount(candidate.sceneCountMax),
    requiredCharacterIds: toIds(candidate.requiredCharacterIds),
    requiredClueIds: toIds(candidate.requiredClueIds),
  };
}

export function sanitizeStory(input: unknown): StoryDocument | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<StoryDocument>;
  if (
    candidate.version !== 1 ||
    typeof candidate.id !== 'string' ||
    typeof candidate.title !== 'string' ||
    !Array.isArray(candidate.characters) ||
    !Array.isArray(candidate.scenes) ||
    !Array.isArray(candidate.clues)
  ) {
    return null;
  }
  const story = candidate as StoryDocument;
  story.goals = sanitizeGoals(candidate.goals);
  return story;
}
