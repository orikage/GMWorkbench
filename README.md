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

# Playwright E2E テスト
pnpm build
pnpm test:e2e
```

初回実行時は `npx playwright install chromium` でブラウザバイナリを取得してください。Linux 環境で必要なシステムライブラリが不足している場合は `npx playwright install-deps` を追加で実行してください。`pnpm test:e2e` はビルド済みの `dist/` を対象に `pnpm preview` を起動し、GitHub Pages と同じ静的配信環境で検証します。

## デプロイ

- 本番環境: http://gmworkbench.orikage.com/
- GitHub Actions の `Deploy site` ワークフローが `main` ブランチへの push ごとに `pnpm test` と `pnpm build` を実行し、生成された `dist/` を GitHub Pages へ公開します。
- ローカルで挙動を確認したい場合は `pnpm build` のあと `pnpm preview -- --host` を利用してください。

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

## タスクから Issue を生成する

`docs/TASKS.md` の表で **状態が「未着手」** の行は、CLI から GitHub Issue に変換できます。

> ℹ️ `main` ブランチに変更が入ったときと毎日午前3時 (UTC) に、[Sync task issues ワークフロー](.github/workflows/task-issues.yml) が自動で CLI を実行し、未作成の Issue を補完します。手元で確認したい場合は以下のコマンドを使ってください。

```bash
# Dry run: 作成対象の一覧だけを表示
pnpm tasks:issues --repo=orikage/GMWorkbench

