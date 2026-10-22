# 美術風格指南（Seafish 卡牌）

風格基準：`role1.png`、`role2.png`（各 4×5 共 20 格的葉羊海蛞蝓貼圖）。所有卡圖、立繪都要看起來像同一套貼圖的延伸。

## 1. 風格 DNA

一句話：**擬人化 Q 版海洋生物，水彩加色鉛筆質感，白色 die-cut 貼紙邊，馬卡龍低飽和色，沒有五官。**

### 必守

- **媒材質感**：透明水彩打底，色鉛筆細線疊紋理（葉片可見細葉脈與顆粒）
- **輪廓線**：細、帶紫灰色（約 `#6E5F80`），不用純黑；線寬一致、略帶手繪抖動
- **光影**：柔和頂光，暗部偏紫、亮部偏奶白，邊緣有輕微水彩暈染
- **色彩**：馬卡龍低飽和（奶白、葉綠、薰衣草紫、粉紅，點綴淡藍、鵝黃）
- **造型**：圓胖的身體、短小的腳部、兩根長觸角（rhinophore）是情緒的主要表達器官
- **情緒表達**：只靠觸角角度、身體姿勢與效果線（汗滴、愛心、閃光、怒氣雲、音符、ZZZ）
- **貼紙外觀**：主體外圍一圈均勻白色 die-cut 邊（約主體寬 2–3%），外加淡淡的灰紫投影
- **道具**：小而可愛、同樣低飽和（禮物盒、雨傘、馬克杯等），與角色等高或更小

### 禁止

- 任何五官：眼睛、嘴巴、鼻子、腮紅臉頰
- 純黑描邊、粗卡通描邊、cel-shading 硬陰影
- 高飽和霓虹色、強烈對比、金屬反光、寫實照片感、3D render 感
- 卡圖內不放文字與 Logo；標題畫面 Logo 可含遊戲名稱文字
- 數字、簽名、浮水印
- 卡框、背景場景、地平線、漸層底色
- 血腥、武器寫實化（攻擊用能量、泡泡、葉片、冰晶表現）
- 人類手指、人類臉、擬真的人類比例

## 2. 陣營色票

每個陣營有主色、副色、點綴色。角色本體仍保留系列奶白基調，陣營色用在身體附屬物（葉片、觸手、鰭）、效果線與道具。

色碼以 `web/src/content/cardStyle.ts` 的 `FACTION_STYLE` 為準

- **葉 leaf**（成長、治癒）
  - 主 葉綠 `#9CC79A`
  - 副 櫻花粉 `#F2B6C6`
  - 點綴 嫩芽黃綠 `#D6E8A8`
  - 效果元素：嫩葉、花瓣、小芽
- **潮 tide**（流動、連擊）
  - 主 淡海藍 `#86CCD6`
  - 副 薄荷青 `#9EDBD2`
  - 點綴 泡沫白 `#F2FAFB`
  - 效果元素：泡泡、水花、波紋
- **霜 frost**（控制、凍結）
  - 主 冰白 `#C9C6EE`
  - 副 淡紫藍 `#B8C2E8`
  - 點綴 冰晶藍 `#CFE6F5`
  - 效果元素：雪花、冰晶、霜霧
- **光 light**（爆發、增益）
  - 主 鵝黃 `#F3DA8C`
  - 副 暖金 `#E8C27A`
  - 點綴 杏橙 `#F5C9A0`
  - 效果元素：星芒、光點、光環
- **中立 neutral**（通用）
  - 主 奶白 `#D9CFC5`
  - 副 米杏 `#E8DCC8`
  - 點綴 薰衣草灰 `#CFC4D9`
  - 效果元素：小石、貝殼、沙粒

系列共用色

- 輪廓紫灰 `#6E5F80`
- 角色奶白 `#F8F4EC`
- 觸角薰衣草紫 `#9B7FC0` → 尖端深紫 `#6E4E9A`
- 貼紙白邊 `#FFFFFF`、投影 `#5A4E6A` 透明度約 20%

## 3. 卡圖規格

- **尺寸**：1024×1024 正方形 PNG
- **背景**：透明（RGBA）。若生成工具給不了透明底，改用純色底（`#00FF00` 純綠）再用 `tools/remove-bg.py` 去背
- **構圖**：角色置中，連同白邊佔畫面約 70%，四周留透明空白
- **貼紙邊**：保留白色 die-cut 邊與淡投影，與 `assets/stickers/` 備用貼圖一致
- **不放**：文字、卡名、數值、卡框、背景場景（卡框與文字由前端疊）
- **立繪（portrait）**：同規格，可改半身或全身站姿，觸角姿勢要能看出角色個性

## 4. 角色設計原則（其他海洋生物 Q 版化）

把任何海洋生物變成「同一系列」的固定公式：

- **身體**：簡化成圓胖的麻糬型身體，頭身合一，2 頭身以內
- **保留一個辨識特徵**：該物種最好認的部位放大（海兔的耳朵狀觸角、水母的傘與觸手、海星的五角、章魚的觸腕、寄居蟹的殼）
- **本體色**：身體一律從奶白 `#F8F4EC` 出發，物種特徵部位上陣營色
- **觸角或替代器官**：沒有觸角的物種，用最接近的部位（觸手、鰭、螯）負擔情緒表達
- **無五官**：所有物種都不畫眼睛嘴巴
- **材質**：葉片類用葉脈紋理，膠質類（水母）用半透明水彩疊色，殼類用色鉛筆點描
- **比例統一**：同一張卡只有一個主角；道具或效果不超過主體一半大小

範例

