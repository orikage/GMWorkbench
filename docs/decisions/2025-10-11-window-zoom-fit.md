# 2025-10-11: ズームフィット操作の導入方針

## Context
- ズームイン／アウト／リセットに加え、ページを即座に読みやすいサイズへ合わせたいという要望が上がっていた。
- PDF.js が返すページ寸法を UI 側で把握できれば、ウィンドウ幅や高さに基づいたフィット倍率を計算できる状態になっていた。
- 既存の `workspace:window-zoom-change` は手動操作とフィット操作を区別できないため、外部統合時に意図した表示モードを判断しづらかった。

## Decision
- ズームパネルへ「幅合わせ」「全体表示」ボタンを追加し、押下時に `workspace:window-zoom-change` を `mode: 'fit-width'` / `'fit-page'` で発火する。
- ビューアにはページ元寸法と描画結果を `data-page-width` / `data-page-height` / `data-viewport-width` / `data-viewport-height` として付与し、ウィンドウ側でも `data-zoom-fit-mode` / `data-zoom-fit-width` / `data-zoom-fit-page` を公開する。
- jsdom など計算が省略される環境向けに、フィット倍率の算出は dataset もフォールバックに利用して安定化する。

## Consequences
- 外部統合は `detail.mode` と `data-zoom-fit-mode` を参照するだけで現在の表示意図（手動 / 幅フィット / 全体フィット）を把握できる。
- DOM から元ページ寸法と描画寸法を取得できるため、フィット後の倍率を視覚的な UI だけでなくテストや解析にも利用できる。
- フィット操作をテストで再現する際はスタイル情報を補う必要があるが、フォールバックにより Node ベースの実行でも検証が継続可能になった。
