// LumiScript-ko — Korean catalog: components/LumiScriptPanel.tsx, components/settings/
// Key = exact English source string; value = Korean. See src/i18n/ko.ts.

export const KO_PANEL: Readonly<Record<string, string>> = {
  // ── components/LumiScriptPanel.tsx — tabs ──
  'Manage': '관리',
  'Status': '상태',
  'Storage': '저장소',
  'manage tab': '관리 탭',
  'status tab': '상태 탭',
  'storage tab': '저장소 탭',
  '[Console output truncated at {n} entries. Clear the console to resume capture.]':
    '[콘솔 출력이 {n}개 항목에서 잘렸어요. 콘솔을 지우면 다시 기록해요.]',

  // ── components/LumiScriptPanel.tsx — Status tab ──
  'Not yet run this session': '이번 세션에서 아직 실행되지 않았어요',
  'Running…': '실행 중…',
  'Last run succeeded': '마지막 실행 성공',
  'Last run failed': '마지막 실행 실패',
  'Scripts': '스크립트',
  'No enabled trigger scripts': '활성화된 트리거 스크립트가 없어요',
  'Fired {n} times this session': '이번 세션에서 {n}번 실행됐어요',
  'Fired {n} time this session': '이번 세션에서 {n}번 실행됐어요',
  'no events selected — choose events in the editor': '선택한 이벤트 없음 — 편집기에서 이벤트를 고르세요',
  'Active Tools': '활성 도구',
  'No tools registered': '등록된 도구가 없어요',
  'Available in Council': 'Council에서 쓸 수 있어요',
  'Unregister tool {name}': '도구 {name} 등록 해제',
  'Unregister "{name}" from Lumiverse.\nThe owning script is not disabled — the next script edit/enable will re-register declaratively-defined tools.':
    'Lumiverse에서 "{name}" 도구 등록을 해제해요.\n이 도구를 가진 스크립트는 비활성화되지 않아요 — 다음에 스크립트를 편집하거나 활성화하면 선언적으로 정의된 도구가 다시 등록돼요.',
  'Active Injections': '활성 주입',
  'No injections active': '활성 주입이 없어요',
  'Post-assembly intercept': '조립 후 인터셉트',
  'Pre-assembly context': '조립 전 컨텍스트',
  'Insert before last {n} messages': '마지막 메시지 {n}개 앞에 삽입해요',
  'Insert before last {n} message': '마지막 메시지 {n}개 앞에 삽입해요',
  'Ephemeral — clears after next generation': '일회성 — 다음 생성이 끝나면 지워져요',

  // ── components/common/PromptDialog.tsx ──
  'Cancel (Esc)': '취소 (Esc)',

  // ── components/settings/SettingsPanel.tsx — header / counts ──
  'Master Enable': '전체 활성화',
  'Libraries': '라이브러리',

  // ── Script Execution ──
  'Script Execution': '스크립트 실행',
  'Engine': '엔진',
  'Which sandbox engine runs script bodies + handler fires. AsyncFunction is the default. QuickJS is an experimental WASM isolate with stronger sandboxing — behaviourally faithful to AsyncFunction bar one documented divergence (a script invoking its OWN tool). Switching engines reloads all active scripts so their handlers re-register under the new engine.':
    '스크립트 본문과 핸들러 실행에 쓸 샌드박스 엔진이에요. 기본값은 AsyncFunction이에요. QuickJS는 샌드박스가 더 강한 실험적 WASM 격리 환경으로, 문서화된 차이 하나(스크립트가 자기 자신의 도구를 호출하는 경우)를 빼면 AsyncFunction과 똑같이 동작해요. 엔진을 바꾸면 활성 스크립트를 모두 다시 불러와 핸들러를 새 엔진에 다시 등록해요.',
  'Script engine': '스크립트 엔진',
  'Default engine': '기본 엔진',
  'QuickJS (experimental isolate)': 'QuickJS (실험적 격리)',
  'Stronger WASM sandbox isolation': '더 강한 WASM 샌드박스 격리',
  'Isolation': '격리',
  "QuickJS engine only — disabled while AsyncFunction is selected, which runs every script in one shared sandbox (shown here as 'Shared context'). 'Shared context' runs every script in one QuickJS context (default). 'Per-script isolation' gives each script its own context — its own globalThis and library instances — so one script cannot observe or poison another's sandbox. Switching respawns the QuickJS worker(s) and reloads all active scripts.":
    "QuickJS 엔진 전용이에요. AsyncFunction을 선택한 동안에는 비활성화돼요 — AsyncFunction은 모든 스크립트를 공유 샌드박스 하나에서 실행해요(여기서는 '공유 컨텍스트'로 표시). '공유 컨텍스트'는 모든 스크립트를 QuickJS 컨텍스트 하나에서 실행해요(기본값). '스크립트별 격리'는 스크립트마다 고유한 컨텍스트(자체 globalThis와 라이브러리 인스턴스)를 줘서, 한 스크립트가 다른 스크립트의 샌드박스를 엿보거나 오염시킬 수 없어요. 바꾸면 QuickJS 워커를 다시 띄우고 활성 스크립트를 모두 다시 불러와요.",
  'Script context isolation': '스크립트 컨텍스트 격리',
  'Shared context': '공유 컨텍스트',
  'One sandbox for all scripts (default)': '모든 스크립트가 샌드박스 하나를 공유 (기본값)',
  'Per-script isolation': '스크립트별 격리',
  'Each script in its own sandbox': '스크립트마다 별도 샌드박스',
  'Timeout (s)': '제한 시간 (초)',
  'Async execution timeout. If a script does not complete within this period it is aborted with a timeout error.':
    '비동기 실행 제한 시간이에요. 이 시간 안에 끝나지 않은 스크립트는 시간 초과 오류로 중단돼요.',
  'Console history': '콘솔 기록',
  'Maximum console log entries kept per script. Older entries are dropped once this cap is reached.':
    '스크립트마다 보관할 콘솔 로그 항목의 최대 개수예요. 이 한도에 다다르면 오래된 항목부터 버려요.',
  'Stream buffer': '스트림 버퍼',
  "QuickJS engine only. Max chunks buffered for a single api.llm.generateStream that is not being consumed fast enough (or at all) — once this many chunks are queued undrained, the stream is cancelled with an error so it can't grow without limit.":
    'QuickJS 엔진 전용이에요. 충분히 빨리(또는 전혀) 소비되지 않는 api.llm.generateStream 하나에 쌓아 둘 최대 청크 수예요 — 소비되지 않은 청크가 이만큼 쌓이면 끝없이 커지지 않도록 스트림을 오류와 함께 취소해요.',

  // ── Network ──
  'Network': '네트워크',
  'Allowed private hosts': '허용된 사설 호스트',
  'Hosts that outbound HTTP may reach directly, bypassing the private-address block. By default every request goes through an SSRF-safe proxy that blocks loopback / LAN / link-local addresses. Only fixed addresses are accepted: an IP literal or localhost, optionally with a port. Omit the port to allow any port on that host, or include one to scope to a single port. This list lives in your settings and is never writable by a script.':
    '외부 HTTP가 사설 주소 차단을 우회해 직접 접속할 수 있는 호스트예요. 기본적으로 모든 요청은 루프백 / LAN / 링크 로컬 주소를 막는 SSRF 안전 프록시를 거쳐요. 고정 주소만 받아요: IP 리터럴이나 localhost, 필요하면 포트까지. 포트를 생략하면 그 호스트의 모든 포트를, 포트를 적으면 그 포트 하나만 허용해요. 이 목록은 내 설정에 저장되며 스크립트는 바꿀 수 없어요.',
  'None — every request uses the SSRF-safe path.': '없음 — 모든 요청이 SSRF 안전 경로를 거쳐요.',
  'Remove {host}': '{host} 제거',
  'Add': '추가',
  'Examples: localhost, localhost:11434, 192.168.1.50, [::1]:8080': '예: localhost, localhost:11434, 192.168.1.50, [::1]:8080',
  'Enter an IP address or localhost, optionally with a port — e.g. localhost:11434, 192.168.1.50, or [::1]:8080.':
    'IP 주소나 localhost를 입력하세요. 포트를 붙여도 돼요 — 예: localhost:11434, 192.168.1.50, [::1]:8080.',

  // ── Workers ──
  'Workers': '워커',
  'Worker count': '워커 수',
  "Number of concurrent script-runner worker subprocesses. Larger values distribute scripts across more processes for better fault isolation, at the cost of more memory (~50-100 MB per worker at idle). Capped at 16 by the host (Spindle's MAX_BACKEND_PROCESSES).":
    '동시에 돌릴 script-runner 워커 하위 프로세스 수예요. 값이 클수록 스크립트를 더 많은 프로세스에 나눠 장애 격리가 좋아지지만 메모리를 더 써요(유휴 상태에서 워커당 ~50-100 MB). 호스트가 16개로 제한해요(Spindle의 MAX_BACKEND_PROCESSES).',
  'Idle timeout (min)': '유휴 제한 시간 (분)',
  "How long a worker may remain idle (no script fires, no handler invocations) before it's torn down to reclaim memory. On next event for any of its assigned scripts, the worker respawns (~150-300 ms cold-start hitch).":
    '워커가 유휴 상태(스크립트 실행·핸들러 호출 없음)로 이만큼 지나면 메모리를 되찾으려고 종료돼요. 할당된 스크립트에 다음 이벤트가 오면 워커가 다시 떠요(~150-300 ms 콜드 스타트 지연).',
  'Memory ceiling (MB)': '메모리 한도 (MB)',
  'Total memory ceiling (sum across all worker subprocesses). When exceeded, the eviction sweep LRU-evicts idle workers until total memory drops back under the ceiling. Workers with active runs are exempt; the sweep always keeps at least one worker warm.':
    '전체 메모리 한도(모든 워커 하위 프로세스의 합)예요. 한도를 넘으면 정리 작업이 전체 메모리가 한도 아래로 내려갈 때까지 유휴 워커를 LRU 순으로 내보내요. 실행 중인 워커는 제외되고, 최소 워커 하나는 항상 대기 상태로 남겨요.',
  'Rebalance pool': '풀 재분배',
  "Releases all script→worker assignments. Each script's next fire reassigns via least-loaded over the current pool. Useful after increasing Worker count to redistribute existing scripts onto the new workers (assignments are sticky by default).":
    '스크립트→워커 할당을 모두 풀어요. 각 스크립트는 다음에 실행될 때 현재 풀에서 가장 한가한 워커로 다시 할당돼요. 워커 수를 늘린 뒤 기존 스크립트를 새 워커로 나눌 때 유용해요(할당은 기본적으로 유지돼요).',

  // ── Editor ──
  'Editor': '편집기',
  'Font size': '글꼴 크기',
  'Font size (in pixels) used by the Monaco code editor. Affects the code editor only; reference docs and console output are unchanged.':
    'Monaco 코드 편집기의 글꼴 크기(픽셀)예요. 코드 편집기에만 적용되고, 레퍼런스 문서와 콘솔 출력은 그대로예요.',
  'Autosave (ms)': '자동 저장 (ms)',
  'Delay (in milliseconds) between the last keystroke and autosave. Larger values reduce backend round-trips while typing.':
    '마지막 키 입력 후 자동 저장까지의 지연 시간(밀리초)이에요. 값이 클수록 입력 중 백엔드 왕복이 줄어요.',
  "Show the editor's IntelliSense — autocomplete suggestions, api.* signature help, and hover docs. Turn off to suppress the popups (syntax-error squiggles stay). Takes effect immediately.":
    '편집기의 IntelliSense(자동 완성 제안, api.* 시그니처 도움말, 마우스오버 문서)를 표시해요. 끄면 팝업이 나오지 않아요(구문 오류 밑줄은 남아요). 바로 적용돼요.',

  // ── New-Script Templates ──
  'New-Script Templates': '새 스크립트 템플릿',
  'Trigger': '트리거',
  'Starter code inserted into newly created trigger scripts.': '새로 만드는 트리거 스크립트에 넣을 시작 코드예요.',
  'Library': '라이브러리',
  'Starter code inserted into newly created library scripts.': '새로 만드는 라이브러리 스크립트에 넣을 시작 코드예요.',

  // ── Support ──
  'Support': '지원',
  'View Diagnostics': '진단 보기',
  'Open the diagnostics modal — runtime state snapshot + copy-as-markdown for Discord support reports':
    '진단 창을 열어요 — 런타임 상태 스냅샷과 Discord 지원 보고서용 마크다운 복사',

  // ── Assistant ──
  'Assistant': '어시스턴트',
  'Connection': '연결',
  'Loading…': '불러오는 중…',
  'Lumiverse default': 'Lumiverse 기본값',
  'Follow the app’s own default connection': '앱의 기본 연결을 따라요',
  '{provider} · {model} · app default': '{provider} · {model} · 앱 기본값',
  'Default Lisa connection': 'Lisa 기본 연결',
  "The LLM connection Lisa's chat starts on. Leave as “Lumiverse default” to follow the app's own default connection, or point Lisa at a model that's a stronger coding brain than your main-chat pick (e.g. GLM-5.1). You can still switch connections per-session inside the chat — this only sets the starting point.":
    'Lisa 채팅이 처음에 쓸 LLM 연결이에요. “Lumiverse 기본값”으로 두면 앱의 기본 연결을 따르고, 메인 채팅용보다 코딩에 강한 모델(예: GLM-5.1)을 Lisa에게 지정할 수도 있어요. 채팅 안에서 세션마다 연결을 바꿀 수 있어요 — 여기서는 시작 연결만 정해요.',
  'Tool iterations': '도구 반복 횟수',
  'Maximum tool-call iterations Lisa is allowed per turn. Each lookup_api call counts as one. Lower this if your model thrashes on hard questions; raise it if Lisa hits the ceiling on genuinely complex Q&A.':
    'Lisa가 한 턴에 할 수 있는 도구 호출 반복의 최대 횟수예요. lookup_api 호출 한 번이 1회로 세져요. 모델이 어려운 질문에서 헛돌면 낮추고, 정말 복잡한 질문에서 Lisa가 한도에 걸리면 올리세요.',
  'Context budget (tokens)': '컨텍스트 예산 (토큰)',
  "Token budget for Lisa's context window. Her per-turn prompt is trimmed to fit this, and the fullness gauge in chat reads against it. The app can't detect a model's real context length, so set this to match your model: 200K suits most modern models; lower it for small/local models, raise it for 1M-context ones.":
    'Lisa의 컨텍스트 창에 쓸 토큰 예산이에요. 턴마다 프롬프트를 이 크기에 맞게 줄이고, 채팅의 사용량 게이지도 이 값을 기준으로 해요. 앱은 모델의 실제 컨텍스트 길이를 알 수 없으니 모델에 맞춰 설정하세요: 대부분의 최신 모델에는 200K가 맞고, 작은/로컬 모델은 낮추고, 1M 컨텍스트 모델은 올리세요.',
  'Generation defaults': '생성 기본값',
  'Reset': '재설정',
  'Clear all four overrides — temperature, top-p, and max tokens go blank; parallel tool calls returns to the default (on).':
    '네 가지 재정의를 모두 지워요 — 온도, Top-P, 최대 토큰은 빈칸이 되고, 병렬 도구 호출은 기본값(켜짐)으로 돌아가요.',
  'Temperature': '온도',
  "Sampling temperature (0-2). Higher = more creative / random; lower = more deterministic. Leave blank to use the connection's preset.":
    '샘플링 온도(0-2)예요. 높을수록 창의적 / 무작위, 낮을수록 결정적이에요. 비워 두면 연결 프리셋 값을 써요.',
  'default': '기본값',
  "Top-P nucleus sampling (0-1). Independent of temperature; most users tune one or the other, not both. Leave blank to use the connection's preset.":
    'Top-P 핵 샘플링(0-1)이에요. 온도와 별개이며, 보통 둘 중 하나만 조절해요. 비워 두면 연결 프리셋 값을 써요.',
  'Max tokens': '최대 토큰',
  "Output token cap per turn. Lower bounds the response length; raise for long-form answers. Leave blank to use the connection's preset.":
    '턴당 출력 토큰 상한이에요. 낮추면 응답 길이가 제한되고, 긴 답변이 필요하면 올리세요. 비워 두면 연결 프리셋 값을 써요.',
  'Parallel tool calls': '병렬 도구 호출',
  'When unchecked, Lisa requests serialised (one-at-a-time) tool calls. Most providers handle parallel calls fine; uncheck only for Mistral and other providers that choke on parallelism.':
    '끄면 Lisa가 도구 호출을 한 번에 하나씩 요청해요. 대부분의 제공자는 병렬 호출을 잘 처리해요. Mistral처럼 병렬 호출에 문제가 있는 제공자에서만 끄세요.',
  'Auto-compact context': '컨텍스트 자동 압축',
  'When on, Lisa automatically summarizes the older part of a long conversation once its context fills past ~85%, so the chat can keep going without overflowing. The summary runs as a background LLM call on the turn that crosses the line. Turn off to compact only manually (the “Compact now” button in chat still works).':
    '켜면 긴 대화의 컨텍스트가 ~85%를 넘을 때 Lisa가 오래된 부분을 자동으로 요약해서, 넘치지 않고 대화를 이어갈 수 있어요. 요약은 그 선을 넘는 턴에서 백그라운드 LLM 호출로 실행돼요. 끄면 수동으로만 압축해요(채팅의 “지금 압축” 버튼은 계속 동작해요).',
  'Cache system prompt': '시스템 프롬프트 캐싱',
  "When on, Lisa marks the stable part of her system prompt (her persona + the API cheat-sheet) for prompt caching, so caching providers (Anthropic and others) read it from cache instead of re-billing ~44K tokens every turn — a large cost/latency saving. Harmless on providers that don't cache. Turn off only if a provider misbehaves with cache markers.":
    '켜면 Lisa가 시스템 프롬프트의 고정 부분(페르소나 + API 요약표)에 프롬프트 캐싱 표시를 달아, 캐싱을 지원하는 제공자(Anthropic 등)가 매 턴 ~44K 토큰을 다시 청구하지 않고 캐시에서 읽게 해요 — 비용과 지연이 크게 줄어요. 캐싱하지 않는 제공자에서는 해가 없어요. 제공자가 캐시 표시 때문에 오작동할 때만 끄세요.',
  'Conversation management': '대화 관리',
  'Clear all threads': '모든 대화 지우기',
  'Permanently delete every Lisa thread and its conversation history. Confirms before acting.':
    'Lisa의 모든 대화와 대화 기록을 영구 삭제해요. 실행 전에 확인을 받아요.',

  // ── Engine / isolation switch confirm dialogs ──
  'Switch script engine?': '스크립트 엔진을 바꿀까요?',
  'Switch script isolation?': '스크립트 격리 방식을 바꿀까요?',
  'Switch & reload': '전환 후 다시 불러오기',
  "Switching to the QuickJS isolate changes which sandbox runs your scripts. Each script's live state — handlers, panels, timers — belongs to one engine and can't be moved, so it is rebuilt under the new engine.":
    'QuickJS 격리 환경으로 바꾸면 스크립트를 실행하는 샌드박스가 달라져요. 각 스크립트의 실시간 상태(핸들러, 패널, 타이머)는 한 엔진에 묶여 있어 옮길 수 없으므로 새 엔진에서 다시 만들어져요.',
  "Switching to AsyncFunction changes which sandbox runs your scripts. Each script's live state — handlers, panels, timers — belongs to one engine and can't be moved, so it is rebuilt under the new engine.":
    'AsyncFunction으로 바꾸면 스크립트를 실행하는 샌드박스가 달라져요. 각 스크립트의 실시간 상태(핸들러, 패널, 타이머)는 한 엔진에 묶여 있어 옮길 수 없으므로 새 엔진에서 다시 만들어져요.',
  'Per-script isolation applies only to the QuickJS engine, so it will be inactive while AsyncFunction runs your scripts. Your choice is kept and takes effect again if you switch back to QuickJS.':
    '스크립트별 격리는 QuickJS 엔진에만 적용되므로, AsyncFunction이 스크립트를 실행하는 동안에는 꺼져 있어요. 선택은 그대로 남아 있고 QuickJS로 다시 바꾸면 다시 적용돼요.',
  'Re-run now ({n})': '지금 다시 실행 ({n})',
  'Startup scripts re-run immediately (spaced out) — panels, toasts, and any LLM calls they make on startup happen again.':
    '시작 스크립트는 곧바로 (간격을 두고) 다시 실행돼요 — 시작할 때 띄우는 패널, 알림, LLM 호출이 다시 일어나요.',
  'State cleared ({n})': '상태 지워짐 ({n})',
  'Event-driven scripts have their live state cleared now and re-arm on their next trigger — no automatic re-run.':
    '이벤트 기반 스크립트는 지금 실시간 상태가 지워지고 다음 트리거 때 다시 준비돼요 — 자동으로 다시 실행되지는 않아요.',
  'In-flight runs finish on the current engine first, and any in-memory (non-persisted) state is reset. Consider disabling expensive startup scripts before switching.':
    '진행 중인 실행은 현재 엔진에서 먼저 끝나고, 메모리에만 있는(저장되지 않은) 상태는 초기화돼요. 바꾸기 전에 비용이 큰 시작 스크립트를 꺼 두는 것도 고려하세요.',
  "Switching to per-script isolation changes how the QuickJS engine sandboxes your scripts. The QuickJS worker is respawned so every context is rebuilt under the new model, and each script's live state — handlers, panels, timers — is rebuilt with it.":
    '스크립트별 격리로 바꾸면 QuickJS 엔진이 스크립트를 샌드박스에 가두는 방식이 달라져요. QuickJS 워커를 다시 띄워 모든 컨텍스트를 새 방식으로 다시 만들고, 각 스크립트의 실시간 상태(핸들러, 패널, 타이머)도 함께 다시 만들어요.',
  "Switching to a shared context changes how the QuickJS engine sandboxes your scripts. The QuickJS worker is respawned so every context is rebuilt under the new model, and each script's live state — handlers, panels, timers — is rebuilt with it.":
    '공유 컨텍스트로 바꾸면 QuickJS 엔진이 스크립트를 샌드박스에 가두는 방식이 달라져요. QuickJS 워커를 다시 띄워 모든 컨텍스트를 새 방식으로 다시 만들고, 각 스크립트의 실시간 상태(핸들러, 패널, 타이머)도 함께 다시 만들어요.',
  'This setting only affects the QuickJS engine. In-flight runs finish first, and any in-memory (non-persisted) state is reset.':
    '이 설정은 QuickJS 엔진에만 영향을 줘요. 진행 중인 실행이 먼저 끝나고, 메모리에만 있는(저장되지 않은) 상태는 초기화돼요.',
};
