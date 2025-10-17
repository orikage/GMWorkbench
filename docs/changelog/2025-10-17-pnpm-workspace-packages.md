# 2025-10-17 — pnpm ワークスペース設定の明示

## Fixed
- `pnpm-workspace.yaml` に `packages` フィールドを追加し、CI で使用している pnpm v9 でもルートパッケージを正しく検出できるようにした
- Playwright を含む CI が `packages field missing or empty` エラーで停止していた問題を解消
