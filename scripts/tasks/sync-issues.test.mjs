import { describe, expect, it } from 'vitest';
import {
  parseTasksTable,
  selectUnstartedTasks,
  buildIssueTitle,
  buildIssueBody
} from './sync-issues.mjs';

describe('task issue sync helpers', () => {
  const markdown = `
| ID | 状態 | 内容 | メモ | 最終更新 |
| --- | --- | --- | --- | --- |
| T-001 | 完了 | 既存タスク | メモ | 2025-10-11 |
| T-129 | 未着手 | キャンバス内部ロジックの細分化 | ` +
    'コンポーネント分割を進める' +
    ` | 2025-10-12 |
| T-130 | 未着手 | カスタムイベント契約の型定義 | - | 2025-10-12 |
`;

  it('parses markdown table rows', () => {
    const rows = parseTasksTable(markdown);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      id: 'T-001',
      status: '完了',
      title: '既存タスク',
      memo: 'メモ',
      updated: '2025-10-11'
    });
  });

  it('selects only unstarted tasks', () => {
    const rows = parseTasksTable(markdown);
    const unstarted = selectUnstartedTasks(rows);
    expect(unstarted.map((row) => row.id)).toEqual(['T-129', 'T-130']);
  });

  it('builds issue title and body', () => {
    const [task] = selectUnstartedTasks(parseTasksTable(markdown));
    expect(buildIssueTitle(task)).toBe('[T-129] キャンバス内部ロジックの細分化');
    const body = buildIssueBody(task);
    expect(body).toContain('## タスク概要');
    expect(body).toContain('docs/TASKS.md');
    expect(body).toContain('コンポーネント分割を進める');
  });
});
