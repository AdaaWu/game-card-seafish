# 前端架構設計文件（MVP）

> 範圍：`web/` 前端單人遊戲（打 AI ＋ 劇情模式），卡池 150 張不重複卡（分兩期：第一期 60 張主線相關、第二期補到 150 張），資料先存瀏覽器。
> 美術主題：主角是擬人化 Q 版海蛞蝓（綠葉海天牛），水彩加色鉛筆質感、透明背景貼圖風。陣營暫定葉、潮、霜、光四個，加上中立。
> 後端（`server/`，預計 Go）不在本文件範圍，只定義「之後換接 API 時要動哪裡」。
> 標示「需求外但建議考慮」的項目一律**不是既定設計**，需使用者勾選後才納入。

---

## 0. 結論先行

- **核心原則：邏輯與演出分離**。規則引擎是純 TS 函式庫，只吃「指令」、吐「新狀態＋事件」；畫面只讀事件來播動畫
- **可決定性（deterministic）是硬需求**：同一個初始狀態＋同一個亂數種子＋同一串指令，結果必定相同。TDD、AI 模擬、重播、之後的後端驗證都靠這點
- **卡牌效果用資料描述**：卡牌企劃改 JSON／TS 資料就能出新卡，不需要程式改寫每張卡
- **持久化走 Repository 介面**：MVP 實作是 IndexedDB（Dexie），之後換後端 API 只換實作
- **Remotion 是獨立子專案**：預先 render 成影片檔，Vue 只負責播放，兩個框架不在執行期混用
- **同一份 event log 有兩種訂閱者**：動畫（GSAP）與音效（Howler.js），engine 不知道它們存在
- **平衡模擬走 headless**：engine 不依賴瀏覽器，QA 可在 Node 批次跑 AI 自我對戰
- **工具鏈**：npm、Node v26

---

## 1. 目錄結構、建置工具、套件與測試

### 1.1 專案根目錄

```
game-card-seafish/
├─ web/                 # 前端遊戲（Vue 3 + TS + three.js）
├─ cinematics/          # Remotion 子專案（React），只產出影片檔
├─ server/              # 之後的 Go 後端（MVP 不建立）
└─ docs/
   └─ architecture.md
```

- `cinematics/` 與 `web/` **各自有 package.json**，不共用 node_modules，避免 Vue 與 React 的型別與 JSX 設定互相干擾
- MVP 不使用 monorepo 工具（npm workspaces、Turborepo），兩個資料夾彼此只透過「影片檔」交換。是否改為 workspace 列在第 8 章「需求外但建議考慮」

### 1.2 `web/` 目錄

```
web/
├─ index.html
├─ vite.config.ts
├─ tsconfig.json
├─ public/
│  └─ assets/
│     ├─ cards/          # 角色透明圖層（webp，含 alpha）
│     ├─ frames/         # 卡框圖層（依陣營與稀有度）
│     ├─ atlas/          # 縮圖貼圖集（建置產出，依期別分檔）
│     ├─ cinematics/     # Remotion 產出的 mp4／webm
│     ├─ audio/          # 音效與音樂（Howler.js 播放）
│     └─ ui/
├─ src/
│  ├─ engine/            # 規則引擎：純 TS，禁止 import Vue／three／DOM
│  │  ├─ core/           # GameState、指令處理、回合流程
│  │  ├─ effects/        # effect DSL 的解譯器（每種 effect 一個 handler）
│  │  ├─ rng/            # seeded RNG
│  │  ├─ events/         # GameEvent 型別定義
│  │  └─ index.ts        # 對外唯一出口
│  ├─ ai/                # AI 對手（依賴 engine，不依賴 Vue）
│  ├─ sim/               # headless 平衡模擬（依賴 engine 與 ai，在 Node 執行）
│  ├─ data/
│  │  ├─ cards/          # 卡牌定義資料（卡牌企劃維護，依期別分檔：set1.ts、set2.ts）
│  │  ├─ story/          # 劇情章節、關卡、對手牌組
│  │  └─ schema/         # 資料驗證（建置時與測試時檢查）
│  ├─ persistence/       # Repository 介面＋IndexedDB 實作＋migration
│  ├─ stores/            # Pinia stores（battle、collection、deck、story、settings）
│  ├─ presentation/
│  │  ├─ battlefield/    # three.js 戰場：scene、相機、卡牌 mesh、貼圖管理
│  │  ├─ animation/      # 事件 → GSAP timeline 的對應
│  │  ├─ audio/          # 事件 → Howler.js 音效的對應
│  │  └─ director/       # 演出佇列：依序把事件派給各訂閱者
│  ├─ views/             # 頁面：標題、劇情、組牌、收藏、對戰、設定
│  ├─ components/        # Vue 元件（含可選的 shadcn-vue）
│  ├─ router/
│  └─ main.ts
└─ tests/
   ├─ engine/            # 規則引擎單元測試（程式企劃 TDD 主戰場）
   ├─ ai/
   ├─ persistence/
   ├─ data/              # 卡牌資料完整性測試
   └─ e2e/               # Playwright E2E
```

- **依賴方向只能由外往內**：

```
① views / components
  ↓
② stores（Pinia）
  ↓
③ presentation / ai / persistence
  ↓
④ engine
```

  ① 頁面只跟 store 互動，不直接呼叫 engine
  ② store 是唯一呼叫 engine 與 repository 的地方
  ③ 戰場、音效、AI、平衡模擬、持久化各自依賴 engine 的型別
  ④ engine 不依賴任何上層，也不依賴瀏覽器 API
- 用 ESLint 的 `no-restricted-imports` 鎖住 `src/engine/**` 不能 import `vue`、`three`、`gsap`、`howler`、`pinia`。這條規則是邏輯與演出分離的強制手段，不靠人工自律

### 1.3 建置工具

- **Vite**：Vue 官方預設，開發伺服器快，支援 TS、Vue SFC、靜態資產
- **TypeScript strict 模式**：`strict: true`、`noUncheckedIndexedAccess: true`。規則引擎大量用陣列索引（手牌、場地格位），後者可在編譯期抓到越界存取
- 路徑別名：`@engine`、`@data`、`@stores` 等，讓依賴方向在 import 路徑上一眼可見

### 1.4 套件清單（`web/`）

- 執行期
  - `vue`（3.x）
  - `vue-router`（4.x）
  - `pinia`（2.x 或 3.x，依 Vue 版本相容性）
  - `three`（r16x 以上）
  - `gsap`（3.x）
  - `howler`（2.x）：音效播放，處理行動裝置的音訊解鎖與格式後備
  - `dexie`（4.x）：IndexedDB 封裝
  - `shadcn-vue`（可選）：只用在選單、設定、組牌清單這類一般 UI；它不是 npm 套件而是「複製元件原始碼進專案」的模式，依賴 `reka-ui` 與 Tailwind CSS
