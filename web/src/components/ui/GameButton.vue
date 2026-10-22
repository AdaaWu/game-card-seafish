<!-- 共用按鈕：九宮格切片底圖，狀態只改切片、亮度與光暈 -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { uiImageUrl } from '@/content/cardStyle'
import {
  buttonAttrs,
  buttonClasses,
  buttonSlicePaths,
  canActivate,
  type ButtonFlags,
  type ButtonSize,
  type ButtonVariant,
} from './gameButton'

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant
    size?: ButtonSize
    disabled?: boolean
    loading?: boolean
    locked?: boolean
    lockedHint?: string
    type?: 'button' | 'submit' | 'reset'
  }>(),
  { variant: 'primary', size: 'md', disabled: false, loading: false, locked: false, lockedHint: '', type: 'button' },
)

const emit = defineEmits<{ click: [e: MouseEvent] }>()

const el = ref<HTMLButtonElement | null>(null)
const lockedWidth = ref<string | null>(null)

const flags = computed<ButtonFlags>(() => ({
  variant: props.variant,
  size: props.size,
  disabled: props.disabled,
  loading: props.loading,
  locked: props.locked,
}))

const classes = computed(() => buttonClasses(flags.value))
const attrs = computed(() => buttonAttrs(flags.value))

const sliceVars = computed(() => {
  const paths = buttonSlicePaths(props.variant)
  if (!paths) return {}
  const url = (p: string) => {
    const u = uiImageUrl(p, true)
    return u ? `url("${u}")` : 'none'
  }
  return {
    '--s-normal': url(paths.normal),
    '--s-hover': url(paths.hover),
    '--s-pressed': url(paths.pressed),
    '--s-disabled': url(paths.disabled),
  }
})

const lockIcon = uiImageUrl('icons/icon-lock', true)

// 進入載入前量寬度，載入期間維持
watch(
  () => props.loading,
  (on) => {
    lockedWidth.value = on && el.value ? `${el.value.offsetWidth}px` : null
  },
  { flush: 'pre' },
)

const style = computed(() => ({ ...sliceVars.value, ...(lockedWidth.value ? { minWidth: lockedWidth.value } : {}) }))

function onClick(e: MouseEvent) {
  if (!canActivate(flags.value)) return
  emit('click', e)
}
</script>

<template>
  <button
    ref="el"
    :type="type"
    :class="classes"
    :style="style"
    :disabled="attrs.disabled"
    :aria-disabled="attrs['aria-disabled']"
    :aria-busy="attrs['aria-busy']"
    @click="onClick"
  >
    <span class="gbtn__label">
      <span v-if="loading" class="gbtn__spinner" aria-hidden="true" />
      <img v-if="locked && lockIcon && variant !== 'menu'" class="gbtn__lock" :src="lockIcon" alt="" draggable="false" />
      <slot />
    </span>
    <span v-if="locked && lockedHint" class="gbtn__hint">
      <img v-if="lockIcon && variant === 'menu'" class="gbtn__lock" :src="lockIcon" alt="" draggable="false" />
      {{ lockedHint }}
    </span>
  </button>
</template>

<style scoped>
.gbtn {
  --h: var(--btn-h-md);
  --hh: max(var(--h), var(--h-min, 0px));
  --fs: var(--btn-fs-md);
  --pad: var(--btn-pad-md);
  --minw: 132px;
  position: relative;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4em;
  margin: 0;
  border: 0 solid transparent;
  background: none;
  font-family: var(--btn-font);
  font-weight: var(--btn-weight);
  font-size: var(--fs);
  line-height: 1;
  letter-spacing: var(--btn-tracking);
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: filter 120ms;
}
.gbtn:focus {
  outline: none;
}
.gbtn:focus-visible {
  box-shadow: var(--btn-focus-ring);
}
.gbtn__label {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
}

/* 尺寸 */
.gbtn--lg {
  --h: var(--btn-h-lg);
  --fs: var(--btn-fs-lg);
  --pad: var(--btn-pad-lg);
  --minw: 160px;
}
.gbtn--sm {
  --h: var(--btn-h-sm);
  --fs: var(--btn-fs-sm);
  --pad: var(--btn-pad-sm);
  --minw: 88px;
}
@media (max-height: 500px) {
  .gbtn--lg {
    --minw: 132px;
  }
  .gbtn--md {
    --minw: 88px;
  }
  .gbtn--primary {
    --h-min: 48px;
    --minw: max(88px, var(--minw));
  }
}

/* 九宮格膠囊：主要、次要、危險 */
.gbtn--primary,
.gbtn--secondary,
.gbtn--danger {
  height: var(--hh);
  min-width: var(--minw);
  padding: 0 max(4px, calc(var(--pad) - var(--hh) / 2)) calc(var(--btn-lip) / 2);
  border-radius: var(--btn-radius);
  border-style: solid;
  border-width: 0 calc(var(--hh) / 2);
  border-image-source: var(--s-normal);
  border-image-slice: 0 64 0 64 fill;
  border-image-width: 0 calc(var(--hh) / 2);
  border-image-repeat: stretch;
}
.gbtn--primary,
.gbtn--danger {
  color: var(--btn-ink-on-primary);
  text-shadow: var(--btn-text-shadow);
}
.gbtn--secondary {
  color: var(--btn-ink);
}

