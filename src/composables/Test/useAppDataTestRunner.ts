import { ref } from 'vue'

import { ErrorUtils } from '@/utils/error'

interface UseAppDataTestRunnerOptions {
  initialize: () => Promise<void>
  isDisabled: () => boolean
}

export function useAppDataTestRunner(options: UseAppDataTestRunnerOptions) {
  const busy = ref(false)
  const logs = ref<string[]>([])
  let testSequence = 0

  function createTestName(prefix: string): string {
    return `[测试] ${prefix}-${Date.now()}-${++testSequence}`
  }

  function log(message: string): void {
    logs.value.unshift(`${new Date().toLocaleTimeString()} ${message}`)
  }

  function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
      throw new Error(`验证失败：${message}`)
    }
  }

  async function expectFailure(
    operation: () => Promise<unknown>,
    message: string,
  ): Promise<void> {
    let failed = false

    try {
      await operation()
    } catch {
      failed = true
    }

    assert(failed, message)
  }

  async function runTest(
    name: string,
    operation: () => Promise<void>,
  ): Promise<void> {
    if (busy.value || options.isDisabled()) return

    busy.value = true
    log(`开始：${name}`)

    try {
      await options.initialize()
      await operation()
      log(`通过：${name}`)
    } catch (cause) {
      log(`失败：${name} - ${ErrorUtils.getMessage(cause)}`)
    } finally {
      busy.value = false
    }
  }

  return {
    busy,
    logs,
    createTestName,
    log,
    assert,
    expectFailure,
    runTest,
  }
}
