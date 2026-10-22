<script setup lang="ts">
// 英雄頭像、名字、生命與護甲；可被選為目標
import { computed } from 'vue'
import CharacterPortrait from '@/components/CharacterPortrait.vue'
import { assetUrls } from '@/content/assetUrls'
import { uiImageUrl } from '@/content/cardStyle'
import type { Faction, PlayerId } from '@/engine'
import { displayHp } from '@/render/battle/viewModel'

const props = defineProps<{
  pid: PlayerId
  name: string
  portraitId?: string
  faction?: Faction
  hp: number
  armor: number
  targetable: boolean
  dimmed: boolean
  size: number
  nameFont: number
}>()
defineEmits<{ pick: [] }>()

const shownHp = computed(() => displayHp(props.hp))
const url = computed(() => (props.portraitId ? (assetUrls[`portraits/${props.portraitId}.png`] ?? null) : null))
const plate = uiImageUrl('panels/nameplate', true)
const plateVar = plate ? `url("${plate}")` : 'none'
</script>

<template>
  <div
    class="hero"
    :class="[pid, { targetable, dimmed }]"
    :data-hero="pid"
    :style="{ '--p': `${size}px`, '--name': `${nameFont}px`, '--plate': plateVar }"
    @pointerdown.stop="$emit('pick')"
  >
    <div class="portrait-wrap">
      <img v-if="url" class="portrait" :src="url" :alt="name" draggable="false" />
      <CharacterPortrait v-else class="portrait" :name="name" :faction="faction" :size="size" />
      <span v-if="targetable" class="target-icon" aria-hidden="true">✦</span>
      <div class="hp-badge" :class="{ low: shownHp <= 10 }" :aria-label="`${name} 生命 ${shownHp}`">{{ shownHp }}</div>
      <div v-if="armor > 0" class="armor-badge" :aria-label="`護甲 ${armor}`">{{ armor }}</div>
    </div>
    <div class="hero-name">{{ name }}</div>
  </div>
</template>

<style scoped>
.hero {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  box-sizing: border-box;
}
.hero.p2 {
  flex-direction: column-reverse;
  justify-content: flex-end;
}
.portrait-wrap {
  position: relative;
  flex: none;
  width: var(--p);
  height: var(--p);
  border-radius: 50%;
  transition: box-shadow 0.2s;
}
.portrait {
  width: 100%;
  height: 100%;
}
img.portrait {
  display: block;
  box-sizing: border-box;
  border-radius: 50%;
  object-fit: cover;
  object-position: center top;
  background: radial-gradient(circle at 50% 40%, #fff, #e7f1f6 60%, #c9dcea);
  border: 5px solid #fffdf7;
  box-shadow:
    0 0 0 3px var(--c-ink),
    var(--shadow);
}
.portrait-wrap :deep(.portrait) {
  border-radius: 50%;
}
.targetable .portrait-wrap {
  box-shadow:
    0 0 0 6px var(--c-butter),
    0 0 26px 8px rgba(246, 227, 161, 0.9);
  animation: pulse 1.2s ease-in-out infinite;
  cursor: pointer;
}
.dimmed .portrait-wrap {
  filter: saturate(0.3);
  opacity: 0.5;
}
.target-icon {
  position: absolute;
  top: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 28px;
  color: var(--c-lavender-deep);
  text-shadow: 0 0 6px #fff;
}
.hp-badge {
  position: absolute;
  right: -12px;
  bottom: -6px;
  min-width: calc(var(--p) * 0.46);
  height: calc(var(--p) * 0.46);
  padding: 0 6px;
  box-sizing: border-box;
  border-radius: 50% 50% 50% 8px;
  background: var(--c-pink);
  border: 3px solid var(--c-ink);
  display: grid;
  place-items: center;
  font: 800 calc(var(--p) * 0.3) var(--font-num);
  color: #fff;
  -webkit-text-stroke: 2px var(--c-ink);
  paint-order: stroke fill;
}
.hp-badge.low {
  border-style: dashed;
  border-color: var(--c-debuff);
  animation: lowhp 1.6s ease-in-out infinite;
}
.armor-badge {
  position: absolute;
  left: -10px;
  bottom: -6px;
  width: calc(var(--p) * 0.36);
  height: calc(var(--p) * 0.4);
  clip-path: polygon(50% 0, 100% 18%, 100% 60%, 50% 100%, 0 60%, 0 18%);
  background: #c9c6ee;
  display: grid;
  place-items: center;
  font: 800 calc(var(--p) * 0.2) var(--font-num);
  color: #fff;
  -webkit-text-stroke: 2px var(--c-ink);
  paint-order: stroke fill;
}
/* 名牌九宮格：左端貝殼與右端圓角不拉伸 */
.hero-name {
  --nh: calc(var(--name) * 1.6);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  height: var(--nh);
  padding: 0 0.15em calc(var(--nh) * 0.06);
  border-style: solid;
  border-width: 0 calc(var(--nh) * 0.5) 0 calc(var(--nh) * 0.77);
  border-image-source: var(--plate);
  border-image-slice: 0 52 0 80 fill;
  border-image-width: 0 calc(var(--nh) * 0.5) 0 calc(var(--nh) * 0.77);
  border-image-repeat: stretch;
  font-size: var(--name);
  line-height: 1;
  font-weight: 800;
  color: var(--c-ink);
  white-space: nowrap;
}
@keyframes pulse {
  50% {
    box-shadow:
      0 0 0 6px var(--c-butter),
      0 0 10px 2px rgba(246, 227, 161, 0.6);
  }
}
/* 低血量只閃外框光暈，不縮放 */
@keyframes lowhp {
  50% {
    box-shadow: 0 0 0 5px rgba(217, 83, 79, 0.45);
  }
}
</style>
