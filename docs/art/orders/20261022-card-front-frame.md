# 美術素材委託單 card-frame

- 一張委託單一種資產，流程見 `game-workflow/standards/placeholder-assets.md` 的「外部 AI 工具產出正式素材的流程」
- 日期：2026-10-22
- 填寫：art-director
- 批次：`batch-20261022-card`（與 `20261022-card-back.md`、`20261022-battle-background.md` 同批）
- 本單包含：卡面框架切片、四角圖示、插畫放大的新版面與裁切規則

## 現況與範圍

**卡面框架目前全部是 Canvas 程式繪製，沒有任何框架圖片素材；本單改為提供透明背景切片給程式疊圖**

- 卡面在 500 x 700 設計稿座標繪製，再縮放成 512 x 717 貼圖（`web/src/render/cardTexture.ts:25-26`、`:311-323`）
- 程式畫的部分（以下全部是 Path2D、漸層、純色）
  - 卡框底與外框：線性漸層加陣營深色描邊（`cardTexture.ts:176-186`）
  - 邊緣花紋：只有潮的波浪與霜的冰晶，白色線條（`cardTexture.ts:187-195`、`web/src/content/cardStyle.ts:203-223`）
  - 傳說花冠：`SHAPES.crown` 幾何（`cardTexture.ts:196`、`cardStyle.ts:199-200`）
  - 插畫區背景：放射漸層加陰影橢圓（`cardTexture.ts:198-210`）
  - 名稱緞帶：六邊形路徑，奶白底（`cardTexture.ts:228-244`）
  - 效果文字框：圓角矩形，90% 不透明奶白（`cardTexture.ts:246-252`）
  - 費用、攻擊、生命徽章：`SHAPES.cost`、`SHAPES.attack`、`SHAPES.health`（`cardTexture.ts:254-277`、`cardStyle.ts:192-197`）
  - 稀有度寶石：依稀有度畫圓、菱形、六角、星形（`cardTexture.ts:279-290`、`cardStyle.ts:136-147`）
  - 派系徽記：奶白圓加陣營圖示路徑（`cardTexture.ts:292-296`、`cardStyle.ts:38-74`）
  - 關鍵字圖示：奶白圓加圖示路徑（`cardTexture.ts:298-308`）
- 唯一的圖片素材是角色插畫 `assets/cards/<cardId>.webp`（`cardTexture.ts:212-218`）
- 現有 64 張插畫（60 張可收集卡加 4 張 token）不重畫，維持 512 x 512 webp；母檔在 `assets/_source/cards/` 為 1024 x 1024 PNG
- 數字、名稱、效果文字、關鍵字圖示路徑仍由程式繪製，不做成圖片

## 新版面規格（插畫放大、邊距收窄）

**主角插畫從目前寬 84%、高 47% 放大到寬 92.8%、高 72%；名稱、費用、攻防數值改疊在插畫上**

以下數字以 500 x 700 設計稿為座標，括號內為佔卡面比例，皆為預設值

- 外框邊寬：12（2.4%，上限 3%）
- 插畫與外框內距：6（1.2%，上限 1.5%）
- 主角插畫區：x 18、y 18、寬 464（92.8%）、高 504（72%），圓角 26
  - 效果文字短的卡，文字框縮短，插畫區往下延伸，最高 548（78.3%）
  - 下限：高度不低於 434（62%）
- 效果文字框：x 18、寬 464，底緣固定在 682，高度 110 到 154（15.7% 到 22%），上限 22%
  - 依實際行數決定高度：4 行用 154，3 行 132，2 行以下 110
  - 法術卡與生物卡共用同一規則，法術不再延伸到 680 以上
- 名稱緞帶：疊在插畫下緣，緞帶底距插畫底 4，高 52
  - 生物卡 x 96、寬 308（夾在攻擊與生命徽章之間）
  - 法術卡 x 50、寬 400
