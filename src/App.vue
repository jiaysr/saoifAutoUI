<template>
  <div class="wrap">
    <header>
      <div class="title">SAOIF 自动助手 <span class="ver">{{ store.ver }}</span></div>
      <div class="conn" :class="store.dev ? 'dev' : 'ok'">{{ store.dev ? 'DEV(本地数据)' : '已连接' }}</div>
    </header>

    <!-- 顶层分区：功能 / 设置 -->
    <div class="sections">
      <button :class="{ on: mode === 'task' }" @click="mode = 'task'">功能</button>
      <button :class="{ on: mode === 'cfg' }" @click="mode = 'cfg'">设置</button>
    </div>

    <!-- 功能：任务标签页 + schema 表单 -->
    <template v-if="mode === 'task'">
      <nav>
        <button
          v-for="t in store.tasks" :key="t.id"
          class="tab" :class="{ active: t.id === curTaskId }"
          @click="pickTask(t)"
        >{{ t.name }}</button>
      </nav>
      <section class="panel">
        <div class="card" v-if="curTask">
          <p class="desc">{{ curTask.desc }}</p>
          <div class="fields">
            <FieldRenderer
              v-for="f in (curTask.schema || [])" :key="f.key"
              :field="f" v-model="store.values[f.key]"
              @update:modelValue="(v) => onField(f.key, v)"
            />
            <p v-if="!(curTask.schema && curTask.schema.length)" class="empty">该功能无参数（使用内置默认值）</p>
          </div>
        </div>
        <p v-else class="empty">请选择一个功能</p>
      </section>
    </template>

    <!-- 设置：全局配置（同样由 schema 渲染） -->
    <section class="panel" v-else>
      <div class="card" v-for="c in store.configs" :key="c.id">
        <p class="desc"><b>{{ c.name }}</b><span v-if="c.desc"> · {{ c.desc }}</span></p>
        <div class="fields">
          <FieldRenderer
            v-for="f in (c.schema || [])" :key="f.key"
            :field="f" v-model="store.values[f.key]"
            @update:modelValue="(v) => onField(f.key, v)"
          />
        </div>
      </div>
      <p v-if="!store.configs.length" class="empty">暂无全局配置（脚本/config/ 为空）</p>
    </section>

    <div class="hint" :class="store.hint && store.hint.level" v-if="store.hint">{{ store.hint.text }}</div>

    <footer>
      <button class="ghost" @click="cancel">退出</button>
      <button class="run" :disabled="mode === 'task' && !curTaskId" @click="submit">保存并运行</button>
    </footer>

    <!-- dev: 提交内容预览（真机不显示） -->
    <div class="preview" v-if="store.submitPreview">
      <div class="preview-head">
        <span>DEV 提交内容（不会真的运行）</span>
        <button @click="store.submitPreview = null">×</button>
      </div>
      <pre>{{ store.submitPreview }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { store, emitChange, emitSubmit, onAutoTest } from './main.js'
import { api, IS_DEV } from './data/source.js'
import { sendJsErr } from './bridge.js'
import FieldRenderer from './components/FieldRenderer.vue'

const mode = ref('task')
const curTaskId = ref('')
let changeTimer = null

const curTask = computed(() => store.tasks.find(t => t.id === curTaskId.value) || null)

// init 到达后选默认功能：优先上次用的（values.func 存的是 id），否则第一个
watch(() => store.tasks, (list) => {
  if (!list || !list.length || curTaskId.value) return
  const last = store.values.func
  curTaskId.value = (last && list.some(t => t.id === last)) ? last : list[0].id
}, { immediate: true })

onMounted(() => { /* 就绪消息由 data/source.js 的 boot() 负责 */ })

function pickTask(t) {
  curTaskId.value = t.id
  store.values.func = t.id
  emitChange('func', t.id)
}

function onField(key, value) {
  clearTimeout(changeTimer)
  changeTimer = setTimeout(() => emitChange(key, value), 250)
}

function submit() { if (mode.value === 'task' && !curTaskId.value) return; emitSubmit() }
function cancel() { api.cancel() }

// 连通自检：Lua 侧调 APP.autoTest() → 模拟"改一个参数 → 保存并运行"
onAutoTest(() => {
  try {
    if (mode.value !== 'task') mode.value = 'task'
    if (!curTaskId.value && store.tasks.length) curTaskId.value = store.tasks[0].id
    store.values.func = curTaskId.value
    const fields = (curTask.value && curTask.value.schema) || []
    const f = fields.find(x => x.type === 'int' || x.type === 'number' || x.type === 'enum') || fields[0]
    if (f) {
      let v
      if (f.type === 'int' || f.type === 'number') v = Number(store.values[f.key] ?? f.min ?? 1) + (f.step || 1)
      else if (f.type === 'enum') v = (f.options || [])[((f.options || []).indexOf(store.values[f.key]) + 1) % (f.options || ['']).length]
      else if (f.type === 'bool') v = !store.values[f.key]
      else v = String(store.values[f.key] ?? '') + ''
      store.values[f.key] = v
      emitChange(f.key, v)
    }
    setTimeout(emitSubmit, 300)
    return true
  } catch (e) {
    sendJsErr('autoTest: ' + e)
    return false
  }
})
</script>
