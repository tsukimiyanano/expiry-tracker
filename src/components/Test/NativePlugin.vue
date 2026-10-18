<script setup lang="ts">
import { ref } from 'vue'
import {
  BaseDirectory,
  readTextFile,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'
import { Button } from 'vant'

const FILE_NAME = 'items.json'
const BASE_DIR = BaseDirectory.AppData

interface TestData {
  message: string
  timestamp: string
}

const fileResult = ref('')
const clipboardResult = ref('')
const notificationResult = ref('')
const busy = ref(false)

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// 1. 文件写入
async function testFileWrite() {
  busy.value = true

  try {
    const data: TestData = {
      message: 'Tauri Android FS Test',
      timestamp: new Date().toISOString(),
    }

    await writeTextFile(FILE_NAME, JSON.stringify(data, null, 2), {
      baseDir: BASE_DIR,
    })

    fileResult.value = '写入成功：\n' + JSON.stringify(data, null, 2)
  } catch (error) {
    fileResult.value = '写入失败：' + errorMessage(error)
  } finally {
    busy.value = false
  }
}

// 2. 文件读取
async function testFileRead() {
  busy.value = true

  try {
    const content = await readTextFile(FILE_NAME, {
      baseDir: BASE_DIR,
    })

    const data: TestData = JSON.parse(content)

    if (
      typeof data.message !== 'string' ||
      typeof data.timestamp !== 'string'
    ) {
      throw new Error('文件数据结构不符合预期')
    }

    fileResult.value = '读取成功：\n' + JSON.stringify(data, null, 2)
  } catch (error) {
    fileResult.value = '读取失败：' + errorMessage(error)
  } finally {
    busy.value = false
  }
}

// 3. 剪贴板
async function testClipboard() {
  try {
    const content = '来自 Tauri Android App 的测试文本'

    await writeText(content)

    clipboardResult.value = '复制成功，请前往其他 App 粘贴'
  } catch (error) {
    clipboardResult.value = '复制失败：' + errorMessage(error)
  }
}

// 4. 通知权限
async function testNotificationPermission() {
  try {
    let granted = await isPermissionGranted()

    if (!granted) {
      const result = await requestPermission()
      granted = result === 'granted'
    }

    notificationResult.value = granted ? '通知权限已授予' : '通知权限未授予'
  } catch (error) {
    notificationResult.value = '权限检查失败：' + errorMessage(error)
  }
}

// 5. 发送通知
async function testNotification() {
  try {
    const granted = await isPermissionGranted()

    if (!granted) {
      notificationResult.value = '请先申请通知权限'
      return
    }

    sendNotification({
      title: 'Tauri Android 测试',
      body: '这是一条来自 Tauri 的本地通知',
    })

    notificationResult.value = '已调用发送通知接口，请检查 Android 通知栏'
  } catch (error) {
    notificationResult.value = '通知调用失败：' + errorMessage(error)
  }
}
</script>

<template>
  <div class="native-test">
    <h3>Tauri 原生插件测试</h3>

    <section>
      <h4>文件系统</h4>
      <Button
        type="primary"
        size="small"
        :loading="busy"
        @click="testFileWrite"
      >
        写入文件
      </Button>

      <Button
        size="small"
        :loading="busy"
        @click="testFileRead"
        style="margin-left: 8px"
      >
        读取文件
      </Button>

      <pre>{{ fileResult }}</pre>
    </section>

    <section>
      <h4>剪贴板</h4>
      <Button type="primary" size="small" @click="testClipboard">
        复制文本
      </Button>

      <pre>{{ clipboardResult }}</pre>
    </section>

    <section>
      <h4>Android 通知</h4>
      <Button size="small" @click="testNotificationPermission">
        申请权限
      </Button>

      <Button
        type="primary"
        size="small"
        @click="testNotification"
        style="margin-left: 8px"
      >
        发送通知
      </Button>

      <pre>{{ notificationResult }}</pre>
    </section>
  </div>
</template>

<style scoped>
.native-test {
  padding: 16px;
}

section {
  margin: 20px 0;
}

pre {
  margin-top: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 12px;
}
</style>