- 開發期
  - `vite`、`@vitejs/plugin-vue`
  - `typescript`、`vue-tsc`
  - `vitest`、`@vue/test-utils`、`happy-dom`
  - `@playwright/test`：E2E
  - `tsx`：在 Node 直接執行 TS 的平衡模擬腳本
  - `eslint`、`@vue/eslint-config-typescript`、`prettier`
  - `@types/three`、`@types/howler`
  - `sharp`：資產轉檔腳本（見第 6 章）
- 資料驗證
  - `zod`：驗證卡牌資料檔與存檔格式。存檔從 IndexedDB 讀回來是 `unknown`，必須驗證後才交給 engine

### 1.5 版本策略

- **套件管理用 npm**（環境未安裝 pnpm），`package-lock.json` 一定提交；CI 用 `npm ci` 安裝，確保與 lockfile 完全一致
- `package.json` 用 `^` 範圍，實際版本以 lockfile 為準
- **three.js 例外：鎖定精確版本**（不加 `^`）。three.js 版號是 `0.xxx`，每個 minor 都可能有 breaking change，要升級時開專門的 commit 並手動驗證戰場
- **Node v26**：寫進 `.nvmrc` 與 `package.json` 的 `engines`（`"node": ">=26"`）
  - 風險：v26 是偶數版，但發佈初期仍屬 Current 而非 LTS，部分套件（特別是 `sharp` 這類原生模組、Playwright）可能尚未正式宣告支援。M1 開工時先跑一次全套件安裝與測試確認
- 升級節奏：每個里程碑結束時統一檢查一次，不在里程碑中途升 major

### 1.6 測試工具

- **Vitest**：與 Vite 共用設定，TS 原生支援
- 測試分層
  - `tests/engine/`：純函式測試，不需 DOM，跑在 `node` 環境，速度最快，是 TDD 主體
  - `tests/ai/`：給固定盤面，斷言 AI 選出的指令
  - `tests/persistence/`：用 `fake-indexeddb` 跑 Dexie 實作與 migration
  - `tests/data/`：所有卡牌資料通過 schema 驗證、id 不重複、引用的 effect 類型都有 handler
  - Vue 元件測試：只測有邏輯的元件，跑在 `happy-dom`
  - `tests/e2e/`（**Playwright**，QA 負責）：跑真實瀏覽器，驗證關鍵流程
    - 標題 → 劇情第一關 → 對戰 → 勝利 → 進度已存
    - 組牌存檔後重新整理頁面，牌組仍在
    - E2E 用固定 seed 啟動對局（透過開發用的 URL 參數或測試專用入口），讓結果可重現
- three.js 畫面**不做自動化像素比對**（MVP），改由「事件 → 動畫」的對應函式做單元測試（斷言產生的 timeline 步驟，而非像素）
- **平衡模擬**（QA 與卡牌企劃）：見 5.3，不屬於 Vitest 的 pass／fail 測試，而是產出統計報表

---

## 2. 分層架構與事件驅動演出

### 2.1 四層職責

- **規則引擎（engine）**：唯一知道遊戲規則的地方
  - 純 TS、無 DOM、無 `Date.now()`、無 `Math.random()`
  - 對外只有一個核心函式：`applyCommand(state, command) → { state, events }`
  - 狀態是**不可變（immutable）**的：每次回傳新物件，不修改舊物件。好處是可以保留歷史、做重播、AI 可以放心在副本上模擬
- **狀態管理（Pinia）**：銜接層
  - 持有目前的 `GameState`（engine 給的）與畫面用的「顯示狀態」
  - 把玩家操作轉成 `Command` 丟給 engine
  - 把 engine 回傳的 `events` 推進演出佇列
- **呈現層（presentation）**：只負責「看起來與聽起來怎樣」
  - three.js 繪製戰場、卡牌、特效
  - GSAP 播放動畫
  - Howler.js 播放音效與背景音樂
  - 不做任何規則判斷（例如「這張卡能不能打」由 engine 提供 `getLegalCommands(state)`，畫面只負責亮框）
- **Vue 頁面**：一般 UI（手牌資訊面板、選單、對話框、劇情文字）

### 2.2 Seeded RNG（可注入亂數種子）

- 定義：用一個整數種子（seed）產生固定序列的偽亂數。同 seed 必得同序列
- 演算法建議 `mulberry32` 或 `xoshiro128**`：實作短、速度快、品質對卡牌遊戲足夠
- **RNG 狀態放在 `GameState` 裡**（只是一個或幾個整數），不放全域變數。這樣：
  - 複製 state 就連亂數一起複製，AI 模擬不會污染正式對局
  - 存檔時亂數進度一起存，讀檔後結果不變
- 測試時直接指定 seed，洗牌結果固定，斷言可以寫死

### 2.3 Event log 驅動動畫

- 定義：engine 處理每個指令時，按發生順序產生一串 `GameEvent`（例如「抽牌」「造成傷害」「單位死亡」）。這串紀錄叫 event log
- 呈現層**不比對新舊狀態來猜發生什麼**，而是照 event log 一個一個播

```
① 玩家操作
  ↓
② store 建立 Command
  ↓
③ engine.applyCommand
  ↓
④ store 更新邏輯狀態
  ↓
⑤ events 進演出佇列
  ↓
⑥ director 逐一播放
  ↓
⑦ 播完解鎖輸入
```

  ① 玩家拖曳卡牌到場上、點擊攻擊目標
  ② 轉成 `{ type: 'PLAY_CARD', instanceId, target }` 這類資料
  ③ 回傳新 state 與 events；不合法時回傳錯誤，不改 state
  ④ 邏輯狀態**立刻**是最新的，不等動畫
  ⑤ 例如 `[CardPlayed, DamageDealt, UnitDied, CardDrawn]`
  ⑥ director 把每個事件依序派給所有訂閱者（動畫、音效），等動畫訂閱者回傳的 Promise 完成才播下一個
  ⑦ 演出期間鎖住輸入，避免玩家在動畫中下第二個指令

- **訂閱者（subscriber）模式**：director 不寫死「要做動畫」，而是持有一組訂閱者，每個訂閱者決定自己對哪些事件有反應

```ts
export interface PresentationSubscriber {
  // 回傳 Promise 代表 director 要等它結束；音效這類不阻擋的訂閱者回傳 void
  onEvent(event: GameEvent, ctx: PresentationContext): Promise<void> | void;
}

// MVP 的兩個訂閱者
// AnimationSubscriber：事件 → GSAP timeline，回傳 timeline 完成的 Promise
// AudioSubscriber：事件 → Howler.js 音效，立即回傳不阻擋
```

