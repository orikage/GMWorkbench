import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STATUS_UNSTARTED = '未着手';

export function parseTasksTable(markdown) {
  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('| T-'))
    .map((line) => {
      const cells = line
        .split('|')
        .map((cell) => cell.trim())
        .filter(Boolean);
      if (cells.length < 5) {
        return null;
      }

      const [id, status, title, memo, updated] = cells;
      return { id, status, title, memo, updated };
    })
    .filter(Boolean);
}

export function selectUnstartedTasks(rows) {
  return rows.filter((row) => row.status === STATUS_UNSTARTED);
}

export function buildIssueTitle(task) {
  return `[${task.id}] ${task.title}`;
}

export function buildIssueBody(task) {
  const memoLine = task.memo && task.memo !== '-' ? `- **メモ**: ${task.memo}` : '';
  const lines = [
    '## タスク概要',
    `- **ID**: ${task.id}`,
    `- **状態**: ${task.status}`,
    `- **内容**: ${task.title}`,
    memoLine,
    task.updated ? `- **最終更新**: ${task.updated}` : ''
  ].filter(Boolean);

  lines.push('\n---\n');
  lines.push('この Issue は `docs/TASKS.md` のタスク表から自動生成されました。');
  lines.push('完了後はタスク表のステータス更新と、この Issue のクローズをあわせて行ってください。');

  return lines.join('\n');
}

function parseArgs(argv) {
  const args = new Map();
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const [key, value] = raw.replace(/^--/, '').split('=');
    args.set(key, value === undefined ? true : value);
  }
  return args;
}

async function readTasksFile(tasksPath) {
  try {
    const absolute = path.resolve(tasksPath);
    return await fs.readFile(absolute, 'utf8');
  } catch (error) {
    throw new Error(`タスクファイルを読み込めませんでした: ${error.message}`);
  }
}

async function fetchExistingTaskIds({ repo, token }) {
  if (!token) {
    return new Set();
  }

  const existingIds = new Set();
  const searchUrl = new URL('https://api.github.com/search/issues');
  searchUrl.searchParams.set('q', `repo:${repo} "[T-" in:title`);
  searchUrl.searchParams.set('per_page', '100');

  const response = await fetch(searchUrl, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'gmworkbench-task-sync'
    }
  });

  if (!response.ok) {
    throw new Error(`既存 Issue の取得に失敗しました: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  for (const item of payload.items ?? []) {
    const match = item.title.match(/\[(T-\d+)\]/);
    if (match) {
      existingIds.add(match[1]);
    }
  }

  return existingIds;
}

async function createIssue({ repo, token, title, body, labels }) {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'gmworkbench-task-sync'
    },
    body: JSON.stringify({ title, body, labels })
  });

  if (!response.ok) {
    const errorPayload = await response.text();
    throw new Error(`Issue 作成に失敗しました: ${response.status} ${response.statusText} — ${errorPayload}`);
  }

  return response.json();
}

async function main() {
  const args = parseArgs(process.argv);
  const tasksPath = args.get('tasks') || 'docs/TASKS.md';
  const repo = args.get('repo') || process.env.GITHUB_REPOSITORY;
  const apply = args.has('apply');
  const labelsArg = args.get('labels');
  const labels = typeof labelsArg === 'string' && labelsArg.length > 0 ? labelsArg.split(',') : [];
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  if (!repo) {
    console.error('リポジトリ名を --repo=owner/repo で指定するか、GITHUB_REPOSITORY 環境変数を設定してください。');
    process.exit(1);
  }

  const markdown = await readTasksFile(tasksPath);
  const rows = parseTasksTable(markdown);
  const unstarted = selectUnstartedTasks(rows);

  if (unstarted.length === 0) {
    console.log('未着手タスクはありません。');
    return;
  }

  console.log(`未着手タスク: ${unstarted.length} 件`);

  const existingIds = await fetchExistingTaskIds({ repo, token }).catch((error) => {
    console.error(error.message);
    if (apply) {
      process.exit(1);
    }
    return new Set();
  });

  const pending = unstarted.filter((task) => !existingIds.has(task.id));

  if (pending.length === 0) {
    console.log('新規に作成すべき Issue はありません。');
    return;
  }

  if (!apply) {
    console.log('\n-- Dry Run --');
    for (const task of pending) {
      console.log(`${buildIssueTitle(task)}`);
    }
    console.log('\n-- 実行方法 --');
    console.log('実際に Issue を作成するには --apply オプションを付けて実行してください。');
    return;
  }

  if (!token) {
    console.error('Issue を作成するには GITHUB_TOKEN (または GH_TOKEN) を設定してください。');
    process.exit(1);
  }

  for (const task of pending) {
    const title = buildIssueTitle(task);
    const body = buildIssueBody(task);
    console.log(`Issue 作成中: ${title}`);
    await createIssue({ repo, token, title, body, labels });
  }

  console.log('未着手タスクの Issue 化が完了しました。');
}

const isDirectExecution =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
