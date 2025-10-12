# DECISIONS

意思決定の記録は `docs/decisions/` 配下に**1トピック = 1ファイル**で保存します。

## 運用ルール
1. ファイル名は `YYYY-MM-DD-topic.md` の形式に統一してください。
2. 内容は見出しで小分けし、判断理由や比較検討を明文化します。
3. 過去の判断を更新する場合は新しいファイルを追加し、旧ファイルの末尾にリンクを残すことで履歴を保ちます。
4. 一覧はディレクトリを参照するか、`pnpm run docs:print:decisions` などの補助スクリプトで取得します。

## 既存エントリ
- [2025-10-12: タスク Issue 同期ワークフローを常設する判断](decisions/2025-10-12-task-issue-workflow.md)
- [2025-10-12: タスク表から Issue を起こす運用](decisions/2025-10-12-task-issue-sync.md)
- [2025-10-12: ワークスペースをモジュール化する方針](decisions/2025-10-12-workspace-modules.md)
- [2025-10-12: ワークスペースイベント契約を型で管理する方針](decisions/2025-10-12-workspace-event-contract.md)
- [2025-10-12: オンボーディングサンプル更新の方針](decisions/2025-10-12-sample-pdf-refresh.md)
- [2025-10-12: オンボーディング完了フラグ導入の判断](decisions/2025-10-12-onboarding-preference.md)
- [2025-10-12: スナップショット軽量化アプローチ](decisions/2025-10-12-snapshot-options.md)
- [2025-10-12: E2E カバレッジ拡張方針](decisions/2025-10-12-e2e-expansion.md)
- [2025-10-12: E2E テスト自動化の導入判断](decisions/2025-10-12-e2e-tests.md)
- [2025-10-12: セッション書き出し/読み込みの導入判断](decisions/2025-10-12-session-export-import.md)
- [2025-10-12: PDF内検索とアウトライン導入の判断](decisions/2025-10-12-search-outline.md)
- [2025-10-12: 初回オンボーディング導入の判断](decisions/2025-10-12-initial-onboarding.md)
- [2025-10-12: バックログ更新の方針](decisions/2025-10-12-backlog-refresh.md)
- [2025-10-11: キャッシュ全削除 UI の導入](decisions/2025-10-11-cache-maintenance.md)
- [2025-10-11: ワークスペースと永続化の意思決定](decisions/2025-10-11-workspace-and-storage.md)
- [2025-10-11: ドキュメント分割でコンフリクトを避ける](decisions/2025-10-11-docs-conflict-mitigation.md)
- [2025-10-11: ウィンドウ複製と操作設計](decisions/2025-10-11-window-duplicate.md)
- [2025-10-11: ウィンドウズームショートカットの導入](decisions/2025-10-11-window-keyboard-zoom.md)
- [2025-10-11: ウィンドウメモ運用の指針](decisions/2025-10-11-window-notes.md)
- [2025-10-11: ウィンドウタイトル編集の体験設計](decisions/2025-10-11-window-title.md)
- [2025-10-11: ページ履歴ナビゲーションの導入方針](decisions/2025-10-11-window-page-history.md)
- [2025-10-11: ウィンドウカラータグとアクセント設計](decisions/2025-10-11-window-color-tags.md)
- [2025-10-11: ページ端ジャンプ操作の導入](decisions/2025-10-11-window-boundary-navigation.md)
- [2025-10-11: ページスライダーの導入方針](decisions/2025-10-11-window-page-slider.md)
- [2025-10-11: ウィンドウ回転コントロールの導入方針](decisions/2025-10-11-window-rotation.md)
- [2025-10-11: ウィンドウ最大化トグルの導入方針](decisions/2025-10-11-window-maximize.md)
- [2025-10-11: ズームフィット操作の導入方針](decisions/2025-10-11-window-zoom-fit.md)
- [2025-10-11: ウィンドウフォーカス循環ショートカットの導入](decisions/2025-10-11-window-focus-cycle.md)
- [2025-10-11: ウィンドウブックマーク導入の指針](decisions/2025-10-11-window-bookmarks.md)
- [2025-10-11: ウィンドウブックマークナビゲーションの設計](decisions/2025-10-11-window-bookmark-navigation.md)
- [2025-10-11: GitHub Pages を自動デプロイする方針](decisions/2025-10-11-gh-pages-automation.md)
