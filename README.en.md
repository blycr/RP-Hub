# Roleplay Hub

[简体中文](./README.md) | **English**

[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)
[![Vue](https://img.shields.io/badge/Vue-3-4FC08D.svg?logo=vue.js)](https://vuejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![DaisyUI](https://img.shields.io/badge/DaisyUI-5A0EF8?logo=daisyui&logoColor=white)](https://daisyui.com/)

A local-first AI roleplay chat and character card creation web app customized from [`STA1N156/RP-Hub`](https://github.com/STA1N156/RP-Hub) (upstream baseline: `2.0.6` / `9124647`). Live site: [https://rp.blycr.xyz/](https://rp.blycr.xyz/).

> See [CHANGELOG.md](./CHANGELOG.md) for version history.

## Features

### Core App
- **Local-First Storage**: Characters, worldbooks, regex scripts, personas, and chats are stored in your browser's IndexedDB.
- **Multimodal & Memory**: Chat models read images directly; supports basic turn summaries, enhanced embedding recall (≥ 48% similarity, up to 10 memories), secondary compression, background backfill, and inline memory citations.
- **Story Branches & UI Templates**: Branching, rollback, import/export, and interactive status panels (initial UI template panels automatically re-attach on chat reset or fresh branches).
- **Tools & Compatibility**: Keyword history search, Tavily web search, RNG tool, Gemini anti-truncation (`output_reply`), and automatic Gemini input obfuscation (`read_user_input`, automatically skipped for array image payloads).
- **Built-in Tools**: Character Card Workshop (`/character/`), Novel workspace (`/novel/`), and Plaza one-click import.

### Customizations Over Upstream
- **Unlimited Providers & Multi-Protocol Routing**: Bind chat, UI template, summary, and embedding models independently by `(providerId, modelId)`. Supports `Chat Completions`, `Responses`, `OpenAI Embeddings`, and per-branch OpenCode Go sessions (`x-opencode-session`).
- **Self-Hosted Static Delivery**: Vue, marked, DOMPurify, SortableJS, localForage, and compiled Tailwind CSS are pinned and committed under `assets/vendor/` with a startup watchdog (`assets/js/boot.js`) to eliminate mobile CDN white screens.
- **Privacy Defaults**: Upstream plaintext cloud backup is intentionally omitted; remote update-check/presence polling is disabled by default.

## Quick Start

### Hosted Site

Open [https://rp.blycr.xyz/](https://rp.blycr.xyz/), configure one or more API providers under **Settings** (base URL or `/v1`, without `/chat/completions`), bind models per role, and import or create a character card.

> Direct browser requests require the target API endpoint to permit CORS for your origin.

### Local Build & Verification

Requires **Node.js >= 22**.

```bash
# Install locked dependencies
npm ci

# Rebuild assets/vendor/, run static delivery checks, and run all unit tests
npm run verify

# Serve locally over HTTP (file:// is not supported)
npx serve .
# or: python3 -m http.server 8080
```

### Mobile Slow-Network Smoke Test (Optional)

```bash
npx playwright-core install chromium
RPHUB_CHROMIUM_PATH=$(find ~/.cache/ms-playwright -path '*/chrome-linux*/chrome' -type f -print -quit) npm run test:mobile
```

## Directory Structure

```text
RP-Hub/
├── index.html                        # Main chat app entry point
├── character/index.html              # Character Card Workshop
├── novel/index.html                  # Novel workspace
├── favicon.svg
├── CNAME
├── assets/
│   ├── vendor/                       # Committed pinned vendor scripts and compiled tailwind.css
│   ├── css/
│   │   ├── styles.css
│   │   ├── tailwind-source.css
│   │   └── theme.css
│   └── js/
│       ├── boot.js                   # Startup watchdog and cache recovery UI
│       ├── tailwind-theme.js
│       ├── theme.js
│       ├── built-in-content.js       # Presets, prompts, artist styles, and announcements
│       ├── core-utils.js             # Shared helpers and card parsing
│       ├── api-utils.js              # Native HTTP/SSE client, tools, Responses, OpenCode Go
│       ├── rphub-api-adapters.js     # Protocol adapters (Chat Completions / Responses / Embeddings)
│       ├── data-services.js          # Storage, memory, context, branches, UI template state
│       ├── runtime-services.js       # Rendering, usage tracking, storage management
│       ├── presence.js               # Upstream inert file (disabled)
│       ├── update-check.js           # Upstream inert file (disabled)
│       ├── ui-components.js          # Modals, pickers, and shared UI components
│       └── app.js                    # Application entry, provider registry, and state
├── scripts/
│   ├── build-static.mjs              # Builds assets/vendor/ and compiled Tailwind CSS
│   └── check-static.mjs              # Enforces static delivery contract
├── tests/                            # Behavioral, compatibility, UI reset, budget, and mobile tests
├── gateway/                          # Optional standalone Cloudflare Worker (not loaded by site)
├── presence-server/                  # Optional upstream update-check server (disabled by default)
├── tailwind.config.cjs
├── package.json
├── CHANGELOG.md
├── LICENSE                           # CC BY-NC 4.0
├── README.en.md
└── README.md
```

## Optional Standalone Components

- **`gateway/`**: Optional controlled Cloudflare Worker source for relaying model API calls (not loaded by the static site). See [`gateway/README.md`](./gateway/README.md).
- **`presence-server/`**: Optional upstream version-check server (stores no chats or keys). See [`presence-server/README.md`](./presence-server/README.md).

## License

Licensed under **[Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](./LICENSE)**:

- **Share & Adapt**: You may copy, redistribute, and adapt the material in any medium or format.
- **Attribution**: You must give appropriate credit, link to the license, and indicate changes made.
- **NonCommercial**: **Commercial use is strictly prohibited** (paid hosting, commercial bundling, or ad monetization). Contact the original author for commercial licensing.
