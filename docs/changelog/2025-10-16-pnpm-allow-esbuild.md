# 2025-10-16 — pnpm のビルドスクリプト許可

## Fixed
- `pnpm-workspace.yaml` に `allowedBuiltDependencies` を追加し、`esbuild` のビルドスクリプトを許可することでデプロイワークフローのビルド失敗を解消した。
