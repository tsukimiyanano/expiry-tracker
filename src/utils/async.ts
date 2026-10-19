export const AsyncUtils = {
  /**
   * 创建串行任务队列。
   *
   * 仅保证当前运行实例内、经同一队列提交的任务按提交顺序执行；
   * 单个任务失败不阻塞后续任务，其拒绝会透传给对应 enqueue 的调用方。
   */
  createSerialQueue() {
    let tail: Promise<void> = Promise.resolve()

    return {
      enqueue<T>(task: () => T | PromiseLike<T>): Promise<T> {
        const result = tail.then(task)

        tail = result.then(
          () => undefined,
          () => undefined,
        )

        return result
      },
    }
  },
}
