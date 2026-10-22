<script setup lang="ts">
// 選擇 AI 對手：每位一張直式大卡，立繪出框，名牌加陣營前綴
import PageTitle from '@/components/ui/PageTitle.vue'
import { pageTitleParts } from '@/components/ui/pageTitle'
import { characterByName } from '@/content'
import { portraitUrl, uiImageUrl } from '@/content/cardStyle'
import { FREE_OPPONENTS, type FreeOpponent } from './opponents'

defineProps<{ title: string }>()
defineEmits<{ pick: [opponent: FreeOpponent] }>()

const showDeckId = import.meta.env.DEV
const bgImage = (p: string) => {
  const u = uiImageUrl(p, true)
  return u ? `url("${u}")` : 'none'
}
const panelStyle = { borderImageSource: bgImage('panels/panel') }
const nameplateStyle = { borderImageSource: bgImage('panels/nameplate') }

const cards = FREE_OPPONENTS.map((o) => {
  const faction = characterByName(o.name)?.faction ?? 'neutral'
  const prefix = pageTitleParts({ level: 'section', faction, prefix: 'shell', divider: 'none' }).prefixPath
  return { o, figure: portraitUrl(o.portraitId), prefix: uiImageUrl(prefix, true) }
})
</script>

<template>
  <div class="picker">
    <div class="head">
      <PageTitle class="title" level="page" prefix="star" faction="common" divider="pearl">{{ title }}</PageTitle>
      <p class="sub">我方牌組：葉之新手<template v-if="showDeckId">（starter-leaf）</template></p>
    </div>
    <div class="list">
      <button
        v-for="{ o, figure, prefix } in cards"
        :key="o.deckId"
        class="opp"
        type="button"
        :aria-label="o.label"
        :data-testid="`opponent-${o.deckId}`"
        @click="$emit('pick', o)"
      >
        <span class="frame" :style="panelStyle">
          <img v-if="figure" class="figure" :src="figure" alt="" draggable="false" />
        </span>
        <span class="plate" :style="nameplateStyle">
          <img v-if="prefix" class="prefix" :src="prefix" alt="" draggable="false" />
          {{ o.label }}
        </span>
      </button>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.picker {
  --cw: clamp(180px, 19vw, 300px);
  --ch: clamp(240px, 50vh, 480px);
  --pb: 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: -48px;
  text-align: center;
}
.head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.sub {
  margin: 0;
  padding: 2px 12px;
  border-radius: 10px;
  background: rgba(255, 253, 247, 0.85);
  color: var(--c-ink-soft);
  font-size: 15px;
}
.list {
  display: flex;
  justify-content: center;
  gap: 2.4vw;
  margin-top: 4vh;
}
.opp {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: var(--cw);
  padding: 0 0 18px;
  border: 0;
  border-radius: 20px;
  background: none;
  cursor: pointer;
  transition: filter 120ms;
  -webkit-tap-highlight-color: transparent;
}
.opp:focus {
  outline: none;
}
.opp:focus-visible .frame {
  box-shadow: var(--btn-focus-ring);
}
/* hover 只加金色外光，不放大 */
@media (hover: hover) {
  .opp:hover {
    filter: drop-shadow(0 0 12px rgba(246, 227, 161, 0.95));
  }
}
.frame {
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: var(--ch);
  border-style: solid;
  border-width: var(--pb);
  border-image-slice: 128 fill;
  border-image-width: var(--pb);
  border-image-repeat: stretch;
  border-radius: 18px;
}
/* 立繪是正方形圖，可見範圍約佔 70%，放大後底部出框 */
.figure {
  flex: none;
  width: min(160%, calc(var(--ch) * 1.25));
  max-width: none;
  margin-bottom: calc(var(--pb) * -1 - 4%);
  pointer-events: none;
  filter: drop-shadow(0 8px 14px rgba(90, 78, 106, 0.22));
}
.plate {
  position: absolute;
  bottom: 0;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 0 4px 16px;
  border-style: solid;
  border-width: 0 22px;
  border-image-slice: 0 52 0 52 fill;
  border-image-width: 0 22px;
  border-image-repeat: stretch;
  white-space: nowrap;
  color: var(--c-ink);
  font-size: 18px;
  font-weight: 900;
}
.prefix {
  width: 28px;
  height: 28px;
}
@media (max-height: 500px) {
  .picker {
    --cw: 22vw;
    --ch: 58vh;
    --pb: 22px;
    margin-top: -60px;
  }
  .head {
    flex-direction: row;
    gap: 12px;
  }
  .title {
    --title-page-h: 48px;
    --title-page-fs: 24px;
    --title-page-prefix: 30px;
  }
  .title :deep(.ptitle__divider) {
    display: none;
  }
  .sub {
    font-size: 13px;
  }
  .list {
    gap: 2vw;
    margin-top: 8px;
  }
  .opp {
    padding-bottom: 14px;
  }
  .plate {
    height: 34px;
    padding: 0 0 3px 10px;
    border-width: 0 16px;
    border-image-width: 0 16px;
    font-size: 13px;
  }
  .prefix {
    width: 20px;
    height: 20px;
  }
}
@media (max-width: 720px) and (min-height: 501px) {
  .list {
    flex-wrap: wrap;
  }
  .picker {
    --cw: 42vw;
    --ch: 40vh;
  }
}
</style>
