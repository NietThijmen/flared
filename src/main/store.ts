import { readFileSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Tiny JSON-file persistence with atomic, coalesced writes. */
export class JsonStore<T> {
  private pending: Promise<void> = Promise.resolve()

  constructor(
    private readonly file: string,
    private readonly fallback: () => T
  ) {}

  load(): T {
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as T
    } catch {
      return this.fallback()
    }
  }

  save(value: T): Promise<void> {
    const data = JSON.stringify(value, null, 2)
    this.pending = this.pending.then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      const tmp = `${this.file}.tmp`
      await writeFile(tmp, data)
      await rename(tmp, this.file)
    })
    return this.pending.catch(() => undefined)
  }
}