# 実際に Issue を作成
GITHUB_TOKEN=ghp_xxx pnpm tasks:issues:apply --repo=orikage/GMWorkbench --labels=P2,meta
```

- `--repo` を省略すると `GITHUB_REPOSITORY` 環境変数が利用されます。
- `--labels` で付与するラベルをカンマ区切り指定できます（省略可）。
- 既に `[T-xxx]` を含むタイトルの Issue が存在する場合は重複作成されません。
- Dry run 時はトークン不要、作成時は `GITHUB_TOKEN`（または `GH_TOKEN`）が必要です。

Issue 作成後は、タスクが完了したタイミングで `docs/TASKS.md` のステータス更新と Issue のクローズをあわせて行ってください。

## コード構成

- `src/workspace/` — ワークスペース UI のモジュール群。`index.js` がエントリポイントで、ドロップゾーン・キュー・オンボーディング・メンテナンス・キャンバスを個別ファイルとして読み込みます。
- `src/workspace/canvas.js` — ウィンドウ管理の中心ロジック。今後さらに `toolbar` や `search` などに分割する前提で、API をモジュール越しに共有しています。
- `src/workspace/constants.js` / `src/workspace/utils.js` — イベント名やデフォルト値など、モジュール間で共有する値とユーティリティ。
- `src/workspace/drop-zone.js` / `file-queue.js` / `onboarding.js` / `maintenance.js` / `chrome.js` — UI セクションごとに DOM を組み立て、`index.js` からコンポーズします。

従来 1 ファイルに集約されていた 4,000 行規模のロジックを段階的に分割することで、差分の見通しとテスト観点の洗い出しを容易にしています。

## カスタムイベント

ワークスペースは UI の節度を保つために DOM イベント経由で状態を外部へ通知します。

- `workspace:file-selected` — ドラッグ＆ドロップまたはファイル選択で PDF が投入されたとき。
- `workspace:file-open-request` — 取り込みキューからキャンバスへ配置したい PDF を選んだとき。
- `workspace:file-queue-remove` — キューから PDF を取り消したとき。
- `workspace:window-close` — ワークスペース上のウィンドウを閉じたとき。
- `workspace:window-pin-toggle` — ウィンドウのピン留め状態を切り替えたとき。
- `workspace:window-page-change` — ページ入力やナビゲーション、キーボード操作で表示ページが変わったとき。詳細には `page`、`totalPages`、`historyIndex`、`historyLength`、現在の `zoom` と `rotation` を含む。
- `workspace:window-zoom-change` — ウィンドウの倍率を拡大・縮小・リセットしたとき。詳細には `zoom` (0.5〜2.0)、現在の `page`、`rotation` に加え `mode` (`manual` / `fit-width` / `fit-page`) を含む。
- `workspace:window-rotation-change` — 回転ツールバーで表示角度を変更したとき。`rotation` (0°/90°/180°/270°)、`page`、`zoom` を通知する。
- `workspace:window-maximize-change` — ヘッダーの「最大化」を切り替えたとき。`maximized`、現在の `left`/`top`/`width`/`height` と復元用の `restore*` 値を通知する。
- `workspace:window-focus-cycle` — キーボード操作でフォーカスを循環させたとき。`direction` (`next` / `previous`)、`windowId`、`title`、`totalWindows` を含む。
- `workspace:window-duplicate` — ウィンドウの「複製」を押したとき。`page`, `zoom`, `rotation`, `totalPages`, `sourceId`, `duplicateId`, `title`, `maximized` を併せて通知する。
- `workspace:window-notes-change` — ウィンドウ内のメモが更新されたとき。`detail.notes` に最新テキストを含む。
- `workspace:window-title-change` — ウィンドウタイトルが保存されたとき。`detail.title` に確定したタイトルを含む。
- `workspace:window-color-change` — ウィンドウの色タグを切り替えたとき。`detail.color` に現在の色 ID を含む。
- `workspace:window-bookmarks-change` — ブックマークを追加・削除したとき。`detail.action` (`add` / `remove`)、`page`、`bookmarks` 配列を通知します。
- `workspace:window-bookmark-jump` — ブックマーク一覧やショートカットでページへ移動したとき。`detail.page`、`source`、`bookmarks`、次・前のブックマーク番号 (`next` / `previous`) を含みます。
- `workspace:session-exported` — メンテナンスパネルからセッションを書き出したとき。`detail.windows`（書き出したウィンドウ件数）と `fileName` を通知します。
- `workspace:session-imported` — セッションを読み込んだとき。`detail.windows`（開いたウィンドウ件数）、`previous`（読み込み前に閉じたウィンドウ件数）、`exportedAt`（スナップショットが持つタイムスタンプ、存在する場合）を含みます。
- `workspace:cache-cleared` — メンテナンス操作で保存済みデータを削除したとき。`detail.windowsCleared` に閉じたウィンドウ件数が入ります。
- `workspace:window-search` — PDF 内検索を実行したとき。`detail.query`、`totalResults`、`index`、現在ページ (`page`)、`action` (`search` / `navigate` / `previous` / `next` / `result`) を通知します。
- `workspace:window-outline-jump` — アウトライン項目からページへ移動したとき。`detail.page`、`title`、`index`、`level` を含みます。

## 初回オンボーディング

- ワークスペースに PDF ウィンドウが 1 件もない場合、ドラッグ＆ドロップから整理までの 4 ステップを示したガイドカードを表示します。
- ガイドには「サンプルPDFを開いてみる」ボタンが付属し、検索語とアウトライン見出しを含む 4 ページ構成の PDF で操作感を確かめられます。
- ガイド右下の「ガイドを閉じる」ボタンから完了フラグを保存でき、常連ユーザーは空の状態でもガイドを非表示のまま利用できます。
- 最初のウィンドウを開くとガイドは自動で退避し、完了フラグが無効な場合のみすべてのウィンドウを閉じると再び表示されるため、空の状態に迷うことがありません。

## PDF内検索とアウトライン

- ウィンドウツールバー下に検索フォームを追加し、キーワードを入力して Enter または「検索」ボタンを押すと全ページから一致箇所を収集します。
- 検索結果は最大 200 件までリスト表示され、「前へ」「次へ」ボタンまたは各結果をクリックしてページへジャンプできます。`Ctrl + F` (macOS は `⌘F`) でフォームへフォーカスできます。
- 検索状態は `data-search-query`、`data-search-count`、`data-search-index` に反映され、`workspace:window-search` イベントで外部へ通知されます。
- pdf.js のアウトライン情報を読み込み、章構成をリスト表示します。各項目をクリックすると該当ページへ移動し、`workspace:window-outline-jump` で遷移内容を通知します。
- アウトラインが存在しない場合は「アウトライン情報は見つかりませんでした。」と表示し、読み込み失敗時はステータスメッセージでエラーを知らせます。

## PDFビューア統合

- `pdfjs-dist` を用いて PDF をローカルで描画し、各ウィンドウは最新ページのキャンバスを生成します。
- ワーカーは `pdfjs-dist/build/pdf.worker.min.mjs?url` を経由してバンドルしているため、Vite 環境では追加設定なしで動作します。
- ビューア要素には `data-page`, `data-zoom`, `data-rotation`, `data-total-pages` に加え、元ページサイズを示す `data-page-width` / `data-page-height`、描画結果の `data-viewport-width` / `data-viewport-height` を付与し、テストやアクセシビリティ計測から現在の表示状態を取得できます。
- ウィンドウ要素側でも `data-zoom-fit-mode`, `data-zoom-fit-width`, `data-zoom-fit-page` を公開し、UI とイベントで採用されているフィットモードや算出倍率を DOM 経由で参照できます。`data-opened-at` と `data-last-focused-at` から作成時刻と最新フォーカスタイムスタンプを取得できます。
- 既存のページ／ズーム操作は描画と同期しており、イベントと DOM 属性のどちらからでも最新の状態を参照できます。

## セッション永続化

- IndexedDB にウィンドウ配置・ページ・ズーム・回転・ピン状態を保存し、ブラウザを再読み込みしても直近の PDF 状態を復元します。
- 最大化状態と復元用レイアウト (`restoreLeft`/`restoreTop`/`restoreWidth`/`restoreHeight`) も保存し、再訪時に同じ広がり方を再現します。
- PDF ファイル本体はローカルのみで保持され、`File`/`Blob` を直接 IndexedDB に退避します。ネットワークへ送信されることはありません。
- ブラウザの「サイトデータを削除」を実行すると保存されたセッションが初期化されます。UI 上でもメンテナンスパネルの「キャッシュを全削除」ボタンから保存済み PDF とウィンドウ配置を一括でリセットでき、処理完了時には `workspace:cache-cleared` を発火します。
- 同じメンテナンスパネルからセッションの JSON スナップショットを書き出し・読み込みでき、外部ストレージへバックアップしたり別ブラウザへ持ち込む運用をサポートします。書き出し後は `workspace:session-exported`、読み込み後は `workspace:session-imported` を通知します。
- 書き出し時は「保存済みすべて」「開いているウィンドウのみ」の対象選択と、gzip 圧縮（対応ブラウザのみ）の有無を切り替えられます。ウィンドウが存在しない場合は警告メッセージで知らせます。
- メモ欄もレイアウトやページ情報と同じく永続化され、再読み込み後に内容が復元されます。

## ウィンドウ複製

- 各ウィンドウのヘッダーに「複製」ボタンを追加し、同じ PDF を別ページで開く操作を 1 クリックで行えます。
- 複製時はページ・ズーム・回転・ピン留め状態を引き継ぎ、元の位置から 24px ずらして積み重なるように配置します。
- 複製後には `workspace:window-duplicate` を発火し、生成されたウィンドウ ID・表示状態・元ウィンドウの `maximized` 状態を外部へ渡せます。

## ウィンドウメモ

- 各ウィンドウ下部にメモ欄を配置し、シーンの補足やアドリブ案をすぐに書き留められます。
- 入力内容は `workspace:window-notes-change` で通知され、`data-notes-length` 属性から文字数を取得できます。
- 内容は永続化対象に含まれるため、ページやズームと同様にリロード後も維持されます。

## ウィンドウブックマーク

- ツールバーの「このページを記憶」ボタンと一覧から重要なページを素早く蓄積できます。
- ブックマークは `workspace:window-bookmarks-change` で通知され、`data-bookmark-count` と `data-bookmark-pages` から最新の件数と一覧を参照できます。
- 重複登録を避けつつ最大 50 件まで保持し、複製・復元でも保存内容が引き継がれます。
- `b` キーでのショートカットにも対応し、フォーカス中のウィンドウから現在ページを即座に登録できます。
- 前後ナビゲーションボタンで現在ページから最も近いブックマークへ移動でき、`data-bookmark-next` と `data-bookmark-previous` に直近の番号が公開されます。
- ブックマークジャンプ時には `workspace:window-bookmark-jump` が発火し、イベント詳細から遷移元・先の状態を取得できます。

## ウィンドウタイトル編集

- ヘッダーの「名称変更」ボタンからタイトルを編集でき、Enter で確定・Escape でキャンセルできます。空のまま確定すると元のファイル名に戻ります。
- 確定時には `workspace:window-title-change` を発火し、`data-window-title` 属性と各種 `aria-label` が最新タイトルと同期されます。
- 設定したタイトルは永続化され、複製やセッション復元でも引き継がれます。

## ウィンドウカラータグ

- ヘッダーの「色」ボタンで標準 → 琥珀 → 翡翠 → 紅玉 → 藍の順にタグカラーを循環させられます。
- 選択中の色は `data-window-color` と `workspace__window--color-*` クラスに反映され、スタイルとテストから一貫して参照できます。
- 変更時には `workspace:window-color-change` を発火し、`detail.color` に現在の色 ID を含めます。選択内容は永続化・複製・復元でも保持されます。

## ウィンドウ回転

- ツールバー右側に回転パネルを追加し、↺ / ↻ ボタンで 90° 単位の回転、0° ボタンでリセットできます。
- 現在の角度は `data-rotation` とツールバー表示に反映され、`workspace:window-rotation-change` で `rotation`・`page`・`zoom` を通知します。
- 回転状態は永続化と複製・復元でも保持され、pdf.js の描画も即時に追従します。

## ウィンドウ最大化

- ヘッダーに「最大化」ボタンを追加し、キャンバス全体へ広げる／元の配置へ戻す操作をワンクリックで切り替えられます。
- 最大化中はヘッダーのドラッグとリサイズハンドルを無効化し、`workspace__window--maximized` クラスと `data-window-maximized` 属性で状態を反映します。
- `workspace:window-maximize-change` では `maximized` のほか、現在のジオメトリ (`left`/`top`/`width`/`height`) と復元用の `restoreLeft`/`restoreTop`/`restoreWidth`/`restoreHeight` を通知します。
- 最大化状態と復元先レイアウトは永続化対象であり、リロード後も同じ広がり方を維持します。複製したウィンドウは通常サイズで生成され、必要に応じて個別に最大化できます。

## ウィンドウフォーカス循環

- `]` / `[` のショートカットで、最近使った順にウィンドウを順送り・逆送りできます。
- フォーカス移動時には `workspace:window-focus-cycle` を発火し、移動方向・ウィンドウ ID・タイトル・総ウィンドウ数を通知します。
- 移動したウィンドウは `workspace__window--active` クラスを持ち、`data-last-focused-at` が更新されて永続化タイムスタンプと同期します。

## ズームフィット

- ズームパネルに「幅合わせ」「全体表示」ボタンを追加し、ワンクリックで閲覧中ページをウィンドウ幅または縦横いっぱいに収められます。
- 操作に応じて `workspace:window-zoom-change` の `detail.mode` が `fit-width` / `fit-page` を通知し、依頼元が現在のフィット種別を把握できます。
- 現在のフィット種別はウィンドウの `data-zoom-fit-mode` に反映され、算出倍率は `data-zoom-fit-width` / `data-zoom-fit-page` から参照できます。フィットを解除すると `mode` は自動的に `manual` へ戻ります。

## ページ履歴ナビゲーション

- ツールバーに「戻」「進」ボタンを追加し、最近開いたページへワンクリックで戻れるようにしました。矢印ボタンや数値入力と組み合わせて移動しても履歴が自動更新されます。
- 履歴は最大 50 件まで保持され、過去に戻った状態で新しいページへジャンプすると未来側の履歴を切り詰めて整合性を保ちます。
- 現在位置と履歴件数はウィンドウ要素の `data-page-history-index` と `data-page-history-length` から参照でき、永続化経由で復元されます。
- ページツールバーには最初と最後のページへジャンプできる ⏮ / ⏭ ボタンを追加し、履歴を保ちながら一気に端へ移動できます。

## ページスライダー

- ページ入力欄の隣にスライダーを配置し、総ページ数が判明している PDF ならドラッグだけで任意のページへ移動できます。
- スライダーの値はページ履歴や他のナビゲーション操作と双方向に同期し、`workspace:window-page-change` のイベント詳細にも反映されます。
- 総ページ数が不明または 1 ページのみの PDF はスライダーを自動的に無効化し、誤操作や無駄な UI ノイズを避けます。

## キーボードショートカット

| 操作 | ショートカット | 備考 |
| --- | --- | --- |
| 次のページ | `→` | フォーカス中のウィンドウに対して発火します。 |
| 前のページ | `←` | 入力フォームをフォーカスしている場合は無効化されます。 |
| 最後のページ | `End` | フォーカス中のウィンドウで総ページ数が判明しているときにジャンプします。 |
| 最初のページ | `Home` | フォーカス中のウィンドウでページ履歴を維持したまま 1 ページ目に戻ります。 |
| 現在のページをブックマーク | `b` | フォーカス中のウィンドウで現在ページを記憶します。入力欄をフォーカスしている場合は無視されます。 |
| 次のブックマークへ移動 | `.` | 現在ページより後ろに保存されたブックマークへ移動します。 |
| 前のブックマークへ移動 | `,` | 現在ページより前に保存されたブックマークへ移動します。 |
| ズームイン | `=` または `+` | 修飾キー付き（Ctrl/⌘ など）の操作はブラウザに委ねます。 |
| ズームアウト | `-` または `_` | ズーム下限 (`50%`) を下回らないよう制御されます。 |
| ズームリセット | `0` | デフォルト倍率 (`100%`) に戻します。 |
| 次のウィンドウ | `]` | 入力欄をフォーカスしていない場合に、最近使った順で次のウィンドウへ移動します。 |
| 前のウィンドウ | `[` | 入力欄をフォーカスしていない場合に、最近使った順で前のウィンドウへ戻ります。 |
