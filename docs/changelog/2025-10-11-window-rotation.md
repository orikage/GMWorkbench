# 2025-10-11 — ウィンドウ回転コントロールの追加

## Added
- ウィンドウツールバーに回転パネルを追加し、↺/↻ ボタンで 90° 単位の回転と 0° リセット操作を提供した。
- ビューアとウィンドウ要素に `data-rotation` 属性を付与し、`workspace:window-rotation-change` で `rotation`・`page`・`zoom` を通知するようにした。
- 回転状態を永続化・複製・復元へ伝搬するため、ストレージスキーマと複製イベントの詳細を拡張した。

## Changed
- ズーム UI を調整し、回転パネルと並列に配置できるよう調整した。
- `workspace:window-page-change` と `workspace:window-zoom-change` のイベント詳細へ現在の回転角を含めるよう更新した。

## Testing
- `pnpm test`
