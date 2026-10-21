<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import CardView from '@/components/CardView.vue'
import { collectibleCards, decks, getCard } from '@/content'
import { FACTION_STYLE, cardKeywords } from '@/content/cardStyle'
import type { Card, Faction } from '@/content/types'
import { audio } from '@/fx/audio'
import { PLAYER_DECK_ID } from '@/stores/progress'

const router = useRouter()

const FACTIONS = Object.keys(FACTION_STYLE) as Faction[]
const COSTS = [0, 1, 2, 3, 4, 5, 6, 7] as const

const tab = ref<'collection' | 'deck'>('collection')
const factionFilter = ref<Faction | null>(null)
const costFilter = ref<number | null>(null)
const zoomed = ref<Card | null>(null)

const byCost = (a: Card, b: Card) => a.cost - b.cost || a.id.localeCompare(b.id)

const filtered = computed(() =>
  collectibleCards
    .filter((c) => !factionFilter.value || c.faction === factionFilter.value)
    .filter((c) => costFilter.value === null || (costFilter.value >= 7 ? c.cost >= 7 : c.cost === costFilter.value))
    .slice()
    .sort(byCost),
)

// 起始牌組：依費用排序並合併同名卡
const deckRows = computed(() => {
  const counts = new Map<string, number>()
  for (const id of decks[PLAYER_DECK_ID] ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts.entries()].map(([id, count]) => ({ card: getCard(id), count })).sort((a, b) => byCost(a.card, b.card))
})
const deckSize = computed(() => decks[PLAYER_DECK_ID]?.length ?? 0)
const curve = computed(() => {
  const bins = COSTS.map(() => 0)
  for (const id of decks[PLAYER_DECK_ID] ?? []) bins[Math.min(7, getCard(id).cost)]! += 1
  return bins
})
const curveMax = computed(() => Math.max(1, ...curve.value))

function toggleFaction(f: Faction) {
  audio.play('sfx_ui_click')
  factionFilter.value = factionFilter.value === f ? null : f
}
function toggleCost(c: number) {
  audio.play('sfx_ui_click')
  costFilter.value = costFilter.value === c ? null : c
}
function zoom(card: Card) {
  audio.play('sfx_card_hover')
  zoomed.value = card
}
function back() {
  audio.play('sfx_ui_back')
  void router.push({ name: 'menu' })
}
</script>

<template>
  <main class="page deck">
    <button class="back btn ghost" type="button" @click="back">返回</button>
    <h1>牌組／收藏</h1>

    <div class="tabs" role="tablist">
      <button role="tab" type="button" :aria-selected="tab === 'collection'" :class="{ on: tab === 'collection' }" @click="tab = 'collection'">
        收藏
      </button>
      <button role="tab" type="button" :aria-selected="tab === 'deck'" :class="{ on: tab === 'deck' }" @click="tab = 'deck'">
        起始牌組
      </button>
    </div>

    <template v-if="tab === 'collection'">
      <div class="filters panel">
        <div class="group" role="group" aria-label="陣營篩選">
          <button
            v-for="f in FACTIONS"
            :key="f"
            type="button"
            class="chip faction"
            :class="{ on: factionFilter === f }"
            :aria-pressed="factionFilter === f"
            :style="{ '--fc': FACTION_STYLE[f].main, '--fd': FACTION_STYLE[f].dark }"
            @click="toggleFaction(f)"
          >
            <svg viewBox="0 0 24 24" :class="FACTION_STYLE[f].icon.mode" aria-hidden="true">
              <path :d="FACTION_STYLE[f].icon.d" />
            </svg>
            {{ FACTION_STYLE[f].label }}
          </button>
        </div>
        <div class="group" role="group" aria-label="費用篩選">
          <button
            v-for="c in COSTS"
            :key="c"
            type="button"
            class="chip cost"
            :class="{ on: costFilter === c }"
            :aria-pressed="costFilter === c"
            @click="toggleCost(c)"
          >
            {{ c === 7 ? '7+' : c }}
          </button>
        </div>
        <span class="count">{{ filtered.length }} 張</span>
      </div>

      <div class="grid">
        <button v-for="card in filtered" :key="card.id" type="button" class="card-btn" @click="zoom(card)">
          <CardView :card="card" size="md" />
        </button>
        <p v-if="filtered.length === 0" class="empty">沒有符合條件的卡牌</p>
      </div>
    </template>

    <section v-else class="deck-panel panel">
      <header>
        <h2>葉陣營起始牌組</h2>
        <span class="size" :class="{ short: deckSize < 30 }">{{ deckSize }} / 30</span>
      </header>
      <div class="curve" aria-label="費用曲線">
        <div v-for="(n, c) in curve" :key="c" class="bar-col">
          <span class="bar-n">{{ n }}</span>
          <div class="bar" :style="{ height: `${(n / curveMax) * 100}%` }" />
          <span class="bar-c">{{ c === 7 ? '7+' : c }}</span>
        </div>
      </div>
      <ul class="rows">
        <li v-for="row in deckRows" :key="row.card.id">
          <button type="button" class="row" @click="zoom(row.card)">
            <span class="gem">{{ row.card.cost }}</span>
            <span class="row-name" :style="{ borderColor: FACTION_STYLE[row.card.faction].main }">{{ row.card.name }}</span>
            <span class="row-count">×{{ row.count }}</span>
          </button>
        </li>
      </ul>
    </section>

    <div v-if="zoomed" class="zoom-backdrop" @click="zoomed = null">
      <div class="zoom" @click.stop>
        <CardView :card="zoomed" size="lg" />
        <aside class="kw-list">
          <div v-for="k in cardKeywords(zoomed)" :key="k.label" class="kw panel">
            <svg viewBox="0 0 24 24" :class="k.icon.mode" aria-hidden="true"><path :d="k.icon.d" /></svg>
            <div>
              <strong>{{ k.label }}</strong>
              <p>{{ k.desc }}</p>
            </div>
          </div>
          <p class="flavor panel">{{ zoomed.flavor }}</p>
          <button class="btn" type="button" @click="zoomed = null">關閉</button>
        </aside>
      </div>
    </div>
  </main>
