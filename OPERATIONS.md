# AIを使わない日次運用

公開先: https://longchanp7-hub.github.io/meat-fair-app/

既存の `.github/workflows/update-fairs.yml` を毎日04:17 JST頃に実行します。15ブランドの公式ページ取得、画像/メニュー/価格の既存解析、品質・回帰テスト、差分commit、Pages公開を通常のNodeスクリプトで行います。スケジュールを重複させず、寿司アプリと統合しません。Work/Codex、LLM、有料APIは定期処理に不要です。

- 対象ブランド/公式URL: `scripts/target-brands.mjs` / `scripts/source-registry.mjs`
- 確認済みの補助データ: `scripts/reviewed-campaigns*.json`（根拠、期限、変更検知条件を維持）
- 公開先と軽量検査: `operations.json` / `scripts/ops-health.mjs`
- リトライ: `scripts/retry-fetch.mjs`。有限回数。解析エラーは推測で修復しない。
- 定期時刻: `.github/workflows/update-fairs.yml` のschedule（UTC）

取得できないソースは状態を明示し、元の確認時刻と保存期限を守って最後の正常データを使用します。全取得失敗・品質検証失敗は公開前に停止します。期限を過ぎた情報を確認済みとして延命しません。未知の故障はActionsログで確認し、通常の修正作業を行います。

schedule実行で公開データ差分がない場合はdeployを省きます。確認時刻・鮮度状態の更新もデータ差分です。変更push/手動Run workflowは公開を実行します。標準Ubuntu runnerと短期artifactを使い、有料APIやlarger runnerに切り替えません。GitHubの条件: https://docs.github.com/en/billing/concepts/product-billing/github-actions

通常チャットで「肉アプリの○ブランドの収集/表示を△△に変更、出典と価格検証を維持し公開まで」と依頼できます。これは設定やコードを編集しやすくする運用であり、日次AI処理ではありません。AIを使った変更作業自体にはそのときの利用枠を使います。

ChatGPT上の旧日次監視については会話履歴しか確認できておらず、有効なスケジュールは未確認です。確認可能な正規ログイン状態で、関係するものだけを確認・停止してください。
