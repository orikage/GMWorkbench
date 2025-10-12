# 2025-10-12 — タスクの Issue 自動化

## Added
- `scripts/tasks/sync-issues.mjs` を追加し、`docs/TASKS.md` の未着手タスクから GitHub Issue を生成できるようにした。
- `pnpm tasks:issues` / `pnpm tasks:issues:apply` スクリプトを `package.json` に登録した。
- `README.md` に Issue 生成手順を追記した。
- 未着手タスクを解析するユニットテストを追加し、スクリプトの挙動を保証した。
