# 美術素材委託單 bg-battle

- 一張委託單一種資產，流程見 `game-workflow/standards/placeholder-assets.md` 的「外部 AI 工具產出正式素材的流程」
- 日期：2026-10-22
- 填寫：art-director
- 批次：`batch-20261022-card`（與 `20261022-card-back.md`、`20261022-card-front-frame.md` 同批）

## 現況

**對戰背景目前沒有圖片，是 three.js 場景背景上的 4 x 256 程式漸層，外層 DOM 再墊一層同色 CSS 漸層**

- three.js：`backgroundTexture()` 畫一條直向漸層 `#E4F4F1`、`#C6E4EE`、`#B3D2E8`、`#C8C1E6`，指定給 `scene.background`（`web/src/render/battle/Battlefield.ts:101-117`、`:177-179`）
- DOM：對戰畫面容器同一組漸層（`web/src/components/battle/BattleScreen.vue:887`），WebGL 載入前或比例外留白時看得到
- 背景之上由程式疊加：柔和光斑 5 顆（`Battlefield.ts:189-200`）、氣泡粒子 30 顆（`:202-215`）、白色分隔線（`:217-223`）、雙方場地 12% 白底（`:225-232`）
- 版面基準 1920 x 1080（`web/src/render/battle/battleLayout.ts:61-62`），戰場寬 1160（約 60%），兩排生物在中線上下 140，戰場半高 250，約佔畫面中央 46% 高度（`battleLayout.ts:65-67`）

## 資產規格

- 資產名：`bg-battle`
- 用途與出現畫面：對戰畫面全螢幕背景，敵我英雄面板、手牌、場上生物、氣泡粒子都疊在上面
- 題材：依 `docs/story.md`「世界觀」，舞台是「暖光礁」，靠陽光與洋流維持生機的珊瑚礁城市
  - 陽光從海面灑下的淺海珊瑚礁，柔和光束
  - 邊緣可有珊瑚、海草、貝殼、礁石，四陣營意象平均點綴（葉的海草、潮的水流、霜的冷色礁石、光的光點），不偏任一陣營
  - 第一期只做一張通用背景；三章各自的背景（洋流、深谷、星光祭）不在本單範圍
- 目標顯示尺寸：全螢幕，桌機橫式與手機直式各一張
- 解析度：橫式 1920 x 1080 px、直式 1080 x 1920 px，為最終尺寸，不提供 2x
  - 不另做 2048 x 1024：專案 three 版本為 0.186.1（`web/package.json:20`），WebGL2 支援非 2 次方貼圖與 mipmap，1920 x 1080 可直接當貼圖
- 長寬比：16:9 與 9:16 各一張
- 格式：WebP 主檔（品質 85、不需 alpha），PNG 備份；單張 2MB 以內

## 風格

- 風格關鍵字：與現有角色圖一致，抽查 3 張的共同特徵如下
  - 抽查樣本：`assets/portraits/xiaoye.webp`（葉羊小葉）、`assets/cards/tide-003.webp`（潮的浪花海兔）、`assets/cards/frost-001.webp`（霜的冰晶海星）
  - 線條：細、柔、帶紫灰或同色系的淡描邊，沒有黑線，邊緣略帶手繪抖動
  - 上色：透明水彩薄塗打底，表面疊色鉛筆斜向細紋與紙張顆粒，暗部用疊色而不是加黑
  - 飽和度：低飽和馬卡龍色，最亮處接近奶白，沒有任何高飽和色塊
  - 光源方向：左上方柔和頂光，左上亮、右下暗，暗部偏薰衣草紫
  - 色溫：整體偏冷的中性，亮部偏暖奶白、暗部偏冷紫，冷暖對比溫和
  - 背景不加白色 die-cut 貼紙邊（貼紙邊只屬於角色與圖示）
- 色盤限制：引用 `docs/art-style.md` 第 2 節
  - 系列共用：輪廓紫灰 `#6E5F80`、奶白 `#F8F4EC`、薰衣草紫 `#9B7FC0`
  - 陣營點綴：葉 `#9CC48A`、`#D6E8A8`；潮 `#9CCBE6`、`#9EDBD2`、`#F2FAFB`；霜 `#EEF3FA`、`#B8C2E8`、`#CFE6F5`；光 `#F6DE8D`、`#F5C9A0`；中立 `#F7F1E6`、`#E8DCC8`、`#CFC4D9`
  - 主調延續現行背景漸層：上 `#E4F4F1`、中 `#C6E4EE`、`#B3D2E8`、下 `#C8C1E6`，換成水彩質感版本
