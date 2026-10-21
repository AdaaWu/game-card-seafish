<script setup lang="ts">
// 潮能水晶：10 顆水滴，旁邊一定有數字；深色底板維持對比
withDefaults(
  defineProps<{ mana: number; maxMana: number; preview?: number; warn?: number; drop: number; font: number }>(),
  { preview: 0, warn: 0 },
)
</script>

<template>
  <div class="mana" :style="{ '--d': `${drop}px`, '--f': `${font}px` }" :aria-label="`潮能 ${mana}/${maxMana}`">
    <div class="drops">
      <span
        v-for="i in 10"
        :key="i"
        class="drop"
        :class="{ full: i <= mana, locked: i > maxMana, preview: i <= mana && i > mana - preview }"
        :style="{ transitionDelay: `${i * 50}ms` }"
      />
    </div>
    <span :key="warn" class="num" :class="{ warn: warn > 0 }">
      <b>{{ mana }}</b><span class="slash">/</span>{{ maxMana }}
    </span>
  </div>
</template>

<style scoped>
.mana {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(46, 39, 66, 0.82);
  box-shadow:
    inset 0 0 0 2px rgba(169, 212, 236, 0.55),
    var(--shadow);
}
.drops {
  display: flex;
  gap: calc(var(--d) * 0.22);
}
.drop {
  width: var(--d);
  height: var(--d);
  margin-top: calc(var(--d) * 0.2);
  border-radius: 50% 0 50% 50%;
  transform: rotate(-45deg);
  border: 2px solid rgba(140, 196, 232, 0.55);
  box-sizing: border-box;
  background: rgba(140, 196, 232, 0.18);
  transition: background 0.2s;
}
.drop.full {
  border-color: #e8f6ff;
  background: radial-gradient(circle at 45% 35%, #fff 0 16%, #a9d4ec 40%, #5b9bc9);
  box-shadow: 0 0 6px rgba(169, 212, 236, 0.9);
}
.drop.locked {
  border-color: transparent;
  opacity: 0.15;
}
.drop.preview {
  animation: blink 0.6s ease-in-out infinite;
}
.num {
  flex: 1;
  text-align: right;
  white-space: nowrap;
  font: 800 var(--f) var(--font-num);
  line-height: 1;
  color: #fff;
}
.num b {
  font-weight: 900;
  color: #bfe6ff;
}
.slash {
  margin: 0 0.08em;
  opacity: 0.8;
}
.num.warn,
.num.warn b {
  color: #ff9a96;
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
