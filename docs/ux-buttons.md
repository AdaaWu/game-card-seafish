# 按鈕設計系統

- 版本：2026-10-23 定案
- 適用：全遊戲所有按鈕，含主選單項目、對戰「結束回合」、設定、結算、彈窗
- 素材：`assets/pending/batch-20261023-ui/buttons/`（委託單 `docs/art/orders/20261023-ui-kit.md` A 組）
- 預覽：`assets/pending/batch-20261023-ui/_preview/after-buttons-<a|b>-1440x900.png`

## 1. 結論

**主色取「結束回合」實際色 `#7A64B0`，視覺走「水彩紙紋底＋紫灰細描邊＋白色 die-cut 邊」，用九宮格切片做，CSS 只負責字、狀態與焦點**

- 實際色碼來源
  - `web/src/components/battle/BattleScreen.vue` `.end-turn`：`background: #7a64b0`，下緣 `box-shadow: 0 5px 0 #5e4c94`
  - `web/src/App.vue` 全域 `.btn` 目前也是 `#7a64b0`，與結束回合一致
- 三個視覺方向的取捨
  - 水彩紙紋底（選用）：與卡框 a 套、四角圖示同一套筆觸，辨識度最高；需要切片，純 CSS 做不出紙紋
  - 紫灰細描邊：純 CSS 可做，但沒有紙紋，跟角色插畫放一起仍像系統 UI
  - 柔和內高光：純 CSS 可做，但容易變成塑膠亮面，與 art-style.md 禁止的「金屬反光、3D 感」太近
- 決定：底圖用切片（紙紋、白邊、描邊、下緣厚度都在圖裡），內高光與光暈用 CSS 疊

## 2. 層級

- **主要 primary**：一個畫面最多一顆。開始、繼續、完成、結束回合
  - 切片 `btn-primary-<變體>`，白字
- **次要 secondary**：取消、返回、回地圖、分段選擇未選中
  - 切片 `btn-secondary-<變體>`，深字 `#3E3550`
- **文字按鈕 text**：低優先操作。重看開場、跳過、查看規則
  - 無底圖，`#7A64B0` 字加 2px 底線
- **危險 danger**：不可逆操作。放棄對戰、重置存檔
  - 切片 `btn-danger-<變體>`，白字；一律搭配確認對話框
- **圖示按鈕 icon**：齒輪、關閉、返回箭頭
  - 切片 `btn-icon-<變體>`，圖示 `#7A64B0`，必須有 `aria-label`
- **主選單項目 menu-item**：主選單大按鈕，屬於次要層級的放大版
  - 切片 `menu-item-<變體>`，鎖定狀態用 `-disabled` 加鎖頭圖示與說明文字

## 3. 尺寸

**觸控目標一律至少 44 x 44；手機橫向（高度 500 以下）的主要按鈕至少 88 x 48**

- 大 lg：高 64、字 24、左右內距 36、最小寬 160；用於結算、設定「完成」、結束回合
- 中 md：高 56、字 20、左右內距 30、最小寬 132；彈窗、一般操作
- 小 sm：高 44、字 17、左右內距 24、最小寬 88；返回、分段、表單內
- 圖示：桌機 56 x 56，手機 48 x 48，圖示本體 46%
- 主選單項目：高 `clamp(56px, 9.6vh, 88px)`，寬 `min(500px, 50vw)`
- 手機橫向規則
  - `@media (max-height: 500px)`：lg 降為 md，md 降為 sm，但主要按鈕不低於 88 x 48
  - 結束回合沿用 `battleLayout.ts` 的 `endW`、`endH` 計算，下限改為 96 x 48（CSS 像素）

## 4. Design token