- **音效 hook 的時機**：音效需要對到動畫的「打擊瞬間」，不只是事件開始。做法是動畫 timeline 在關鍵影格發出 cue（例如 `'impact'`），AudioSubscriber 除了訂閱 GameEvent，也訂閱動畫 cue
  - 事件層級音效：`CardDrawn` → 抽牌聲（事件一到就播）
  - cue 層級音效：`DamageDealt` 的動畫在命中影格發出 `impact` → 播打擊聲
  - Game Feel 設計師調整的就是這層時序，不需要改 engine
- **對應表放資料檔**：`事件類型（＋陣營或卡牌 id）→ 音效 key`，例如葉陣營與霜陣營的上場音效不同；找不到專屬音效時退回通用音效
- **Howler.js 注意事項**
  - 行動瀏覽器要等使用者第一次點擊後才能出聲，在標題畫面的「開始」按鈕解鎖音訊
  - 短音效用 audio sprite（多個音效合成一個檔案），減少請求數
  - 音量分軌：音樂、音效、語音三個獨立音量，存在設定裡

- **顯示狀態與邏輯狀態分開**：
  - 邏輯狀態（engine 的 state）在第 ④ 步已是最終結果
  - 顯示狀態（畫面上 HP 數字、卡牌位置）隨動畫逐步追上
  - 因此 Vue 元件綁的是「顯示狀態」，不是直接綁 engine state，否則數字會在動畫開始前就跳到最終值
- **好處**
  - engine 可以在 Node 跑上萬局做數值平衡，完全不需要畫面（headless 模式就是「不掛任何訂閱者」）
  - 演出工程與 Game Feel 設計師可以獨立調整動畫與音效，不會改到規則
  - 同一份 event log 可以拿來做戰鬥紀錄文字、重播
- **事件粒度原則**：一個事件對應「玩家需要看到的一個變化」。連鎖效果（死亡觸發抽牌）拆成多個事件並保持順序，不合併成一個大事件

### 2.4 three.js 與 Vue 的邊界

- three.js 的 scene、renderer **不放進 Pinia、不做成 Vue 響應式物件**。Vue 的 Proxy 包住 three 物件會讓效能大幅下降
- 做法：一個 `Battlefield` 類別持有 scene，Vue 元件在 `onMounted` 建立、`onUnmounted` 呼叫 `dispose()`；store 透過明確的方法呼叫它（`battlefield.playEvent(event)`）
- 需要放進響應式狀態的 three 物件，一律用 `markRaw()` 排除

---

## 3. 卡牌資料格式

### 3.1 定義與實例分離

- **卡牌定義（CardDefinition）**：模板，靜態、唯讀，150 張各一筆。描述「這張卡是什麼」
- **卡牌實例（CardInstance）**：對局中實際存在的一張卡，有自己的 `instanceId`、目前所在區域、受到的傷害、暫時增益。描述「這張卡現在怎樣」
- 實例只存 `definitionId` 參照定義，不複製定義內容。改了定義（數值平衡），所有實例自動套用

### 3.2 效果用資料描述（effect DSL）

- 定義：DSL（Domain-Specific Language，領域特定語言）在這裡指「一組有固定結構的 JSON 物件，用來描述卡牌效果」。engine 有一個解譯器讀這些物件並執行
- 組成三要素
  - **觸發（Trigger）**：何時發動，例如上場時、死亡時、回合開始時
  - **目標（Target）**：作用在誰身上，例如敵方英雄、隨機一個敵方單位、所有友方單位
  - **動作（Action）**：做什麼，例如造成傷害、抽牌、加攻
- 另有**關鍵字（Keyword）**：常見的被動能力（嘲諷、衝鋒、護盾）用字串標記，engine 內建規則處理，不需要寫成 effect
- **逃生口（escape hatch）**：極少數 DSL 描述不了的卡，允許 `{ type: 'custom', handlerId }` 指向一個程式寫的 handler。原則是「出現第二張類似卡時，就把它升級成 DSL 的正式動作」。custom handler 數量建議設上限（例如不超過卡池 5%），超過代表 DSL 設計不足

### 3.3 TypeScript 型別草案

以下為草案，實際的關鍵字、動作種類由卡牌企劃定案後補齊。

