import { useEffect, useState } from 'react';
import type { StoryDocument } from '../models/story';
import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface GoalsPanelProps {
  viewModel: StoryViewModel;
}

export function GoalsPanel({ viewModel }: GoalsPanelProps) {
  const story = viewModel.snapshot.story;
  const report = viewModel.goalReport;
  const [editing, setEditing] = useState(false);
  const [minInput, setMinInput] = useState('');
  const [maxInput, setMaxInput] = useState('');
  if (!story || !report) return null;

  const configureMode = editing || !report.enabled;
  const openCount = report.total - report.metCount;

  const applyRange = () => {
    viewModel.setGoalSceneCount(minInput, maxInput);
  };

  const finishEditing = () => {
    viewModel.setGoalSceneCount(minInput, maxInput);
    setEditing(false);
  };

  const syncRangeInputs = () => {
    setMinInput(story.goals.sceneCountMin?.toString() ?? '');
    setMaxInput(story.goals.sceneCountMax?.toString() ?? '');
  };

  return (
    <section className="panel goals-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">STRUCTURE GOALS / 结构目标</span>
          <h2>结构目标核对</h2>
        </div>
        {report.enabled && (
          <div className="goals-heading-actions">
            <span className={openCount > 0 ? 'goal-progress alert' : 'goal-progress'}>
              {report.metCount}/{report.total} 已达成{openCount > 0 ? ` · ${openCount} 项待处理` : ''}
            </span>
            <button className="secondary-button goals-edit-button" onClick={finishEditing}>
              {editing ? '完成调整' : '调整目标'}
            </button>
          </div>
        )}
      </div>

      {!report.enabled && !editing && (
        <p className="goals-intro">还没有结构目标。设定必须回收的伏笔、必须出场的核心人物和场景数量区间后，每次编辑都会自动核对。</p>
      )}

      {configureMode && (
        <GoalEditor
          story={story}
          viewModel={viewModel}
          minInput={minInput}
          maxInput={maxInput}
          onMinChange={setMinInput}
          onMaxChange={setMaxInput}
          onApplyRange={applyRange}
          onSyncInputs={syncRangeInputs}
        />
      )}

      {report.enabled && !editing && (
        <ul className="goal-checklist">
          {report.items.map((item) => (
            <li key={item.key} className={item.status === 'met' ? 'goal-item met' : 'goal-item open'}>
              <span className="goal-check">{item.status === 'met' ? '✓' : '△'}</span>
              <div className="goal-copy">
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
              <em>{item.status === 'met' ? '已达成' : '未达成'}</em>
              {item.sceneId && (
                <button className="goal-jump" onClick={() => viewModel.selectScene(item.sceneId!)}>
                  查看相关幕 →
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface GoalEditorProps {
  story: StoryDocument;
  viewModel: StoryViewModel;
  minInput: string;
  maxInput: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  onApplyRange: () => void;
  onSyncInputs: () => void;
}

function GoalEditor({ story, viewModel, minInput, maxInput, onMinChange, onMaxChange, onApplyRange, onSyncInputs }: GoalEditorProps) {
  useEffect(() => {
    onSyncInputs();
    // 仅在首次进入编辑态时把已保存的区间填入输入框。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goals = story.goals;
  return (
    <div className="goal-editor">
      <fieldset className="goal-fieldset">
        <legend>必须回收的伏笔</legend>
        {story.clues.length === 0 && <span className="goal-empty">先在下方伏笔面板建立伏笔，再来勾选目标。</span>}
        <div className="goal-option-list">
          {story.clues.map((clue) => (
            <label key={clue.id} className="goal-option">
              <input
                type="checkbox"
                checked={goals.requiredClueIds.includes(clue.id)}
                onChange={() => viewModel.toggleRequiredClue(clue.id)}
              />
              <span>{clue.title}</span>
              <i>{clue.payoffSceneId ? '已回收' : '未回收'}</i>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="goal-fieldset">
        <legend>必须安排出场的核心人物</legend>
        {story.characters.length === 0 && <span className="goal-empty">还没有人物可以设为目标。</span>}
        <div className="goal-option-list">
          {story.characters.map((character) => (
            <label key={character.id} className="goal-option">
              <input
                type="checkbox"
                checked={goals.requiredCharacterIds.includes(character.id)}
                onChange={() => viewModel.toggleRequiredCharacter(character.id)}
              />
              <span>{character.name}</span>
              <i>{character.role}</i>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="goal-fieldset">
        <legend>场景数量的大致区间（留空表示不限制）</legend>
        <div className="goal-range-row">
          <input
            aria-label="场景数量下限"
            type="number"
            min={0}
            value={minInput}
            placeholder="下限"
            onChange={(event) => onMinChange(event.target.value)}
          />
          <span>至</span>
          <input
            aria-label="场景数量上限"
            type="number"
            min={0}
            value={maxInput}
            placeholder="上限"
            onChange={(event) => onMaxChange(event.target.value)}
          />
          <span>幕</span>
          <button className="secondary-button" onClick={onApplyRange}>应用区间</button>
        </div>
      </fieldset>

      {goals.requiredClueIds.length > 0 || goals.requiredCharacterIds.length > 0 ||
        goals.sceneCountMin !== null || goals.sceneCountMax !== null ? (
        <button className="goal-clear" onClick={() => viewModel.clearGoals()}>清空全部目标</button>
      ) : null}
    </div>
  );
}
