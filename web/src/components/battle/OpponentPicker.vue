<script setup lang="ts">
// 選擇 AI 對手
import CharacterPortrait from '@/components/CharacterPortrait.vue'
import { FREE_OPPONENTS, type FreeOpponent } from './opponents'

defineProps<{ title: string }>()
defineEmits<{ pick: [opponent: FreeOpponent] }>()
</script>

<template>
  <div class="picker panel">
    <h1>{{ title }}</h1>
    <p class="sub">我方牌組：葉之新手（starter-leaf）</p>
    <div class="list">
      <button
        v-for="o in FREE_OPPONENTS"
        :key="o.deckId"
        class="opp"
        type="button"
        :data-testid="`opponent-${o.deckId}`"
        @click="$emit('pick', o)"
      >
        <CharacterPortrait :name="o.name" :size="96" />
        <span>{{ o.label }}</span>
      </button>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.picker {
  max-width: 760px;
  margin: 0 auto;
  padding: 28px 36px;
  text-align: center;
}
h1 {
  margin: 0 0 4px;
}
.sub {
  margin: 0 0 20px;
  color: var(--c-ink-soft);
}
.list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
}
.opp {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 10px;
  border: none;
  border-radius: 20px;
  background: #fffdf7;
  box-shadow: var(--shadow);
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.1s;
}
.opp:hover {
  transform: scale(1.05);
}
</style>
