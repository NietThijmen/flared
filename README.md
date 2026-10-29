# Flared

A local-first media downloader. Paste a link (YouTube, SoundCloud and 1000+ other sites), pick video, audio or muted video, and download. Everything runs on your machine: no accounts, no telemetry, no Flared servers.

Flared is a desktop UI (Electron + Svelte 5) around [yt-dlp](https://github.com/yt-dlp/yt-dlp) and ffmpeg.

## Privacy

Flared only talks to:

- the sites you download from, and
- GitHub (yt-dlp releases) and the ffmpeg build hosts, to install or update those tools. Turn auto-update off in Settings to skip the update check.

yt-dlp is verified against its published SHA-256 sums; the Linux/Windows ffmpeg builds are verified against the FFmpeg-Builds checksums. The macOS ffmpeg build (martin-riedl.de) publishes no checksum beside the download, so it is **not** verified.

## Development

```sh
npm install
npm run dev        # run the app (installs yt-dlp/ffmpeg into the app data dir on first launch)
npm test           # unit tests
npm run lint && npm run typecheck
FLARED_INTEGRATION=1 npm test   # also downloads real binaries and a short video
npm run build:mac  # or build:win / build:linux
```

```
src/main       Electron main: queue, yt-dlp engine, binary manager, settings, IPC
src/preload    typed contextBridge API (channels listed in src/shared/ipc.ts)
src/renderer   Svelte UI
src/shared     types and the IPC contract shared by all three
```

Notes:

- yt-dlp is always spawned with an argument array (never a shell), URLs are restricted to http(s) and passed after `--`.
- State is stored as JSON in the app data directory (`settings.json`, `jobs.json`) rather than SQLite, to avoid native module rebuilds.
- Clipboard watching (opt-in) notifies when a link is copied; with auto-download on, Flared looks the link up with yt-dlp and queues single-media links using your defaults (playlists only notify). Links already on the clipboard when watching starts are ignored.
- On macOS a menu bar item opens a small popover: paste a link (it prefills from the clipboard), pick Video/Audio/Muted, press Enter. Single media is queued with your defaults; playlists offer "Choose in Flared". Right-click the item for Open/Quit.
- "Cancel" stops a download; "Resume" re-queues it and yt-dlp continues from the partial file.

## Releases

Pushing a `v*` tag builds mac/windows/linux artifacts in CI. Builds are unsigned and mac notarization is off (`notarize: false`); set up signing secrets before distributing widely.

## Legal

Only download content you have the right to. Flared does not circumvent DRM. You are responsible for complying with the terms of the services you use.
