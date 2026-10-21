<script setup lang="ts">
// 英雄頭像、生命與護甲；可被選為目標
import CharacterPortrait from '@/components/CharacterPortrait.vue'
import type { Faction, PlayerId } from '@/engine'

defineProps<{
  pid: PlayerId
  name: string
  faction?: Faction
  hp: number
  armor: number
  targetable: boolean
  dimmed: boolean
}>()
defineEmits<{ pick: [] }>()
</script>

<template>
  <div class="hero" :class="[pid, { targetable, dimmed }]" :data-hero="pid" @pointerdown.stop="$emit('pick')">
    <div class="portrait-wrap">
      <CharacterPortrait :name="name" :faction="faction" :size="128" />
      <span v-if="targetable" class="target-icon" aria-hidden="true">✦</span>
    </div>
    <div class="hp-badge" :class="{ low: hp <= 10 }" :aria-label="`${name} 生命 ${hp}`">{{ hp }}</div>
    <div v-if="armor > 0" class="armor-badge" :aria-label="`護甲 ${armor}`">{{ armor }}</div>
    <div class="hero-name">{{ name }}</div>
  </div>
</template>

<style scoped>
.hero {
  position: absolute;
  width: 160px;
  height: 160px;
  display: grid;
  place-items: center;
}
.portrait-wrap {
  position: relative;
  border-radius: 34px;
  transition: box-shadow 0.2s;
}
.targetable .portrait-wrap {
  box-shadow:
    0 0 0 5px var(--c-butter),
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
  right: -6px;
  bottom: -4px;
  min-width: 64px;
  height: 64px;
  padding: 0 6px;
  box-sizing: border-box;
  border-radius: 50% 50% 50% 8px;
  transform: rotate(0deg);
  background: var(--c-pink);
  border: 3px solid var(--c-ink);
  display: grid;
  place-items: center;
  font: 800 40px var(--font-num);
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
  left: -6px;
  bottom: -4px;
  width: 48px;
  height: 52px;
  clip-path: polygon(50% 0, 100% 18%, 100% 60%, 50% 100%, 0 60%, 0 18%);
  background: #c9c6ee;
  display: grid;
  place-items: center;
  font: 800 26px var(--font-num);
  color: #fff;
  -webkit-text-stroke: 2px var(--c-ink);
  paint-order: stroke fill;
}
.hero-name {
  position: absolute;
  top: 100%;
  margin-top: -2px;
  font-size: 16px;
  font-weight: 700;
  color: var(--c-ink-soft);
  white-space: nowrap;
}
.hero.p2 .hero-name {
  top: auto;
  bottom: 100%;
}
@keyframes pulse {
  50% {
    box-shadow:
      0 0 0 5px var(--c-butter),
      0 0 10px 2px rgba(246, 227, 161, 0.6);
  }
}
@keyframes lowhp {
  50% {
    transform: scale(1.08);
  }
}
</style>
