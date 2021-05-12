import { asyncMapSettled } from '@xen-orchestra/async-map'

export default class Task {
  #tasks = new Map()

  constructor(app) {
    const tasks = new Map()
    this.#tasks = tasks

    app.api.addMethods({
      task: {
        *list() {
          for (const id of tasks.keys()) {
            yield { id }
          }
        },
        cancel: [
          ({ taskId }) => this.cancel(taskId),
          {
            params: {
              taskId: { type: 'string' },
            },
          },
        ],
      },
    })

    app.hooks.on('stop', () => asyncMapSettled(tasks.values(), task => task.cancel()))
  }

  async cancel(taskId) {
    await this.tasks.get(taskId).cancel()
  }

  register(task) {
    this.#tasks.set(task.id, task)
  }
}
