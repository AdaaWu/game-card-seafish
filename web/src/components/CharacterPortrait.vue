<script setup lang="ts">
// 角色頭像：缺圖時顯示陣營色塊與名字首字
import { computed, ref, watch } from 'vue'
import { characterByName } from '@/content'
import { FACTION_STYLE, portraitUrl } from '@/content/cardStyle'
import type { Faction } from '@/content/types'

const props = withDefaults(defineProps<{ name: string; faction?: Faction; size?: number }>(), {
  faction: undefined,
  size: 120,
})

const character = computed(() => characterByName(props.name))
const style = computed(() => FACTION_STYLE[props.faction ?? character.value?.faction ?? 'neutral'])
const url = computed(() => portraitUrl(character.value?.id))
const failed = ref(false)
watch(url, () => (failed.value = false))
</script>

<template>
  <div
    class="portrait"
    :style="{ width: `${size}px`, height: `${size}px`, '--main': style.main, '--dark': style.dark, '--light': style.light }"
  >
    <img v-if="url && !failed" :src="url" :alt="name" draggable="false" @error="failed = true" />
    <div v-else class="fallback" :aria-label="name">
      <svg viewBox="0 0 24 24" :class="style.icon.mode" aria-hidden="true"><path :d="style.icon.d" /></svg>
      <span :style="{ fontSize: `${size * 0.32}px` }">{{ [...name][0] }}</span>
    </div>
  </div>
</template>

<style scoped>
.portrait {
  flex: none;
  border-radius: 28%;
  background: radial-gradient(circle at 50% 40%, #fff, var(--light) 60%, var(--main));
  border: 4px solid var(--dark);
  box-sizing: border-box;
  overflow: hidden;
  box-shadow: var(--shadow);
}
img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.fallback {
  position: relative;
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--dark);
  font-weight: 900;
}
.fallback svg {
  position: absolute;
  width: 70%;
  height: 70%;
  opacity: 0.25;
}
svg.fill path {
  fill: currentColor;
}
svg.stroke path {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
}
.fallback span {
  position: relative;
}
</style>