```ts
// ---------- 識別碼 ----------
// 用 branded type 讓不同 id 不能混用
type Brand<T, B> = T & { readonly __brand: B };
export type CardDefId = Brand<string, 'CardDefId'>;   // 例：'c001_flame_knight'
export type InstanceId = Brand<string, 'InstanceId'>; // 對局中產生，例：'i42'
export type PlayerId = 'player' | 'opponent';

// ---------- 卡牌定義（模板） ----------
export type CardType = 'unit' | 'spell';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

// 陣營暫定，定案前只改這一行與對應卡框資產
export type Faction = 'leaf' | 'tide' | 'frost' | 'light' | 'neutral'; // 葉、潮、霜、光、中立

// 期別：第一期 60 張、第二期補到 150 張
export type CardSet = 1 | 2;

export type Keyword = 'taunt' | 'charge' | 'shield';  // 由卡牌企劃定案

export interface CardDefinition {
  readonly id: CardDefId;
  readonly name: string;
  readonly type: CardType;
  readonly cost: number;
  readonly rarity: Rarity;
  readonly faction: Faction;
  readonly set: CardSet;
  readonly attack?: number;        // 只有 unit 有
  readonly health?: number;        // 只有 unit 有
  readonly keywords: readonly Keyword[];
  readonly effects: readonly EffectDef[];
  readonly text: string;           // 卡面敘述（顯示用）
  readonly art: string;            // 角色圖層資產鍵，例：'c001'；卡框由 faction＋rarity 決定
}

// ---------- Effect DSL ----------
export type Trigger =
  | { kind: 'onPlay' }
  | { kind: 'onDeath' }
  | { kind: 'onTurnStart'; owner: 'self' | 'opponent' }
  | { kind: 'onDamaged' };

export type TargetSelector =
  | { kind: 'self' }
  | { kind: 'enemyHero' }
  | { kind: 'friendlyHero' }
  | { kind: 'chosen'; filter: TargetFilter }      // 玩家指定
  | { kind: 'random'; filter: TargetFilter; count: number }
  | { kind: 'all'; filter: TargetFilter };

export interface TargetFilter {
  side: 'friendly' | 'enemy' | 'any';
  zone: 'board';
  cardType?: CardType;
}

export type Action =
  | { kind: 'damage'; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'draw'; count: number }
  | { kind: 'buff'; attack: number; health: number }
  | { kind: 'summon'; cardId: CardDefId; count: number }
  | { kind: 'custom'; handlerId: string };         // 逃生口

export interface EffectDef {
  trigger: Trigger;
  target: TargetSelector;
  action: Action;
}

// ---------- 卡牌實例（對局中） ----------
export type Zone = 'deck' | 'hand' | 'board' | 'graveyard';

export interface CardInstance {
  readonly instanceId: InstanceId;
  readonly definitionId: CardDefId;
  readonly owner: PlayerId;
  readonly zone: Zone;
  readonly damage: number;          // 已受傷害，目前生命 = health + 增益 - damage
  readonly attackBuff: number;
  readonly healthBuff: number;
  readonly canAttack: boolean;
}

// ---------- 對局狀態 ----------
export interface PlayerState {
  readonly id: PlayerId;
  readonly heroHealth: number;
  readonly mana: number;
  readonly maxMana: number;
  readonly deck: readonly InstanceId[];      // 順序即抽牌順序
  readonly hand: readonly InstanceId[];
  readonly board: readonly InstanceId[];
  readonly graveyard: readonly InstanceId[];
}

export interface RngState {
  readonly seed: number;
  readonly cursor: number;          // 或演算法內部狀態
}

export interface GameState {
  readonly turn: number;
  readonly activePlayer: PlayerId;
  readonly players: Readonly<Record<PlayerId, PlayerState>>;
  readonly cards: Readonly<Record<InstanceId, CardInstance>>;
  readonly rng: RngState;
  readonly nextInstanceSeq: number;  // 產生新 instanceId 用，避免依賴外部計數
  readonly winner: PlayerId | null;
}

// ---------- 指令（輸入） ----------
export type Command =
  | { type: 'PLAY_CARD'; instanceId: InstanceId; targetId?: InstanceId | 'enemyHero' | 'friendlyHero' }
  | { type: 'ATTACK'; attackerId: InstanceId; targetId: InstanceId | 'enemyHero' }
  | { type: 'END_TURN' };

// ---------- 事件（輸出，驅動動畫） ----------
export type GameEvent =
  | { type: 'TurnStarted'; player: PlayerId; turn: number }
  | { type: 'CardDrawn'; player: PlayerId; instanceId: InstanceId }
  | { type: 'CardPlayed'; player: PlayerId; instanceId: InstanceId }
  | { type: 'AttackDeclared'; attackerId: InstanceId; targetId: InstanceId | PlayerId }
  | { type: 'DamageDealt'; sourceId: InstanceId | null; targetId: InstanceId | PlayerId; amount: number }
  | { type: 'Healed'; targetId: InstanceId | PlayerId; amount: number }
  | { type: 'Buffed'; targetId: InstanceId; attack: number; health: number }
  | { type: 'UnitDied'; instanceId: InstanceId }
  | { type: 'GameEnded'; winner: PlayerId };

// ---------- 引擎介面 ----------
export type CommandResult =
  | { ok: true; state: GameState; events: readonly GameEvent[] }
  | { ok: false; error: CommandError };

export type CommandError =
  | 'NOT_YOUR_TURN'
  | 'NOT_ENOUGH_MANA'
  | 'INVALID_TARGET'
  | 'CARD_NOT_IN_HAND'
  | 'UNIT_CANNOT_ATTACK'
  | 'GAME_OVER';

export interface CardCatalog {
  get(id: CardDefId): CardDefinition;
}

export declare function createGame(input: {
  catalog: CardCatalog;
  playerDeck: readonly CardDefId[];
  opponentDeck: readonly CardDefId[];
  seed: number;
}): { state: GameState; events: readonly GameEvent[] };

export declare function applyCommand(
  catalog: CardCatalog,
  state: GameState,
  command: Command,
): CommandResult;

export declare function getLegalCommands(
  catalog: CardCatalog,
  state: GameState,
): readonly Command[];
```

- **分期加卡**
  - 卡牌資料依期別分檔：`data/cards/set1.ts`（60 張）、`data/cards/set2.ts`（90 張），由 `data/cards/index.ts` 合併成 `CardCatalog`
  - id 編號依期別分段：第一期 `c001`～`c060`，第二期從 `c061` 起，加卡不會撞號、不會重排既有 id
  - 第二期加卡只是「新增資料」，不改 `CardDefinition` 型別；若第二期需要新的 effect 動作或關鍵字，屬於 engine 擴充，要有對應測試
  - 存檔不受影響：收藏與牌組只存 `CardDefId`，新卡加入不需要 migration
  - `set` 欄位用途：資料完整性測試按期別檢查張數、資產管線按期別產 atlas、平衡模擬可限定「只用第一期卡池」
- **為什麼 `cards` 用 Record 而不是把實例放在各區陣列裡**：卡牌會在區域間移動，用 id 索引可以 O(1) 查找，區域陣列只存 id 與順序
- **卡牌資料檔格式**：建議用 `.ts` 檔匯出 `CardDefinition[]`（有型別檢查、編輯器自動完成），再用 zod schema 在測試中二次驗證。若卡牌企劃習慣試算表，改成「試算表 → 匯出 JSON → 建置時轉檔」，此選擇列為使用者決策事項

---

## 4. 瀏覽器持久化

### 4.1 Repository 介面

- 定義：Repository（儲存庫）是一層介面，上層只呼叫「存」「取」，不知道資料實際存在 IndexedDB 還是後端
- MVP 實作 `IndexedDb*Repository`，之後新增 `Api*Repository`，Pinia store 只在注入點換實作

```ts
export interface SaveRepository {
  load(slot: SaveSlotId): Promise<SaveData | null>;
  save(slot: SaveSlotId, data: SaveData): Promise<void>;
  listSlots(): Promise<readonly SaveSlotSummary[]>;
  delete(slot: SaveSlotId): Promise<void>;
}

export interface DeckRepository {
  list(): Promise<readonly Deck[]>;
  get(id: DeckId): Promise<Deck | null>;
  upsert(deck: Deck): Promise<void>;
  delete(id: DeckId): Promise<void>;
}

export interface CollectionRepository {
  get(): Promise<Collection>;            // 已解鎖的卡與數量
  unlock(cards: readonly CardDefId[]): Promise<void>;
}

export interface StoryProgressRepository {
  get(): Promise<StoryProgress>;
  completeStage(stageId: StageId): Promise<void>;
}
```

- **所有方法都回傳 Promise**：IndexedDB 本身就是非同步，之後換 HTTP 也是非同步，介面不用改
- 注入方式：在 `main.ts` 建立實作，用 Vue 的 `provide` 或 Pinia store 的建構參數傳入。不在 store 內部 `new` 具體實作
- 測試時注入記憶體版實作（`InMemory*Repository`），store 測試不碰 IndexedDB

### 4.2 IndexedDB 套件選擇

- **建議 Dexie**
  - Pros：內建 schema 版本與升級機制（`db.version(n).stores().upgrade()`）、查詢 API 好寫、有 `fake-indexeddb` 可測
  - Cons：套件較大（約 30KB gzip 前後），抽象層多一層
- **替代 idb**
  - Pros：極輕量，貼近原生 API
  - Cons：版本升級要自己寫 `onupgradeneeded` 邏輯，migration 管理成本較高