- 稀有度寶石：緞帶下緣正中，直徑 24
- 四角圖示：直徑 70（14%）
  - 左上費用：x 10、y 10
  - 右上派系：x 420、y 10
  - 左下攻擊：x 14，底緣對齊插畫底往上 2
  - 右下生命：x 416，底緣對齊插畫底往上 2
  - 攻擊與生命疊在插畫下緣兩角，與名稱緞帶同一列，不另外佔一塊
- 關鍵字圖示列：疊在插畫上緣，中心 y 45，直徑 48，第一顆中心 x 130，間距 56
- 可讀性：插畫上緣與下緣各疊一層半透明漸層（見切片 `card-scrim`），保證費用、關鍵字、名稱、攻防在任何插畫上都可讀

## 插畫裁切規則（現有 64 張不重畫）

**物件置中、保留頭部；只裁下方與左右，不裁上方**

- 來源：優先讀 `assets/_source/cards/<cardId>.png`（1024 x 1024），沒有才用 512 webp
- 步驟
  - 取 alpha 大於 16 的像素外框（bounding box），當作角色範圍
  - 縮放倍率取下列兩者較小值
    - 角色高度 = 插畫區高度 86%
    - 角色寬度 = 插畫區寬度 108%（寬型物種如鯨、鬼蝠魟最多左右各裁 4%）
  - 水平：角色外框中心對齊插畫區中心
  - 垂直：角色外框頂端對齊插畫區頂端往下 10%（避開關鍵字圖示列），頭部永遠完整
  - 超出插畫區的部分由插畫區圓角矩形裁掉，只會發生在下方與左右
- 陰影橢圓維持在插畫區底往上 28 的位置（`cardTexture.ts:207-210` 現行做法）
- 驗收時抽查 6 張：每陣營 1 張加 1 張法術卡，確認頭部、觸角完整

## 資產規格

- 資產名：`card-frame`（含下列切片家族）
- 用途與出現畫面：所有卡面（手牌、放大卡、收藏、牌組編輯、獲得卡片），Canvas 版與 DOM 版（`web/src/components/CardView.vue`）共用
- 目標顯示尺寸：卡面貼圖 512 x 717；DOM 放大卡依 `container-type: inline-size` 縮放，最大約 2 倍
- 解析度：切片 1x 以 512 寬貼圖為準（設計稿座標乘 1.024，取 4 的倍數），2x 為 1x 的兩倍，2x 檔名加 `@2x`
- 長寬比：整卡 5:7
- 格式：WebP 主檔（品質 85，含 alpha）、PNG 備份，全部透明背景

### 切片清單

變體 a、b、c 為三套完整風格，每個切片都要三套都出，人類以「套」為單位挑選

- `card-frame-<陣營>-<變體>`：整卡底框，陣營為 leaf、tide、frost、light、neutral
  - 1x 512 x 716，2x 1024 x 1432
  - 內容：外框邊（1x 12 px）、紙張水彩紋理底、外框邊上的陣營花紋（葉為藤蔓、潮為波浪、霜為冰晶、光為星點、中立為小貝殼）
  - 圓角半徑 1x 37 px，圓角外 alpha = 0
  - 不拉伸，固定尺寸
- `card-artwash-<陣營>-<變體>`：插畫區底的水彩暈染
  - 1x 476 x 564，2x 952 x 1128（涵蓋插畫區最高 548）
  - 中心偏上亮、外圍漸深，取代 `cardTexture.ts:199-206` 的放射漸層
  - 程式以頂端對齊、依當張插畫區高度裁切下方，不拉伸
- `card-scrim-<變體>`：插畫上下緣的可讀性漸層，程式上緣直接用、下緣垂直翻轉後用
  - 1x 476 x 112，2x 952 x 224
  - 由 `#3E3550` 透明度 35% 漸變到 0，帶輕微水彩邊緣
  - 九宮格：左右各 28 px（1x），上下 0；寬度可拉伸
