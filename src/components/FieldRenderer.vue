<template>
  <label class="field">
    <span class="label">{{ field.label || field.key }}</span>

    <button
      v-if="field.type === 'enum'"
      ref="selRef"
      type="button"
      class="sel"
      @click.stop="toggle"
    >
      <span class="sel-txt">{{ modelValue == null ? '' : modelValue }}</span>
      <span class="arr">▾</span>
    </button>

    <input
      v-else-if="field.type === 'bool'"
      type="checkbox"
      :checked="!!modelValue"
      @change="$emit('update:modelValue', $event.target.checked)"
    />

    <input
      v-else-if="field.type === 'int' || field.type === 'number'"
      type="number"
      :min="field.min" :max="field.max" :step="field.step || 1"
      :value="modelValue"
      @input="$emit('update:modelValue', Number($event.target.value))"
    />

    <input
      v-else
      type="text"
      :value="modelValue == null ? '' : modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />

    <small v-if="field.tip" class="tip">{{ field.tip }}</small>
  </label>

  <!-- 原生 select 的下拉弹层在懒人精灵悬浮窗里弹不出来（无 Activity window token），
       改自绘列表：Teleport 到 body + fixed 定位，避免被 .panel 的 overflow 裁剪 -->
  <Teleport to="body">
    <div v-if="open" ref="listRef" class="dropdown" :style="posStyle" @click.stop>
      <div
        v-for="o in (field.options || [])"
        :key="o"
        class="opt"
        :class="{ on: o === modelValue }"
        @click.stop="pick(o)"
      >{{ o }}</div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue'

defineProps({
  field: { type: Object, required: true },
  modelValue: { default: null }
})
const emit = defineEmits(['update:modelValue'])

const selRef = ref(null)
const listRef = ref(null)
const open = ref(false)
const posStyle = ref({})

function close() {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onDocDown, true)
  document.removeEventListener('scroll', onDocScroll, true)
}
function onDocDown(e) {
  // 点在触发按钮上交给 toggle 处理（再点一次收起）；点在列表里是选择；其余位置关闭
  if (selRef.value && selRef.value.contains(e.target)) return
  if (listRef.value && listRef.value.contains(e.target)) return
  close()
}
function onDocScroll() { close() }

async function toggle() {
  if (open.value) { close(); return }
  const r = selRef.value.getBoundingClientRect()
  const vw = window.innerWidth
  const left = Math.max(4, Math.min(r.left, vw - r.width - 4))
  // 先隐藏渲染拿到列表实际高度，再决定弹在下还是上（面板底部空间不足时翻转）
  posStyle.value = { left: left + 'px', width: r.width + 'px', top: '-9999px' }
  open.value = true
  document.addEventListener('pointerdown', onDocDown, true)
  document.addEventListener('scroll', onDocScroll, true)
  await nextTick()
  if (!listRef.value) return
  const h = listRef.value.offsetHeight
  const vh = window.innerHeight
  let top = r.bottom + 4
  if (top + h > vh - 4) top = Math.max(4, r.top - h - 4)
  posStyle.value = { left: left + 'px', width: r.width + 'px', top: top + 'px' }
}

function pick(o) {
  emit('update:modelValue', o)
  close()
}

onBeforeUnmount(close)
</script>