```css
:root {
  /* 主色階（結束回合紫） */
  --btn-primary-100: #EDE6F7;  /* 文字按鈕 hover 底 */
  --btn-primary-300: #B9A6DB;  /* 光暈、描邊點綴，不可放白字 */
  --btn-primary-500: #7A64B0;  /* 主色，白字 4.91:1 */
  --btn-primary-600: #6A549F;  /* hover 參考色，白字 6.21:1 */
  --btn-primary-700: #5E4C94;  /* 下緣厚度、按下、焦點環，白字 7.15:1 */
  /* 次要與危險 */
  --btn-cream: #FFFDF7;        /* 次要底，深字 11.28:1 */
  --btn-cream-lip: #E2D8C8;
  --btn-danger-500: #B04A6A;   /* 白字 5.21:1 */
  --btn-danger-700: #8A3852;   /* 白字 7.59:1 */
  /* 停用 */
  --btn-disabled-bg: #E4DFEA;
  --btn-disabled-ink: #5F566E; /* 5.27:1 */
  /* 文字 */
  --btn-ink: #3E3550;
  --btn-ink-on-primary: #FFFFFF;
  /* 形狀 */
  --btn-radius: 999px;
  --btn-radius-menu: 30%;      /* 以高度計，由切片決定 */
  --btn-outline: #6E5F80;      /* 切片內描邊色，CSS 不另外畫 */
  --btn-lip: 4px;              /* 下緣厚度（切片內含） */
  --btn-press-shift: 2px;      /* 按下下沉，上限 2px */
  /* 陰影與光暈 */
  --btn-shadow: 0 8px 24px rgba(62, 53, 80, 0.14);
  --btn-glow: 0 0 10px rgba(185, 166, 219, 0.9);
  --btn-focus-ring: 0 0 0 3px #5E4C94, 0 0 0 7px rgba(246, 227, 161, 0.95);
  /* 字 */
  --btn-font: var(--font-ui);
  --btn-weight: 800;
  --btn-fs-lg: 24px;
  --btn-fs-md: 20px;
  --btn-fs-sm: 17px;
  --btn-tracking: 0.06em;
  /* 尺寸 */
  --btn-h-lg: 64px;
  --btn-h-md: 56px;
  --btn-h-sm: 44px;
  --btn-pad-lg: 36px;
  --btn-pad-md: 30px;
  --btn-pad-sm: 24px;
}
```

- 九宮格寫法（1x 安全區見委託單）
  - 一般按鈕：`border-image: url(btn-primary-a@2x.webp) 0 64 0 64 fill / 0 calc(var(--h) / 2) stretch`
  - 主選單：`border-image: url(menu-item-a@2x.webp) 0 96 0 176 fill / 0 44px 0 80px stretch`
- 白字一律加 `text-shadow: 0 1px 2px rgba(62, 53, 80, 0.45)`；深字不加

## 5. 狀態

**狀態只改顏色、亮度、光暈；按下可下沉 2px；嚴禁上下漂浮、呼吸縮放、搖擺、hover 放大**

- 一般 normal：切片原圖
- hover：換 `-hover` 切片（亮度 +7%），外加 `filter: drop-shadow(var(--btn-glow))`，`transition: filter 120ms`
  - 主要按鈕例外：`-hover` 切片最亮處白字只有 4.38:1，改為不換切片，維持一般切片
  - 主要按鈕 hover 修正值：`filter: drop-shadow(var(--btn-glow)) brightness(1.03)`
  - 實測（1440 x 900、2 倍像素，字底區逐像素）：白字最低 4.66:1、中位數 4.93:1；一般狀態最低 4.83:1
  - 危險按鈕同主要按鈕：`-hover` 切片白字只有 4.33:1，不換切片，套用相同的 brightness 修正值
- 按下 active：換 `-pressed` 切片（亮度 -8%、已下沉 2px），文字同步 `translateY(2px)`
- 停用 disabled：換 `-disabled` 切片，字色 `--btn-disabled-ink`，`cursor: not-allowed`，不接 hover
  - 鎖定項目（主選單）同停用，但保留 `aria-disabled` 讓點擊播錯誤音效
- 載入中 loading：維持一般切片，文字前加 0.9em 圓形 spinner；寬度鎖定為進入 loading 前的寬度，`aria-busy="true"`，期間不接受點擊
  - spinner 是旋轉，不是漂浮，屬允許範圍；`prefers-reduced-motion` 時改成三點透明度輪播
