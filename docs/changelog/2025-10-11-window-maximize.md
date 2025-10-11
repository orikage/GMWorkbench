# 2025-10-11 — ウィンドウ最大化トグルの追加

## Added
- ウィンドウヘッダーに「最大化」ボタンを追加し、キャンバス全体へ広げる操作と元のレイアウトへ戻す操作をワンクリックで切り替えられるようにした。
- `workspace:window-maximize-change` を新設し、`maximized` と現在の配置 (`left`/`top`/`width`/`height`) に加えて復元用レイアウト (`restoreLeft`/`restoreTop`/`restoreWidth`/`restoreHeight`) を通知するようにした。
- 最大化状態と復元用レイアウトを永続化対象へ加え、複製では通常サイズのウィンドウを生成することでユーザーが任意に最大化できるようにした。

## Changed
- 最大化中はヘッダードラッグとリサイズハンドルを無効化し、`workspace__window--maximized` クラスと `data-window-maximized` 属性で状態を把握できるようスタイルと DOM を更新した。
- リサイズハンドルを `disabled` 状態で非表示にし、最大化時の視認性と誤操作防止を高めた。

## Testing
- `pnpm test`
