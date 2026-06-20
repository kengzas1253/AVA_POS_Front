# AVA MY POS

Electron desktop app scaffolded with React, Vite, and TypeScript.

## Scripts

- `npm run dev` starts Vite and opens Electron.
- `npm run build` compiles the app into `dist/`.
- `npm run package:win` builds a Windows installer into `release/`.

## Structure

- `src/main` contains the Electron main process.
- `src/preload` exposes a safe bridge from Electron to the renderer.
- `src/renderer` contains the React renderer app.
