<template>
  <label class="field">
    <span class="label">{{ field.label || field.key }}</span>

    <select
      v-if="field.type === 'enum'"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option v-for="o in (field.options || [])" :key="o" :value="o">{{ o }}</option>
    </select>

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
</template>

<script setup>
defineProps({
  field: { type: Object, required: true },
  modelValue: { default: null }
})
defineEmits(['update:modelValue'])
</script>
