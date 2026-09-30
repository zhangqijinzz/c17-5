import { describe, expect, it } from 'vitest';
import { createEmptyGoals, createStarterStory } from '../models/story';
import { checkStoryGoals, getStats, getTimelineWarning, orderedScenes, sanitizeStory, validateName } from '../models/storyRules';

describe('story domain rules', () => {
  it('sorts scenes and calculates unresolved clues', () => {
    const story = createStarterStory();
    story.scenes = [...story.scenes].reverse();
    expect(orderedScenes(story).map((scene) => scene.title)).toEqual(['旧港口的来信', '风暴前夜']);
    expect(getStats(story)).toMatchObject({ characters: 2, scenes: 2, clues: 1, unresolvedClues: 1, completion: 80 });
  });

  it('guards invalid names and duplicate timeline orders', () => {
    const story = createStarterStory();
    story.scenes[1].order = story.scenes[0].order;
    expect(validateName(' ')).toBe('至少输入 2 个字');
    expect(getTimelineWarning(story)).toContain('重复');
  });

  it('rejects corrupt persisted documents', () => {
    expect(sanitizeStory('{bad json}')).toBeNull();
    expect(sanitizeStory({ version: 99 })).toBeNull();
    expect(sanitizeStory(createStarterStory())).not.toBeNull();
  });

  it('keeps older documents goal-free and sanitizes malformed goals', () => {
    const legacy = sanitizeStory(createStarterStory());
    expect(legacy?.goals).toBeUndefined();
    const withBadGoals = sanitizeStory({ ...createStarterStory(), goals: { sceneCountMin: 'many', requiredClueIds: [42, 'clue-first-letter'] } });
    expect(withBadGoals?.goals).toEqual({ sceneCountMin: null, sceneCountMax: null, requiredCharacterIds: [], requiredClueIds: ['clue-first-letter'] });
  });
});

describe('structure goals', () => {
  it('returns no report when the project has no goals', () => {
    expect(checkStoryGoals(createStarterStory())).toBeNull();
  });

  it('checks scene range, required characters, and required clues', () => {
    const story = createStarterStory();
    story.goals = { sceneCountMin: 3, sceneCountMax: 5, requiredCharacterIds: ['character-june'], requiredClueIds: ['clue-first-letter'] };
    const report = checkStoryGoals(story);
    expect(report?.total).toBe(3);
    expect(report?.unmet.map((item) => item.id)).toEqual(['scene-count', 'clue:clue-first-letter']);
    const clueItem = report?.items.find((item) => item.kind === 'clue');
    expect(clueItem?.sceneIds).toEqual(['scene-old-harbor']);
    expect(clueItem?.hint).toContain('潮汐表背后的日期');
    expect(report?.items.find((item) => item.kind === 'character')?.ok).toBe(true);
  });

  it('marks goals met once the story catches up', () => {
    const story = createStarterStory();
    story.goals = { ...createEmptyGoals(), sceneCountMin: 2, requiredClueIds: ['clue-first-letter'] };
    story.clues[0].payoffSceneId = 'scene-storm';
    const report = checkStoryGoals(story);
    expect(report).toBeDefined();
    expect(report?.unmet).toHaveLength(0);
    expect(report?.items.find((item) => item.kind === 'clue')?.sceneIds).toEqual([]);
  });

  it('ignores goal entries that point at removed records', () => {
    const story = createStarterStory();
    story.goals = { ...createEmptyGoals(), requiredCharacterIds: ['character-gone'], requiredClueIds: ['clue-gone'] };
    expect(checkStoryGoals(story)?.total).toBe(0);
  });
});
