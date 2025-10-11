完璧。以下は **更新版 `agents.md`**。
先ほどの開発行動規範に加え、**定期的な振り返り・感想共有・改善文化のルール**を正式に組み込んだ完全版。
これをそのままリポジトリ直下に配置すれば、チーム全員が「どう開発し、どう省察するか」を自動的に共有できる。

---

# agents.md — GMWorkbench

## 🧭 Mission

GMWorkbench は、TRPG GM が**思考の流れを止めずにプレイを進められる環境**をつくる。
目的は**「PDFシナリオの物理的制約を超える」**ことで、GMの創造的判断を支援する。
我々は、技術ではなく**体験**を開発する。

---

## 💡 Development Philosophy

1. **Simple is sacred.**
   余分な抽象を避け、理解可能な規模で保つ。

2. **Local first.**
   すべての処理をブラウザ内で完結させる。ネットワーク依存を持たない。

3. **Design for flow.**
   GM のテンポを乱さない。UI・コードいずれも“流れ”を最優先。

4. **Readable over clever.**
   賢いより、読みやすい。誰が読んでも意味が明確であること。

5. **Reproducibility.**
   Git が唯一の信頼できる履歴。環境構築なしで誰でも再現可能にする。

---

## 🧱 Repository Rules

### 1. Git Discipline

* **1 機能 = 1 ブランチ** (`feature/<topic>` 形式)。
* **コミット粒度**は 10〜50行単位で論理的に独立させる。
* **コミットメッセージ**は動詞始まりの短文で統一。
  例：`feat: add always-on-top toggle for window`
* main ブランチは常にデプロイ可能状態を維持。
* **Squash merge 推奨**。

### 2. Pull Request Culture

* 問題や気づきがあれば**即プルリクを作る**。
  「完璧な修正」でなくても構わない。
  目的は**課題の可視化と議論の起点**を増やすこと。
* 気になる挙動・コードの違和感・設計の迷いは「Draft PR」で共有する。
* **PRコメントより issue に残らない洞察**を優先。知見を閉じない。

### 3. Documentation

* **ドキュメントもコードと同じく Git で管理。**
* 更新内容を `/docs/CHANGELOG.md` に即記載。
* 思考や決定の理由を `/docs/DECISIONS.md` に残す。

---

## 🧪 Testing & QA

* **TDD** を基本とする。

  * failing test → 実装 → pass → リファクタリング。
* ユーティリティ／描画／保存処理は単体テスト。
* E2E（Playwright）で主要操作（開く→動かす→復元）を自動確認。
* CI（GitHub Actions）でテスト・lint を必ず通す。
* main への merge 条件：**lint + test + manual check** が全通過。

---

## ⚙️ Development Environment

| 項目        | 推奨                                     |
| --------- | -------------------------------------- |
| Node.js   | LTS（20+）                               |
| Manager   | pnpm                                   |
| Build     | Vite                                   |
| Linter    | ESLint + Prettier                      |
| Formatter | husky + lint-staged                    |
| Test      | Vitest or Jest                         |
| Target    | Chromium 最新 / Firefox ESR / Safari 16+ |

---

## 🧩 Coding Style

* Vanilla JS 基準。依存は最小限。
* 関数は**副作用を局所化**。
* 変数: camelCase / 定数: UPPER_SNAKE / ファイル名: kebab-case。
* コメントは「Why」を説明、「What」はコードで伝える。
* UI は **1ファイル＝1責務**。DOM構造を隠さない。

---

## 🧰 Tooling Guidelines

* GitHub Actions による自動テスト・デプロイ。
* Issue Templates：`bug`, `feature`, `refactor`, `docs`, `feedback`。
* Label：

  * 優先度: `P0` 緊急 / `P1` 高 / `P2` 通常
  * 分野: `ui`, `pdf`, `storage`, `infra`, `meta`

---

## 🧭 Design Governance

* 新機能は常に以下を問う：

  > “この変更はGMの思考を止めないか？”
* UIは物理デスクの比喩を維持。
* 複雑な機能を追加するよりも、1クリック減らす改善を優先。

---

## 🔁 Retrospective & Reflection（振り返り制度）

### 1. 開発サイクル

* **コミット事に1度**、`/reviews/YYYY-MM-DD-commitNumber.md` を作成し、全員が記入する。
* 記入内容：

  * 今の開発体験で**良かった点**
  * **不満・不足・懸念点**
  * 次スプリントで改善すべきこと（具体的行動）
  * 個人的な学び・感想

### 2. 書き方例

```markdown
## 2025-10-31 Review (by codex)
- 👍 良かった: ウィンドウ管理の安定化。コード構造が単純化した。
- 👎 不満: IndexedDB の削除がわかりづらい。
- 💡 提案: キャッシュ削除後にトーストを出す。
- 🪞 感想: UXを触って感じたが「閉じる前に確認」欲しいかも。
```

### 3. 改善活動

* 各レビュー後に**改善PRまたはIssueを最低1件立てる**。
* 不満・提案は口頭で終わらせず、**形としてリポジトリに残す**。
* 小さな改善も歓迎。**批判より提案**。

---

## 💬 Communication Rules

* “気になる”はすぐ書く。**沈黙よりDraft PR。**
* 指摘は人格でなく行動・コードに向ける。
* 良い提案・良い設計は積極的に賞賛する。
* ミスは責めず、**再現性と修正パスを共有**する。

---

## 📦 Release Workflow

1. `feature/*` → PR → review → squash merge → `main`
2. GitHub Actions により自動デプロイ（`gh-pages` branch）
3. バージョンタグ追加 → `CHANGELOG.md` 更新
4. 必要に応じて `/reviews` のフィードバック反映

---

## 🔒 Security & Privacy

* すべてのPDF処理はローカルで完結。
* IndexedDB, localStorage のみを使用。
* HTTPS 強制（GitHub Pages 設定で enforce）。
* 外部通信を一切行わないことを定期的に検証。

---

## 🧭 Core Principles Summary

| 原則                     | 内容                     |
| ---------------------- | ---------------------- |
| **Local-Only**         | ブラウザ内で完結。サーバ通信なし       |
| **Git-First**          | すべてをGit管理。再現可能性の確保     |
| **TDD**                | 仕様を先に定義し、テストで保証する      |
| **Flow over Features** | 新機能よりも操作の流れを優先         |
| **Reflect Often**      | 定期的に立ち止まり、感じた違和感を言語化する |

---

## ✅ Commit Example

```bash
git checkout -b feature/window-pinning
# 実装・テスト作成
git add .
git commit -m "feat: implement always-on-top toggle for window"
git push origin feature/window-pinning
# PR 作成
```

---

### ✍️ Reflection Reminder

> プロジェクトはコードだけでなく「気づき」で進化する。
> 不満・疑問・違和感を放置せず、**すぐにIssueやPRに変換**する。
> それが GMWorkbench の持続的改善の基盤になる。

---

この `agents.md` は、

* **codex の行動規範**
* **チームの自己改善の仕組み**
* **開発文化の再現性保証**
  を兼ねた「運営憲章」。
  この文書はコードと同等に Git 管理し、**定期的に読み返して更新すること**。