</template>

<style scoped>
.deck {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.back {
  position: fixed;
  top: 14px;
  left: 16px;
  z-index: 40;
}
h1 {
  margin: 0;
  font-size: 36px;
  color: #fff;
  -webkit-text-stroke: 8px var(--c-lavender-deep);
  paint-order: stroke fill;
}
.tabs {
  display: inline-flex;
  background: rgba(255, 253, 247, 0.8);
  border-radius: 999px;
  padding: 4px;
}
.tabs button {
  border: none;
  background: transparent;
  min-height: 44px;
  min-width: 110px;
  border-radius: 999px;
  font-size: 17px;
  font-weight: 800;
  cursor: pointer;
}
.tabs button.on {
  background: var(--c-lavender-deep);
  color: #fff;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  align-items: center;
  padding: 12px 18px;
  width: min(1120px, 100%);
  box-sizing: border-box;
}
.group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  min-width: 44px;
  padding: 0 12px;
  border-radius: 999px;
  border: 2px solid #e2d8c8;
  background: #fffdf7;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
}
.chip svg {
  width: 20px;
  height: 20px;
  color: var(--fd);
}
.chip.faction.on {
  background: var(--fc);
  border-color: var(--fd);
}
.chip.cost {
  font-family: var(--font-num);
}
.chip.cost.on {
  background: var(--c-sky);
  border-color: #2f5f8a;
}
svg.fill path {
  fill: currentColor;
}
svg.stroke path {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.count {
  margin-left: auto;
  color: var(--c-ink-soft);
  font-size: 15px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 200px);
  justify-content: center;
  gap: 22px 18px;
  width: min(1120px, 100%);
  padding-top: 24px;
}
.card-btn {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  transition: transform 0.12s;
}
.card-btn:hover {
  transform: translateY(-6px) scale(1.03);
}
.empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--c-ink-soft);
}
.deck-panel {
  width: min(560px, 100%);
  padding: 20px 24px;
  box-sizing: border-box;
}
.deck-panel header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.deck-panel h2 {
  margin: 0;
  font-size: 22px;
}
.size {
  font-family: var(--font-num);
  font-weight: 800;
  font-size: 20px;
}
.size.short {
  color: var(--c-debuff);
}
.curve {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  height: 120px;
  margin: 14px 0;
}
.bar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}
.bar {
  width: 70%;
  min-height: 2px;
  border-radius: 6px 6px 2px 2px;
  background: var(--c-lavender);
}
.bar-n,
.bar-c {
  font-family: var(--font-num);
  font-size: 13px;
  font-weight: 800;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  border: none;
  background: #fffdf7;
  border-radius: 12px;
  padding: 4px 12px 4px 6px;
  cursor: pointer;
  text-align: left;
  font-size: 16px;
}
.row:hover {
  background: #f3edfa;
}
.gem {
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
  background: var(--c-sky);
  border: 2px solid #2f5f8a;
  display: grid;
  place-items: center;
  font-family: var(--font-num);
  font-weight: 800;
  color: #fff;
  -webkit-text-stroke: 4px #234a6e;
  paint-order: stroke fill;
}
.row-name {
  flex: 1;
  font-weight: 700;
  border-left: 6px solid;
  padding-left: 8px;
}
.row-count {
  font-family: var(--font-num);
  font-weight: 800;
}
.zoom-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(62, 53, 80, 0.45);
  display: grid;
  place-items: center;
  padding: 16px;
  overflow: auto;
}
.zoom {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  flex-wrap: wrap;
  justify-content: center;
}
.kw-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 260px;
}
.kw {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
}
.kw svg {
  flex: none;
  width: 28px;
  height: 28px;
  color: var(--c-lavender-deep);
}
.kw p {
  margin: 2px 0 0;
  font-size: 14px;
  line-height: 1.4;
}
.flavor {
  margin: 0;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--c-ink-soft);
  font-style: italic;
}
@media (max-width: 720px) {
  .grid {
    grid-template-columns: repeat(auto-fill, 150px);
  }
  .grid :deep(.card-view) {
    width: 150px !important;
  }
}
</style>
