# H Company Agentic Layout Overlay

A Chrome (Manifest V3) extension that restyles and rearranges any web page
(Gmail, LinkedIn, etc.) in place using reusable templates. Templates are
authored with help from the H Company agent API and then replayed
deterministically on later visits ~ no agent calls, no API credits spent on
reuse.

> **Status: inception stage.** This is the initial scaffold only.

## Tech stack

- Chrome MV3 + Side Panel API
- React 18 + TypeScript (strict)
- Vite + `@crxjs/vite-plugin`
- Vitest + jsdom

## Getting started

```bash
npm install
npm run dev     # develop with HMR
npm run build   # produce the loadable extension in dist/
npm test        # run the test suite
```

Load it in the browser: `chrome://extensions` -> enable Developer mode ->
**Load unpacked** -> select the `dist/` folder -> click the toolbar icon on any
page to open the side panel.