- `card-ribbon-<變體>`：名稱緞帶，半透明奶白
  - 1x 316 x 56，2x 632 x 112
  - 底色 `#FFFDF7` 透明度 88%，兩端燕尾
  - 九宮格：左右各 32 px（1x，燕尾不拉伸），上下 0；生物卡寬 316、法術卡拉伸到 412
- `card-textbox-<變體>`：效果文字框
  - 1x 476 x 160，2x 952 x 320
  - 底色 `#FBF6EC` 透明度 90%，圓角 1x 16 px，色鉛筆細邊
  - 九宮格：上下左右各 20 px（1x）；高度在 112 到 160 之間拉伸
- `card-gem-<稀有度>-<變體>`：稀有度寶石，稀有度為 common、rare、epic、legendary
  - 1x 28 x 28，2x 56 x 56（含透明留邊）
  - 形狀沿用 `docs/ux.md` 4.5 節：common 圓、rare 菱形、epic 六角、legendary 星形
  - 色沿用 `cardStyle.ts:76-81`：`#EDE8E1`、`#6FA8D6`、`#A98BD4`、`#F0B45A`
  - 不拉伸
- `card-crown-<變體>`：傳說卡頂部珊瑚花冠
  - 1x 204 x 60，2x 408 x 120，置中疊在卡框頂端
  - 主色 `#F0B45A`、描邊 `#C98A2E`（`cardTexture.ts:196` 現行色）
  - 不拉伸
- `card-keyword-ring-<變體>`：關鍵字圖示的底座圓
  - 1x 52 x 52，2x 104 x 104
  - 奶白 `#FFFDF7` 底，外圈留給程式依陣營深色描邊，中央 60% 留空給圖示路徑
  - 不拉伸

## 四角圖示

**四個角目前都是程式畫的向量形狀，改由 Codex 出圖；數字仍由程式疊上**

- 現況（以 `cardTexture.ts` 實際為準）
  - 左上：費用，水滴形 `#A9D4EC` 底、`#2F5F8A` 描邊，直徑 96（`cardTexture.ts:255-256`）
  - 右上：派系徽記，奶白圓加陣營圖示，直徑 80（`cardTexture.ts:292-296`）
  - 左下：攻擊，珊瑚尖角形 `#F6E3A1` 底，直徑 88（`cardTexture.ts:262-263`）
  - 右下：生命，水滴愛心形 `#F2B8C6` 底，直徑 88（`cardTexture.ts:264-265`）
  - 稀有度寶石在緞帶正中下方，不在角落，歸在上方切片 `card-gem`
- 共通規格
  - 直徑：卡面寬度 14%，設計稿 70，貼圖 1x 72 x 72 px、2x 144 x 144 px
  - 格式：透明背景 PNG 與 WebP 都要
  - 造型語言：四個圖示同一套，同樣的描邊粗細、同樣的白色 die-cut 邊、同樣的光源方向（左上）
  - 立體感：用水彩明暗與左上邊緣白色高光表現，不用金屬反光、不做 3D render 感（`docs/art-style.md` 第 1 節禁止項）
  - 數字區：中央留出直徑至少 60% 的平整色塊，不放紋理與高光
    - 數字為白字加深色描邊（`cardTexture.ts:74-84`），數字區平均色與描邊色 `#3E3550`（費用為 `#234A6E`）對比至少 4.5:1
    - 數字區中心即圖示幾何中心，程式直接置中疊字
  - 形狀差異保留：費用水滴、攻擊珊瑚尖角、生命水滴愛心，色弱也能分辨（`docs/ux.md` 4.2 節）
