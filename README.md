# Flared

A local-first media downloader. Paste a link (YouTube, SoundCloud and 1000+ other sites), pick video, audio or muted video, and download. Everything runs on your machine: no accounts, no telemetry, no Flared servers.

Flared is a desktop UI (Electron + Svelte 5) around [yt-dlp](https://github.com/yt-dlp/yt-dlp) and ffmpeg.

## Supported sites

These sites have first-class support: Flared recognises their links, validates them, and tunes the download for the site.

| Site        | Links                                           | Notes                                                                |
| ----------- | ----------------------------------------------- | -------------------------------------------------------------------- |
| SoundCloud  | tracks, sets, artist pages, `on.soundcloud.com` | Audio only. Artist and title are tagged from `Artist - Song` titles. |
| Bandcamp    | `/track/…` and `/album/…` (artist subdomains)   | Audio only. Tags the real track name, plus album and track number.   |
| Mixcloud    | single mixes                                    | Audio only.                                                          |
| Twitch      | clips and VODs                                  | Live channels are not matched.                                       |
| Kick        | VODs and clips                                  | Live channels are not matched.                                       |
| TikTok      | videos and `vm.`/`vt.` share links              | Photo slideshows are not matched.                                    |
| X / Twitter | posts (`/<user>/status/<id>`)                   | Only posts that contain a video.                                     |
| Instagram   | reels, posts, IGTV                              | Often needs browser cookies (Settings).                              |
| Reddit      | posts, share links, `redd.it`, `v.redd.it`      | Video and audio streams are merged.                                  |
| Vimeo       | videos and `player.vimeo.com` embeds            | Some videos need browser cookies (Settings).                         |

Audio-only sites download as audio whatever type you pick. Any other link yt-dlp understands (YouTube and [1000+ more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)) still works through the generic downloader. Flared handles video and audio only, not images or galleries.

Each site is a small module in `src/main/downloaders/` (a URL validator plus option rules) registered in `index.ts`; the shared `Downloader` interface is in `types.ts`.

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

Pushing a `v*` tag (which must match the version in `package.json`) runs the checks, builds mac/windows/linux installers in CI and publishes them as a GitHub release:

```sh
git tag v1.0.0 && git push origin v1.0.0
```

Builds are unsigned unless the optional signing secrets are set (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`). Mac notarization is also off (`notarize: false`); turn it on before distributing widely. `npm run check` runs the same typecheck, lint, format and test steps as CI.

## Legal

Only download content you have the right to. Flared does not circumvent DRM. You are responsible for complying with the terms of the services you use.