- 構圖要求
  - 中央區域（橫式約 x 20% 到 80%、y 25% 到 75%；直式約 x 10% 到 90%、y 28% 到 72%）低對比、低細節，只留水彩暈染與極淡光束，讓卡面與數字可讀
  - 上下各留 12%（橫式 130 px、直式 230 px）給敵我英雄面板與手牌，低細節
  - 細節與珊瑚、海草集中在左右邊緣與四角
  - 中央不畫大型氣泡，程式已有氣泡粒子
  - 橫式與直式構圖各自完整，不是單純裁切
  - 上方稍亮（海面光）、下方稍深，與現行漸層方向一致

## 禁止事項

- 不含文字、數字、字母、Logo、簽名、浮水印
- 不含品牌、商標、既有 IP
- 不含真人、人類手指與臉
- 不含角色、生物主體與五官（避免與場上生物混淆）
- 不用純黑描邊、cel-shading 硬陰影、金屬反光、霓虹高飽和、寫實照片感、3D render 感
- 不含地平線式的硬分界、不含強烈明暗對比的光束

## 委託

- 委託對象：Codex 內建圖像生成
  - 提示詞格式沿用 `tools/gen-art.mjs:103-111` 的組法：開頭指令句、風格前綴、Subject、陣營色句、規格後綴，附 `role1.png`、`role2.png` 參考圖
  - 原因：背景要與角色圖同一套水彩色鉛筆筆觸，程序化難以一致
  - 提示詞全文見下方「給 Codex 的指令」
- 變體數量：每個方向 3 張，檔名 `bg-battle-landscape-a.webp` 到 `bg-battle-landscape-c.webp`、`bg-battle-portrait-a.webp` 到 `bg-battle-portrait-c.webp`
- 產出路徑：`assets/pending/batch-20261022-card/battle-bg/`，簽核後搬到正式路徑（由程式端決定）

## 授權確認

- [ ] 委託對象的服務條款允許商用
- [ ] 提示詞不含在世創作者名字或既有 IP 名稱
- [ ] 工具名、版本、提示詞全文、生成日期已準備登錄 `docs/asset-inventory.md`

## 驗收標準

- [ ] 橫式 1920 x 1080 px、直式 1080 x 1920 px，WebP 與 PNG 齊全，單張 2MB 以內
- [ ] 命名符合 `asset-naming.md`
- [ ] 中央區域亮度標準差低於全圖的一半（附檢查數據）
- [ ] 上下各 12% 低細節
- [ ] 與 3 張抽查角色圖並排，線條、上色、飽和度、光源、色溫一致（對照頁並排）
- [ ] 不含文字、品牌、真人、角色
- [ ] 兩個方向各 3 個變體齊全
- [ ] 疊上卡面與數字的模擬圖中，文字對比至少 4.5:1
- [ ] 程式端接上後，實機截圖在桌機與手機都可讀（此項在程式端配合完成後才驗）

## 程式端配合

**本單不改程式，以下列給工程端評估**

- 接入形式：平面貼圖，沿用 `scene.background`，不用天空盒
  - 鏡頭是固定正面的透視相機（`Battlefield.ts:121`），天空盒沒有視差效益
  - `Battlefield.ts:101-117` 的 `backgroundTexture()` 改為載入 `bg-battle-<方向>` 圖，`colorSpace` 維持 sRGB
  - `scene.background` 的貼圖會拉伸填滿畫布，需依畫布比例設定 `texture.repeat` 與 `texture.offset` 做 cover 裁切，在 resize 時重算
  - 依畫布寬高比切換 landscape 與 portrait 兩張
- DOM 層：`BattleScreen.vue:887` 的 CSS 漸層保留為載入前的底色，可加同一張圖當 `background-image` 避免 WebGL 載入前閃色
- 光斑與氣泡粒子可保留，簽核時一併看疊加效果；若畫面過滿，再由工程端評估調低 `opacity`
- `web/src/content/assetUrls.ts:2-5` 的 glob 需加入背景圖所在目錄
- 背景圖約 1920 x 1080 RGBA 貼圖，GPU 記憶體約 8MB，低於卡面貼圖總量，可接受

## 人類簽核

**AI 不得自行判定通過，art-director 只填初審**

- art-director 初審：<通過／退回加原因>，<YYYY-MM-DD>
- 人類終審：<通過／退回加原因>
- 選用變體：<landscape 變體、portrait 變體>
- 簽核人：<人類姓名或職稱>
- 簽核日期：<YYYY-MM-DD>
- 對照頁：`docs/reviews/art-signoff-20261022.md`

## 給 Codex 的指令