- 各圖示
  - `icon-cost-<變體>`：左上費用寶石，語意「潮能」，水滴形，主色淡藍 `#A9D4EC`、暗部 `#2F5F8A`，點綴泡沫白 `#F2FAFB`；3 個變體
  - `icon-attack-<變體>`：左下攻擊，珊瑚尖角形，主色鵝黃 `#F6E3A1`、暗部暖金 `#E8C27A`，輪廓 `#6E5F80`；3 個變體
  - `icon-health-<變體>`：右下生命，水滴愛心形，主色粉紅 `#F2B8C6`、點綴櫻花粉 `#F2B6C6`，輪廓 `#6E5F80`；3 個變體
  - `icon-faction-<陣營>-<變體>`：右上派系徽記，每陣營一款、每款 3 個變體，共 15 張
    - leaf：葉片，`#9CC48A`、`#F2B6C6`、`#D6E8A8`
    - tide：浪花，`#9CCBE6`、`#9EDBD2`、`#F2FAFB`
    - frost：雪花，`#EEF3FA`、`#B8C2E8`、`#CFE6F5`
    - light：星芒，`#F6DE8D`、`#E8C27A`、`#F5C9A0`
    - neutral：貝殼，`#F7F1E6`、`#E8DCC8`、`#CFC4D9`
    - 派系徽記不疊數字，中央可放完整圖形
- 檔名範例：`icon-cost-a.webp`、`icon-cost-a@2x.webp`、`icon-faction-tide-b.png`

## 風格

- 風格關鍵字：引用 `docs/art-style.md` 第 1 節「風格 DNA」
  - 透明水彩打底，色鉛筆細線疊紋理
  - 輪廓細、帶紫灰色 `#6E5F80`，不用純黑，略帶手繪抖動
  - 柔和頂光，暗部偏紫、亮部偏奶白
  - 貼紙外觀：圖示外圍白色 die-cut 邊 `#FFFFFF`，投影 `#5A4E6A` 透明度約 20%
- 色盤限制
  - 陣營外框主色、深色、淺色：沿用線上版 `cardStyle.ts:38-74` 的 `FACTION_STYLE`
    - leaf `#9CC79A`、`#5E9461`、`#E3F1DC`
    - tide `#86CCD6`、`#3F8E9F`、`#DDF2F4`
    - frost `#C9C6EE`、`#7F78C2`、`#F4F3FC`
    - light `#F3DA8C`、`#C9A54A`、`#FCF4D9`
    - neutral `#D9CFC5`、`#9C8F82`、`#F4EFEA`
  - 花紋與點綴：`docs/art-style.md` 第 2 節陣營色票（主、副、點綴）
  - 系列共用：輪廓 `#6E5F80`、奶白 `#F8F4EC`、文字墨色 `#3E3550`
- 構圖要求
  - 框架細、低調，插畫是主角；框架不得搶過插畫的彩度與對比
  - 所有切片透明背景，邊緣抗鋸齒
  - 九宮格邊角區不得有被拉伸會變形的圖案
  - 切片疊合後與 500 x 700 版面座標對齊，誤差 1x 下 1 px 以內

## 禁止事項

- 不含文字、數字、字母、Logo、簽名、浮水印（數字與文字全由程式畫）
- 不含品牌、商標、既有 IP，不模仿既有卡牌遊戲的框架造型
- 不含真人、人類手指與臉
- 不含角色與角色五官
- 不用純黑描邊、cel-shading 硬陰影、金屬反光、霓虹高飽和、寫實照片感、3D render 感
- 不重畫或修改現有 64 張角色插畫

## 委託

- 委託對象：Codex，分兩種方式
  - 框架切片：程序化腳本 `tools/art/card-frame.py`（Python 3 加 Pillow）
    - 原因：九宮格、座標對齊、圓角都要像素精準
  - 四角圖示：Codex 內建圖像生成，提示詞格式沿用 `tools/gen-art.mjs:103-111` 的組法（開頭指令句、風格前綴、Subject、陣營色句、規格後綴）
    - 原因：要「好看一點」的水彩立體質感，程序化難以達到與角色插畫一致的筆觸
    - 後處理：`python3 tools/remove-bg.py <in> <out> --fit 0.92 --size 144` 置中，再縮出 72 版；`tools/to-webp.py` 只收 `assets/_source/`，pending 批次需自行用 Pillow 轉 WebP
