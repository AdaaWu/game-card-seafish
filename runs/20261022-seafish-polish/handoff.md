# handoff 20261022-seafish-polish

給下一個 session 的交接書。先讀 STATE.md、checklist.md、log.md 最後 20 行，再派 checklist-verifier 對磁碟重驗。

## 目前階段
- 所有實作完成，單元測試 333 案綠、typecheck 綠、E2E battle-auto-end 3/3、battle-sandbox 2/2、battle-mobile 2/2
- 已 push 21 個 commit（e75da6f..fde5f4b），Actions run 39666284981 成功，網址驗證 200、可進對戰

## 已完成
- 自動結束回合（hasNoActions + BattleScreen 1 秒延遲與提示），code-reviewer 有條件通過，後續三項已修
- GitHub Pages：repo 轉公開、Pages 來源 Actions、vite base 用 VITE_BASE、router hash 模式、.github/workflows/deploy.yml
- 手機 RWD：viewport-fit、dvh、Story 單欄、Deck 寬度、開場跳過鈕 Teleport、轉橫向返回鈕、pointercancel、mv 28；對戰直式維持「請轉橫向」提示（未做直式版面）
- 美術：docs/art/audit-20261022.md 盤點；三張委託單 docs/art/orders/；素材生成到 assets/pending/batch-20261022-card/，對照頁 docs/reviews/art-signoff-20261022.md
- 整合建議變體：卡背 a、框架 a 套、圖示 cost-b attack-a health-a、派系 leaf-a tide-a frost-b light-a neutral-a、背景 b；卡面新版面（插畫 72%、外框 2.4%、文字框 ≤22%、四角圖示）；卡圖重轉 1024
- 劇情立繪 64vh 無框、對話框不透明、直式只顯示說話者；翻面卡背；潮能水滴；場地柔邊；結算面板與按鈕對比

## 進行中
- 無；本輪全部完成

## 待人類決定（都寫在對照頁與 audit）
- 美術終審：docs/reviews/art-signoff-20261022.md 每組簽核欄為空，目前上線的是「建議變體」，變體仍在 assets/pending
- 色碼三邊不一致（art-style.md、ux.md、cardStyle.ts）
- 主字體粉圓授權未查證；數字字型二選一
- 對戰直式版面要不要做
- 無效果文字生物卡的空白文字框
- 全域 .btn 對比 2.2:1（App.vue）
- assets/_tests/redraw-v2/ 8.3MB 未追蹤，留或刪

## 下一步三項
① 確認 push 完成與 Actions 成功，網址能開、能進對戰、手機橫向能玩
② 使用者親眼看對照頁與 contact sheet，簽核或換變體；換變體只要替換 assets/ui、assets/backgrounds 的檔
③ 依 audit「程式端可改」剩餘 12 項排下一輪（字體 @font-face、卡名縮字已由 Codex 做、空狀態、切片缺圖 fallback）

## 已知風險
- Codex 可能同時在改 web/，提交前看 git status 的 mtime
- Pages 存檔是新 origin，會重播開場、只開第 1 關
- 手機首次進對戰 chunk 690KB 偏慢
- 切片或圖示載入失敗時該層空白，無 fallback

## 更新（本 session 收尾第二輪）
- audit 20 項程式端可改：可做的全部完成並 push（最新 5afe38d），audit 檔每項已標狀態
- 剩下只有需人類決定：粉圓字體授權、生物待機漂浮、色碼統一、開場影片畫風、Logo 放字、無效果文字卡、結算完整版、對戰直式版面、redraw-v2 去留
- 美術終審：docs/reviews/art-signoff-20261022.md 簽核欄待填
- 人眼確認兩處：腳下柔光是否夠明顯（crop-minion-compare.png）、牌庫空紅字對比 3.03:1
- 工作區有另一個 session 的未提交改動（新手教學、insertPreview、20261023 畫面背景委託單），提交前注意別用舊版蓋掉 5afe38d 之後的 BattleScreen.vue 與 Battlefield.ts

## 使用者決定（2026-10-22 末）與第二輪待辦
- 簽核：建議變體通過，對照頁簽核欄已填
- 要做：D01 到 D07，見 checklist.md 第二輪；不做：生物待機漂浮
- 建議順序：D01（小）→ D05、D07（文件）→ D03 → D06 → D04 → D02（最大）
- 每項走 TDD 兩棒與 code-reviewer 驗收；D02 與 D04 完成後要人眼看截圖
- 工作區仍有另一個 session 的未提交改動（新手教學、insertPreview、20261023 畫面背景），接手時先處理它們的提交
