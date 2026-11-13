# RESONA

RESONA is a browser-based experimental audiovisual experience. CREATE generates procedural compositions. REMIX plays a built-in soundtrack or a local upload with an optional effects mix. Five environments and four visualizers respond to sound and pointer input. Both modes support WAV and 320 kbps MP3 export.

## Run locally

Open index.html with VS Code Live Server, or run:

```sh
node server.mjs
```

Visit http://127.0.0.1:5173. Use **CLICK TO ENTER** on the homepage or open experience.html directly. No npm install is required.

The five built-in MP3s are in assets/audio/. See the Credits page for soundtrack and software attribution. Run the full suite with `node --test tests/*.test.mjs`.

Historical reports, including [STAGE-6.md](STAGE-6.md), use the project's former name and describe earlier builds. See [M11-RESONA.md](M11-RESONA.md) for the current homepage and branding changes.
