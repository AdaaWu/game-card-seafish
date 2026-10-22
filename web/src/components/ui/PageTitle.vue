<!-- 共用標題組：前綴裝飾、底飾、標題文字、分隔線 -->
<script setup lang="ts">
import { computed } from 'vue'
import { uiImageUrl } from '@/content/cardStyle'
import { pageTitleParts, type TitleDivider, type TitleFaction, type TitleLevel, type TitlePrefix } from './pageTitle'

const props = withDefaults(
  defineProps<{
    level?: TitleLevel
    faction?: TitleFaction
    prefix?: TitlePrefix
    divider?: TitleDivider
  }>(),
  { level: 'page', faction: 'common', prefix: 'shell', divider: 'none' },
)

const parts = computed(() => pageTitleParts(props))
const prefixUrl = computed(() => uiImageUrl(parts.value.prefixPath, true))
const underlay = computed(() => {
  const u = uiImageUrl(parts.value.underlayPath, true)
  return u ? { borderImageSource: `url("${u}")` } : {}
})
const dividerStyle = computed(() => {
  const u = parts.value.dividerPath ? uiImageUrl(parts.value.dividerPath, true) : undefined
  return u ? { backgroundImage: `url("${u}")` } : null
})
</script>

<template>
  <div class="ptitle" :class="`ptitle--${level}`">
    <div class="ptitle__row" :style="underlay">
      <img v-if="prefixUrl" class="ptitle__prefix" :src="prefixUrl" alt="" draggable="false" />
      <component :is="parts.tag" class="ptitle__text"><slot /></component>
    </div>
    <div v-if="dividerStyle" class="ptitle__divider" :style="dividerStyle" aria-hidden="true" />
  </div>
</template>

<style scoped>
.ptitle {
  --th: var(--title-page-h);
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  max-width: 100%;
}
.ptitle__row {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  max-width: 100%;
  height: var(--th);
  padding: 0 calc(var(--th) * 0.76) calc(var(--th) * 0.1);
  border-style: solid;
  border-width: 0 calc(var(--th) * 1.3);
  border-image-slice: 0 230 0 230 fill;
  border-image-width: 0 calc(var(--th) * 1.3);
  border-image-repeat: stretch;
}
.ptitle__prefix {
  width: var(--title-page-prefix);
  height: var(--title-page-prefix);
  flex-shrink: 0;
}
.ptitle__text {
  margin: 0;
  white-space: nowrap;
  font-family: var(--font-ui);
  font-weight: 900;
  font-size: var(--title-page-fs);
  line-height: 1;
  letter-spacing: 0.04em;
  color: #fff;
  -webkit-text-stroke: 7px var(--title-stroke);
  paint-order: stroke fill;
}
.ptitle__divider {
  width: 72%;
  min-width: 192px;
  height: 24px;
  background-repeat: repeat-x;
  background-size: 96px 24px;
  background-position: center;
}

.ptitle--section {
  --th: var(--title-section-h);
}
.ptitle--section .ptitle__row {
  padding: 0 calc(var(--th) * 0.58) calc(var(--th) * 0.08);
  border-width: 0 calc(var(--th) * 0.58);
  border-image-slice: 0 60 0 60 fill;
  border-image-width: 0 calc(var(--th) * 0.58);
  gap: 8px;
}
.ptitle--section .ptitle__prefix {
  width: var(--title-section-prefix);
  height: var(--title-section-prefix);
}
.ptitle--section .ptitle__text {
  font-size: var(--title-section-fs);
  color: var(--c-ink);
  -webkit-text-stroke: 0;
}
</style>