- 聚焦 focus-visible：`box-shadow: var(--btn-focus-ring)`，圓角跟隨按鈕；只在 `:focus-visible` 出現，滑鼠點擊不顯示
- 結束回合的「已無可出牌」提示 `.done`：維持現行鵝黃底，但 `glow` 動畫只能變光暈透明度，不能縮放

## 6. 對比修正

**所有文字對比至少 4.5:1，以下是要改的值**

- 全域 `.btn`（handoff 記錄為 2.2:1，即白字配 `#B9A6DB`）
  - 修正值：底色 `#7A64B0`，白字 4.91:1；hover `#6A549F` 6.21:1；下緣 `#5E4C94`
  - 2026-10-23 讀到的 `App.vue` 已是 `#7a64b0`，仍需在實作時確認沒有其他頁面覆寫回 `--c-lavender`
- 收藏分頁 `.tabs button.on`（`DeckView.vue:198-201`）：白字配 `#8D74C2` 只有 3.88:1
  - 修正值：改用 `--btn-primary-500` `#7A64B0`
- 主選單鎖定字 `#8F879A` 配 `#ECE8F0` 只有 2.85:1（`MenuView.vue` `.item.locked .label`）
  - 修正值：`--btn-disabled-ink` `#5F566E`，5.71:1
- 停用按鈕現行 `var(--c-disabled)` 加 `opacity: 0.6`，白字約 2.8:1
  - 修正值：底 `#E4DFEA`、字 `#5F566E`，5.27:1，不再用 opacity 壓整顆
- 文字按鈕 `#7A64B0` 配奶白 `#FBF6EC`：4.56:1，及格但緊；放在背景圖上時一律墊 `rgba(255, 253, 247, 0.85)` 圓角底

## 7. 程式端接法

**做成共用元件 `GameButton.vue` 加 CSS 變數，現有 `.btn` 先保留當過渡，逐檔替換**

- 元件介面
  - `variant`: `'primary' | 'secondary' | 'text' | 'danger' | 'icon' | 'menu'`
  - `size`: `'lg' | 'md' | 'sm'`
  - `loading`、`disabled`、`locked` 布林
  - 預設插槽放文字；`icon` 變體用 `aria-label`
- 樣式
  - token 放 `App.vue` `:root`（或新檔 `web/src/styles/buttons.css` 由 `main.ts` 引入）
  - 切片路徑透過 `uiImageUrl('buttons/btn-primary-a', true)` 取得，與卡框同一套載入方式
- 要替換的檔案
  - `web/src/App.vue`：全域 `.btn`、`.btn.ghost`、`.btn:disabled`、`.gear`（hover 旋轉改光暈）
  - `web/src/views/MenuView.vue`：`.item` 改 `variant="menu"`，hover `scale(1.04)` 移除
  - `web/src/views/StoryView.vue`：返回、重看開場、彈窗取消與開始
  - `web/src/views/DeckView.vue`：返回、分頁、縮放視窗關閉
  - `web/src/views/BattleView.vue`：返回、回到章節地圖
  - `web/src/components/battle/BattleScreen.vue`：`.end-turn`（保留絕對定位與字級計算，外觀改用 token 與切片）、目標選擇按鈕
  - `web/src/components/battle/BattleResult.vue`：重新挑戰、回地圖、繼續
  - `web/src/components/battle/TutorialOverlay.vue`：下一步、跳過
  - `web/src/components/DialogueOverlay.vue`：返回、快轉、記錄
  - `web/src/components/OpeningVideo.vue`：跳過
  - `web/src/components/SettingsDialog.vue`：完成、速度分段
  - `web/src/components/battle/OpponentPicker.vue`：對手卡片外層（`variant="menu"` 的直式版另議）
- 測試：元件單元測試覆蓋六種狀態的 class 與 `aria-*`；E2E 現有 `data-testid` 必須保留在 `GameButton` 根元素
