<!-- 開發用元件展示頁 /#/ui-kit：列出 GameButton 與 PageTitle 的所有組合 -->
<script setup lang="ts">
import { ref } from 'vue'
import GameButton from './GameButton.vue'
import PageTitle from './PageTitle.vue'
import type { ButtonSize } from './gameButton'
import type { TitleFaction, TitlePrefix } from './pageTitle'

const sizes: ButtonSize[] = ['lg', 'md', 'sm']
const sliced = [
  { variant: 'primary', label: '開始' },
  { variant: 'secondary', label: '取消' },
  { variant: 'danger', label: '放棄對戰' },
  { variant: 'text', label: '重看開場' },
] as const
const prefixes: TitlePrefix[] = ['shell', 'leaf', 'star']
const factions: TitleFaction[] = ['common', 'neutral', 'leaf', 'tide', 'frost', 'light']

const last = ref('尚未點擊')
function hit(name: string) {
  last.value = name
}
</script>

<template>
  <main class="page kit">
    <PageTitle level="page" prefix="star" divider="pearl">元件展示</PageTitle>
    <p class="note" role="status" data-testid="kit-last">最後觸發：{{ last }}（停用與載入中不觸發，鎖定會觸發）</p>

    <section class="block">
      <PageTitle level="section" prefix="shell">按鈕：變體 x 尺寸 x 狀態</PageTitle>
      <p class="note">hover、按下、鍵盤聚焦請直接用滑鼠與 Tab 操作</p>
      <div class="grid">
        <span />
        <span class="head">一般</span>
        <span class="head">停用</span>
        <span class="head">載入中</span>
        <span class="head">鎖定</span>
        <template v-for="b in sliced" :key="b.variant">
          <template v-for="s in sizes" :key="s">
            <span class="head">{{ b.variant }} {{ s }}</span>
            <div><GameButton :variant="b.variant" :size="s" @click="hit(`${b.variant} ${s}`)">{{ b.label }}</GameButton></div>
            <div><GameButton :variant="b.variant" :size="s" disabled @click="hit('停用')">停用</GameButton></div>
            <div><GameButton :variant="b.variant" :size="s" loading @click="hit('載入中')">處理中</GameButton></div>
            <div><GameButton :variant="b.variant" :size="s" locked @click="hit(`鎖定 ${b.variant} ${s}`)">鎖定</GameButton></div>
          </template>
        </template>
        <span class="head">icon</span>
        <div>
          <GameButton variant="icon" aria-label="設定" @click="hit('icon 設定')">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill-rule="evenodd"
                d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10.3 2h3.4l.5 2.6 2 .9 2.2-1.5 2.4 2.4-1.5 2.2.9 2 2.6.5v3.4l-2.6.5-.9 2 1.5 2.2-2.4 2.4-2.2-1.5-2 .9-.5 2.6h-3.4l-.5-2.6-2-.9-2.2 1.5-2.4-2.4 1.5-2.2-.9-2L2 13.7v-3.4l2.6-.5.9-2L4 5.6 6.4 3.2l2.2 1.5 2-.9z"
              />
            </svg>
          </GameButton>
        </div>
        <div>
          <GameButton variant="icon" aria-label="關閉" disabled>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6.4 4.9 12 10.6l5.6-5.7 1.5 1.5-5.7 5.6 5.7 5.6-1.5 1.5-5.6-5.7-5.6 5.7-1.5-1.5 5.7-5.6-5.7-5.6z" />
            </svg>
          </GameButton>
        </div>
        <div>
          <GameButton variant="icon" aria-label="載入中" loading />
        </div>
        <div>
          <GameButton variant="icon" aria-label="鎖定" locked @click="hit('icon 鎖定')" />
        </div>
      </div>
    </section>

    <section class="block">
      <PageTitle level="section" prefix="leaf">主選單項目</PageTitle>
      <div class="menu-col">
        <GameButton variant="menu" @click="hit('menu 劇情模式')">劇情模式</GameButton>
        <GameButton variant="menu" locked locked-hint="完成第 1 場後開放" @click="hit('menu 鎖定')">自由對戰</GameButton>
        <GameButton variant="menu" disabled>停用</GameButton>
        <GameButton variant="menu" loading>載入中</GameButton>
      </div>
    </section>

    <section class="block">
      <PageTitle level="section" prefix="star">頁標：前綴 x 陣營</PageTitle>
      <div class="titles">
        <template v-for="p in prefixes" :key="p">
          <PageTitle v-for="f in factions" :key="`${p}-${f}`" level="page" :prefix="p" :faction="f">{{ p }} {{ f }}</PageTitle>
        </template>
      </div>
    </section>

    <section class="block">
      <PageTitle level="section" prefix="shell">分隔線與區塊標題</PageTitle>
      <div class="titles">
        <PageTitle level="page" prefix="shell" divider="pearl">珍珠線</PageTitle>
        <PageTitle level="page" prefix="leaf" divider="seagrass">海草線</PageTitle>
        <PageTitle level="page" prefix="star" divider="none">無分隔線</PageTitle>
      </div>
      <div class="titles">
        <PageTitle v-for="f in factions" :key="f" level="section" prefix="shell" :faction="f">第 1 章　{{ f }}</PageTitle>
        <PageTitle level="section" prefix="leaf" faction="leaf" divider="seagrass">區塊加海草線</PageTitle>
      </div>
    </section>
  </main>
</template>

<style scoped>
.kit {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  padding-bottom: 80px;
}
.block {
  width: min(1200px, 100%);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4);
  box-sizing: border-box;
  border-radius: var(--radius);
  background: rgba(251, 246, 236, 0.78);
}
.note {
  margin: 0;
  padding: 4px 10px;
  border-radius: 8px;
  background: rgba(255, 253, 247, 0.85);
  font-size: 14px;
  font-weight: 700;
  color: var(--c-ink);
}
.grid {
  display: grid;
  grid-template-columns: 120px repeat(4, minmax(0, 1fr));
  gap: var(--space-3) var(--space-4);
  align-items: center;
  width: 100%;
  overflow-x: auto;
}
.head {
  font-size: 14px;
  font-weight: 700;
  color: var(--c-ink);
}
.menu-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.titles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-5);
}
</style>
