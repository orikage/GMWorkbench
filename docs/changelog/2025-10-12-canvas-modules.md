# 2025-10-12 — キャンバス内部ロジックの分割

## Changed
- `src/workspace/canvas.js` のツールバー・検索・メモ関連処理を専用モジュールへ委譲し、主要関数が状態同期だけに集中するよう整理しました。
- 新たに `src/workspace/window-toolbar.js`・`src/workspace/window-search.js`・`src/workspace/window-notes.js` を追加し、各責務を独立したモジュールとして構成しました。

## Fixed
- メモや検索のイベント処理が `canvas.js` に集中していたことで見通しが悪かった問題を解消し、今後の機能追加時の影響範囲を明確にしました。
