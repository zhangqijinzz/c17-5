import type { StoryViewModel } from '../viewmodels/storyViewModel';

interface GoalsPanelProps { viewModel: StoryViewModel; }

export function GoalsPanel({ viewModel }: GoalsPanelProps) {
  const story = viewModel.snapshot.story;
  if (!story) return null;
  const goals = story.goals;
  const report = viewModel.goalReport;
  const parseCount = (value: string): number | null => (value === '' ? null : Number(value));
  return (
    <section className="panel goals-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">GOALS / 结构核对</span><h2>结构目标</h2></div>
        {report && report.total > 0 && (
          <span className={report.unmet.length > 0 ? 'goal-badge unmet' : 'goal-badge met'}>
            {report.unmet.length > 0 ? `${report.unmet.length} 项未达成` : '✓ 全部达成'}
          </span>
        )}
      </div>
      {!goals ? (
        <div className="empty-state goals-empty">
          <p>还没有设定结构目标。定下必须回收的伏笔、必须出场的核心人物和场景数量区间，之后每次编辑都会自动核对，偏离时会在相关那一幕上提示。</p>
          <button className="secondary-button" onClick={() => viewModel.enableGoals()}>＋ 设定结构目标</button>
        </div>
      ) : (
        <>
          <div className="goal-form">
            <div className="goal-field">
              <span className="field-label">场景数量区间</span>
              <div className="goal-range">
                <input aria-label="场景数量下限" type="number" min={0} placeholder="最少" value={goals.sceneCountMin ?? ''} onChange={(event) => viewModel.setSceneCountGoal(parseCount(event.target.value), goals.sceneCountMax)} />
                <span>–</span>
                <input aria-label="场景数量上限" type="number" min={0} placeholder="最多" value={goals.sceneCountMax ?? ''} onChange={(event) => viewModel.setSceneCountGoal(goals.sceneCountMin, parseCount(event.target.value))} />
                <span className="hint">幕</span>
              </div>
            </div>
            <div className="goal-field">
              <span className="field-label">必须出场的核心人物</span>
              <div className="person-toggles">
                {story.characters.map((character) => (
                  <button key={character.id} className={goals.requiredCharacterIds.includes(character.id) ? `person-toggle selected ${character.color}` : 'person-toggle'} onClick={() => viewModel.toggleGoalCharacter(character.id)}>
                    <span>{character.name.slice(0, 1)}</span>{character.name}
                  </button>
                ))}
                {story.characters.length === 0 && <span className="hint">还没有人物可以选择。</span>}
              </div>
            </div>
            <div className="goal-field">
              <span className="field-label">必须回收的伏笔</span>
              <div className="person-toggles">
                {story.clues.map((clue) => (
                  <button key={clue.id} className={goals.requiredClueIds.includes(clue.id) ? 'person-toggle selected clue-goal' : 'person-toggle'} onClick={() => viewModel.toggleGoalClue(clue.id)}>
                    <span>⌁</span>{clue.title}
                  </button>
                ))}
                {story.clues.length === 0 && <span className="hint">还没有伏笔可以选择。</span>}
              </div>
            </div>
          </div>
          {report && report.total > 0 ? (
            <ul className="goal-checklist">
              {report.items.map((item) => (
                <li key={item.id} className={item.ok ? 'goal-item met' : 'goal-item unmet'}>
                  <span className="goal-state">{item.ok ? '✓' : '△'}</span>
                  <div><strong>{item.label}</strong><span>{item.detail}</span></div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hint goals-hint">从上方设定数量区间、勾选人物或伏笔，核对结果会随每次编辑实时更新。</p>
          )}
          <button className="reset-link goals-clear" onClick={() => viewModel.clearGoals()}>清除全部目标</button>
        </>
      )}
    </section>
  );
}
