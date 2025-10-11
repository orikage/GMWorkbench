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
- [docs/changelog/](docs/changelog)
- [docs/DECISIONS.md](docs/DECISIONS.md)
- [docs/decisions/](docs/decisions)
- [docs/TASKS.md](docs/TASKS.md)

変更履歴と意思決定は**1変更 = 1ファイル**で `docs/changelog/` と `docs/decisions/` に追加し、トップレベルの Markdown は運用ルールと索引を管理します。CLI で一覧を確認したい場合は次のコマンドを利用してください。

```bash
pnpm docs:print:changelog
pnpm docs:print:decisions
```

各エントリを分割することで、複数のブランチが同時に更新してもマージコンフリクトを最小化できます。

## カスタムイベント

ワークスペースは UI の節度を保つために DOM イベント経由で状態を外部へ通知します。

- `workspace:file-selected` — ドラッグ＆ドロップまたはファイル選択で PDF が投入されたとき。
- `workspace:file-open-request` — 取り込みキューからキャンバスへ配置したい PDF を選んだとき。
- `workspace:file-queue-remove` — キューから PDF を取り消したとき。
- `workspace:window-close` — ワークスペース上のウィンドウを閉じたとき。
- `workspace:window-pin-toggle` — ウィンドウのピン留め状態を切り替えたとき。
- `workspace:window-page-change` — ページ入力やナビゲーション、キーボード操作で表示ページが変わったとき。詳細には `page` と `totalPages` を含む。
- `workspace:window-zoom-change` — ウィンドウの倍率を拡大・縮小・リセットしたとき。詳細には `zoom` (0.5〜2.0) と現在の `page` を含む。
- `workspace:window-duplicate` — ウィンドウの「複製」を押したとき。`page`, `zoom`, `totalPages`, `sourceId`, `duplicateId`, `title` を併せて通知する。
- `workspace:window-notes-change` — ウィンドウ内のメモが更新されたとき。`detail.notes` に最新テキストを含む。
- `workspace:window-title-change` — ウィンドウタイトルが保存されたとき。`detail.title` に確定したタイトルを含む。
- `workspace:cache-cleared` — メンテナンス操作で保存済みデータを削除したとき。`detail.windowsCleared` に閉じたウィンドウ件数が入ります。

## PDFビューア統合

- `pdfjs-dist` を用いて PDF をローカルで描画し、各ウィンドウは最新ページのキャンバスを生成します。
- ワーカーは `pdfjs-dist/build/pdf.worker.min.mjs?url` を経由してバンドルしているため、Vite 環境では追加設定なしで動作します。
- ビューア要素には `data-page`, `data-zoom`, `data-total-pages` を付与し、テストやアクセシビリティ計測から現在の表示状態を取得できます。
- 既存のページ／ズーム操作は描画と同期しており、イベントと DOM 属性のどちらからでも最新の状態を参照できます。

## セッション永続化

- IndexedDB にウィンドウ配置・ページ・ズーム・ピン状態を保存し、ブラウザを再読み込みしても直近の PDF 状態を復元します。
- PDF ファイル本体はローカルのみで保持され、`File`/`Blob` を直接 IndexedDB に退避します。ネットワークへ送信されることはありません。
- ブラウザの「サイトデータを削除」を実行すると保存されたセッションが初期化されます。UI 上でも「キャッシュを全削除」ボタンから保存済み PDF とウィンドウ配置を一括でリセットでき、処理完了時には `workspace:cache-cleared` を発火します。
- メモ欄もレイアウトやページ情報と同じく永続化され、再読み込み後に内容が復元されます。

## ウィンドウ複製

- 各ウィンドウのヘッダーに「複製」ボタンを追加し、同じ PDF を別ページで開く操作を 1 クリックで行えます。
- 複製時はページ・ズーム・ピン留め状態を引き継ぎ、元の位置から 24px ずらして積み重なるように配置します。
- 複製後には `workspace:window-duplicate` を発火し、生成されたウィンドウ ID や表示状態を外部へ渡せます。

## ウィンドウメモ

- 各ウィンドウ下部にメモ欄を配置し、シーンの補足やアドリブ案をすぐに書き留められます。
- 入力内容は `workspace:window-notes-change` で通知され、`data-notes-length` 属性から文字数を取得できます。
- 内容は永続化対象に含まれるため、ページやズームと同様にリロード後も維持されます。

## ウィンドウタイトル編集

- ヘッダーの「名称変更」ボタンからタイトルを編集でき、Enter で確定・Escape でキャンセルできます。空のまま確定すると元のファイル名に戻ります。
- 確定時には `workspace:window-title-change` を発火し、`data-window-title` 属性と各種 `aria-label` が最新タイトルと同期されます。
- 設定したタイトルは永続化され、複製やセッション復元でも引き継がれます。

## キーボードショートカット

| 操作 | ショートカット | 備考 |
| --- | --- | --- |
| 次のページ | `→` | フォーカス中のウィンドウに対して発火します。 |
| 前のページ | `←` | 入力フォームをフォーカスしている場合は無効化されます。 |
| ズームイン | `=` または `+` | 修飾キー付き（Ctrl/⌘ など）の操作はブラウザに委ねます。 |
| ズームアウト | `-` または `_` | ズーム下限 (`50%`) を下回らないよう制御されます。 |
| ズームリセット | `0` | デフォルト倍率 (`100%`) に戻します。 |