- 結論：本專案需要存檔 migration，選 Dexie 省去自己管升級流程

### 4.3 存檔版本號與 migration

- 兩層版本，**不要混在一起**
  - **IndexedDB schema 版本**：資料表與索引結構變更時遞增（Dexie 的 `db.version(n)`）
  - **存檔資料版本 `saveVersion`**：存在每筆資料裡的整數，資料內容格式變更時遞增（例如卡牌 id 改名、欄位拆分）

```
① 讀出原始資料
  ↓
② 檢查 saveVersion
  ↓
③ 依序套用 migration
  ↓
④ zod 驗證
  ↓
⑤ 交給 store
```

  ① 從 IndexedDB 讀出，型別為 `unknown`
  ② 小於目前版本就進入 migration；大於目前版本代表玩家用了較新的版本後退版，拒絕讀取並提示
  ③ `migrations[1→2]`、`migrations[2→3]` 逐版套用，每個 migration 是純函式，有自己的單元測試
  ④ 驗證失敗不覆寫原資料，保留原檔並提示玩家
  ⑤ 驗證通過才使用，並以新版本格式寫回

- **卡牌 id 一旦上線不可改名**：存檔裡的牌組、收藏都存 `CardDefId`。真的要改，必須寫 migration 對應舊 id → 新 id
- **對局中途存檔**：MVP 建議只在「回合結束」或「離開對戰」時存 `GameState`。因為 engine 是可決定性的，也可以只存「初始 seed＋指令列表」重播還原，此選項列為使用者決策事項

### 4.4 換後端時要改的地方

- 新增 `Api*Repository` 實作
- 在注入點切換實作
- 增加「本機存檔上傳」的一次性遷移流程（屬之後的工作）
- engine、store、畫面都不用改

---

## 5. AI 對手

### 5.1 介面

```ts
export interface AiPlayer {
  // 回傳本回合下一個指令；回合結束時回傳 END_TURN
  chooseCommand(catalog: CardCatalog, state: GameState, self: PlayerId): Command;
}
```

- AI **只透過 engine 的公開函式**理解遊戲（`getLegalCommands`、`applyCommand`），不自己重寫規則
- AI 的亂數（例如同分時隨機選）使用**獨立的 seed**，不消耗對局 state 裡的 RNG，否則 AI 的思考過程會改變對局結果

### 5.2 MVP：啟發式評分（heuristic）

- 定義：heuristic（啟發式）是用經驗規則打分數，不保證最佳解，但計算快
- 流程

```
① 列出合法指令
  ↓
② 逐一模擬
  ↓
③ 盤面評分
  ↓
④ 選最高分
```

  ① `getLegalCommands(state)`
  ② 對每個指令呼叫 `applyCommand`，因為 state 不可變，模擬不影響正式對局
  ③ 評分函式加權計算：雙方英雄血量差、場上攻擊力總和、手牌數、是否形成斬殺
  ④ 同分時用 AI 專屬 RNG 打破平手

- 評分權重放在資料檔，讓卡牌企劃能調整 AI 風格；劇情關卡的不同對手可以用不同權重組
- **效能注意**：只看一步（greedy），一回合內每次決策都重新評估。150 張卡、手牌與場上數量有限，一步模擬的計算量很小
- **AI 思考不要卡住主執行緒**：MVP 計算量小可以直接在主執行緒跑，每個指令之間加入演出等待。若之後加深搜尋，改用 Web Worker（engine 是純 TS，可以直接搬進 Worker）

### 5.3 Headless 平衡模擬（AI 自我對戰）

- 定義：headless 指「不開畫面、不開瀏覽器」，直接在 Node 呼叫 engine 與 AI 跑完整對局
- 可行的前提就是 engine 的三個既定性質：純 TS 無 DOM、可決定性、RNG 狀態在 GameState 裡
- 位置：`web/src/sim/`，用 `npx tsx src/sim/run.ts` 執行，掛成 `npm run sim`

```
① 讀模擬設定
  ↓
② 產生對局清單
  ↓
③ 逐局 AI 自我對戰
  ↓
④ 收集 event log 統計
  ↓
⑤ 輸出報表
```

  ① 設定檔指定：雙方牌組（或陣營）、AI 權重組、局數、起始 seed、卡池期別
  ② 每局 seed = 起始 seed + 局號，先後手輪替，排除先手優勢的干擾
  ③ 迴圈：`ai.chooseCommand` → `applyCommand`，直到 `winner` 出現或達到回合上限（防無限迴圈，超過記為平局並單獨標記）
  ④ 直接讀 `GameEvent` 統計，不另外埋點：陣營對陣營勝率、每張卡的「被打出時的勝率」、平均對局回合數、先手勝率
  ⑤ 輸出 JSON 與 CSV，卡牌企劃用試算表看

- **可重現性**：報表裡任何一局異常，都能用「seed＋設定」在 Vitest 或開發頁面重新跑出同一局逐步除錯
- **平行化**：用 Node 的 `worker_threads` 依 CPU 核心數拆分局數；因為每局只依賴自己的 seed，拆分不影響結果
- **定位**：平衡模擬產出的是統計，不是 pass／fail。可額外設定「陣營勝率超過 60% 時 CI 警告」這類門檻，門檻值由卡牌企劃決定
- **限制**：AI 是一步 greedy，模擬出的勝率反映的是「AI 打法下的平衡」，不等於人類玩家的平衡。高手才會用的組合技可能被低估，仍需人工試玩補足

### 5.4 可替換性

- `AiPlayer` 是介面，`HeuristicAi` 是 MVP 唯一實作
- 依專案規則「只有一個實作就不開 interface」，這裡保留介面的理由是：store 測試需要注入「固定出招」的假 AI，平衡模擬也需要讓兩個不同權重的 AI 對打。若使用者認為不需要，可以先只寫一個類別

---

## 6. 資產管線

### 6.1 卡面分層

- 卡面不是一張完整圖，而是**兩層疊合**，在 three.js 裡是同一張卡的兩個貼圖層
  - **卡框層（frame）**：依「陣營 × 稀有度」共用，5 陣營 × 4 稀有度 = 最多 20 張，美術監督手工或另行出圖
  - **角色層（character）**：每張卡一張，Codex 出圖，RGBA 透明背景的綠葉海天牛等 Q 版角色
  - 數值與文字（費用、攻擊、生命、卡名）由程式繪製，不燒進圖裡，數值平衡調整不需要重出圖
- Pros：角色圖可在收藏頁、劇情立繪、Remotion 影片重複使用；換卡框風格不需重出 150 張圖；陣營辨識一致
- Cons：多一層貼圖，draw call 與 overdraw（透明像素重複繪製）增加，需靠 atlas 與 InstancedMesh 壓回去（見第 7 章）

### 6.2 命名規則

