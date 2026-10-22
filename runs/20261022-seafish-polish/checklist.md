# checklist 20261022-seafish-polish

使用者目標：自動結束回合、美術細節完整、RWD 手機版、GitHub Pages 網址；全部完成再一次回報

- [x] C01 seafish 既有變更分批 commit 並 push（13 commits，197c88f..e75da6f）
- [x] C02 自動結束回合：qa-lead 紅燈（tests/engine/auto-end、tests/stores/battle-auto-end、e2e/battle-auto-end）
- [x] C03 綠燈完成，驗收中： 自動結束回合：gameplay-engineer 綠燈 + code-reviewer 驗收
- [x] C04 美術委託單：卡背、卡面框架（主圖放大、窄邊距、四角圖示）、對戰背景 → docs/art/orders/
- [x] C05 RWD 與部署調查（Explore）
- [x] C06 RWD 手機版實作（先測試版面純函式，再截圖人眼驗收）
- [x] C07 GitHub Pages 部署：vite base、router、素材路徑、workflow、啟用 Pages、驗證網址
- [x] C08 美術總監盤點五個畫面，出 docs/art/audit-20261022.md
- [x] C09 程式端美術調整（渲染品質、CSS 細節）附改前改後截圖
- [x] C10 全部 commit push（依關注點拆分）
- [x] C11 總回報：網址、截圖、需人類簽核清單、需求外項目

狀態值：todo / doing / done / blocked / partial

## 第二輪（使用者 2026-10-22 決定，待新 session 執行）
- [x] D01 腳下柔光加強一級、牌庫空紅字改成對比達 4.5:1 的色（producer 建議，使用者同意先列）
- [x] D02 對戰直式版面：battleLayout 加寬度 <600 的直式分支，另設直式邏輯寬度約 720，重排英雄、戰場 6 格、手牌；three.js 鏡頭與拖曳判定同步；補 390x844 測試與 E2E
- [x] D03 無效果文字生物卡縮小文字框，插畫露更多；cardStyle 的 cardFaceLayout 加「無文字」分支並補測試
- [x] D04 結算畫面做到 docs/ux.md 完整版：角色圖、翻牌獎勵、總傷害
- [x] D05 色碼統一：以 web/src/content/cardStyle.ts 為準，改 docs/art-style.md 與 docs/ux.md 的潮、霜、葉、中立色碼
- [x] D06 主字體接 jf open 粉圓：先查證授權為 OFL 1.1 並記錄來源，再加 @font-face 與字體檔，數字字型在 M PLUS Rounded 1c 與 Baloo 2 擇一
- [x] D07 Logo 允許放字：docs/art-style.md 的禁文字規則改為只限卡圖
- [x] D08 刪除 assets/_tests/redraw-v2（已於本 session 執行）
- [x] D09 美術終審：對照頁簽核欄已填，建議變體正式採用，pending 變體保留
