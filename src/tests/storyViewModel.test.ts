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

  it('starts without goals, saves adjustments, and recomputes checks every edit', () => {
    const repository = new LocalStoryRepository(new MemoryStorageService());
    const viewModel = new StoryViewModel(repository);
    viewModel.initialize();
    expect(viewModel.goalReport?.enabled).toBe(false);

    const clueId = viewModel.snapshot.story!.clues[0].id;
    const juneId = viewModel.snapshot.story!.characters[1].id;
    viewModel.toggleRequiredClue(clueId);
    viewModel.toggleRequiredCharacter(juneId);
    viewModel.setGoalSceneCount('3', '5');
    let report = viewModel.goalReport!;
    expect(report.total).toBe(3);
    // 示例故事中裘恩已在第二幕出场，人物项目初始即达成；伏笔与场次待处理。
    expect(report.metCount).toBe(1);
    expect(viewModel.sceneGoalHints[viewModel.snapshot.story!.clues[0].setupSceneId]).toBeDefined();

    // 调整目标后结论按新目标重算：放宽场景下限后场景数量项立刻达成。
    viewModel.setGoalSceneCount('1', '5');
    report = viewModel.goalReport!;
    expect(report.items.find((item) => item.kind === 'sceneCount')?.status).toBe('met');
    expect(report.metCount).toBe(2);

    // 继续编辑（建立已回收的伏笔并切换目标）后核对随之更新。
    const stormId = viewModel.snapshot.story!.scenes[1].id;
    viewModel.addClue('回收用伏笔', stormId, stormId);
    const payoffClue = viewModel.snapshot.story!.clues.find((item) => item.title === '回收用伏笔')!;
    viewModel.toggleRequiredClue(clueId);
    viewModel.toggleRequiredClue(payoffClue.id);
    expect(viewModel.goalReport?.items.find((item) => item.kind === 'clue')?.status).toBe('met');
    expect(viewModel.goalReport?.metCount).toBe(3);

    // 目标随项目保存，重新打开后仍然生效。
    const restored = new StoryViewModel(repository);
    restored.initialize();
    expect(restored.snapshot.story?.goals.requiredClueIds).toContain(payoffClue.id);
    expect(restored.snapshot.story?.goals.sceneCountMin).toBe(1);
    expect(restored.goalReport?.total).toBe(3);
  });

  it('rejects an invalid scene range and rejects lower bound above upper bound', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    viewModel.setGoalSceneCount('abc', '5');
    expect(viewModel.snapshot.story?.goals.sceneCountMin).toBeNull();
    expect(viewModel.snapshot.notice).toContain('整数');
    viewModel.setGoalSceneCount('6', '5');
    expect(viewModel.snapshot.notice).toContain('下限不能大于上限');
    expect(viewModel.snapshot.story?.goals.sceneCountMax).toBeNull();
  });

  it('surfaces open goals when completing the project', () => {
    const viewModel = new StoryViewModel(new LocalStoryRepository(new MemoryStorageService()));
    viewModel.initialize();
    viewModel.toggleRequiredClue(viewModel.snapshot.story!.clues[0].id);
    viewModel.completeProject();
    expect(viewModel.snapshot.notice).toContain('1 项');
    viewModel.clearGoals();
    expect(viewModel.goalReport?.enabled).toBe(false);
  });
});
