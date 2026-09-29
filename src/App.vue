<template>
  <div class="wrap">
    <header>
      <div class="title">SAOIF 自动助手 <span class="ver">{{ store.ver }}</span></div>
      <div class="conn" :class="connClass">{{ connText }}</div>
    </header>

    <nav>
      <button
        v-for="t in store.tasks" :key="t.name"
        class="tab" :class="{ active: t.name === cur }"
        @click="cur = t.name"
      >{{ t.name }}</button>
    </nav>

    <section class="panel">
      <div class="card" v-if="curTask">
        <p class="desc">{{ curTask.desc }}</p>
        <div class="fields">
          <FieldRenderer
            v-for="f in (curTask.schema || [])" :key="f.key"
            :field="f" v-model="store.values[f.key]"
          />
          <p v-if="!(curTask.schema && curTask.schema.length)" class="empty">该功能无参数（使用内置默认值）</p>
        </div>
      </div>
      <p v-else class="empty">请选择一个功能</p>
    </section>

    <footer>
      <button class="ghost" @click="cancel">退出</button>
      <button class="run" :disabled="!cur" @click="submit">保存并运行</button>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { store } from './main.js'
import { send } from './bridge.js'
import FieldRenderer from './components/FieldRenderer.vue'

const cur = ref('')
const connected = ref(true)

const curTask = computed(() => store.tasks.find(t => t.name === cur.value) || null)
const connText = computed(() => (connected.value ? '已连接' : '未连接'))
const connClass = computed(() => (connected.value ? 'ok' : 'err'))

onMounted(() => {
  // 通知 Lua：页面就绪（Lua 收到后下发 init：ver/sid/tasks/values）
  send({ type: 'ready', sid: store.sid })
})

// init 到达后选默认功能：优先上次运行的功能(values.func)，否则第一个
import { watch } from 'vue'
watch(
  () => store.tasks,
  (list) => {
    if (cur.value || !list || !list.length) return
    const last = store.values.func
    cur.value = (last && list.some(t => t.name === last)) ? last : list[0].name
  },
  { immediate: true }
)

function submit() {
  if (!cur.value) return
  send(Object.assign(
    { type: 'submit', sid: store.sid, func: cur.value },
    JSON.parse(JSON.stringify(store.values))
  ))
}

function cancel() {
  send({ type: 'cancel', sid: store.sid })
}
</script>
