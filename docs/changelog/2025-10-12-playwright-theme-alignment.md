# 2025-10-12 — Playwright テストのシェル整合

## Changed
- `e2e/workspace.spec.js` の期待値を最新のワークスペースシェルに合わせ、アプリバーのシナリオ切り替えと隠し補助パネルを基準にロード確認を行うよう更新した。
- オンボーディングの非表示判定を `hidden` 属性に合わせて確認するよう修正し、ガイドを閉じた後も確実に完了ステートを検証できるようにした。
- メンテナンスパネルのエクスポートオプション検証を DOM の存在と初期値チェックに変更し、UIを非表示にするデザイン変更と整合させた。

## Tests
- `npm run build`
- `npx playwright test`
- `npx vitest run src/workspace.test.js src/workspace/theme.test.js src/workspace/menu.test.js src/workspace/icons.test.js src/workspace/events-contract.test.js --reporter=basic`
