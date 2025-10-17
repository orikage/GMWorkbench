# 2025-10-17: pnpm ワークスペース設定に `packages` を定義する

## 背景
- GitHub Actions で pnpm v9 系を使用しており、`pnpm install --frozen-lockfile` 実行時に `packages field missing or empty` エラーで停止していた
- ルートに `pnpm-workspace.yaml` は存在するが、`allowedBuiltDependencies` のみを定義しており `packages` のパターンが欠落していた

## 決定
- `pnpm-workspace.yaml` に `packages: ['.']` を明示してルートパッケージをワークスペースに含める

## 影響
- pnpm v9 でもワークスペースが正しく認識され、CI の依存インストールが継続できる
- 既存の `allowedBuiltDependencies` 設定は維持される

## 選択肢と理由
- `pnpm/action-setup` で pnpm v10 を使用する案: CI とローカルのバージョン差異が大きくなり、将来の依存性に影響するため採用しなかった
- `pnpm install` を `--config.use-beta` 等で抑制する案: 追加のフラグ管理が煩雑で根本原因を解消しないため不採用
