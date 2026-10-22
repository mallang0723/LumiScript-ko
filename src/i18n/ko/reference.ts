/**
 * LumiScript-ko — Korean translations for the Reference tab.
 *
 * Covers UI chrome, section introductions, caveats/notes, permission descriptions,
 * event fires semantics, directives, macros, sandbox hardening, and script packs.
 */

export const KO_REFERENCE: Readonly<Record<string, string>> = {
  // ── Section headers & UI chrome ──
  'Download the current reference as a Markdown file': '현재 레퍼런스를 Markdown 파일로 내려받아요',
  'Export Markdown': 'Markdown 내보내기',
  'Trigger model': '트리거 모델',
  'Lumiverse Events': 'Lumiverse 이벤트',
  'Permission Matrix': '권한 표',
  'Sandbox hardening': '샌드박스 강화',
  'LumiScript Events': 'LumiScript 이벤트',
  'Directives': '지시문',
  'LumiScript Macros': 'LumiScript 매크로',
  'Key Types': '주요 타입',
  'API Functions': 'API 함수',
  'Built-in Libraries': '내장 라이브러리',
  'Script Packs': '스크립트 팩',
  'none': '없음',
  'Event': '이벤트',
  'Group': '그룹',
  'Payload shape': '페이로드 형태',
  'Fires': '발생 시점',
  'Method': '메서드',
  'Required permissions': '필요 권한',
  'Pattern': '패턴',
  'Why': '이유',
  'Use instead': '대신 쓸 것',
  'Category': '분류',
  'Available globals': '사용 가능한 전역',
  'Payload fields': '페이로드 필드',
  'Emitted by': '보내는 곳',
  'Directive': '지시문',
  'Applies to': '적용 대상',
  'What it does': '하는 일',
  'Macro': '매크로',
  'Aliases': '별칭',
  'Returns': '반환값',
  'Description': '설명',
  'Field': '필드',
  'Type': '타입',
  'Arguments': '인수',

  // ── Markdown export chrome ──
  'Layer 1 — dispatch-time source check': '계층 1 — 디스패치 시점 소스 검사',
  'Layer 2 — runtime `globalThis` lockdown': '계층 2 — 런타임 `globalThis` 잠금',
  'Built-in types': '내장 타입',
  'LumiScript Reference': 'LumiScript 레퍼런스',
  'Exported {date}': '{date} 내보냄',

  // ── Trigger model section ──
  'LumiScript does NOT use runtime event subscription.': 'LumiScript는 런타임 이벤트 구독 방식을 쓰지 않아요.',
  "There is no {on}, no {eventsOn}, no {subscribe}, no {listen}, no {triggersOn} — and no, you don't write {eventOn} either. None of those exist. The paradigm is completely different from Node.js EventEmitter or DOM event listeners.":
    '{on}, {eventsOn}, {subscribe}, {listen}, {triggersOn} 같은 건 없고, {eventOn}처럼 작성하지도 않아요. 이런 API는 전혀 존재하지 않아요. Node.js EventEmitter나 DOM 이벤트 리스너와는 패러다임이 완전히 달라요.',
  'Event wiring is configured in the editor UI, not in the script source.': '이벤트 연결은 스크립트 소스가 아니라 편집기 UI에서 설정해요.',
  "When you create or edit a script, the event-selector control in the script editor lets you pick which Lumiverse events run this script's body. There is no script-side syntax for subscription — the wiring lives in the script's editor config, alongside its name, enabled flag, and binding.":
    '스크립트를 만들거나 편집할 때 스크립트 편집기의 이벤트 선택기에서 어떤 Lumiverse 이벤트가 이 스크립트 본문을 실행할지 골라요. 스크립트 코드 안에는 구독 문법이 전혀 없고, 이벤트 연결은 스크립트 이름, 활성화 여부, 바인딩과 함께 편집기 설정에 저장돼요.',
  'in a script header is informative only.': '스크립트 헤더의 지시문은 참고용 주석일 뿐이에요.',
  'intended': '의도',
  "It's a comment convention you may use to document which events the script is {intended} to be wired to. The host does not parse it — writing {atTriggers} has zero runtime effect. A future LumiScript version may add a programmatic-subscription API; current versions do not.":
    '이 스크립트가 어떤 이벤트에 연결되도록 {intended}했는지 적어 두는 주석 규칙일 뿐이에요. 호스트는 이를 해석하지 않으며, {atTriggers}를 적어도 런타임에는 아무 영향이 없어요. 향후 LumiScript 버전에서 코드 구독 API가 추가될 수 있지만, 현재 버전에는 없어요.',
  'script body itself runs as the handler': '스크립트 본문 자체가 핸들러로 실행돼요',
  "When a wired event fires, the {strong} — the entire body executes top-to-bottom with the event's payload available as the {data} global. No callback, no subscription object, no listener registry. {dataEvent} carries the event name (e.g. {messageSent}); the rest of {data} is the event-specific payload (see the {eventsSection} section below for per-event payload shapes).":
    '연결된 이벤트가 발생하면 {strong} — 이벤트 페이로드가 {data} 전역 변수로 전달된 상태에서 본문 전체가 위에서 아래로 실행돼요. 콜백도, 구독 객체도, 리스너 등록도 없어요. {dataEvent}에는 이벤트 이름(예: {messageSent})이 들어 있고, 나머지 {data}는 이벤트별 페이로드예요(이벤트별 페이로드 형태는 아래 {eventsSection} 절을 참고하세요).',
  'Execution isolation — every fire is a fresh function scope.': '실행 격리 — 매 실행마다 새로운 함수 스코프가 생성돼요.',
  'When a wired event fires, the host wraps your script body in a brand-new {asyncFunction} and invokes it ONCE. Module-scope {vars} declarations at the top of your body are LOCAL to that one invocation — they do NOT survive to the next fire of the same script. A pattern like {pattern} at the top followed by branching on {branch} does {not} work; the two fires share no local state. For state that needs to persist across fires:':
    '연결된 이벤트가 발생하면 호스트는 스크립트 본문을 완전히 새로운 {asyncFunction}으로 감싸고 단 한 번 호출해요. 본문 맨 위에 선언한 모듈 스코프의 {vars} 선언은 해당 1회 실행에만 속하는 로컬 변수이며, 같은 스크립트의 다음 실행까지 유지되지 않아요. 맨 위에 {pattern}을 두고 {branch}로 분기하는 패턴은 동작하지 {not}. 두 실행은 어떤 로컬 상태도 공유하지 않아요. 실행 간에 유지되어야 하는 상태는 아래 방법을 쓰세요:',
  'process-scoped, persists for the lifetime of the script-runner subprocess (i.e. until the extension reloads). Cheapest option; ideal for in-memory caches.':
    '프로세스 스코프이며, script-runner 하위 프로세스의 수명 동안(즉, 확장을 다시 불러올 때까지) 유지돼요. 비용이 가장 적게 드는 방법으로, 인메모리 캐시에 적합해요.',
  'durable JSON-serialised stores with explicit scope semantics. Survive extension reloads.':
    '명시적인 범위 의미론을 갖는 영구 JSON 직렬화 저장소예요. 확장을 다시 불러와도 유지돼요.',
  'Registered handlers ({macros}, {tools}, {processors}, …) — capture closures over the proxy and survive across fires until the script is disabled or deleted. Useful for "subscriber-only" patterns where a script registers a handler in one fire and it fires later from a different source. {broadcast} is the exception — subscriptions persist between fires too, but the next run of the owning script clears them at its start and the body re-registers, so re-firing never stacks duplicates while a fire-once script keeps them until disabled or deleted.':
    '등록된 핸들러({macros}, {tools}, {processors}, …) — 프록시의 클로저를 캡처하여 스크립트가 비활성화되거나 삭제될 때까지 실행 간에 유지돼요. 스크립트가 한 번 실행될 때 핸들러를 등록해 두고 나중에 다른 곳에서 실행되도록 하는 "구독 전용" 패턴에 유용해요. {broadcast}은 예외예요 — 구독은 실행 간에도 유지되지만, 소유 스크립트가 다음번에 실행될 때 시작 부분에서 이전 구독을 지우고 본문에서 다시 등록하므로, 다시 실행되어도 중복 리스너가 쌓이지 않고 한 번만 실행되는 스크립트는 비활성화되거나 삭제될 때까지 구독을 유지해요.',
  'Three similar-sounding systems, three different problems': '이름은 비슷하지만 서로 다른 세 가지 시스템',
  'keep them straight:': '명확히 구분해 두세요:',
  'Editor-UI event wiring': '편집기 UI 이벤트 연결',
  'lifecycle': '수명 주기',
  'react to Lumiverse host {lifecycle} events (MESSAGE_SENT, GENERATION_ENDED, CHAT_CHANGED, …). Configured per-script in the script editor.':
    'Lumiverse 호스트의 {lifecycle} 이벤트(MESSAGE_SENT, GENERATION_ENDED, CHAT_CHANGED, …)에 반응해요. 스크립트 편집기에서 스크립트별로 설정해요.',
  'script-to-script': '스크립트 간',
  'real-time {scriptToScript} pub/sub between user scripts running inside the same LumiScript extension. Use for custom in-extension messaging.':
    '동일한 LumiScript 확장 안에서 실행되는 사용자 스크립트 간의 실시간 {scriptToScript} 발행/구독(pub/sub)이에요. 확장 내 커스텀 메시지 전달에 쓰세요.',
  'persistent log': '영구 로그',
  'NOT': '아닙니다',
  '{persistentLog} of custom events ( {methods}). Use for audit trails, state-resuming scripts, custom analytics. {not} for subscribing to host events.':
    '커스텀 이벤트의 {persistentLog}({methods})예요. 감사 로그, 상태 복원 스크립트, 맞춤 분석에 쓰세요. 호스트 이벤트를 구독하는 용도가 {not}.',
  '10 per 60s window': '60초당 10회',
  'The script-runner sandbox enforces dispatch-time + runtime guards on what scripts can reach — see the {sandbox} section below for the full layer-by-layer breakdown. Unhandled rejections from a single script are rate-limited to {limit}; further rejections drop silently with a summary count on the next-window rejection.':
    'script-runner 샌드박스는 스크립트가 접근할 수 있는 영역에 대해 디스패치 시점 및 런타임 보호 조치를 적용해요. 계층별 전체 분석은 아래 {sandbox} 절을 참고하세요. 단일 스크립트에서 처리되지 않은 거부(rejection)는 {limit}로 속도가 제한되며, 초과된 거부는 조용히 삭제된 뒤 다음 시간 창의 거부 발생 시 누적 횟수가 요약 표시돼요.',

  // ── Sandbox hardening section ──
  'opt in': '선택적으로 허용',
  'The script-runner subprocess locks down host capabilities that user scripts have no business reaching. Two layers gate this — both are always on; there is no per-script opt-out. Cross-references: the {app_manipulation} and {cors_proxy}permissions in the {matrix} are how scripts {optIn} to specific surfaces that the sandbox otherwise denies.':
    'script-runner 하위 프로세스는 사용자 스크립트가 접근할 필요가 없는 호스트 기능을 차단해요. 두 개의 계층이 이를 제어하며, 둘 다 항상 켜져 있고 스크립트별로 끌 수 없어요. 참고: 샌드박스가 차단하는 특정 영역을 스크립트가 {optIn}하는 방법은 {matrix}의 {app_manipulation} 및 {cors_proxy} 권한을 확인하세요.',
  'The script-runner subprocess locks down host capabilities that user scripts have no business reaching. Two layers gate this — both are always on; there is no per-script opt-out. Cross-reference the `app_manipulation` and `cors_proxy` permissions in the **Permission Matrix** for how scripts opt in to specific surfaces that the sandbox otherwise denies.':
    'script-runner 하위 프로세스는 사용자 스크립트가 접근할 필요가 없는 호스트 기능을 차단해요. 두 개의 계층이 이를 제어하며, 둘 다 항상 켜져 있고 스크립트별로 끌 수 없어요. 샌드박스가 차단하는 특정 영역을 스크립트가 선택적으로 허용하는 방법은 **권한 표**의 `app_manipulation` 및 `cors_proxy` 권한을 참고하세요.',
  'Layer 1 — dispatch-time source check.': '계층 1 — 디스패치 시점 소스 검사.',
  'rejected before they run': '실행되기 전에 거부돼요',
  'Scripts containing any of the patterns below are {rejected}; the editor console shows a {security} entry naming the rejected pattern.':
    '아래 패턴 중 하나라도 포함된 스크립트는 {rejected}. 편집기 콘솔에는 거부된 패턴 이름을 나타내는 {security} 항목이 표시돼요.',
  'Scripts containing any of the patterns below are **rejected before they run**; the editor console shows a `[security]` entry naming the rejected pattern.':
    '아래 패턴 중 하나라도 포함된 스크립트는 **실행되기 전에 거부돼요**. 편집기 콘솔에는 거부된 패턴 이름을 나타내는 `[security]` 항목이 표시돼요.',
  'Layer 2 — runtime {globalThis} lockdown.': '계층 2 — 런타임 {globalThis} 잠금.',
  'At subprocess startup, every {globalThis} property NOT on the allowlist below is replaced with {undefinedVal}. Reading a locked global returns {undefinedVal2} (so {typeofExpr} evaluates naturally for feature-detect paths); reaching through to a method throws {typeError}.':
    '하위 프로세스가 시작될 때 아래 허용 목록에 없는 모든 {globalThis} 속성은 {undefinedVal}로 대체돼요. 잠긴 전역 변수를 읽으면 {undefinedVal2}가 반환되고(따라서 기능 감지 경로에서 {typeofExpr}가 자연스럽게 평가됨), 메서드를 호출하려고 하면 {typeError}가 발생해요.',
  "At subprocess startup, every `globalThis` property NOT on the allowlist below is replaced with `undefined`. Reading a locked global returns `undefined` (so `typeof X === 'undefined'` evaluates naturally for feature-detect paths); reaching through to a method throws `TypeError: Cannot read properties of undefined`.":
    '하위 프로세스가 시작될 때 아래 허용 목록에 없는 모든 `globalThis` 속성은 `undefined`로 대체돼요. 잠긴 전역 변수를 읽으면 `undefined`가 반환되고(따라서 기능 감지 경로에서 `typeof X === \'undefined\'`가 자연스럽게 평가됨), 메서드를 호출하려고 하면 `TypeError: Cannot read properties of undefined`가 발생해요.',
  'Notable globals that are {not} on the allowlist (representative, not exhaustive): {fetch} (use {http}), {worker}, {websocket}, {eventSource}, {broadcastChannel}, {xmlHttpRequest}, browser dialogs ({alert} / {prompt} / {confirm}), and Node-compat module globals reached via {globalThis} ({nodeMods}). The canonical list of accessible globals is {safeGlobals} in {entryPath}.':
    '허용 목록에 포함되지 {not} 주요 전역 항목(대표적인 예시이며 전부는 아님): {fetch}({http} 사용), {worker}, {websocket}, {eventSource}, {broadcastChannel}, {xmlHttpRequest}, 브라우저 대화상자({alert} / {prompt} / {confirm}), 그리고 {globalThis}를 통해 접근하는 Node 호환 모듈 전역 항목({nodeMods}). 접근 가능한 전역 항목의 정식 목록은 {entryPath}의 {safeGlobals}에 있어요.',
  'Notable globals that are *not* on the allowlist (representative, not exhaustive): `fetch` (use `api.utils.http.*`), `Worker`, `WebSocket`, `EventSource`, `BroadcastChannel`, `XMLHttpRequest`, browser dialogs (`alert` / `prompt` / `confirm`), and Node-compat module globals reached via `globalThis` (`fs`, `http`, `net`, `tls`, `vm`, `worker_threads`, `child_process`, `sqlite`, etc.). The canonical list of accessible globals is `SAFE_GLOBALS` in `src/script-runner/child-entry.ts`.':
    '허용 목록에 포함되지 *않는* 주요 전역 항목(대표적인 예시이며 전부는 아님): `fetch`(`api.utils.http.*` 사용), `Worker`, `WebSocket`, `EventSource`, `BroadcastChannel`, `XMLHttpRequest`, 브라우저 대화상자(`alert` / `prompt` / `confirm`), 그리고 `globalThis`를 통해 접근하는 Node 호환 모듈 전역 항목(`fs`, `http`, `net`, `tls`, `vm`, `worker_threads`, `child_process`, `sqlite` 등). 접근 가능한 전역 항목의 정식 목록은 `src/script-runner/child-entry.ts`의 `SAFE_GLOBALS`에 있어요.',

  // ── Sandbox rejected patterns table ──
  'Dynamic import lets scripts pull untrusted modules at runtime, bypassing every other check.':
    '동적 import를 허용하면 런타임에 신뢰할 수 없는 모듈을 가져와 모든 검사를 우회할 수 있어요.',
  "`script.require('library-name')` for inter-script libraries — see the Built-in Libraries section.":
    '스크립트 간 라이브러리 참조에는 `script.require(\'library-name\')`을 사용하세요 — 내장 라이브러리 절을 참고하세요.',
  'Bare CommonJS `require` would reach Node modules directly.':
    '단독 CommonJS `require`는 Node 모듈에 직접 접근할 수 있어요.',
  "`script.require('library-name')`. Method-style access — `obj.require(...)` — is exempt via the source check's `(?<!\\.)` lookbehind.":
    '`script.require(\'library-name\')`을 사용하세요. 메서드 형태의 접근인 `obj.require(...)`는 소스 검사의 `(?<!\\.)` 후방탐색을 통해 예외로 처리돼요.',
  'Runtime-constructed code bypasses the dispatch-time source check.':
    '런타임에 동적으로 생성된 코드는 디스패치 시점 소스 검사를 우회해요.',
  'Normal function syntax: `function foo() {}` / `const foo = () => {}`. Method-style `obj.Function(...)` is exempt.':
    '일반 함수 문법을 사용하세요: `function foo() {}` / `const foo = () => {}`. 메서드 형태의 `obj.Function(...)`는 예외로 처리돼요.',
  'Prototype-chain path that reaches the Function constructor.':
    'Function 생성자에 도달하는 프로토타입 체인 경로예요.',
  'Same as above — define functions with normal syntax.':
    '위와 동일 — 일반 문법으로 함수를 정의하세요.',
  'Direct access to the Bun runtime API.':
    'Bun 런타임 API에 직접 접근하는 경로예요.',
  '`api.utils.http.*` for HTTP, `api.files.*` (with `allowDangerous`) for filesystem.':
    'HTTP에는 `api.utils.http.*`, 파일시스템에는 `api.files.*`(`allowDangerous` 필요)을 사용하세요.',
  'Direct access to the host process (env vars, exit, signals).':
    '호스트 프로세스(환경 변수, 종료, 시그널)에 직접 접근하는 경로예요.',
  '`api.enclave.*` for secrets, the `script.*` global for self-info. No script should ever read host env vars directly.':
    '비밀값에는 `api.enclave.*`, 스크립트 자체 정보에는 `script.*` 전역을 사용하세요. 어떤 스크립트도 호스트 환경 변수를 직접 읽어서는 안 돼요.',

  // ── Sandbox accessible globals table notes ──
  'Standard ES global functions + value constants. Pure, no capability surface.':
    '표준 ES 전역 함수 및 값 상수예요. 순수 연산이며 외부 기능에 접근하지 않아요.',
  'Pure codecs and URL parsing — no I/O surface.':
    '순수 코덱 및 URL 파싱이에요 — I/O 접근 영역이 없어요.',
  'In-memory only; filesystem access still gated by `api.files.*` + `allowDangerous`.':
    '인메모리 전용이에요. 파일시스템 접근은 여전히 `api.files.*`와 `allowDangerous`로 제어돼요.',
  'Structural types only. Outbound HTTP capability is `api.utils.http.*` (requires `cors_proxy` + `allowDangerous`).':
    '구조적 타입일 뿐이에요. 외부 HTTP 기능은 `api.utils.http.*`(`cors_proxy` 및 `allowDangerous` 필요)을 사용하세요.',
  'Pure data transforms. The dangerous part of streams is what you READ FROM or PIPE TO; those endpoints are separately gated.':
    '순수 데이터 변환이에요. 스트림에서 위험한 부분은 데이터를 읽어오거나 파이프하는 대상이며, 해당 엔드포인트는 별도로 제어돼요.',
  'Random bytes + `crypto.subtle.*` for signing / encryption. Also powers `api.utils.shortId` / `uuid`.':
    '난수 바이트 및 서명/암호화를 위한 `crypto.subtle.*`이에요. `api.utils.shortId` / `uuid`의 기반이기도 해요.',
  "String-form `setTimeout('code', ms)` is rejected at the wrapper — must pass a function.":
    "문자열 형태의 `setTimeout('code', ms)`는 래퍼에서 거부되므로, 반드시 함수를 전달해야 해요.",
  'Pure data carriers, no capability.':
    '순수 데이터 전달 객체이며, 외부 기능에 접근하지 않아요.',
  "Whitelisted on architectural necessity — Zod's schema compiler and Handlebars' template compiler both invoke `new Function(...)`. The dispatch-time source check still rejects literal `new Function(...)` / `Function(...)` in user-script source as defence-in-depth.":
    "아키텍처상의 필요로 허용 목록에 포함되었어요 — Zod 스키마 컴파일러와 Handlebars 템플릿 컴파일러가 모두 `new Function(...)`을 호출해요. 심층 방어를 위해 사용자 스크립트 소스의 리터럴 `new Function(...)` / `Function(...)`은 디스패치 시점 소스 검사에서 여전히 거부돼요.",
  "Node-compat — user scripts can manipulate bytes; doesn't enable escape.":
    'Node 호환 — 사용자 스크립트에서 바이트를 조작할 수 있으며, 샌드박스 탈출을 허용하지 않아요.',
  "`ShadowRealm` is whitelisted for experimentation; within a single subprocess `MessageChannel`/`MessagePort` can't reach anything dangerous.":
    '`ShadowRealm`은 실험 목적으로 허용 목록에 포함되었어요. 단일 하위 프로세스 안에서 `MessageChannel`/`MessagePort`는 위험한 곳에 접근할 수 없어요.',
  "`navigator` is the read-only Bun metadata object (`userAgent`, `platform`, etc.) — library code feature-detects via it. `console` is per-run shadowed for capture, but kept on the allowlist so the binding exists in the brief window before the per-run preamble.":
    '`navigator`는 읽기 전용 Bun 메타데이터 객체(`userAgent`, `platform` 등)이며, 라이브러리 코드가 이를 통해 기능을 감지해요. `console`은 로그 캡처를 위해 실행마다 섀도잉되지만, 실행 전 프리앰블 이전의 짧은 순간에도 바인딩이 존재하도록 허용 목록에 유지돼요.',
  "Both have known aliasing residuals documented in the security audit response. `spindle` is the host gateway — not present on the script-runner subprocess in production (only on the backend worker); whitelisted for test-infrastructure shape. `process` is whitelisted because Spindle's subprocess runtime uses the standard process lifecycle hooks internally; user-script access to bare `process` is closed by AsyncFunction parameter shadowing (Layer 1) and the dispatch-time source check (Layer 4).":
    '둘 다 보안 감사 답변에 문서화된 알려진 에일리어싱 잔여물이 있어요. `spindle`은 호스트 게이트웨이로 프로덕션의 script-runner 하위 프로세스에는 존재하지 않고(백엔드 워커에만 있음) 테스트 인프라 형태를 위해 허용 목록에 있어요. `process`는 Spindle의 하위 프로세스 런타임이 내부적으로 표준 프로세스 수명 주기 훅을 사용하기 때문에 허용 목록에 있으며, 사용자 스크립트가 순수 `process`에 접근하는 것은 AsyncFunction 매개변수 섀도잉(계층 1) 및 디스패치 시점 소스 검사(계층 4)로 차단돼요.',

  // ── LumiScript Events section ──
  'The `ls:` prefix is reserved for LumiScript engine events. Use any other name for custom events between scripts.':
    '`ls:` 접두사는 LumiScript 엔진 이벤트용으로 예약되어 있어요. 스크립트 간 커스텀 이벤트에는 다른 이름을 쓰세요.',
  'The {ls} prefix is reserved for LumiScript engine events. Use any other name for custom events between scripts.':
    '{ls} 접두사는 LumiScript 엔진 이벤트용으로 예약되어 있어요. 스크립트 간 커스텀 이벤트에는 다른 이름을 쓰세요.',

  // ── Directives section ──
  'Runtime directives are special {directive} comments that change how the runtime treats your script. The {prefix} prefix distinguishes them from passive frontmatter tags like {desc}or {author} (read by humans + pack tooling but inert at runtime). Place anywhere at line start in the script source.':
    '런타임 지시문은 런타임이 스크립트를 처리하는 방식을 바꾸는 특수한 {directive} 주석이에요. {prefix} 접두사로 {desc}나 {author} 같은 수동적인 프론트매터 태그(사람이나 팩 도구가 읽지만 런타임에는 동작하지 않음)와 구분돼요. 스크립트 소스의 줄 시작 부분 어디에나 둘 수 있어요.',
  "Opts the script INTO automatic hot-reload after a code save. Without this directive, the script's closures stay stale until the next real trigger fire or until the user clicks the Reload button on the editor topbar. Add the directive to scripts whose module-scope code is idempotent and cheap (no expensive LLM calls, no duplicate DB writes, no leaked timers). The body re-runs end-to-end on each edit ~500ms after the autosave settles.":
    '코드 저장 후 스크립트를 자동 핫 리로드하도록 설정해요. 이 지시문이 없으면 실제 트리거가 발생하거나 사용자가 편집기 상단의 다시 불러오기 버튼을 누를 때까지 스크립트의 클로저가 이전 상태로 유지돼요. 모듈 스코프 코드가 멱등성을 띠고 비용이 적은 스크립트(비용이 큰 LLM 호출 없음, 중복 DB 쓰기 없음, 누수되는 타이머 없음)에 이 지시문을 추가하세요. 자동 저장이 완료된 후 약 500ms 뒤에 본문이 처음부터 끝까지 다시 실행돼요.',
  'Enabled trigger scripts (libraries are loaded on-demand and ignore the directive).':
    '활성화된 트리거 스크립트(라이브러리는 필요할 때 로드되므로 이 지시문을 무시해요).',

  // ── LumiScript Macros section ──
  'Character variable macros read from and write to the active character\'s store at `variables/characters/<id>.json` in user storage. They resolve to `""` when no character is active.':
    '캐릭터 변수 매크로는 사용자 저장소의 `variables/characters/<id>.json`에 있는 활성 캐릭터 저장소를 읽고 써요. 활성 캐릭터가 없으면 `""`로 평가돼요.',
  'Character variable macros read from and write to the active character\'s store at {path} in user storage. They resolve to {empty} when no character is active.':
    '캐릭터 변수 매크로는 사용자 저장소의 {path}에 있는 활성 캐릭터 저장소를 읽고 써요. 활성 캐릭터가 없으면 {empty}로 평가돼요.',
  'Push-model boolean. "true" when the LumiScript master toggle is on, "false" when off. Ideal for conditional preset blocks: {{if::{{lumiScriptActive}}}}…{{/if}}':
    '푸시 모델 불리언이에요. LumiScript 전체 활성화 토글이 켜져 있으면 "true", 꺼져 있으면 "false"를 반환해요. 조건부 프리셋 블록에 적합해요: {{if::{{lumiScriptActive}}}}…{{/if}}',
  "reads/writes the active character's variable store. Write operations are silent.":
    '활성 캐릭터의 변수 저장소를 읽거나 써요. 쓰기 작업은 아무것도 출력하지 않아요(silent).',
  'Get a character-scoped variable. Returns "" if the key is not set or there is no active character.':
    '캐릭터 범위 변수를 가져와요. 키가 설정되지 않았거나 활성 캐릭터가 없으면 ""를 반환해요.',
  'Set a character-scoped variable to value.':
    '캐릭터 범위 변수를 value로 설정해요.',
  'Add the number n to a character-scoped variable (treated as 0 if unset or non-numeric).':
    '캐릭터 범위 변수에 숫자 n을 더해요(설정되지 않았거나 숫자가 아니면 0으로 처리).',
  'Increment a character-scoped variable by 1.':
    '캐릭터 범위 변수를 1 증가시켜요.',
  'Decrement a character-scoped variable by 1.':
    '캐릭터 범위 변수를 1 감소시켜요.',
  'Returns "true" if the variable exists in the active character\'s store, "false" otherwise.':
    '활성 캐릭터의 저장소에 변수가 존재하면 "true", 그렇지 않으면 "false"를 반환해요.',
  'Delete a character-scoped variable.':
    '캐릭터 범위 변수를 삭제해요.',

  // ── Built-in Libraries section ──
  "Built-in libraries are loaded via `script.require('ls:<name>')`. Two are currently shipped: `ls:components` (DOM widget factories — all operations attributed to the calling script; injection components require `app_manipulation`, HTML builders are free) and `ls:council-prompt` (pure string helpers for replicating Lumiverse's built-in Council sidecar prompt in extension tools; no permissions required; only meaningful when the tool was invoked as part of a Council cycle).":
    "내장 라이브러리는 `script.require('ls:<name>')`로 불러와요. 현재 두 가지가 제공돼요: `ls:components`(DOM 위젯 팩토리 — 모든 작업은 호출한 스크립트의 것으로 처리됨. 주입 컴포넌트는 `app_manipulation` 필요, HTML 빌더는 무료)와 `ls:council-prompt`(확장 도구에서 Lumiverse 내장 Council 사이드카 프롬프트를 재현하기 위한 순수 문자열 헬퍼. 권한 필요 없음. 도구가 Council 사이클의 일부로 호출되었을 때만 의미가 있음).",
  "Built-in libraries are loaded via {require}. Three are currently shipped: {components} (DOM widget factories — all operations attributed to the calling script; injection components require {app_manipulation}, HTML builders are free); {council} (pure string helpers for replicating Lumiverse's built-in Council sidecar prompt in extension tools; no permissions required; only meaningful when the tool was invoked as part of a Council cycle); and {icons} (a curated ~150-icon Lucide subset as pre-serialized SVG strings, ready to drop into {iconSvg} options or DOM templates; no permissions required).":
    '내장 라이브러리는 {require}로 불러와요. 현재 세 가지가 제공돼요: {components}(DOM 위젯 팩토리 — 모든 작업은 호출한 스크립트의 것으로 처리됨. 주입 컴포넌트는 {app_manipulation} 필요, HTML 빌더는 무료); {council}(확장 도구에서 Lumiverse 내장 Council 사이드카 프롬프트를 재현하기 위한 순수 문자열 헬퍼. 권한 필요 없음. 도구가 Council 사이클의 일부로 호출되었을 때만 의미가 있음); 그리고 {icons}(사전 직렬화된 SVG 문자열로 제공되는 엄선된 약 150개의 Lucide 아이콘 세트. {iconSvg} 옵션이나 DOM 템플릿에 바로 사용할 수 있음. 권한 필요 없음).',

  // ── Script Packs section ──
  'Export': '내보내기',
  'Import': '가져오기',
  'not': '않아요',
  '**Export** — click the `↓` button in the script list header to download the currently filtered scripts as a `.lumiscript.zip` file. The pack contains a `pack.json` with script names, code, triggers, bindings, folders, and metadata. IDs, timestamps, enabled state, and the allowDangerous flag are *not* included.':
    '**내보내기** — 스크립트 목록 헤더의 `↓` 버튼을 누르면 현재 필터링된 스크립트를 `.lumiscript.zip` 파일로 내려받아요. 팩 안에는 스크립트 이름, 코드, 트리거, 바인딩, 폴더, 메타데이터가 담긴 `pack.json` 파일이 들어 있어요. ID, 타임스탬프, 활성화 상태, allowDangerous 플래그는 포함되지 *않아요*.',
  '**Import** — click the `↑` button to pick a `.lumiscript.zip`. After validation (format version, schema, 1 MB decompressed size limit, max 100 scripts per pack), a confirmation dialog shows the script list. Imported scripts are always created with `enabled: false` and `allowDangerous: false` — review and enable them manually.':
    '**가져오기** — `↑` 버튼을 눌러 `.lumiscript.zip` 파일을 선택해요. 유효성 검사(형식 버전, 스키마, 압축 해제 후 1MB 크기 제한, 팩당 최대 100개 스크립트)를 거친 뒤 확인 대화상자에 스크립트 목록이 표시돼요. 가져온 스크립트는 항상 `enabled: false` 및 `allowDangerous: false` 상태로 생성되므로, 직접 코드를 검토한 뒤 활성화하세요.',
  '{exportStrong} — click the {down} button in the script list header to download the currently filtered scripts as a {ext} file. The pack contains a {packJson} with script names, code, triggers, bindings, folders, and metadata. IDs, timestamps, enabled state, and the allowDangerous flag are {not} included.':
    '{exportStrong} — 스크립트 목록 헤더의 {down} 버튼을 누르면 현재 필터링된 스크립트를 {ext} 파일로 내려받아요. 팩 안에는 스크립트 이름, 코드, 트리거, 바인딩, 폴더, 메타데이터가 담긴 {packJson} 파일이 들어 있어요. ID, 타임스탬프, 활성화 상태, allowDangerous 플래그는 포함되지 {not}.',
  '{importStrong} — click the {up} button to pick a {ext}. After validation (format version, schema, 1 MB decompressed size limit, max 100 scripts per pack), a confirmation dialog shows the script list. Imported scripts are always created with {enabled} and {allowDangerous} — review and enable them manually.':
    '{importStrong} — {up} 버튼을 눌러 {ext} 파일을 선택해요. 유효성 검사(형식 버전, 스키마, 압축 해제 후 1MB 크기 제한, 팩당 최대 100개 스크립트)를 거친 뒤 확인 대화상자에 스크립트 목록이 표시돼요. 가져온 스크립트는 항상 {enabled} 및 {allowDangerous} 상태로 생성되므로, 직접 코드를 검토한 뒤 활성화하세요.',

  // ── Permissions table note ──
  'free tier, read-only': '무료 티어, 읽기 전용',

  // ── Lumiverse events 'fires' semantics ──
  'Per-script when the script enters the active state: at LumiScript boot (extension enable / app start) AND after the user toggles the script from disabled→enabled. Symmetric partner to `ls:teardown`. Use for tool registration, cache pre-warm, broadcast subscription setup, and other init that should run whenever the script becomes runnable. On re-enable the case body re-runs in full — bottom-of-body `api.broadcast.on(...)` calls also re-execute, re-registering the subscriptions disable\'s cleanup wiped, so the case body itself can be empty if all you need is the body firing. **Use the `if (data.__event === "ls:startup")` branch for code that should run EXCLUSIVELY on cold boot — not on every Reload click.** Common cold-boot-only patterns: seeding a default config into `api.scriptStorage`, logging a boot timestamp, one-shot migrations on persistent data. To make init code ALSO re-run on hot reload, branch on `(data.__event === "ls:startup" || data.__event === "ls:reload")`, or put it at the top of the body un-gated (the body re-runs on every fire including `ls:reload`). See `ls:reload` for the hot-reload counterpart.':
    '스크립트가 활성 상태로 진입할 때 스크립트별로 실행돼요: LumiScript 부팅 시(확장 활성화 / 앱 시작) 및 사용자가 스크립트를 비활성화→활성화로 전환한 후. `ls:teardown`의 대칭 파트너예요. 도구 등록, 캐시 사전 예열, 브로드캐스트 구독 설정 등 스크립트가 실행 가능해질 때마다 실행되어야 하는 초기화에 쓰세요. 다시 활성화할 때 케이스 본문 전체가 다시 실행되며, 본문 하단의 `api.broadcast.on(...)` 호출도 다시 실행되어 비활성화 시 정리된 구독을 다시 등록하므로, 본문 실행만 필요하다면 케이스 본문 자체는 비워 두어도 돼요. **콜드 부팅 시에만 전적으로 실행되어야 하고 다시 불러오기 버튼을 누를 때마다 실행되어서는 안 되는 코드에는 `if (data.__event === "ls:startup")` 분기를 사용하세요.** 일반적인 콜드 부팅 전용 패턴: `api.scriptStorage`에 기본 설정 시딩, 부팅 타임스탬프 기록, 영구 데이터 1회성 마이그레이션. 초기화 코드가 핫 리로드 시에도 다시 실행되게 하려면 `(data.__event === "ls:startup" || data.__event === "ls:reload")`로 분기하거나 조건문 없이 본문 맨 위에 두세요(본문은 `ls:reload`를 포함한 모든 실행 시 다시 실행됨). 핫 리로드 대응 항목은 `ls:reload`를 참고하세요.',

  'Per-script when the script is disabled or deleted. Use for cleanup of external state (dynamic world-book entries, persistent storage migrations, etc.). **NOT fired on hot reload — `ls:reload` performs the per-script state wipe silently. ls:teardown is exclusive to disable / delete.**':
    '스크립트가 비활성화되거나 삭제될 때 스크립트별로 실행돼요. 외부 상태 정리(동적 월드북 항목, 영구 저장소 마이그레이션 등)에 쓰세요. **핫 리로드 시에는 실행되지 않아요 — `ls:reload`가 스크립트별 상태 정리를 조용히 수행해요. ls:teardown은 비활성화 / 삭제 전용이에요.**',

  'After a code edit IF the script opts in via the `// @ls:reload-on-edit` directive (~500ms debounce). Body re-runs in its existing worker so registered handlers refresh their closures. Also fires on click of the editor topbar Reload button (manual — bypasses the directive check). Branch on `data.__event === "ls:reload"` to detect. **Pairs with `ls:startup` as the lifecycle distinction**: ls:startup = cold boot (extension boot OR disable→enable transition), ls:reload = hot reload (autosave-with-directive OR manual Reload button click). **Reload performs a full per-script state wipe BEFORE the body re-runs** (DOM injections, modals, float widgets, drawer tabs, input-bar actions, handler closures, broadcast subs, tools, macros, interceptors, injections) while preserving `api.scriptStorage`, `api.theme.*` contributions, and the worker\'s `script.require()` cache. So the body re-running from `ls:reload` lands into a clean slate identical to a fresh `ls:startup` fire — the only difference is `data.__event` + the presence of `data.reason` (`"autosave" | "manual"`). v1.0.0-rc.8+. **NOT in the trigger picker UI**: ls:reload is a deterministic side-effect of the Reload button OR the `@ls:reload-on-edit` directive, not a picker-checkbox subscription (parallel to the Run button, which also has no checkbox).':
    '스크립트가 `// @ls:reload-on-edit` 지시문을 통해 선택한 경우 코드 편집 후 실행돼요(~500ms 디바운스). 본문이 기존 워커에서 다시 실행되므로 등록된 핸들러가 클로저를 갱신해요. 편집기 상단의 다시 불러오기 버튼을 클릭해도 발생해요(수동 — 지시문 검사 우회). 감지하려면 `data.__event === "ls:reload"`로 분기하세요. **수명 주기 구분을 위해 `ls:startup`과 쌍을 이뤄요**: ls:startup = 콜드 부팅(확장 부팅 또는 비활성화→활성화 전환), ls:reload = 핫 리로드(지시문이 있는 자동 저장 또는 수동 다시 불러오기 버튼 클릭). **다시 불러오기는 본문이 다시 실행되기 전에 스크립트별 전체 상태를 초기화해요**(DOM 주입, 모달, 플로팅 위젯, 서랍 탭, 입력창 동작, 핸들러 클로저, 브로드캐스트 구독, 도구, 매크로, 인터셉터, 주입). 단, `api.scriptStorage`, `api.theme.*` 기여분 및 워커의 `script.require()` 캐시는 보존돼요. 따라서 `ls:reload`로 본문이 다시 실행되면 새로운 `ls:startup` 실행과 동일한 깨끗한 상태에서 시작돼요 — 유일한 차이는 `data.__event`와 `data.reason`(`"autosave" | "manual"`)의 존재 여부예요. v1.0.0-rc.8+. **트리거 선택기 UI에는 없어요**: ls:reload는 다시 불러오기 버튼이나 `@ls:reload-on-edit` 지시문의 결정론적 부수 효과이며, 선택기 체크박스 구독이 아니에요(체크박스가 없는 실행 버튼과 마찬가지예요).',

  'Fires once per **message creation** — the host emits it from the generic message-insert path, so it fires for the **user\'s send AND the assistant\'s empty streaming placeholder** created immediately after (`is_user: false`, empty `content`), plus auto-greetings and manually-added messages. **To react to the user\'s send only, guard with `if (!data.message.is_user) return;`** — `data.message.is_user` (boolean) is the discriminator; `GENERATION_ENDED` is the clean hook for *generated* assistant text. For a user send it fires **before prompt assembly** for the generation that follows — `api.chat.inject(...)` calls from the handler ARE picked up by the immediate-next generation (host emits via `queueMicrotask`; assembly runs a tick later in the macrotask queue, so the inject lands first). **`message` is the raw host `Message` record — it uses `is_user` (boolean), NOT `role`, and snake_case fields (`swipe_id`, `swipe_dates`); it is NOT the camelCase `ChatMessage` DTO from `getMessages()`.** Note: `message` does NOT carry the active character — resolve via `api.chats.get(chatId).then(c => c.characterId)` then `api.characters.get(characterId)`.':
    '**메시지 생성**당 한 번 발생해요 — 호스트가 일반 메시지 삽입 경로에서 발생시키므로, **사용자의 전송과 그 직후 생성되는 어시스턴트의 빈 스트리밍 자리표시자**(`is_user: false`, 빈 `content`), 자동 인사말 및 수동으로 추가된 메시지에 대해 모두 발생해요. **사용자의 전송에만 반응하려면 `if (!data.message.is_user) return;`으로 가드하세요** — `data.message.is_user`(불리언)가 판별자예요. `GENERATION_ENDED`는 *생성된* 어시스턴트 텍스트를 잡는 깔끔한 훅이에요. 사용자 전송의 경우 이어지는 생성을 위한 **프롬프트 조립 전**에 발생해요 — 핸들러에서 호출한 `api.chat.inject(...)`는 바로 다음 생성에 반영돼요(호스트는 `queueMicrotask`를 통해 발생시키고 조립은 매크로태스크 큐에서 한 틱 늦게 실행되므로 주입이 먼저 적용됨). **`message`는 호스트의 원시 `Message` 레코드예요 — `role`이 아니라 `is_user`(불리언)를 쓰며 스네이크 케이스 필드(`swipe_id`, `swipe_dates`)를 가져요. `getMessages()`의 카멜케이스 `ChatMessage` DTO가 아니에요.** 참고: `message`에는 활성 캐릭터가 포함되지 않아요 — `api.chats.get(chatId).then(c => c.characterId)` 후 `api.characters.get(characterId)`로 조회하세요.',

  'Twice per swipe-with-regen (initiation + completion); once for swipe-without-regen.':
    '재생성을 포함한 스와이프당 두 번(시작 + 완료), 재생성 없는 스와이프는 한 번 발생해요.',

  'At the start of a new generation, **before prompt assembly + interceptor invocation** in the same generation pipeline. `api.chat.inject(...)` calls from this handler ARE picked up by this generation. Symmetric pre-assembly hook to `MESSAGE_SENT` — use whichever fits the script flow.':
    '새 생성이 시작될 때 동일한 생성 파이프라인의 **프롬프트 조립 + 인터셉터 호출 전**에 발생해요. 이 핸들러의 `api.chat.inject(...)` 호출은 이번 생성에 반영돼요. `MESSAGE_SENT`와 대칭되는 조립 전 훅으로, 스크립트 흐름에 맞는 쪽을 사용하세요.',

  'Assistant-side message arrival — the clean hook for *generated* replies (whereas `MESSAGE_SENT` fires on every message creation, user sends included). Fires **after** the generation completes — `api.chat.inject(...)` calls from this handler are too late for the just-finished generation but WILL be picked up by the next one. Payload has no `swipeId` — look it up via `api.chat.getMessages` if needed.':
    '어시스턴트 측 메시지 도착 — *생성된* 답변을 잡는 깔끔한 훅이에요(`MESSAGE_SENT`는 사용자 전송을 포함하여 모든 메시지 생성 시 발생함). 생성이 완료된 **후**에 발생해요 — 이 핸들러의 `api.chat.inject(...)` 호출은 방금 끝난 생성에는 너무 늦지만 다음 생성에는 반영돼요. 페이로드에는 `swipeId`가 없으므로 필요한 경우 `api.chat.getMessages`를 통해 조회하세요.',

  'Once per streamed token — **high-frequency**. Deliberately NOT offered in the editor event picker (wiring a whole script body per token is rarely intended); advanced use only.':
    '스트리밍된 토큰당 한 번 발생해요 — **고빈도**. 편집기 이벤트 선택기에서는 의도적으로 제공하지 않아요(토큰당 스크립트 본문 전체를 실행하는 것은 거의 의도되지 않음). 고급 사용자 전용이에요.',

  'Chat **metadata** mutations only (rename, etc.). The primary emission carries `{ chat, changedFields }` (read the id as `chat.id`). Does NOT fire on chat open/switch — use `CHAT_SWITCHED` for that.':
    '채팅 **메타데이터** 변경에만 발생해요(이름 변경 등). 기본 페이로드는 `{ chat, changedFields }`를 전달해요(ID는 `chat.id`로 읽음). 채팅을 열거나 전환할 때는 발생하지 않아요 — 그 용도로는 `CHAT_SWITCHED`를 쓰세요.',

  'Active chat opens, switches, or closes (chatId becomes null on return-to-home). **Important — Phase-1/Phase-2 character resolution**: triggers fire during Phase 1 (chatId set sync); characterId is resolved Phase-2 ~10–15 ms later via async lookup. So `data.characterId` does NOT exist on the payload, and reading the active-context characterId at trigger-fire time can see null/stale. **Pattern**: call `api.chats.getActive()` and read `chat.characterId` — that hits the host\'s live state which has it populated regardless of Phase-2 status.':
    '활성 채팅이 열리거나 전환되거나 닫힐 때 발생해요(홈으로 돌아가면 chatId가 null이 됨). **중요 — 단계 1/단계 2 캐릭터 확인**: 트리거는 단계 1(chatId가 동기적으로 설정됨) 중에 발생하며, characterId는 약 10–15ms 후 단계 2에서 비동기 조회로 확인돼요. 따라서 페이로드에 `data.characterId`가 존재하지 않으며, 트리거 발생 시점에 활성 컨텍스트의 characterId를 읽으면 null이나 이전 값이 보일 수 있어요. **패턴**: `api.chats.getActive()`를 호출하고 `chat.characterId`를 읽으세요 — 이렇게 하면 단계 2 상태와 상관없이 값이 채워져 있는 호스트의 라이브 상태를 조회할 수 있어요.',

  'A chat was forked (branched) from a message into a new chat that shares the source character — messages up to and including the fork point are copied. `forkedChatId === chat.id`; the forked `chat.metadata` carries `branched_from` + `branch_at_message`. Use it to clone per-chat state into the fork, log lineage, or re-decorate the new chat. Emitted by the host branch-chat flow on newer Lumiverse builds.':
    '채팅이 특정 메시지에서 분기(포크)되어 원본 캐릭터를 공유하는 새 채팅으로 생성되었어요 — 분기 지점까지의 메시지가 복사돼요. `forkedChatId === chat.id`이며, 분기된 `chat.metadata`에는 `branched_from`과 `branch_at_message`가 포함돼요. 포크된 채팅에 채팅별 상태를 복제하거나 계통을 기록하거나 새 채팅을 다시 꾸미는 데 쓰세요. 최신 Lumiverse 빌드의 호스트 채팅 분기 흐름에서 발생해요.',

  'A character was created OR imported (the host emits it on card import too). `data.character` is the new character record (carries its `extensions` blob). NOTE: LumiScript itself subscribes to this internally for card-embedded-script detection; your trigger handler runs alongside that, independently.':
    '캐릭터가 생성되거나 가져와졌어요(호스트는 카드 가져오기 시에도 발생시킴). `data.character`는 새 캐릭터 레코드예요(`extensions` 블롭 포함). 참고: LumiScript 자체도 카드에 포함된 스크립트를 감지하기 위해 내부적으로 이를 구독하고 있으며, 사용자의 트리거 핸들러는 그와 병렬로 독립적으로 실행돼요.',

  'An image was saved to the user image library — manual upload OR generated/saved via api.imageGen / api.images. `data.image` is the full Image record (carries its `id`, usable with api.images.get / api.theme.extractColors / spindle.characters.setAvatar). NOTE: host docs list `{ imageId }` — that is stale; the real payload is `{ image }`.':
    '이미지가 사용자 이미지 라이브러리에 저장되었어요 — 수동 업로드 또는 api.imageGen / api.images를 통해 생성/저장됨. `data.image`는 전체 Image 레코드예요(`id`를 포함하며 api.images.get / api.theme.extractColors / spindle.characters.setAvatar에 사용 가능). 참고: 호스트 문서에는 `{ imageId }`로 나와 있지만 이전 정보이며, 실제 페이로드는 `{ image }`예요.',

  'An image was deleted from the library. `data.id` is the removed image id. (Host docs list `{ imageId }` — stale; real payload is `{ id }`.)':
    '이미지가 라이브러리에서 삭제되었어요. `data.id`는 삭제된 이미지 ID예요. (호스트 문서에는 `{ imageId }`로 나와 있지만 이전 정보이며, 실제 페이로드는 `{ id }`예요.)',

  'World Info entries were activated during prompt assembly.':
    '프롬프트 조립 중에 월드 인포 항목이 활성화되었어요.',

  'Coarse-grained: world book was created, updated, had its semantic-activation toggled, or had any of its entries mutated (entry create / update / delete / reorder / bulk-op / import). Fires alongside `WORLD_BOOK_ENTRY_CHANGED` on per-entry mutations — handlers subscribed to both see two events per change. Bulk imports suppress per-entry events and emit this once at the end.':
    '광범위한 변경: 월드북이 생성, 업데이트, 의미론적 활성화 토글되었거나 항목 중 하나가 변경되었어요(항목 생성 / 업데이트 / 삭제 / 순서 변경 / 대량 작업 / 가져오기). 항목별 변경 시 `WORLD_BOOK_ENTRY_CHANGED`와 함께 발생하므로, 둘 다 구독한 핸들러는 변경당 두 번의 이벤트를 보게 돼요. 대량 가져오기는 항목별 이벤트를 억제하고 마지막에 이 이벤트를 한 번만 발생시켜요.',

  'World book was deleted.':
    '월드북이 삭제되었어요.',

  'Entry was created or updated. Does NOT fire during bulk imports — those emit a single `WORLD_BOOK_CHANGED` for the parent book instead. Subscribe to `WORLD_BOOK_CHANGED` in addition if you need to catch imported entries.':
    '항목이 생성되거나 업데이트되었어요. 대량 가져오기 중에는 발생하지 않아요 — 대신 상위 월드북에 대한 단일 `WORLD_BOOK_CHANGED`가 발생해요. 가져온 항목을 감지해야 한다면 `WORLD_BOOK_CHANGED`도 함께 구독하세요.',

  'Entry was deleted.':
    '항목이 삭제되었어요.',

  'A Lumiverse permission was granted to or revoked from LumiScript. `granted` is the new boolean state of `permission`; `allGranted` is the full current permission list. Use to (re)initialize a feature when its permission is granted, or degrade gracefully when revoked. `extensionId` identifies which extension — filter if you only care about LumiScript\'s.':
    'LumiScript에 Lumiverse 권한이 부여되었거나 취소되었어요. `granted`는 `permission`의 새 불리언 상태이고, `allGranted`는 현재 권한 전체 목록이에요. 권한이 부여되었을 때 기능을 (재)초기화하거나 취소되었을 때 우아하게 대체 동작하도록 하는 데 쓰세요. `extensionId`는 대상 확장을 식별하므로, LumiScript의 권한에만 관심이 있다면 필터링하세요.',
};