```
任務：為 Seafish 卡牌遊戲產生對戰畫面背景 bg-battle，橫式與直式各 3 個變體。專案根目錄 /Users/sunnywu/Documents/game-card-seafish

先讀
- docs/art/orders/20261022-battle-background.md（本委託單，構圖與色碼以它為準）
- docs/art-style.md 第 1、2 節
- docs/story.md「世界觀」段
- 參考圖：role1.png、role2.png、assets/portraits/xiaoye.webp、assets/cards/tide-003.webp、assets/cards/frost-001.webp

1. 用你內建的圖像生成工具，一次產一張，共 6 張，依下列提示詞組字（沿用 tools/gen-art.mjs 的結構），附 role1.png、role2.png 當參考圖
   開頭：Use your built-in image generation tool to create exactly ONE image. Do not run shell commands and do not edit files.
   風格前綴：A full-bleed background illustration in the exact painting style of the attached reference sticker sheets: hand-painted transparent watercolor washes with colored-pencil hatching and paper grain, thin soft purple-grey outlines #6E5F80 (no black lines), gentle soft light from the upper left with lavender-tinted shadows, muted low-saturation pastel macaron palette, cool-neutral overall color temperature with warm cream highlights.
   Subject：A calm shallow-water coral reef town called the Warm Light Reef, sunlight filtering down from the sea surface in very soft light rays. Rounded pastel corals, swaying seagrass, small shells and smooth reef rocks gathered along the left and right edges and corners. Gentle hints of the four factions spread evenly: leafy seagrass in #9CC48A, flowing water ribbons in #9CCBE6 and #9EDBD2, pale cool rocks in #B8C2E8, tiny warm light specks in #F6DE8D.
   色調句：Overall gradient from #E4F4F1 at the top through #C6E4EE and #B3D2E8 to #C8C1E6 at the bottom, cream #F8F4EC highlights.
   構圖句（橫式）：Composition: wide 16:9 landscape. The central area (from 20% to 80% horizontally, 25% to 75% vertically) must be very low contrast and low detail, only soft watercolor wash, because game cards will be placed on top. Keep the top 12% and bottom 12% low detail as well. Put all richer details at the left and right edges.
   構圖句（直式）：Composition: tall 9:16 portrait. The central area (from 10% to 90% horizontally, 28% to 72% vertically) must be very low contrast and low detail, only soft watercolor wash. Keep the top 12% and bottom 12% low detail as well. Put richer details at the edges and corners.
   規格後綴：No sticker border, no die-cut outline. Do NOT include: text, letters, numbers, logos, watermark, characters, creatures, faces, eyes, mouths, people, horizon line, large bubbles in the center, metallic shine, 3D render look, neon colors.
   變體句：a 光束較明顯、b 珊瑚較多較暖、c 水流與海草較多較冷，以英文一句話加在規格後綴前
   - 以工具能給的最大橫式或直式尺寸生成
2. 後處理（Python 3 加 Pillow）
   - 依方向 cover 裁切到 16:9 或 9:16，LANCZOS 縮放到 1920 x 1080 或 1080 x 1920
   - 輸出 bg-battle-landscape-<變體>.png、.webp 與 bg-battle-portrait-<變體>.png、.webp，WebP 品質 85、method 6
   - 單張超過 2MB 時降低 WebP 品質到 80 再試
3. 新增 tools/art/check-battle-bg.py，對每張印出
   - 尺寸、檔案大小
   - 全圖與中央區域、上下 12% 區域的亮度標準差
   - 合成一張模擬圖：在戰場位置疊 6 張灰色卡片方塊與 #3E3550 數字樣本，存到 _preview/
4. 製作並排圖：每個變體與 3 張參考角色圖並排，存到 _preview/
5. 全部輸出到 assets/pending/batch-20261022-card/battle-bg/，提示詞全文逐張記錄在同目錄 prompts.md
6. 整理 docs/reviews/art-signoff-20261022.md 的「battle-bg」段落（檔案已存在就只新增段落，不改其他段落）
   - 6 張背景、模擬圖、並排圖連結
   - 檢查數據
   - 對應 art-style.md 與委託單的條目
   - 來源：圖像生成工具名與版本、提示詞、生成日期
   - 每張留空白的「人類終審：通過／退回加原因」欄位

限制
- 不改 web/ 底下任何程式、不改 tools/gen-art.mjs
- 不把圖放進正式路徑
- 不執行 git add、git commit
- 產出後不得自行判定通過，只整理對照頁，等人類簽核
- 完成時回報：輸出檔清單、檢查數據、遇到配額或生成失敗的項目、任何不符合規格的地方
```
