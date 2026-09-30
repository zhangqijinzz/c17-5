import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { evaluateGoals, sanitizeGoals } from '../models/storyGoals';
import { sanitizeStory } from '../models/storyRules';

describe('structure goals evaluation', () => {
  it('reports no goals for projects without configured goals', () => {
    const report = evaluateGoals(createStarterStory());
    expect(report.enabled).toBe(false);
    expect(report.items).toHaveLength(0);
    expect(report.metCount).toBe(0);
  });

  it('marks a required clue open until its payoff scene is assigned', () => {
    const story = createStarterStory();
    const clue = story.clues[0];
    story.goals.requiredClueIds = [clue.id];
    let report = evaluateGoals(story);
    expect(report.enabled).toBe(true);
    expect(report.items[0].status).toBe('open');
    expect(report.sceneHints[clue.setupSceneId]).toContain(`目标伏笔「${clue.title}」尚未回收`);

    clue.payoffSceneId = story.scenes[1].id;
    report = evaluateGoals(story);
    expect(report.items[0].status).toBe('met');
    expect(report.sceneHints[clue.setupSceneId]).toBeUndefined();
  });

  it('tracks required character appearances against scenes', () => {
    const story = createStarterStory();
    const [mira, june] = story.characters;
    story.scenes.forEach((scene) => {
      scene.characterIds = scene.characterIds.filter((id) => id !== june.id);
    });
    story.goals.requiredCharacterIds = [mira.id, june.id];
    let report = evaluateGoals(story);
    expect(report.items).toMatchObject([{ status: 'met' }, { status: 'open' }]);

    story.scenes[1].characterIds = [...story.scenes[1].characterIds, june.id];
    report = evaluateGoals(story);
    expect(report.items.every((item) => item.status === 'met')).toBe(true);
  });

  it('checks the scene count range and tags overflow scenes', () => {
    const story = createStarterStory();
    story.goals.sceneCountMin = 3;
    story.goals.sceneCountMax = 4;
    let report = evaluateGoals(story);
    expect(report.items[0].status).toBe('open');
    expect(report.items[0].detail).toContain('还差 1 幕');

    story.goals.sceneCountMin = 1;
    story.scenes.push({
      id: 'scene-third',
      title: '灯塔熄灭',
      order: 3,
      summary: '灯在涨潮前熄灭了。',
      conflict: '',
      characterIds: [],
      clueIds: [],
    }, {
      id: 'scene-fourth',
      title: '多余的一幕',
      order: 4,
      summary: '结构上需要删减。',
      conflict: '',
      characterIds: [],
      clueIds: [],
    }, {
      id: 'scene-fifth',
      title: '再多余的一幕',
      order: 5,
      summary: '结构上需要删减。',
      conflict: '',
      characterIds: [],
      clueIds: [],
    });
    report = evaluateGoals(story);
    expect(report.items[0].status).toBe('open');
    expect(report.items[0].detail).toContain('超出 1 幕');
    expect(report.sceneHints['scene-fifth']?.[0]).toContain('超过目标上限 4 幕');
    expect(report.sceneHints['scene-fourth']).toBeUndefined();
  });

  it('ignores goal entries that reference deleted entities', () => {
    const story = createStarterStory();
    story.goals.requiredClueIds = ['gone-clue'];
    story.goals.requiredCharacterIds = ['gone-character'];
    const report = evaluateGoals(story);
    expect(report.items).toHaveLength(0);
    expect(report.enabled).toBe(false);
  });

  it('migrates legacy persisted documents with empty goals', () => {
    const legacy = createStarterStory() as Partial<{ goals: unknown }>;
    delete legacy.goals;
    const migrated = sanitizeStory(legacy);
    expect(migrated?.goals).toEqual({
      requiredClueIds: [],
      requiredCharacterIds: [],
      sceneCountMin: null,
      sceneCountMax: null,
    });
  });

  it('coerces malformed persisted goals back into a safe shape', () => {
    expect(sanitizeGoals({ requiredClueIds: 'nope', sceneCountMin: -3, sceneCountMax: 2 })).toEqual({
      requiredClueIds: [],
      requiredCharacterIds: [],
      sceneCountMin: null,
      sceneCountMax: 2,
    });
    expect(sanitizeGoals(null).requiredCharacterIds).toEqual([]);
  });
});
