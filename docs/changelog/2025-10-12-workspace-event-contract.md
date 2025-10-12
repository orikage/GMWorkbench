# 2025-10-12 — ワークスペースイベント契約の型定義

## Added
- `src/workspace/events-contract.js` に `workspace:*` カスタムイベントのディスパッチ契約を集約し、フィールドの型メタデータと説明を定義。
- `types/workspace-events.d.ts` を追加し、イベント契約から型情報を組み立てて DOM の `HTMLElementEventMap` / `DocumentEventMap` を拡張。
- `src/workspace/events-contract.test.js` で契約が全イベントをカバーし、定義済みの型識別子のみを利用していることを検証。

## Changed
- `package.json` に `types/workspace-events.d.ts` を公開するエントリを追加。
- `docs/TASKS.md` の T-130 を完了に更新し、型契約タスクの完了状況を反映。
