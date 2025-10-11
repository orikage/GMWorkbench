# 2025-10-11 — GitHub Pages デプロイパイプラインの整備

## Added
- `.github/workflows/deploy.yml` を追加し、`main` への push ごとに `pnpm test` と `pnpm build` を実行して GitHub Pages へ配信する自動デプロイを構築した。
- ワークフロー内で Pages アーティファクトをアップロードし、`deploy-pages` アクションで公開までを自動化した。

## Changed
- README に本番 URL とデプロイ手順を追記し、開発者が公開フローを確認しやすくした。

## Tests
- GitHub Actions 上で `pnpm test` を実行するステップを追加し、公開前にリグレッションを検知できるようにした。
