# 2025-10-12 — タスク Issue 同期ワークフロー

## Added
- `.github/workflows/task-issues.yml` を追加し、`docs/TASKS.md` の未着手行を毎日と `main` への変更時に自動で Issue 化するようにした。
- ワークフローでは `pnpm tasks:issues:apply --labels=P2,meta` を実行し、既存 Issue を確認したうえで不足分のみを作成する。
- README のタスク同期手順に自動実行の概要を追記し、手動確認との併用方法を共有した。
