<template>
  <div class="wrap">
    <header>
      <div class="title">SAOIF 自动助手 <span class="ver">{{ store.ver }}</span></div>
      <div class="conn" :class="store.dev ? 'dev' : 'ok'">{{ store.dev ? 'DEV(本地数据)' : '已连接' }}</div>
    </header>

    <div class="sections">
      <button :class="{ on: mode === 'task' }" @click="mode = 'task'">功能</button>
      <button :class="{ on: mode === 'cfg' }" @click="mode = 'cfg'">设置</button>
    </div>

    <!-- 功能：任务标签页 + schema 表单（值按 task:<id>.<key> 命名空间存放） -->
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
              :field="f" v-model="store.values[pathOf(scopeOfTask(curTask), f.key)]"
              @update:modelValue="(v) => onField(f.key, v)"
            />
            <p v-if="!(curTask.schema && curTask.schema.length)" class="empty">该功能无参数（使用内置默认值）</p>
          </div>
        </div>
        <p v-else class="empty">请选择一个功能</p>
      </section>
    </template>

    <!-- 设置：全局配置（值按 cfg:<id>.<key> 命名空间存放） -->
    <section class="panel" v-else>
      <div class="card" v-for="c in store.configs" :key="c.id">
        <p class="desc"><b>{{ c.name }}</b><span v-if="c.desc"> · {{ c.desc }}</span></p>
        <div class="fields">
          <FieldRenderer
            v-for="f in (c.schema || [])" :key="f.key"
            :field="f" v-model="store.values[pathOf(scopeOfConfig(c), f.key)]"
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
import { store, emitChange, emitSubmit, onAutoTest, pathOf, scopeOfTask, scopeOfConfig } from './main.js'
import { api, IS_DEV } from './data/source.js'
import { sendJsErr } from './bridge.js'
import FieldRenderer from './components/FieldRenderer.vue'

const mode = ref('task')
const curTaskId = ref('')
let changeTimer = null

const curTask = computed(() => store.tasks.find(t => t.id === curTaskId.value) || null)

// init 到达后选默认功能（values.func 存的是任务 id）
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

// 改参数：防抖 250ms 后实时回传（扁平键 + 全量扁平值，Lua 侧照旧）
function onField(key, value) {
  clearTimeout(changeTimer)
  changeTimer = setTimeout(() => emitChange(key, value), 250)
}

function submit() { if (mode.value === 'task' && !curTaskId.value) return; emitSubmit() }

// 退出防误触：窗口刚弹出时偶发被外部触摸命中（真机实测"界面一闪而过"就是这个原因），
// 改成 1.5s 内点两次才真正退出。
let cancelArmed = 0
function cancel() {
  const now = Date.now()
  if (now - cancelArmed < 1500) { api.cancel(); return }
  cancelArmed = now
  store.hint = { level: 'warn', text: '再点一次「退出」确认关闭（防误触）' }
}

onAutoTest(() => {
  try {
    if (mode.value !== 'task') mode.value = 'task'
    if (!curTaskId.value && store.tasks.length) curTaskId.value = store.tasks[0].id
    store.values.func = curTaskId.value
    const fields = (curTask.value && curTask.value.schema) || []
    const f = fields.find(x => x.type === 'int' || x.type === 'number' || x.type === 'enum') || fields[0]
    if (f && curTask.value) {
      const p = pathOf(scopeOfTask(curTask.value), f.key)
      let v
      if (f.type === 'int' || f.type === 'number') v = Number(store.values[p] ?? f.min ?? 1) + (f.step || 1)
      else if (f.type === 'enum') { const o = f.options || ['']; v = o[(o.indexOf(store.values[p]) + 1) % o.length] }
      else if (f.type === 'bool') v = !store.values[p]
      else v = String(store.values[p] ?? '')
      store.values[p] = v
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
