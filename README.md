## 한국어판 안내

**LumiScript (한국어)** 는 [mindbound/lumiscript](https://github.com/mindbound/lumiscript)의 화면 문구를 한국어로 옮긴 **비공식** 번역판이에요. 원작자(mindbound)가 관리하거나 지원하는 판이 아니므로, 이 판에서 생긴 문제는 원작 저장소가 아니라 [이 저장소](https://github.com/mallang0723/LumiScript-ko)에 알려 주세요.

- 원작: [LumiScript](https://github.com/mindbound/lumiscript) by **mindbound**
- 한국어 번역: **mallang0723**
- 라이선스: 원작과 같은 [MIT](LICENSE)예요. 저작권 표시는 원작 그대로 두었어요.

**설치:** Lumiverse의 **설정 → 확장 기능**에서 아래 주소로 설치하고, 요청하는 권한을 허용하세요.

```txt
https://github.com/mallang0723/LumiScript-ko
```

**한국어로 바뀐 것**

- 스크립트 목록·편집기·트리거·바인딩·콘솔, 설정, 저장소 살펴보기, 팩 가져오기/내보내기, 카드 스크립트 동의·묶기 창, 진단 창, 알림(토스트)과 오류 안내 등 화면 문구
- Lisa(앱 안 코드 도우미)의 채팅 화면, 그리고 Lisa의 답변(기본으로 한국어로 답해요. 코드와 `api.*` 이름은 영어 그대로예요)
- 레퍼런스 탭: 제목·버튼뿐 아니라 API 설명, 트리거 모델·샌드박스·지시문·매크로 설명, 스크립트 팩 사용법 문단과 마크다운 내보내기
- 문서: [`docs/ko/index.md`](docs/ko/index.md)에 `docs/` 전체의 한국어판이 있어요(시작하기, 개념, 가이드, 쿡북). 코드 블록은 원문 그대로예요

**영어 그대로인 것**

- Lisa가 참고하는 API 지식 자료(`src/assistant/corpus/`)와 원작 `docs/` 문서(한국어판은 `docs/ko/`)
- 문서와 레퍼런스의 코드 예시, 메서드 시그니처, 타입 이름
- 코드 식별자, `api.*` 이름, 이벤트 이름(`MESSAGE_SENT` …), 권한 ID, 지시문 이름, 스크립트에 던져지는 API 오류 메시지와 스크립트 콘솔의 `[lumiscript]` 로그
- 진단 보고서(마크다운) 파일의 틀 — 안의 검사 항목은 한국어로 나와요

**원작과 함께 쓸 때:** 확장 ID가 달라서(`lumiscript` / `lumiscript_ko`) 둘 다 설치할 수 있지만, **동시에 켜지는 마세요.** 스크립트·설정·변수·저장소는 확장마다 따로 저장되므로 원작의 스크립트는 자동으로 넘어오지 않아요. 원작에서 스크립트를 팩(`.lumiscript.zip`)으로 내보낸 뒤 한국어판에서 가져오세요. 캐릭터 카드에 묶인 스크립트(`extensions.lumiscript`)는 원작과 호환돼요. 자세한 내용은 [`docs/ko-fork.md`](docs/ko-fork.md)를 보세요.

---

![LumiScript](https://raw.githubusercontent.com/mindbound/mindbound.github.io/refs/heads/master/ls/lumiscript.png)

# LumiScript

A JavaScript scripting platform for [Lumiverse](https://github.com/prolix-oc/Lumiverse). Write scripts that react to chat events, automate behaviour, inject prompt context, and build interactive UIs — without touching Lumiverse's core code.

## Install

In Lumiverse, open **Settings → Extensions** and install from URL:

```
https://github.com/mindbound/lumiscript
```

Grant the requested Spindle permissions when prompted. The exact set depends on which APIs your scripts use — granting all of them up front is fine and easy to tighten later.

## Hello, world

Open the **LumiScript** panel from Lumiverse's dock, click **+ New Script**, and paste this in:

```javascript
// Wire the script to the MESSAGE_SENT trigger in the editor.

const messages = await api.chat.getMessages();
const latest   = messages[messages.length - 1];

console.log(`You said: ${latest.content}`);
api.ui.toast(`Got a message — ${messages.length} total in this chat`, 'success');
```

Save, send a message in any chat, and watch the toast appear. Console output shows up in the script's row in the LumiScript panel.

## What you can do

LumiScript exposes a broad surface area through the `api.*` object available to every script:

**Chat, characters, world info**
- Read, send, edit, and delete messages
- Inject content into prompt assembly with first-class visibility in the Prompt Breakdown
- Full CRUD on characters, chats, personas, world books, databanks, presets, and regex scripts
- Resolve macros (`{{user}}`, `{{char}}`, custom) with or without committing side effects

**LLM and generation**
- Call any configured connection via `api.llm.generate` / `generateStructured` / `generateWithTools`, or stream tokens with `generateStream`
- Register tools usable by Lumiverse Council and inline function-calling
- Server-side token counting with the actual provider tokenizer

**UI and DOM**
- Toasts, prompts, confirms, modals, context menus
- Sanitised DOM injection with event handlers, draggable widgets, scoped CSS
- Drawer tabs, input-bar actions, floating widgets, edge-docked panels
- Theme manipulation (CSS variables, palette-driven theming, palette extraction from images)

**Storage**
- Four-tier variable scopes (local / global / character / chat)
- Per-script JSON micro-DB with filter predicates, jsonquery, and optional Zod schema validation
- Per-script in-memory session store with admin inspector
- AES-256-GCM encrypted secret storage, plus tiered file I/O (user / shared / ephemeral)

**Images, generation, OAuth**
- Image-store CRUD and image generation against configured providers (incl. img2img / inpainting)
- OAuth callback hook — the only inbound-HTTP surface — pair with HTTP and the encrypted enclave for full token flows

**Inter-script and inter-extension**
- Real-time pub/sub broadcast bus between scripts
- Cross-extension shared RPC pool via `api.rpc.*`

**Other**
- Long-term Memory Cortex + chat-memory access (`api.memories.*`) and web search (`api.webSearch.*`)
- Persistent event tracking with replay and latest-state lookup
- HTTP requests (text or binary) through Lumiverse's CORS proxy
- Handlebars templates, UUIDs, image MIME sniffing, base64 helpers

## Where to learn more

LumiScript ships with extensive documentation — both in the repo and in-app:

- **The [`docs/`](docs/index.md) tree** — hand-written concept docs, a per-API guide for every namespace, and an end-to-end **cookbook** of runnable recipes
- **In-app Reference** — the full API surface, method signatures, type definitions, event-payload shapes, and example snippets, always current with your installed version
- **Lisa** (Settings → Assistant) — in-app code assistant that knows the entire LumiScript API. Ask her to write a script, explain an error, or look up a method
- **Trigger model** concept doc — covers the script execution model in detail; worth reading before writing your first non-trivial script

## Sandbox model

Scripts execute server-side inside a supervised Bun subprocess. DOM access is proxied through messaging — scripts can manipulate the page but can't directly touch globals like `window` or `document`. Permissions are granted at the extension level when you install LumiScript; individual risky surfaces (outbound HTTP, encrypted secrets, file I/O) additionally require a per-script `allowDangerous` toggle. As of v2.0, outbound requests to **localhost and private-network** addresses are also blocked by default — if a script talks to a local model server (Ollama, ComfyUI, LM Studio) or a LAN device, allowlist that host under Settings → Network (see [`docs/guides/network.md`](docs/guides/network.md)).

A runaway user script can't take down Lumiverse. The supervisor SIGKILLs the script-runner subprocess via a heartbeat watchdog and respawns it automatically.

**Execution engine (new in v2.0).** By default, scripts run in `AsyncFunction` sandboxes — the long-term-support engine, unchanged from earlier versions. v2.0 adds an opt-in **QuickJS-WASM isolate** engine (choose it in the LumiScript settings): user code runs in a WebAssembly VM where host globals like `Bun` and `process` don't exist, with per-script memory and CPU limits, optional per-script context isolation, and graceful teardown. AsyncFunction remains the default and is fully supported — switch engines only when you want stronger structural isolation.

## Requirements

- Lumiverse `v1.0.4` or later

## Building from source

```bash
bun install
bun run build
```

Lumiverse must be restarted (or the extension toggled off/on) to pick up new builds.

## License

[MIT](LICENSE)

## Author

[mindbound](https://github.com/mindbound)
