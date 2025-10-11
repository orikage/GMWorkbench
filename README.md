# GMWorkbench

GMWorkbench は、TRPG GM が PDF シナリオを複数窓で並べて参照するための仮想デスクです。ブラウザ上のみで動作し、ネットワーク通信に依存せず GM の進行テンポを止めません。

## 開発環境

- Node.js 20+
- パッケージマネージャー: pnpm

```bash
pnpm install
pnpm dev
```

`pnpm dev` で Vite 開発サーバーが立ち上がります。

## テスト

Vitest + jsdom を使用しています。

```bash
# CI と同じ単発実行
pnpm test

# ウォッチしながら開発する場合
pnpm vitest -- --watch
```

## ドキュメント

- [docs/基本要件.md](docs/%E5%9F%BA%E6%9C%AC%E8%A6%81%E4%BB%B6.md)
- [docs/CHANGELOG.md](docs/CHANGELOG.md)
- [docs/DECISIONS.md](docs/DECISIONS.md)
- [docs/TASKS.md](docs/TASKS.md)

プロジェクトの意思決定や変更履歴は上記ドキュメントに記録します。

## カスタムイベント

ワークスペースは UI の節度を保つために DOM イベント経由で状態を外部へ通知します。

- `workspace:file-selected` — ドラッグ＆ドロップまたはファイル選択で PDF が投入されたとき。
- `workspace:file-open-request` — 取り込みキューからキャンバスへ配置したい PDF を選んだとき。
- `workspace:file-queue-remove` — キューから PDF を取り消したとき。
- `workspace:window-close` — ワークスペース上のウィンドウを閉じたとき。
- `workspace:window-pin-toggle` — ウィンドウのピン留め状態を切り替えたとき。
- `workspace:window-page-change` — ページ入力やナビゲーション、キーボード操作で表示ページが変わったとき。詳細には `page` と `totalPages` を含む。
- `workspace:window-zoom-change` — ウィンドウの倍率を拡大・縮小・リセットしたとき。詳細には `zoom` (0.5〜2.0) と現在の `page` を含む。

## PDFビューア統合

- `pdfjs-dist` を用いて PDF をローカルで描画し、各ウィンドウは最新ページのキャンバスを生成します。
- ワーカーは `pdfjs-dist/build/pdf.worker.min.mjs?url` を経由してバンドルしているため、Vite 環境では追加設定なしで動作します。
- ビューア要素には `data-page`, `data-zoom`, `data-total-pages` を付与し、テストやアクセシビリティ計測から現在の表示状態を取得できます。
- 既存のページ／ズーム操作は描画と同期しており、イベントと DOM 属性のどちらからでも最新の状態を参照できます。