- 角色層：`cards/{cardId}_{variant}.webp`
  - 例：`c001_full.webp`、`c001_thumb.webp`
  - `cardId` 與 `CardDefinition.art` 一致，全小寫、底線分隔，不含中文與空白
- 卡框層：`frames/{faction}_{rarity}_{variant}.webp`，例：`leaf_rare_thumb.webp`
- 原始檔（資產庫，不進 `web/`）：`src-art/set{n}/{cardId}.png`，依期別分資料夾
- 劇情：`story/{chapter}/{scene}_{index}.webp`
- 影片：`cinematics/{chapter}_{name}.webm`（另附 `.mp4` 作為 Safari 後備）
- 音效：`audio/sfx_{name}.webm`（另附 `.mp3` 後備）、`audio/bgm_{name}.webm`
- 用 `tests/data/` 的測試檢查：每張卡定義的 `art` 都有對應檔案、每個「陣營 × 稀有度」都有卡框、沒有孤兒檔案

### 6.3 尺寸與格式

- **原始檔**：Codex 產出的 PNG，約 1200px、RGBA 透明背景。存放於美術資產庫（雲端硬碟或 Git LFS），不放進 `web/`
- **產出規格**（建議值，美術監督確認後定案）
  - `full`：長邊 1024px，用於放大檢視與收藏頁大圖
  - `thumb`：長邊 256px，用於手牌、場上、收藏列表
  - 格式：**webp 含 alpha**，品質 80～85
- **水彩與色鉛筆質感的壓縮注意**
  - 筆觸與紙紋是高頻細節，壓縮率過高會糊掉，品質不建議低於 80
  - 透明邊緣的半透明筆觸要保留：轉檔時不可把 alpha 二值化
  - three.js 貼圖要處理 **premultiplied alpha（預乘透明度）**：沒處理時透明邊緣會出現黑邊或白邊。建議轉檔時保持一般 alpha，載入後設定 `texture.premultiplyAlpha` 與材質的 blending 一致，M3 用實際卡圖驗證
- **轉檔腳本**：Node + `sharp`，`npm run assets` 執行

```
① 讀原始 PNG
  ↓
② 檢查規格
  ↓
③ 裁切與縮放
  ↓
④ 輸出 webp
  ↓
⑤ 產生 atlas
```

  ① 預設只處理「新增或變更」的檔案（比對檔案雜湊），分期加卡時不重跑全部
  ② 必須有 alpha 通道、尺寸在預期範圍，不符合就中止並列出檔名，避免 Codex 偶發產出不透明背景的圖混進來
  ③ 依統一的安全區（角色主體置中、預留卡框遮擋範圍）裁切
  ④ 產出 full 與 thumb
  ⑤ atlas 依期別產出（`atlas/set1.webp`＋座標 JSON、`atlas/set2.webp`＋座標 JSON），第二期加卡不改動第一期 atlas

### 6.4 three.js 貼圖載入與記憶體

- **貼圖記憶體算法**：GPU 上是解壓後的大小，與檔案大小無關。寬 × 高 × 4 bytes（RGBA）× 約 1.33（含 mipmap）
  - 一張 1024 × 1434 的 full 圖約 7.8MB GPU 記憶體
  - 150 張全部載入約 1.2GB，**行動裝置一定撐不住**
  - 一張 256 × 358 的 thumb 約 0.5MB，150 張約 73MB，可接受
- 原則
  - 戰場上一律用 thumb 或 atlas
  - full 圖只在「放大檢視單張卡」時載入，離開時 `texture.dispose()`
- **TextureManager**：集中管理載入與釋放
  - 以參照計數（reference counting）追蹤每張貼圖被幾個 mesh 使用，降到 0 就 dispose
  - 同一張圖只載入一次（快取）
  - three.js 的 `dispose()` 必須手動呼叫，不會被 JS 垃圾回收自動釋放，這是最常見的記憶體洩漏來源
- 色彩空間：卡圖貼圖設 `texture.colorSpace = THREE.SRGBColorSpace`，否則水彩色調會偏淡
- **透明物件排序**：角色層是半透明，three.js 會依距離排序透明物件。卡牌重疊（手牌扇形排列）時可能出現前後錯亂，用 `renderOrder` 明確指定順序，不依賴自動排序

### 6.5 Lazy load

- **對戰前預載**：進入對戰時，只載入「雙方牌組會用到的卡」的 thumb（最多 2 × 牌組張數），顯示載入進度
- **收藏頁**：用 `IntersectionObserver` 只載入可見範圍的縮圖（這裡是 DOM `<img>`，不走 three.js）
- **影片**：劇情影片只在播放前才載入，播放完釋放 `<video>` 的 `src`
- **路由層級拆包**：Vite 依路由自動 code-split，three.js 只在對戰頁載入，標題與選單頁不用下載 three.js

### 6.6 Remotion 過場影片的並存方式

- `cinematics/` 是獨立的 React + Remotion 專案，演出工程在這裡寫過場動畫
- 輸出流程

```
① 編寫 Remotion composition
  ↓
② npx remotion render
  ↓
③ 複製到 web/public/assets/cinematics
  ↓
④ Vue 用 video 元素播放
```

  ① 讀取同一批美術資產（從資產庫或 `web/public/assets` 以相對路徑引用）
  ② 輸出 `.webm`（VP9）與 `.mp4`（H.264）兩種
  ③ 用腳本複製，檔名依 6.2 規則
  ④ 一個 `CinematicPlayer.vue` 元件負責播放、跳過、播完回呼

- **Pros**：兩個框架執行期完全隔離；影片檔播放效能穩定；Vue 端不需要 React 依賴
- **Cons**：劇情影片無法依玩家狀態動態變化（例如顯示玩家命名的角色名字）；改一個字就要重新 render；影片檔增加下載量
- 若劇情需要動態文字，建議影片只做畫面，文字由 Vue 疊加字幕層

---

## 7. 效能

### 7.1 目標

- 桌機與中階手機都達到 **60fps**（每影格 16.6ms 內完成）
- 對戰頁首次載入（含貼圖預載）在一般網路下 3 秒內可操作

### 7.2 Draw call 控制

- 定義：draw call 是 CPU 對 GPU 下一次「畫這個東西」的指令。數量過多時 CPU 會成為瓶頸，行動裝置建議控制在 100 以內
- 估算：場上與手牌同時存在的卡牌約 20～30 張。卡面分成卡框層與角色層（見 6.1），若每張卡是「卡框 mesh＋角色 mesh＋數字 mesh」各自獨立材質，會達到 60～90 個 draw call，接近上限
- 手段（依優先順序）
  - **貼圖 atlas**：把所有 thumb 拼成一張或幾張大圖，卡牌 mesh 用 UV 座標取各自區域，所有卡共用同一材質
  - **卡框與角色合併成單一 shader**：一個材質同時取樣卡框 atlas 與角色 atlas，在 shader 內疊合，一張卡從兩個 draw call 降為一個
  - **控制 overdraw**：角色層透明區域大，卡牌 mesh 不用整張矩形，可依角色輪廓裁成較貼合的多邊形（M6 視量測結果決定是否需要）
  - **InstancedMesh**：同一幾何與材質的多張卡用一個 draw call 畫完，個別位置用 instance matrix 控制
  - **數字與文字**：攻擊、生命數字用 bitmap font 或 SDF 文字（例如 `troika-three-text`），避免每次數值變化都重新產生 canvas 貼圖
