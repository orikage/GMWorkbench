# DECISIONS

意思決定の記録は `docs/decisions/` 配下に**1トピック = 1ファイル**で保存します。

## 運用ルール
1. ファイル名は `YYYY-MM-DD-topic.md` の形式に統一してください。
2. 内容は見出しで小分けし、判断理由や比較検討を明文化します。
3. 過去の判断を更新する場合は新しいファイルを追加し、旧ファイルの末尾にリンクを残すことで履歴を保ちます。
4. 一覧はディレクトリを参照するか、`pnpm run docs:print:decisions` などの補助スクリプトで取得します。

## 既存エントリ
- [2025-10-11: キャッシュ全削除 UI の導入](decisions/2025-10-11-cache-maintenance.md)
- [2025-10-11: ワークスペースと永続化の意思決定](decisions/2025-10-11-workspace-and-storage.md)
- [2025-10-11: ドキュメント分割でコンフリクトを避ける](decisions/2025-10-11-docs-conflict-mitigation.md)
- [2025-10-11: ウィンドウ複製と操作設計](decisions/2025-10-11-window-duplicate.md)
- [2025-10-11: ウィンドウズームショートカットの導入](decisions/2025-10-11-window-keyboard-zoom.md)
- [2025-10-11: ウィンドウメモ運用の指針](decisions/2025-10-11-window-notes.md)
- [2025-10-11: ウィンドウタイトル編集の体験設計](decisions/2025-10-11-window-title.md)