- 變體數量：每個切片與圖示 3 個變體（a、b、c），派系徽記 5 陣營各 3 個
- 產出路徑：`assets/pending/batch-20261022-card/card-front/`，簽核後搬到正式路徑（由程式端決定）

## 授權確認

- [ ] 委託對象的服務條款允許商用（Codex 程式產出與圖像生成）
- [ ] 提示詞不含在世創作者名字、既有 IP 名稱、既有卡牌遊戲名稱
- [ ] 工具名、版本、提示詞全文、生成日期已準備登錄 `docs/asset-inventory.md`

## 驗收標準

- [ ] 每個切片與圖示的 1x、2x 尺寸符合本單，WebP 與 PNG 齊全，透明背景
- [ ] 命名符合 `asset-naming.md`（小寫 kebab-case、2x 加 `@2x`）
- [ ] 九宮格切片拉伸到指定範圍後，邊角不變形（對照頁附拉伸測試圖）
- [ ] 四角圖示數字區與描邊色對比至少 4.5:1（附數據）
- [ ] 四角圖示同一套造型語言，形狀差異可辨（附灰階版）
- [ ] 禁止事項逐條確認沒有出現
- [ ] 變體數量達標：切片 a、b、c 三套齊全，四角圖示 9 張加派系徽記 15 張
- [ ] 新版面預覽合成圖：插畫寬至少 90%、高至少 62%，外框不超過 3%，內距不超過 1.5%，文字框不超過 22%
- [ ] 裁切規則抽查 6 張，頭部與觸角完整
- [ ] 手牌尺寸（150 px 寬）縮圖中，費用數字仍可辨識
- [ ] 程式端接上後，實機畫面截圖疊加 UI 仍可讀（此項在程式端配合完成後才驗）

## 程式端配合

**本單不改程式，以下為接上新素材與新版面時要改的地方，給工程端評估**

- 版面常數（`web/src/content/cardStyle.ts`）
  - `:11` `border: 12` 維持
  - `:12` `art: { x: 40, y: 60, w: 420, h: 330, r: 24, overflowTop: 40 }` 改為 `x 18, y 18, w 464, h 504, r 26, overflowTop 0`，另需最高 548 的延伸規則
  - `:13` `ribbon: { x: 30, y: 380, w: 440, h: 64 }` 改為相對插畫底定位，生物 `x 96, w 308`、法術 `x 50, w 400`、`h 52`
  - `:14` `text: { x: 50, y: 456, w: 400, h: 190, r: 16, spellBottom: 680 }` 改為 `x 18, w 464, 底 682, h 110 到 154`，移除 `spellBottom`
  - `:15` `cost: { x: 8, y: 8, d: 96 }` 改為 `x 10, y 10, d 70`
  - `:16` `attack: { x: 8, y: 604, d: 88 }` 改為 `x 14, d 70`，y 相對插畫底
  - `:17` `health: { x: 404, y: 604, d: 88 }` 改為 `x 416, d 70`，y 相對插畫底
  - `:18` `gem: { cx: 250, cy: 444, d: 28 }` 改為緞帶下緣正中、`d 24`
  - `:19` `font.cost 64`、`font.stat 56`、`font.statWide 48` 依直徑 70 等比縮小，約 46、40、34
  - `:21` `textMaxLines: 5` 在 154 高下約只能放 4 行（24px 行高 1.35），需重新確認字級下限或行數
- 繪製流程（`web/src/render/cardTexture.ts`）
  - `:176-196` 卡框底、花紋、花冠改為 `drawImage` 疊 `card-frame`、`card-crown`
  - `:198-210` 插畫區背景改疊 `card-artwash`
  - `:212-218` 角色圖由 contain 改為上方「插畫裁切規則」，並加插畫區圓角裁切
  - `:228-244` 名稱緞帶改疊 `card-ribbon`（九宮格）
  - `:246-252` 效果文字框改疊 `card-textbox`（九宮格），高度依行數
  - `:254-277` 費用、攻擊、生命改疊 `icon-cost`、`icon-attack`、`icon-health`，數字座標寫死的偏移（`+48, +62`、`+44, +46`、`+44, +44`）改為圖示中心
  - `:279-290` 稀有度寶石改疊 `card-gem`
  - `:292-296` 派系徽記座標寫死 `(444, 50)` 半徑 40，改疊 `icon-faction` 並改讀版面常數
  - `:298-308` 關鍵字圖示座標寫死 `142 + i * 58`、`y 40`、半徑 26，改讀版面常數並疊 `card-keyword-ring`
  - `:123` 文字寬 `box.w - 32`、`:138` 類型字預留 `26`，隨新文字框調整