- 葉羊海蛞蝓（主角）：奶白身體、葉綠帶粉尖的葉狀突起、薰衣草紫觸角
- 海兔（潮）：圓滾身體帶淡藍斑點，兩根大耳狀觸角，周圍泡泡
- 冰水母（霜）：半透明冰白鐘形傘，淡紫藍觸手，周圍雪花冰晶
- 海星（光）：鵝黃圓角五角星，表面點狀紋理，周圍星芒

## 5. 出圖 prompt 模板（英文）

### 固定風格前綴（STYLE_PREFIX）

```
A single chibi sticker illustration in the exact style of the attached reference sticker sheets:
hand-painted watercolor with colored-pencil texture, thin soft purple-grey outlines (no black lines),
gentle soft lighting with lavender-tinted shadows, muted pastel macaron palette
(cream white, leaf green, lavender purple, soft pink, with touches of pale blue and butter yellow).
The character is an anthropomorphic, round, chubby sea creature with NO facial features
(no eyes, no mouth, no nose); emotion is shown only through antenna/tentacle pose and small effect marks.
The character has a clean white die-cut sticker border around its silhouette and a faint soft drop shadow.
```

### 每卡變數（CARD_BLOCK）

```
Subject: {species}, {artHint 去掉五官字詞}.
```

陣營色句依卡片種類三選一：

- 一般生物：`Faction mood: {factionName}. Make it a chubby, round chibi creature; paint the creature's own body and fins/tentacles in {factionColors} so the faction color sits on the character itself, not only in the effects ({factionEffects}).`
- 主角（species 含「葉羊」或角色 xiaoye）：`Faction mood: {factionName}; use {factionColors} for effect marks ({factionEffects}).`
- 劇情角色（角色立繪，或 artHint 提到角色 id 的卡）：`Faction mood: {factionName}. Make it a chubby, round chibi creature; keep the body colors exactly as described in the subject, and use {factionColors} for accessories and effect marks ({factionEffects}).`
- 法術卡：`Faction mood: {factionName}; the effect is painted mainly in {factionColors} ({factionEffects}).`

### 主角特徵鎖（HERO_LOCK，主角才加）

```
Hero lock (must match the reference sheets exactly): purple rabbit-ear rhinophores,
cream-white round body, green leaf cerata with pink tips.
```

### 固定規格後綴（SPEC_SUFFIX）

```
Composition: square 1:1, character centered, occupying about 70% of the frame, empty margins.
Background: fully transparent (alpha).
Do NOT include: text, letters, numbers, logos, watermark, card frame, border frame, scenery, ground, horizon, faces, eyes, mouths.
```

備案：若某次輸出不透明，把 Background 那句換成 `Background: a perfectly flat solid #00FF00 green, no gradient, no shadow on the background, no green on the character.`，再跑 `tools/remove-bg.py`。不要用白底，白底會連貼紙白邊一起被去掉。

### 法術卡補充（SPELL_NOTE，`type = spell` 才加）

```
This is a spell card: the magical effect itself is the subject, drawn as one compact sticker vignette
(a small creature from the series may appear); keep a single die-cut sticker silhouette, no full-background scenery.
```

組合順序：`STYLE_PREFIX + Subject + (HERO_LOCK) + 陣營色句 + (SPELL_NOTE) + SPEC_SUFFIX`，並用 `-i role1.png -i role2.png` 附參考圖。實際組字邏輯在 `tools/gen-art.mjs`。

注意事項

- `artHint` 不要寫 smile、eyes、face 這類五官字眼，會和「無五官」互相打架；腳本會自動濾掉 smile、grin、wink、eyes、face、frown、pout、expression 等字詞
- Codex 的 image generation 實測可直接輸出透明 PNG（1254×1254），腳本再縮成 1024×1024；純綠底去背只當備案

## 6. 審稿檢查表

每張圖逐項打勾，任一項「禁止」命中就重出：

- [ ] 尺寸 1024×1024，PNG RGBA
- [ ] 四角透明（alpha = 0），沒有殘留綠邊或白霧
- [ ] 角色置中，佔畫面約 70%
- [ ] 有白色 die-cut 邊與淡投影
- [ ] 無五官
- [ ] 無文字、數字、浮水印、卡框
- [ ] 輪廓線為細紫灰，不是黑色粗線
- [ ] 色彩低飽和，陣營色正確
- [ ] 有水彩加色鉛筆紋理，不是平塗或 3D 感
- [ ] 物種辨識特徵清楚，縮到 128px 仍認得出來
- [ ] 與 `assets/stickers/` 並排看不突兀

## 7. 命名與路徑

- 卡圖：`assets/cards/{cardId}.png`（`cardId` 取自 `content/cards.phase1.json` 的 `id`）
- 角色立繪：`assets/portraits/{characterId}.png`（取自 `content/story.json` 的 `characters[].id`）
- 備用貼圖：`assets/stickers/role1-01.png` … `role2-20.png`（由 `tools/slice-stickers.py` 產生）
- 測試圖：`assets/_tests/test-*.png`（只當參考，遊戲不讀這個資料夾）
- token 卡：與一般卡相同，`assets/cards/{tokenId}.png`
- 檔名一律小寫、`-` 連接，不含空白與中文

## 8. 工具

- `python3 tools/slice-stickers.py`：從貼圖合集切出 40 張備用貼圖
- `python3 tools/remove-bg.py <in.png> [out.png] [--fit 0.7 --size 1024]`：純色底去背（四邊洪水填充），`--fit` 把主體置中縮到畫布 70%
- `node tools/gen-art.mjs [--only id1,id2] [--limit N] [--concurrency N]`：批次呼叫 Codex 出圖
