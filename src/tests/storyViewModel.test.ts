import { describe, expect, it } from 'vitest';
import { createStarterStory } from '../models/story';
import { LocalStoryRepository } from '../repositories/storyRepository';
import { MemoryStorageService } from '../services/storageService';
import { StoryViewModel } from '../viewmodels/storyViewModel';

describe('story view model', () => {
  it('initializes, edits, persists, and restores the main flow', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.snapshot.status).toBe('ready');
    viewModel.addCharacter('阿洛', '修复师');
    viewModel.addScene('地下档案室', '他们找到被隐藏的航海日志。');
    const scene = viewModel.selectedScene;
    expect(scene?.title).toBe('地下档案室');
    viewModel.toggleCharacter(scene?.id ?? '', viewModel.snapshot.story?.characters[2]?.id ?? '');
    expect(viewModel.snapshot.stats.characters).toBe(3);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.scenes.some((item) => item.title === '地下档案室')).toBe(true);
    expect(restored.snapshot.story?.characters.some((item) => item.name === '阿洛')).toBe(true);
  });

  it('shows recoverable validation feedback and resets corrupt storage', () => {
    const storage = new MemoryStorageService();
    storage.write('{broken');
    const viewModel = new StoryViewModel(new LocalStoryRepository(storage));
    viewModel.initialize();
    viewModel.addCharacter(' ', '');
    expect(viewModel.snapshot.notice).toContain('至少');
    viewModel.resetProject();
    expect(viewModel.snapshot.story?.id).toBe(createStarterStory().id);
  });

  it('starts goal-free, recalculates conclusions when goals change, and clears cleanly', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    expect(viewModel.goalReport).toBeNull();

    viewModel.enableGoals();
    viewModel.setSceneCountGoal(5, null);
    expect(viewModel.goalReport?.unmet.map((item) => item.id)).toEqual(['scene-count']);

    viewModel.setSceneCountGoal(1, 2);
    expect(viewModel.goalReport?.unmet).toHaveLength(0);

    viewModel.toggleGoalClue('clue-first-letter');
    expect(viewModel.goalHintsForScene('scene-old-harbor')).toHaveLength(1);
    viewModel.addClue('铜罗盘的刻痕', 'scene-storm', '');
    const clue = viewModel.snapshot.story?.clues.find((item) => item.title === '铜罗盘的刻痕');
    viewModel.toggleGoalClue(clue?.id ?? '');
    expect(viewModel.goalReport?.unmet).toHaveLength(2);

    viewModel.clearGoals();
    expect(viewModel.snapshot.story?.goals).toBeUndefined();
    expect(viewModel.goalReport).toBeNull();
    expect(viewModel.goalHintsForScene('scene-old-harbor')).toHaveLength(0);
  });

  it('persists goals with the project and reports unmet goals on completion', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    viewModel.enableGoals();
    viewModel.toggleGoalCharacter('character-mira');
    viewModel.setSceneCountGoal(9, null);

    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.goals?.requiredCharacterIds).toEqual(['character-mira']);
    expect(restored.goalReport?.unmet.map((item) => item.id)).toEqual(['scene-count']);

    restored.completeProject();
    expect(restored.snapshot.notice).toContain('1 项结构目标未达成');
  });
});