/* 圖示 */
.gbtn--icon {
  width: var(--btn-icon);
  height: var(--btn-icon);
  padding: 0 0 2px;
  border-radius: 50%;
  background: var(--s-normal) center / 100% 100% no-repeat;
  box-shadow: 0 3px 0 rgba(110, 95, 128, 0.25);
  color: var(--btn-primary-500);
}
.gbtn--icon :deep(svg) {
  width: 46%;
  height: 46%;
  fill: currentColor;
}
.gbtn--icon .gbtn__label {
  width: 100%;
  height: 100%;
  justify-content: center;
}

/* 主選單項目 */
.gbtn--menu {
  --hh: var(--btn-menu-h);
  height: var(--hh);
  width: min(500px, max(50vw, 280px));
  justify-content: space-between;
  padding: 0 4px 6px 8px;
  border-style: solid;
  border-width: 0 calc(var(--hh) * 0.5) 0 calc(var(--hh) * 0.9167);
  border-image-source: var(--s-normal);
  border-image-slice: 0 96 0 176 fill;
  border-image-width: 0 calc(var(--hh) * 0.5) 0 calc(var(--hh) * 0.9167);
  border-image-repeat: stretch;
  color: var(--btn-ink);
  font-weight: 900;
  font-size: clamp(19px, 2.6vh, 26px);
  letter-spacing: 0.04em;
}
.gbtn--menu:focus-visible {
  border-radius: calc(var(--hh) * 0.3);
}

/* 文字按鈕：放在背景圖上一律墊奶白底 */
.gbtn--text {
  min-width: 44px;
  min-height: 44px;
  padding: 0 12px;
  border-radius: 12px;
  background: rgba(255, 253, 247, 0.85);
  color: var(--btn-primary-500);
  font-size: var(--fs);
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 5px;
  transition: background-color 120ms;
}

/* hover：換亮一階切片加光暈；主要按鈕例外 */
@media (hover: hover) {
  .gbtn:not(.is-disabled):not(.is-locked):not(.is-loading):hover {
    border-image-source: var(--s-hover);
    filter: drop-shadow(var(--btn-glow));
  }
  /* 主要與危險按鈕沿用一般切片，只微提亮度，白字對比維持 4.5:1 以上 */
  .gbtn--primary:not(.is-disabled):not(.is-locked):not(.is-loading):hover,
  .gbtn--danger:not(.is-disabled):not(.is-locked):not(.is-loading):hover {
    filter: drop-shadow(var(--btn-glow)) brightness(1.03);
  }
  .gbtn--icon:not(.is-disabled):not(.is-locked):not(.is-loading):hover {
    background-image: var(--s-hover);
  }
  .gbtn--text:not(.is-disabled):not(.is-locked):not(.is-loading):hover {
    filter: none;
    background-color: var(--btn-primary-100);
  }
}

/* 按下：換下沉切片，文字同步下沉 */
.gbtn:not(.is-disabled):not(.is-locked):not(.is-loading):active {
  border-image-source: var(--s-pressed);
}
.gbtn--icon:not(.is-disabled):not(.is-locked):not(.is-loading):active {
  background-image: var(--s-pressed);
}
.gbtn:not(.is-disabled):not(.is-locked):not(.is-loading):active .gbtn__label {
  transform: translateY(var(--btn-press-shift));
}

/* 停用與鎖定 */
.gbtn.is-disabled,
.gbtn.is-locked {
  border-image-source: var(--s-disabled);
  color: var(--btn-disabled-ink);
  text-shadow: none;
  cursor: not-allowed;
}
.gbtn--icon.is-disabled,
.gbtn--icon.is-locked {
  background-image: var(--s-disabled);
}
.gbtn--text.is-disabled,
.gbtn--text.is-locked {
  text-decoration: none;
}
.gbtn.is-loading {
  cursor: progress;
}

.gbtn__lock {
  width: 1em;
  height: 1em;
  flex-shrink: 0;
}
.gbtn__hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: clamp(12px, 1.6vh, 15px);
  font-weight: 700;
  letter-spacing: 0;
  color: var(--btn-disabled-ink);
}

/* 載入：旋轉 spinner；減少動態時改三點透明度輪播 */
.gbtn__spinner {
  width: 0.9em;
  height: 0.9em;
  flex-shrink: 0;
  box-sizing: border-box;
  border-radius: 50%;
  border: 3px solid currentColor;
  border-top-color: transparent;
  opacity: 0.85;
  animation: gbtn-spin 0.9s linear infinite;
}
@keyframes gbtn-spin {
  to {
    transform: rotate(1turn);
  }
}
@media (prefers-reduced-motion: reduce) {
  .gbtn__spinner {
    width: 1.2em;
    height: 0.3em;
    border: 0;
    border-radius: 0;
    background: radial-gradient(circle closest-side, currentColor 90%, transparent) 0 0 / 33.3% 100% repeat-x;
    animation: gbtn-dots 1.2s steps(3) infinite !important;
    animation-duration: 1.2s !important;
    animation-iteration-count: infinite !important;
  }
}
@keyframes gbtn-dots {
  0% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
  100% {
    opacity: 0.35;
  }
}
</style>