- DOM 版 `web/src/components/CardView.vue:68-130` 同步改用新版面與切片
- `web/src/content/cardStyle.ts:203-223` `framePatternPath` 由框架圖取代後可移除
- `tools/to-webp.py:16` `MAX_SIDE = 512`：插畫放大後 512 webp 會被放大約 1.1 倍，建議工程端評估卡圖改輸出 768 或 1024
- `web/src/content/assetUrls.ts:2-5` 的 glob 需加入框架與圖示所在目錄

## 人類簽核

**AI 不得自行判定通過，art-director 只填初審**

- art-director 初審：<通過／退回加原因>，<YYYY-MM-DD>
- 人類終審：<通過／退回加原因>
- 選用變體：<切片套組 a／b／c；四角圖示各自的變體編號>
- 簽核人：<人類姓名或職稱>
- 簽核日期：<YYYY-MM-DD>
- 對照頁：`docs/reviews/art-signoff-20261022.md`

## 給 Codex 的指令

```
任務：為 Seafish 卡牌遊戲產生卡面框架切片與四角圖示，每種 3 個變體。專案根目錄 /Users/sunnywu/Documents/game-card-seafish

先讀
- docs/art/orders/20261022-card-front-frame.md（本委託單，尺寸、九宮格、色碼以它為準）
- docs/art-style.md 第 1、2、5 節
- web/src/content/cardStyle.ts 與 web/src/render/cardTexture.ts（只讀，了解現行版面）
- tools/gen-art.mjs 第 30 到 111 行（提示詞組法）

第一部分：框架切片（程序化）
1. 新增 tools/art/card-frame.py，只用 Python 3 與 Pillow，不新增套件
   - 參數：--variant a|b|c、--seed、--out <目錄>
   - 依委託單「切片清單」輸出 card-frame-<陣營>、card-artwash-<陣營>、card-scrim、card-ribbon、card-textbox、card-gem-<稀有度>、card-crown、card-keyword-ring
   - 每個切片輸出 1x 與 @2x，PNG 與 WebP（品質 85、method 6、保留 alpha）
   - 水彩紙紋理用固定種子雜訊，三個變體用不同筆觸風格，但同一變體內所有切片風格一致
   - 不畫任何文字、數字、字母
2. 新增 tools/art/preview-card.py，把切片、現有插畫 assets/_source/cards/<id>.png、四角圖示合成預覽卡
   - 依委託單「新版面規格」座標與「插畫裁切規則」
   - 數字與名稱用灰色色塊代替，不畫文字
   - 每個變體合成 6 張：leaf、tide、frost、light、neutral 各 1 張生物卡，加 1 張法術卡
   - 另輸出九宮格拉伸測試圖：緞帶拉到 412 寬、文字框拉到 112 與 160 高
   - 再輸出每張預覽縮到 150 px 寬的手牌縮圖

第二部分：四角圖示（圖像生成）
3. 用你內建的圖像生成工具，一次產一張，依下列提示詞格式組字（沿用 tools/gen-art.mjs 的結構）
   開頭：Use your built-in image generation tool to create exactly ONE image. Do not run shell commands and do not edit files.
   風格前綴：A single game UI badge icon in the exact style of the attached reference sticker sheets: hand-painted watercolor with colored-pencil texture, thin soft purple-grey outlines #6E5F80 (no black lines), gentle soft lighting from the upper left with lavender-tinted shadows and a soft white rim highlight on the upper-left edge, muted pastel macaron palette. The badge has a clean white die-cut sticker border and a faint soft drop shadow. Gentle volume through watercolor shading only, no metallic shine, no 3D render look.
   Subject：依圖示填入
     cost: a water-droplet shaped mana gem, pale sky blue #A9D4EC with deep blue #2F5F8A shading and foam white #F2FAFB sparkles
     attack: a coral-spike star shaped badge, butter yellow #F6E3A1 with warm gold #E8C27A shading
     health: a droplet-heart shaped badge, soft pink #F2B8C6 with cherry-blossom pink #F2B6C6 accents
     faction-leaf: a round emblem with a leaf, leaf green #9CC48A, pink #F2B6C6, sprout green #D6E8A8
     faction-tide: a round emblem with a curling wave, pale sea blue #9CCBE6, mint #9EDBD2, foam white #F2FAFB
     faction-frost: a round emblem with a snowflake, ice white #EEF3FA, periwinkle #B8C2E8, ice blue #CFE6F5
     faction-light: a round emblem with a four-point star sparkle, butter yellow #F6DE8D, warm gold #E8C27A, apricot #F5C9A0
     faction-neutral: a round emblem with a scallop shell, cream #F7F1E6, beige #E8DCC8, lavender grey #CFC4D9
   數字區句（cost、attack、health 才加）：Leave a flat, evenly colored circular area in the exact center covering about 60% of the badge diameter, with no texture and no highlight, so a number can be printed on top later.
   規格後綴：Composition: square 1:1, badge centered, occupying about 90% of the frame. Background: fully transparent (alpha). Do NOT include: text, letters, numbers, logos, watermark, faces, eyes, mouths, characters.
   變體句：a 偏圓潤柔和、b 邊緣高光較明顯、c 色鉛筆紋理較明顯，以英文一句話加在規格後綴前
   參考圖：附 role1.png、role2.png
4. 每張生成圖後處理
   - python3 tools/remove-bg.py <原圖> <輸出 png> --fit 0.92 --size 144，得到 @2x
   - 用 Pillow LANCZOS 縮出 72 x 72 的 1x
   - 用 Pillow 轉 WebP（品質 85、method 6、保留 alpha）；tools/to-webp.py 只收 assets/_source，不要用它
   - 檔名：icon-cost-<變體>、icon-attack-<變體>、icon-health-<變體>、icon-faction-<陣營>-<變體>，2x 加 @2x
5. 新增 tools/art/check-card-front.py，對每張圖示印出尺寸、檔案大小、中央 60% 數字區平均色與 #3E3550（費用用 #234A6E）的對比值，並輸出灰階對照圖

輸出
- 全部放在 assets/pending/batch-20261022-card/card-front/，子目錄 slices/、icons/、_preview/
- 生成提示詞全文逐張記錄在 assets/pending/batch-20261022-card/card-front/prompts.md

對照頁
6. 整理 docs/reviews/art-signoff-20261022.md 的「card-front」段落（檔案已存在就只新增段落，不改其他段落）
   - 三套切片的預覽卡、拉伸測試圖、手牌縮圖
   - 四角圖示所有變體並排、灰階版、對比數據
   - 對應 art-style.md 與委託單的條目
   - 來源：腳本路徑或圖像生成工具名與版本、提示詞、生成日期
   - 每個項目留空白的「人類終審：通過／退回加原因」欄位

限制
- 不改 web/ 底下任何程式、不改 tools/gen-art.mjs、tools/remove-bg.py、tools/to-webp.py
- 不重畫、不覆寫 assets/cards/ 與 assets/_source/cards/ 的插畫
- 不把圖放進正式路徑
- 不執行 git add、git commit
- 產出後不得自行判定通過，只整理對照頁，等人類簽核
- 完成時回報：輸出檔清單、對比數據、遇到配額或生成失敗的項目、任何不符合規格的地方
```
