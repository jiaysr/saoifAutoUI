<template>
  <label class="field">
    <span class="label">{{ field.label || field.key }}</span>

    <!-- 数字：步进器（触屏 ± 调节，也可直接输入） -->
    <van-stepper
      v-if="field.type === 'int' || field.type === 'number'"
      :model-value="modelValue"
      :min="field.min" :max="field.max" :step="field.step || 1"
      :integer="field.type === 'int'"
      @update:model-value="(v) => $emit('update:modelValue', v)"
    />

    <!-- 布尔：开关 -->
    <van-switch
      v-else-if="field.type === 'bool'"
      size="22px"
      :model-value="!!modelValue"
      @update:model-value="(v) => $emit('update:modelValue', v)"
    />

    <!-- 枚举：只读字段 + 自绘 Picker（悬浮窗里原生 select 弹层不可用） -->
    <van-field
      v-else-if="field.type === 'enum'"
      class="picker-field"
      readonly
      is-link
      input-align="right"
      :model-value="modelValue == null ? '' : String(modelValue)"
      @click="open = true"
    />

    <!-- 文本 -->
    <van-field
      v-else
      class="text-field"
      :model-value="modelValue == null ? '' : String(modelValue)"
      @update:model-value="(v) => $emit('update:modelValue', v)"
    />

    <small v-if="field.tip" class="tip">{{ field.tip }}</small>
  </label>

  <!-- 枚举选择弹层：Picker 自绘，teleport 到 body 避免 .panel 裁剪 -->
  <van-popup v-model:show="open" position="bottom" round teleport="body">
    <van-picker
      v-model="pickValues"
      :columns="pickColumns"
      :title="field.label || field.key"
      :visible-item-count="pickerRows"
      @confirm="onPick"
      @cancel="open = false"
    />
  </van-popup>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { default: null }
})
const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const pickValues = ref([])
// 横屏（CSS 高约 295）时减少可见行数让弹层放得下；旋转重建页面后自动重算
const pickerRows = window.innerHeight < 400 ? 3 : 5

// 必须 give PickerOption 对象格式：Vant 4.10 的 Picker 对字符串列做 'children' in item
// 检查会抛 TypeError（Cannot use 'in' operator），导致面板渲染中断只剩遮罩
const pickColumns = computed(() =>
  (props.field.options || []).map(o => ({ text: String(o), value: o }))
)

// 打开时把当前值同步给 picker
watch(open, (v) => {
  if (v) pickValues.value = props.modelValue == null ? [] : [props.modelValue]
})

function onPick({ selectedOptions }) {
  if (selectedOptions.length) emit('update:modelValue', selectedOptions[0].value)
  open.value = false
}
</script>
