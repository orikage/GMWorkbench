# 2025-10-11 — ドキュメント分割によるコンフリクト削減

## Added
- 変更履歴と意思決定ログを `docs/changelog/` と `docs/decisions/` に分割し、1変更=1ファイルで管理できるようにした。
- `docs/CHANGELOG.md` と `docs/DECISIONS.md` を索引兼ルール集へ刷新し、分割運用を明文化した。
- CLI から履歴を俯瞰できるよう `pnpm docs:print:changelog` / `pnpm docs:print:decisions` スクリプトを追加した。

## Changed
- README のドキュメント項目を更新し、新しい運用とコマンドを案内するようにした。
