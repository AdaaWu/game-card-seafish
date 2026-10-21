<script setup lang="ts">
// 潮能水晶：10 顆水滴，旁邊一定有數字
withDefaults(defineProps<{ mana: number; maxMana: number; preview?: number; small?: boolean; warn?: number }>(), {
  preview: 0,
  small: false,
  warn: 0,
})
</script>

<template>
  <div class="mana" :class="{ small }" :aria-label="`潮能 ${mana}/${maxMana}`">
    <div class="drops">
      <span
        v-for="i in 10"
        :key="i"
        class="drop"
        :class="{ full: i <= mana, locked: i > maxMana, preview: i <= mana && i > mana - preview }"
        :style="{ transitionDelay: `${i * 50}ms` }"
      />
    </div>
    <span :key="warn" class="num" :class="{ warn: warn > 0 }">{{ mana }}/{{ maxMana }}</span>
  </div>
</template>

<style scoped>
.mana {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mana.small {
  transform: scale(0.7);
  transform-origin: left center;
}
.drops {
  display: flex;
  gap: 4px;
}
.drop {
  width: 20px;
  height: 26px;
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  border: 2.5px solid #5b9bc9;
  box-sizing: border-box;
  background: transparent;
  transition: background 0.2s;
}
.drop.full {
  background: var(--c-sky);
}
.drop.locked {
  opacity: 0.35;
}
.drop.preview {
  animation: blink 0.6s ease-in-out infinite;
}
.num {
  font: 800 28px var(--font-num);
  color: #fff;
  -webkit-text-stroke: 2px var(--c-ink);
  paint-order: stroke fill;
}
.num.warn {
  color: var(--c-debuff);
  animation: wobble 0.3s;
}
@keyframes blink {
  50% {
    background: #fff;
  }
}
@keyframes wobble {
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}
</style>
