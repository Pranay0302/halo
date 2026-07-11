# H Company Agentic Layout Overlay

A Chrome (Manifest V3) extension that restyles and rearranges any web page
(Gmail, LinkedIn, etc.) in place using reusable templates. Templates are
authored with help from the H Company agent API, then replayed
deterministically on later visits - no agent calls, no API credits spent on
reuse.

## Features

- Restyle any page in place: hide, move, reorder, and restyle elements plus a
  scoped CSS block. Fully reversible with "Reset page".
- Built-in presets: Minimal, Dark, and Focus / Reading.
- Refine with natural language via the H Company agent (Holo models).
- Save templates per site; reuse replays them with zero agent calls.
- Export / import templates as JSON for backup.
- Local-only: templates and your API key live in the browser (chrome.storage).
  Content scripts (the web page) never see your key.

## Tech stack

- Chrome MV3 + Side Panel API
- React 18 + TypeScript (strict)
- Vite + `@crxjs/vite-plugin`
- Vitest + jsdom

## Getting started

```bash
npm install
npm run dev        # develop with HMR
npm run build      # produce the loadable extension in dist/
npm test           # run the test suite
npm run typecheck  # strict type-check
```

Load it in the browser: `chrome://extensions` -> enable Developer mode ->
**Load unpacked** -> select the `dist/` folder -> click the toolbar icon on any
page to open the side panel.

## Configure the agent

1. Create an API key in the H Company portal:
   <https://portal.hcompany.ai/api-keys>
2. Open the side panel, paste the key, and click **Save key**.

The free tier is rate-limited to 5 requests/min. The default model is
`holo3-1-35b-a3b`.

## Usage

1. Click a preset to apply it instantly (live preview on the page).
2. Optionally refine with a natural-language instruction, then **Generate** -
   the agent inspects the page and returns restyle rules.
3. **Save template** to store the current result for this site.
4. Revisit the site later and click the saved template to replay it
   deterministically (no agent call).
5. **Reset page** to restore the original layout.

## How it works

The agent authors a template once; the result is a validated, structured
`RestyleRuleSet` (ordered DOM ops plus one sanitized CSS block, no arbitrary
JS). Saved templates are replayed by a deterministic engine, so revisiting a
site spends no API credits. The side panel calls H Company's OpenAI-compatible
`/v1/chat/completions` endpoint directly; page reads and edits run through a
content script that is injected on demand so it works even on already-open tabs.