- 用 `renderer.info.render.calls` 在開發模式顯示即時 draw call 數

### 7.3 貼圖 atlas 規格

- 單張 atlas 上限 4096 × 4096（多數行動 GPU 的安全上限）
- 256 × 358 的縮圖一張 4096 atlas 可放 16 × 11 = 176 張
- **依期別分 atlas**（見 6.3）
  - 第一期 60 張：`set1` atlas 用 2048 × 4096 即可（8 × 11 = 88 格），GPU 記憶體約 43MB（含 mipmap）
  - 第二期 90 張：另一張 `set2` atlas
  - 對戰時只載入雙方牌組用到的期別 atlas
  - Pros：加卡不影響已上線的 atlas 與瀏覽器快取；Cons：跨期牌組會用到兩張 atlas，材質數多一個，draw call 多一組
- 卡框 atlas 另外一張：最多 20 種卡框，1024 或 2048 即可
- 兩期全載入時 GPU 記憶體約 85MB＋卡框 atlas，行動裝置可接受

### 7.4 其他 60fps 要點

- **不在每影格建立物件**：動畫中重複使用 `Vector3`、`Matrix4`，避免 GC 造成卡頓
- **閒置時降頻**：沒有動畫與互動時停止 render loop，只在事件觸發時重新繪製，省電也降低發熱
- **Vue 響應式不碰 three 物件**：見 2.4
- **devicePixelRatio 上限 2**：高 DPI 手機（3x）直接用原生解析度會讓填充率爆量
- **GSAP 只動 three 物件屬性**：GSAP 直接 tween `mesh.position`，不經過 Vue 響應式

---

## 8. 風險與取捨

### 8.1 關鍵決策 Pros / Cons

- **規則引擎不可變狀態（immutable）**
  - Pros：AI 模擬、重播、測試都簡單；不會出現「動畫播到一半狀態被改」的 bug
  - Cons：每次指令都複製物件，有少量記憶體與 GC 成本
  - 風險：150 張卡、單局卡牌數有限，成本可忽略；若 AI 改成深度搜尋才需要重新評估
- **effect DSL 而非每張卡寫程式**
  - Pros：卡牌企劃可自行出卡；效果可被 AI 理解與評分；資料可驗證
  - Cons：DSL 設計初期要投入；複雜卡會逼出 DSL 擴充
  - 風險：DSL 設計過度泛用會變成另一個程式語言，難以維護。對策是只做「已出現在卡池裡」的動作種類
- **事件驅動演出**
  - Pros：邏輯與畫面完全解耦；engine 可獨立測試與跑模擬
  - Cons：每加一種事件，呈現層要同步加一個動畫對應，兩邊需要協作
  - 風險：事件種類漏對應動畫會讓畫面卡住。對策是對應表用 TS 的窮盡檢查（exhaustive check），漏寫會編譯失敗
- **Remotion 預先 render 影片**
  - Pros：框架隔離乾淨；播放穩定
  - Cons：影片不能動態變化；檔案大
  - 風險：劇情多章節時影片總量會拉高下載量，需控制每支長度與碼率
- **資料存瀏覽器**
  - Pros：MVP 不需後端，開發與部署最快
  - Cons：玩家清除瀏覽器資料就遺失；不能跨裝置
  - 風險：Safari 對非安裝型網站的儲存有自動清除機制（一段時間沒造訪會清除），存檔可能消失
- **卡面分層（卡框＋角色透明層）**
  - Pros：數值與卡框可改不重出圖；角色圖可在劇情、收藏、影片重用
  - Cons：多一層貼圖與透明排序問題
  - 風險：透明邊緣黑邊、手牌重疊排序錯亂。對策見 6.3、6.4，M3 用第一批實際卡圖驗證
- **依期別分 atlas**
  - Pros：分期加卡不動既有資產
  - Cons：跨期牌組多一組 draw call
  - 風險：第二期之後若再擴充，需改為依牌組動態組 atlas
- **Howler.js 音效**
  - Pros：處理行動裝置音訊解鎖與格式後備，API 簡單
  - Cons：與 three.js 的 `PositionalAudio` 是兩套系統，若之後要做 3D 空間音效需重新評估
  - 風險：iOS 靜音開關與自動播放限制，需在真機測試

### 8.2 其他技術風險

- **three.js 版本破壞性變更**：已用精確版本鎖定緩解
- **Codex 出圖風格與規格不一致**：水彩加色鉛筆質感容易在批次間漂移；也可能產出不透明背景或主體偏移。屬美術監督流程，架構面提供命名、尺寸、alpha 檢查與安全區裁切（見 6.3），轉檔腳本會擋下規格不符的檔案
- **分期造成的平衡斷層**：第一期 60 張先調好平衡，第二期 90 張加入後可能打破。平衡模擬（5.3）要能「只用第一期」與「兩期合併」各跑一次比較
- **陣營暫定**：葉、潮、霜、光＋中立若之後調整，影響 `Faction` 型別、卡框資產、音效對應表與平衡模擬設定。卡牌 id 不含陣營名，陣營調整不需要存檔 migration
- **規則細節未定導致 engine 反覆重構**：建議卡牌企劃先定「核心回合規則＋前 20 張卡」，engine 以此為第一批測試案例

### 8.3 需求外但建議考慮

以下項目**不在目前設計中**，需使用者勾選後才納入。

- **對局重播與指令紀錄存檔**
  - 為什麼：engine 已可決定性，只要存「seed＋指令列表」就能完整重播，用於回報 bug 與除錯
  - 不加的風險：玩家回報「某張卡效果錯了」時無法重現
  - 成本差異：現在加只需在 store 多記一個陣列；之後加也不難，但前提是 engine 一直保持可決定性
- **存檔匯出／匯入（JSON 檔下載與上傳）**
  - 為什麼：緩解 8.1 提到的瀏覽器清除資料風險
  - 不加的風險：玩家遺失存檔無法救回
  - 成本差異：現在或之後加成本接近，因為 Repository 與 zod 驗證已存在
- **`navigator.storage.persist()` 請求持久儲存**
  - 為什麼：向瀏覽器請求不要自動清除本站資料
  - 不加的風險：Safari 與儲存空間不足時資料可能被清掉
  - 成本差異：幾行程式，現在加與之後加差不多，但越早加，越早保護到早期玩家
