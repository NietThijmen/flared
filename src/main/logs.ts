/** Fixed-size in-memory log of yt-dlp/ffmpeg diagnostics for the Settings screen. */
export class LogBuffer {
  private lines: string[] = []

  constructor(private readonly max = 500) {}

  push(source: string, chunk: string): void {
    for (const line of chunk.split(/\r?\n/)) {
      if (!line.trim()) continue
      this.lines.push(`${new Date().toISOString()} [${source}] ${line}`)
    }
    if (this.lines.length > this.max) this.lines.splice(0, this.lines.length - this.max)
  }

  text(): string {
    return this.lines.join('\n')
  }

  clear(): void {
    this.lines = []
  }
}