- **npm workspaces（`web/`、`cinematics/`、之後的共用型別）**
  - 為什麼：若之後 Go 後端要驗證對局，或 cinematics 要讀卡牌資料，共用套件會比複製檔案好維護
  - 不加的風險：卡牌資料或型別在多處複製，容易不一致
  - 成本差異：npm 內建 workspaces，不用多裝工具；之後加需要搬移資料夾與調整 import 路徑，中等成本
- **規則引擎可在後端重用（伺服器端驗證）**
  - 為什麼：之後若有排行榜或線上獎勵，後端需要驗證玩家沒有作弊
  - 不加的風險：Go 後端要用 Go 重寫整套規則，兩套實作會不一致
  - 成本差異：現在只需「維持 engine 純 TS、無瀏覽器依賴」（已是既定設計）。真正的決策是之後後端用 Go 重寫，還是用 Node 跑同一份 TS，這點要在做後端前決定
- **Web Worker 執行 AI**
  - 為什麼：若之後 AI 改深度搜尋，計算可能超過一個影格
  - 不加的風險：MVP 的 greedy AI 不會有問題；深度搜尋時畫面會卡頓
  - 成本差異：engine 已是純 TS，之後搬進 Worker 成本低，不建議現在做
- **錯誤追蹤（例如 Sentry）**
  - 為什麼：上線後能收到玩家端的例外與 engine 錯誤
  - 不加的風險：只能靠玩家口頭回報
  - 成本差異：之後加成本低，但上線前沒有就看不到第一批玩家的問題
- **多語系（i18n）**
  - 為什麼：卡牌敘述與劇情文字若之後要翻譯，現在把字串從程式抽出到資料檔會比較省事
  - 不加的風險：之後翻譯要逐一找出寫死的字串
  - 成本差異：現在只要「文字放資料檔、不寫死在元件」即可；之後補做需要全面掃描，150 張卡與劇情文字量越大越貴
- **PWA（可安裝、離線可玩）**
  - 為什麼：單人遊戲適合離線；安裝後 Safari 的儲存清除規則也較寬鬆
  - 不加的風險：只能線上開網頁遊玩
  - 成本差異：之後用 `vite-plugin-pwa` 加入，成本低；但資產快取策略要配合 6 章的檔名規則（建議檔名加 hash）

---

## 9. 開發里程碑建議

- 一句話重點：先把第一期 60 張做成可玩的主線，再補第二期 90 張；規則引擎與平衡模擬最早上線

```
① M1 規則引擎
  ↓
② M2 對戰原型與平衡模擬
  ↓
③ M3 演出、音效與戰場
  ↓
④ M4 收藏與組牌
  ↓
⑤ M5 劇情模式與第一期 60 張
  ↓
⑥ M6 第二期補到 150 張
  ↓
⑦ M7 效能與品質收斂
```

① **M1 規則引擎（純 TS，無畫面）**
  - 負責：程式企劃（TDD）、卡牌企劃（核心回合規則與前 20 張卡）
  - 交付：seeded RNG、`createGame`、`applyCommand`、`getLegalCommands`、effect DSL 解譯器、event log
  - 完成條件：前 20 張卡的效果全部有測試；固定 seed 的整局對戰可在 Node 跑完並得到固定結果；Node v26 下全套件安裝與測試通過
② **M2 對戰原型與平衡模擬**
  - 負責：前端、程式企劃、QA、卡牌企劃
  - 交付：Pinia battle store、Heuristic AI、用一般 DOM 元件顯示的簡易對戰畫面（先不用 three.js）、`npm run sim` 批次自我對戰與報表
  - 完成條件：玩家可以完整打完一局 AI 對戰；平衡模擬能輸出陣營勝率與單卡勝率
③ **M3 演出、音效與戰場（three.js＋GSAP＋Howler.js）**
  - 負責：演出工程、Game Feel 設計師、UX/UI、前端
  - 交付：three.js 戰場、卡面分層 shader、TextureManager、演出 director 與動畫／音效兩個訂閱者、動畫 cue 機制
  - 完成條件：所有 GameEvent 都有動畫；主要事件有音效；用第一批實際 Codex 卡圖驗證透明邊緣與排序無誤
④ **M4 收藏與組牌（持久化）**
  - 負責：前端、UX/UI
  - 交付：Repository 介面與 Dexie 實作、存檔版本與 migration 機制、收藏頁、組牌頁
  - 完成條件：關閉瀏覽器重開資料仍在；migration 有測試；Playwright 覆蓋組牌存檔流程
⑤ **M5 劇情模式與第一期 60 張**
  - 負責：資深企劃（劇情）、卡牌企劃、美術監督、演出工程（Remotion）、前端
  - 交付：`set1` 60 張卡資料與卡圖、`set1` atlas、章節與關卡資料、劇情文字播放、過場影片播放、關卡專屬對手牌組與 AI 權重
  - 完成條件：主線可從頭玩到尾並存進度；第一期平衡模擬報表經卡牌企劃確認；Playwright 覆蓋主線第一關
⑥ **M6 第二期補到 150 張**
  - 負責：卡牌企劃、美術監督、程式企劃、QA
  - 交付：`set2` 90 張卡資料與卡圖、`set2` atlas、第二期需要的新 effect 動作（含測試）
  - 完成條件：150 張資料與資產測試全綠；「只用第一期」與「兩期合併」兩種平衡模擬都跑過並比較
⑦ **M7 效能與品質收斂**
  - 負責：效能工程師、QA、Game Feel 設計師
  - 交付：draw call 與 GPU 記憶體量測、中階手機實機調校、手感與音效時序微調
  - 完成條件：中階手機 60fps；draw call 在目標內；E2E 全綠

- M1 與 Codex 出圖、卡框設計、劇情撰寫、Remotion 前期製作、音效製作可以**平行進行**，不互相阻擋
- M2 用 DOM 而非 three.js 的理由：讓卡牌企劃提早試玩，數值問題越早發現越便宜；three.js 演出放 M3 不會阻擋規則驗證
- 效能工程師建議從 M3 起就每週量一次 draw call 與記憶體，不要等到 M7 才發現架構問題

---

## 附錄：需要使用者決定的事項

- 卡牌資料由誰維護、用什麼格式（TS 檔，或試算表匯出 JSON）
- 對局中途存檔用「完整 state」還是「seed＋指令列表重播」
- `AiPlayer` 是否保留介面（見 5.4）
- shadcn-vue 是否採用（會連帶引入 Tailwind CSS）
- 卡圖尺寸與安全區規格（6.3 建議值）由美術監督確認
- 陣營最終定案（目前暫定葉、潮、霜、光＋中立）
- 平衡模擬的 CI 警告門檻（例如陣營勝率上限）由卡牌企劃決定
- 8.3「需求外但建議考慮」清單逐項勾選
