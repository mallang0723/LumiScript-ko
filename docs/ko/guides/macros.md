# 커스텀 매크로

LumiScript 스크립트는 매크로가 쓰일 수 있는 모든 곳(LLM에 전달할 조립된 프롬프트, 채팅 제목 자동 생성, 프리셋 미리보기 등)에서 Lumiverse가 처리할 수 있는 커스텀 `{{macros}}`를 등록할 수 있어요. `api.chat.inject`나 콘텐츠 프로세서를 건드리지 않고도 프롬프트 파이프라인에 스크립트 계산값을 주입할 수 있는 가장 깔끔한 방법이에요.

`api.macros.register` 자체는 **별도 권한이 필요하지 않아요**. 어떤 스크립트든 매크로를 등록할 수 있어요. 다만 핸들러가 실행하면서 유발하는 부수 효과(DB 읽기, LLM 호출 등)는 각 `api.*`의 권한 요구사항을 따라요. 뒤에서 다룰 매크로 **인터셉터(interceptor)**는 `macro_interceptor` 권한이 필요해요.

## 매크로의 용도

Lumiverse는 이미 내장 매크로를 제공하고 있어요: `{{user}}`와 `{{char}}`는 활성 페르소나와 캐릭터 이름으로 변환되고, `{{getvar::x}}`는 저장된 변수를 읽어오는 식이에요. 스크립트는 여기에 원하는 계산값을 반환하는 새 매크로를 등록할 수 있어요:

```
{{moodScore}}                      → "0.74"
{{getCharNote::theme}}             → "Tone: melancholic, midwinter setting"
{{lastSummary}}                    → "User asked Alice about her childhood..."
```

매크로를 등록해 두면 사용자가 시스템 프롬프트, 프리셋 블록, 월드 인포 항목 등에 매크로 이름을 적어 둘 수 있고, 생성 시점에 스크립트가 계산한 값이 그 자리에 대체돼요. 매크로가 실행될 **위치**는 사용자가 정하고, 치환될 **값**은 스크립트가 제어하는 구조예요.

## 푸시(Push) 모드 vs 풀(Pull) 모드

매크로를 등록하는 방법에는 두 가지가 있어요. 핵심은 **값이 계산되는 시점**이에요:

- **푸시 모드 (Push mode)** — 핸들러 없이 등록해요. 매크로는 초기값 없이 시작(기본값 `""`)하며, 스크립트가 다른 곳(트리거 실행, UI 핸들러, 주기적 갱신 등)에서 값을 계산한 뒤 `api.macros.updateValue(name, newValue)`를 호출해 값을 밀어 넣어요. 호스트가 전달받은 값을 저장하고 있으며, 매크로 해석 시 추가 RPC 없이 캐시에서 즉시 값을 읽어가요.

- **풀 모드 (Pull mode)** — 핸들러 함수를 넘겨서 등록해요. 호스트는 매크로가 해석될 때마다 컨텍스트 객체와 함께 핸들러를 호출해요. 핸들러는 반환할 문자열 값을 돌려줘요. 비동기 핸들러도 지원하므로 `globalThis`에 미리 캐싱해 둘 필요 없이 본문에서 바로 `await`할 수 있어요.

**가능하다면 푸시 모드를 권장해요.** 푸시 모드는 매크로 해석 시점의 RPC 지연이 없으므로 템플릿이 많이 중첩된 프롬프트에서 특히 유리해요(풀 모드는 매 해석마다 워커 통신이 일어남). 풀 모드는 매크로 인수나 활성 캐릭터, 활성 채팅 등 해석되는 그 순간의 컨텍스트에 값이 진정으로 종속될 때만 사용하세요.

## 빠른 시작 — 푸시 모드

현재 세션에서 사용자가 보낸 메시지 수를 추적하는 매크로 예제예요:

```js
// 트리거: ls:startup (스크립트가 활성화될 때 한 번 실행)
if (data.__event === 'ls:startup') {
  api.macros.register('messagesSent', {
    description: 'Number of messages the user has sent in this session.',
    category:    'extension:lumiscript:my-script',
    returnType:  'integer',
  });
  // 초기값 설정
  await api.macros.updateValue('messagesSent', '0');
}

// 트리거: MESSAGE_SENT
if (data.__event === 'MESSAGE_SENT' && data.message.is_user) {
  const current = parseInt(await api.variables.global.get('messagesSent', '0'), 10);
  const next    = current + 1;
  await api.variables.global.set('messagesSent', String(next));
  await api.macros.updateValue('messagesSent', String(next));
}
```

이제 매크로를 쓸 수 있는 어디서나 `{{messagesSent}}`가 현재 카운트 값으로 치환돼요. 사용자는 이를 시스템 프롬프트나 월드 인포 등에 자유롭게 넣을 수 있어요.

## 빠른 시작 — 풀 모드

필요할 때마다 스크립트가 캐릭터의 현재 기분을 계산해서 반환하는 매크로 예제예요:

```js
api.macros.register(
  'characterMood',
  {
    description: 'Current mood of the active character (computed from recent messages).',
    category:    'extension:lumiscript:my-script',
    returnType:  'string',
  },
  async (ctx) => {
    if (ctx.commit === false) return '';                // 모의 해석 — 작업 건너뛰기
    const chat = await api.chats.getActive();
    if (!chat?.characterId) return 'neutral';
    return await computeMood(chat.characterId);         // 자체 비동기 함수
  },
);
```

이 핸들러에서 주목할 두 가지:

1. **`ctx.commit === false` 가드.** Lumiverse는 프롬프트 미리보기나 제목 생성 등 *미리보기* 목적으로 매크로를 해석할 때 `commit: false`를 전달해요. 부수 효과가 있는 핸들러는 모의 해석 시 상태 변경 작업을 건너뛰어야 해요. 읽기 전용 핸들러라면 무시해도 돼요(아래 [`ctx.commit`](#ctxcommit--handling-dry-resolves) 참고).

2. **캐릭터 ID를 가져올 때 `ctx.env?.character?.id` 대신 `await api.chats.getActive()` 사용.** 매크로 컨텍스트의 `env.character`는 캐릭터 카드 데이터(이름, 설명 등)를 담고 있지만, 소스에서도 명시하듯 `id` 필드가 안정적으로 채워져 있지 않아요. `api.chats.getActive()`를 쓰거나 엔진이 설정해 주는 `globalThis.__lsActiveCharId`를 읽으세요.

## `register(name, def, handler?)` — 통합 등록 메서드

```ts
register(
  name:    string,
  def:     MacroDefinition,
  handler?: (ctx: MacroContext) => string | Promise<string>,
): void
```

하나의 메서드로 두 모드를 모두 지원해요 — `handler`를 넘기면 풀 모드, 생략하면 푸시 모드가 돼요.

등록 시점에 엔진이 검증하는 두 가지 규칙:

- **예약된 이름은 거부돼요.** LumiScript 자체 내장 매크로 이름(`lumiScriptActive`, 캐릭터 변수 매크로 제품군 `getcvar` / `setcvar` / `addcvar` / `inccvar` / `deccvar` / `hascvar` / `deletecvar` 및 `*char*` 별칭들)은 예약되어 있어요. 이 이름으로 등록을 시도하면 예외가 발생해요.

- **스크립트 간 이름 충돌은 거부돼요.** 서로 다른 두 스크립트가 동일한 매크로 이름을 등록할 수 없어요. 두 번째 등록 시 소유 스크립트 이름이 적힌 오류가 발생해요. 네임스페이스 접두사(`my-script:mood`, `agents:current-task` 등)를 붙여 충돌을 방지하세요.

`register` 자체에는 권한 제한이 없어요.

### `MacroDefinition` 구조

```ts
interface MacroDefinition {
  description: string;
  category?:   string;          // 기본값: 'extension:lumiscript:user'
  returnType?: 'string' | 'integer' | 'number' | 'boolean';
  args?: Array<{
    name:         string;
    description?: string;
    required?:    boolean;
  }>;
  volatile?: boolean;           // 기본값: true (풀 모드) / false (푸시 모드)
}
```

| 필드 | 용도 |
|---|---|
| `description` | 사용자가 매크로 브라우저나 프리셋 편집기에서 매크로를 고를 때 보이는 설명이에요. 단순히 "기분"이라고 쓰기보다는 "사용자의 현재 기분을 0~1 점수로 반환"처럼 구체적으로 작성하세요. |
| `category` | 매크로 브라우저에서 매크로들을 그룹화해요. 기본값은 `extension:lumiscript:user`로, 스크립트가 등록한 매크로들이 한곳에 묶여요. 시각적 분류를 위해 커스텀 접두사(예: `extension:lumiscript:my-script`)를 줄 수 있어요. |
| `returnType` | 값 형변환을 위한 힌트예요. 기본값은 `'string'`이에요. 호스트가 해석된 매크로 문자열을 타입이 있는 값으로 변환하길 원할 때(`{{if}}` 같은 범위 지정 매크로에서 쓰여요) `'integer'`, `'number'`, `'boolean'`으로 지정하세요. |
| `args` | 프리셋 편집기 UI의 매크로 자동완성용 인수 스키마예요. 런타임에 유효성을 강제하지는 않으며(핸들러에는 원시 문자열 배열이 전달됨), 순수하게 UI 편의를 위한 항목이에요. |
| `volatile` | Lumiverse의 표시용 정규식(display-regex) 캐시를 건너뛸지 여부예요. 푸시 모드는 호스트에 이미 캐싱되어 있으므로 `false`, 매 해석마다 값이 달라질 수 있는 풀 모드는 `true`로 설정하세요. |

### 풀 모드 핸들러

#### `ctx` 매개변수 구조

```ts
interface MacroContext {
  name:      string;
  args:      string[];
  env?: {
    character?: { name?: string; [k: string]: unknown };
    chat?:      { id?: string;   [k: string]: unknown };
    names?:     { char?: string; user?: string; [k: string]: unknown };
    variables?: { local?: Record<string, string>; global?: Record<string, string> };
    [k: string]: unknown;
  };
  isScoped?: boolean;
  body?:     string;
}
```

- **`ctx.name`** — 호출된 매크로 이름이에요(`{{}}` 및 인수 제외).
- **`ctx.args`** — 호출 시 파싱된 문자열 인수 배열이에요. `{{moodFor::Alice::strict}}`는 `['Alice', 'strict']`로 전달돼요. **항상 문자열**이며 `def.args`에 따라 타입이 자동 변환되지 않아요.
- **`ctx.env`** — 실행 환경 스냅샷이에요. `env.character`는 캐릭터 카드 데이터를 담고 있지만 **`id` 필드가 안정적으로 채워져 있지 않아요**(채팅 수준 상태가 아니라 캐릭터 카드 메타데이터이기 때문이에요). 활성 캐릭터 ID는 `await api.chats.getActive()`를 통해 가져오세요.
- **`ctx.env.variables`** — 사용자의 `{{getvar}}` / `{{getglobalvar}}` 저장소로, `api.variables.local` / `api.variables.global`에서 채워져요. 읽기 전용 스냅샷이에요.
- **`ctx.isScoped`** — `{{if::condition}}…{{/if}}` 같은 범위 지정 블록 안에서 해석될 때 `true`예요.
- **`ctx.body`** — 범위 지정 매크로의 내부 본문 텍스트예요(시작 태그와 끝 태그 사이의 내용).

<a id="ctxcommit--handling-dry-resolves"></a>

#### `ctx.commit` — 모의 해석 처리

매크로 컨텍스트에는 런타임에 해당 해석 결과가 실제로 사용될 것인지를 알려 주는 `commit?: boolean` 필드가 포함돼요:

- **`commit === undefined` 또는 `commit === true`** — 실제 반영되는 해석이에요. 핸들러가 수행하는 작업이 최종 결과에 반영돼요.
- **`commit === false`** — 모의 해석(dry resolve)이에요. 호스트가 프롬프트 형태를 미리 확인(채팅 제목 자동 생성, 프롬프트 미리보기 UI 등)하는 중이며 결과를 실제로 저장하거나 전송하지 않아요. 이때는 디스크 쓰기, 이벤트 발행, 외부 HTTP 요청 등 부수 효과를 **건너뛰어야** 해요.

```js
async (ctx) => {
  if (ctx.commit === false) return '';        // 모의 실행 — 부수 작업 건너뛰기
  await api.events.track('mood_lookup', { ... });
  return computeMood();
}
```

`ctx.commit`은 v1.0.0-rc.8부터 `MacroContext` 정식 타입으로 선언되어 있어 Monaco 편집기에서 TypeScript 자동완성이 깔끔하게 지원돼요. (이 필드는 Lumiverse spindle-types v0.4.32부터 런타임에는 전달되고 있었지만 공개 타입 정의가 뒤처져 있었고, rc.8 문서 정비에서 그 차이를 메웠어요.)

#### 비동기 핸들러

핸들러 함수는 동기식과 비동기식(`(ctx) => string | Promise<string>`)을 모두 지원해요. 호스트가 반환된 Promise를 네이티브로 기다려 주므로, 과거 방식처럼 데이터를 `globalThis`에 미리 적어 두고 동기로 읽어올 필요가 없어요(그 방식은 `api.macros.register`가 어차피 받지 않는 과거의 문자열 형태 핸들러에만 해당돼요).

```js
api.macros.register('lastReview', { description: '...' }, async (ctx) => {
  const events = await api.events.query({ eventName: 'character_review', limit: 1 });
  return events[0]?.payload?.summary ?? 'No reviews yet';
});
```

#### 핸들러에서 활성 캐릭터 가져오기

```js
// 잘못된 방법 — env.character는 카드 데이터이며 .id가 비어 있을 수 있어요
const charId = ctx.env?.character?.id;

// 올바른 방법 — 활성 채팅 조회
const chat = await api.chats.getActive();
const charId = chat?.characterId;

// 또 다른 올바른 방법 — 엔진이 설정한 전역 변수 읽기
const charId = globalThis.__lsActiveCharId ?? null;
```

`globalThis.__lsActiveCharId`는 LumiScript 백엔드가 활성 컨텍스트를 갱신할 때마다 설정해 줘요(LumiScript 자체 내장 캐릭터 변수 매크로가 쓰는 것과 같은 방식이며, `src/macros.ts:80`을 참고하세요). 동기식으로 즉시 읽을 수 있으므로 핸들러 안에서 `await` 통신 지연을 줄이고 싶을 때 매우 유용해요.

### 푸시 모드 값 갱신

```ts
updateValue(name: string, value: string): void
```

푸시 모드 매크로의 값을 갱신해요. 인수는 반드시 문자열이어야 해요. 타입이 있는 반환값으로의 변환은 푸시 쪽이 아니라 해석 쪽에서 `def.returnType`에 따라 호스트가 처리해요.

```js
await api.macros.updateValue('messagesSent', '42');
```

**풀 모드로 등록된 매크로에 `updateValue`를 호출하면 예외가 발생해요:**

```
Error: api.macros.updateValue: "<name>" was registered with a handler (pull mode) — updateValue is only valid for push-mode macros.
```

모드 불일치 버그를 빠르게 발견할 수 있도록 의도적으로 예외를 던지도록 설계되었어요.

### 목록 조회 및 정리

```ts
list(): RegisteredMacroInfo[]
```

모든 스크립트가 등록한 전체 매크로의 스냅샷을 반환해요. 매크로 브라우저 화면의 기반 데이터예요. `name`, `description`, `category`, `mode: 'push' | 'pull'`, 소유 스크립트 정보(`scriptId` / `scriptName`), 푸시 모드의 경우 `lastValue`가 포함돼요. 별도 권한 없이 쓸 수 있으며, 검사·디버그 UI에 활용하세요.

```ts
unregister(name: string): void
```

내 스크립트가 등록한 매크로를 제거해요. 매크로가 없거나 다른 스크립트의 소유라면 오류 없이 조용히 무시돼요.

**일반적으로 `unregister`를 직접 호출할 필요는 없어요.** 스크립트가 비활성화되거나 삭제되면 LumiScript가 등록된 매크로를 자동으로 모두 해제해 줘요. 스크립트 전체를 끄지 않고 특정 매크로만 중간에 제거하고 싶을 때만 사용하세요.

## 매크로 인터셉터 — `registerInterceptor`

더 강력하고 별개의 기능을 수행하는 표면이에요. 인터셉터는 Lumiverse의 일반 매크로 해석기가 동작하기 **전에** 실행돼요. 프롬프트 블록이나 응답의 **원시 템플릿 문자열**을 전달받아 변환된 템플릿을 반환할 수 있어요. `{{#each LARGE_LIST}}…{{my_macro}}…{{/each}}`처럼 수많은 매크로가 반복되어 매크로별 통신 비용이 부담될 때 템플릿 전체를 한 번에 일괄 치환하거나, 매크로 해석 전에 템플릿을 통째로 재작성하고 싶을 때 사용하세요.

```ts
registerInterceptor(
  handler: (ctx: MacroInterceptorCtx) => string | void | Promise<string | void>,
  options?: MacroInterceptorOptions,
): { id: string; remove(): void }
```

### 인터셉터 핸들러

핸들러가 받는 컨텍스트 객체:

```ts
interface MacroInterceptorCtx {
  readonly template:    string;                  // 매크로 해석 전의 원시 템플릿
  readonly env:         MacroInterceptorEnv;     // MacroContext.env와 동일한 형태
  readonly commit:      boolean;                 // 모의 해석 시 false (항상 제공됨)
  readonly phase:       'prompt' | 'display' | 'response' | 'other';
  readonly sourceHint?: string;                  // 호스트 힌트 (예: 블록 ID)
  readonly userId?:     string;
}
```

템플릿을 변환하고 싶다면 **문자열**을 반환하고, 변경 없이 그대로 통과시키려면 **void / undefined**를 반환하세요. (원래 템플릿을 그대로 반환하는 것은 낭비이므로 그냥 void를 반환하세요.)

### 옵션

```ts
interface MacroInterceptorOptions {
  id?:            string;                          // 중복 방지 및 재등록을 위한 고유 ID
  priority?:      number;                          // 기본값 100; 숫자가 낮을수록 먼저 실행
  phase?:         MacroInterceptorPhase | MacroInterceptorPhase[];
  matchTemplate?: string | string[] | RegExp;      // 원시 템플릿 사전 필터링
  timeoutMs?:     number;                          // 기본값 2000ms
}
```

- **`priority`** — 인터셉터는 우선순위 **오름차순**으로 실행돼요(낮은 숫자가 먼저 실행됨). 기본값은 100이에요. 다른 확장의 인터셉터보다 먼저 실행되게 하려면 **100 미만**으로 낮추고, 나중에 실행되게 하려면 **100 초과**로 높이세요. (`api.worldInfo.registerInterceptor` 등 LumiScript의 다른 인터셉터 표면과 같은 규칙이에요. `macro-interceptor-registry.ts:374-381`과 `script.ts:5487`에서 확인했어요.)
- **`phase`** — 해석 컨텍스트 필터예요. 지정된 단계에서만 핸들러가 호출돼요. 생략하면 모든 단계에서 실행돼요.
  - `'prompt'` — LLM 프롬프트 조립 단계.
  - `'display'` — 채팅 UI에 메시지를 렌더링하는 단계.
  - `'response'` — LLM 응답 후처리 단계.
  - `'other'` — 그 외 단계 (프리셋 미리보기 등).
- **`matchTemplate`** — 템플릿 문자열 사전 필터예요:
  - `string` → `template.includes(s)`
  - `string[]` → 배열의 문자열 중 하나라도 포함되면 일치
  - `RegExp` → `re.test(template)`
- **`timeoutMs`** — 이 시간보다 오래 걸리는 핸들러는 타임아웃 오류가 발생하고 원본 템플릿이 그대로 통과해요. 기본값은 2초예요. 느린 비동기 작업에는 값을 늘려도 되지만, 그동안 프롬프트 조립이 멈추고 기다린다는 점을 염두에 두세요.

### 필요 권한

`registerInterceptor`는 `macro_interceptor` 권한이 필요해요(`api.chat.inject`와 `api.chat.registerContentProcessor`를 제어하는 `interceptor` 권한과는 별개예요). 성능에 민감한 영역이므로 별도의 권한으로 제어돼요.

진단 및 디버깅을 위한 `listInterceptors()`는 권한 없이 호출할 수 있어요.

### 정리

`registerInterceptor`가 반환하는 핸들에는 `remove()` 메서드가 있어요. 매크로와 마찬가지로 스크립트 비활성화/삭제 시 자동으로 정리돼요.

## 모의 해석 도중의 상태 변경 경쟁 상태

매크로를 다룰 때 꼭 알아두어야 할 주의점이에요. 스크립트를 실행하는 워커는 현재 어떤 매크로라도 `commit: false` 상태로 해석 중인지를 추적하는 플래그를 가지고 있어요. 이 플래그가 켜져 있는 동안 같은 워커에서 상태를 **변경**하는 `spindle.*` 호출을 실행하면 다음과 같은 오류가 발생해요:

```
Error: spindle.X.Y is not allowed during non-committing macro resolution
```

실제 전송되지 않을 수도 있는 프롬프트를 미리보는 도중에 상태를 변경하면 안 되기 때문에 호스트가 이를 차단하는 것이에요. 읽기 작업은 안전하지만 쓰기 작업은 차단돼요.

**가장 취약한 이벤트는 `CHAT_SWITCHED`예요.** 채팅을 열면 프롬프트 재생성이 트리거되고, 이 과정에서 `commit: false` 매크로 해석이 진행되는 도중에 `CHAT_SWITCHED` 트리거가 실행될 수 있어요. 채팅이 열릴 때 상태를 변경하려는 스크립트가 이 오류에 걸리기 쉬워요.

### 자동 재시도 지원 여부

LumiScript 엔진은 다음 두 영역에 대해 이 경쟁 상태를 자동으로 처리해 줘요:

- **`api.theme.apply` / `applyPalette` / `clear`** — `withMacroRaceRetry`로 감싸져 있어요. 지수 백오프(15ms / 30ms / 60ms / 120ms / 240ms) 기반으로 최대 5회 자동 재시도해요. 스크립트에서 추가 처리를 할 필요가 없어요.

- **`api.macros.register`** — 등록 경로 안에 전용 try/catch가 있어요. 내부의 `spindle.registerMacro` 호출이 경쟁 상태에 걸리면 엔진이 info 수준으로 로그만 남기고 이전 등록을 유효한 것으로 간주해요. 매크로는 등록된 상태로 유지돼요.

그 외의 변경 API들(`api.chat.sendMessage`, `api.variables.global.set`, `api.events.track` 등)은 예외가 발생하므로, 스크립트에서 직접 잡아서 재시도해야 해요. 일반적인 형태는 다음과 같아요:

```js
async function retryOnMacroRace(fn, attempts = 5) {
  let delayMs = 15;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (!msg.includes('non-committing macro resolution')) throw err;
      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, delayMs));
      delayMs *= 2;
    }
  }
}

// 사용 예시:
await retryOnMacroRace(() => api.variables.global.set('mood', String(score)));
```

근본적인 해결책은 워커의 `macroInvocationStack`을 비동기 컨텍스트별로 한정하는 것이에요(그러면 서로 무관한 동시 작업이 플래그를 보지 않게 돼요). 다만 호스트 쪽 변경이 필요해서 현재 추적 중이며 아직 반영되지 않았어요.

## LumiScript 내장 매크로

확장이 시작될 때 등록되며, 별도의 등록 없이 프롬프트나 스크립트에서 바로 쓸 수 있어요:

| 매크로 | 별칭 | 반환값 | 비고 |
|---|---|---|---|
| `{{lumiScriptActive}}` | — | `"true"` / `"false"` | 푸시 모드. 확장의 전체 활성화 토글 상태를 반영해요. |
| `{{getcvar::key}}` | `{{getcharvar}}` | 저장된 문자열 | `variables/characters/<id>.json`에서 읽어요. 활성 캐릭터가 없거나 키가 없으면 `""`. |
| `{{setcvar::key::value}}` | `{{setcharvar}}` | `""` | 저장. `ctx.commit === false`일 때는 건너뛰어요. |
| `{{addcvar::key::number}}` | `{{addcharvar}}` | 새 숫자값 | 현재 값에 숫자를 더해요. 모의 해석 시 건너뛰어요. |
| `{{inccvar::key}}` | — | 새 값 | `addcvar`의 `+1` 축약형. |
| `{{deccvar::key}}` | — | 새 값 | `addcvar`의 `-1` 축약형. |
| `{{hascvar::key}}` | `{{hascharvar}}` | `"true"` / `"false"` | 읽기 전용 존재 여부 확인. |
| `{{deletecvar::key}}` | `{{deletecharvar}}` | `""` | 키 삭제. 모의 해석 시 건너뛰어요. |

모든 캐릭터 변수 매크로는 캐릭터별 JSON 저장소를 사용해요. 사용자 관점에서는 동기식이라 프롬프트에 매크로를 적기만 하면 되지만, 핸들러는 내부적으로 비동기(`spindle.userStorage.*`)로 동작해요. 이름이 예약되어 있어 사용자 스크립트가 덮어쓸 수 없어요.

## 자주 쓰이는 패턴

### 캐릭터별 상태 매크로 (푸시 모드, 이벤트 시 재계산)

```js
// 트리거: MESSAGE_SENT, GENERATION_ENDED, ls:startup
if (data.__event === 'ls:startup') {
  api.macros.register('characterStatus', {
    description: 'Active character status — emotional/situational summary.',
    category:    'extension:lumiscript:my-script',
  });
}

// 어시스턴트 메시지가 올 때마다 상태 재계산
if (data.__event === 'GENERATION_ENDED') {
  const summary = await api.llm.generateStructured(/* 분석 프롬프트 */, /* 스키마 */);
  await api.macros.updateValue('characterStatus', summary.text);
}
```

사용자는 시스템 프롬프트에 `{{characterStatus}}`를 적어 두기만 하면 항상 최신 분석 결과를 프롬프트에 반영할 수 있어요.

### 자료 저장소 검색 매크로 (풀 모드, 비동기)

```js
api.macros.register(
  'lookupFact',
  {
    description: 'Look up a fact from the project databank by topic.',
    args: [{ name: 'topic', required: true }],
  },
  async (ctx) => {
    if (ctx.commit === false) return '';
    const topic = (ctx.args[0] ?? '').trim();
    if (!topic) return '';
    const doc  = await api.databanks.documents.findByName('proj-databank-id', topic);
    const fact = doc ? (await api.databanks.documents.getContent(doc.id))?.content : null;
    return fact?.slice(0, 200) ?? `(no fact for "${topic}")`;
  },
);
```

프롬프트 활용 예시: `Background: {{lookupFact::Vex's home village}}`.

### 대량 반복 템플릿용 인터셉터 패턴

```js
// {{#each items}}…{{itemDetail::X}}…{{/each}} 처럼 수백 개 항목을 순회할 때
// 매크로별 통신이 병목이 되므로, 전체 치환을 한 번에 미리 수행해요.

api.macros.registerInterceptor(
  (ctx) => {
    if (!ctx.template.includes('itemDetail::')) return;
    if (ctx.commit === false) return ctx.template;   // 모의 해석 시 건너뛰기
    // 템플릿의 모든 itemDetail 참조를 한 번에 일괄 치환
    return ctx.template.replace(/\{\{itemDetail::([^}]+)\}\}/g, (_, id) => lookupDetail(id));
  },
  { matchTemplate: 'itemDetail::', phase: 'prompt' },
);
```

## 흔한 실수

- **풀 모드 매크로에 `updateValue`를 호출하면 오류가 발생해요.** 등록 시점에 모드를 하나 정해서 일관되게 사용하세요. 확신이 없다면 푸시 모드가 지연 시간과 구조 면에서 더 안전한 기본값이에요.

- **`ctx.env?.character?.id`는 신뢰할 수 없어요.** `await api.chats.getActive()`(표준 방법)를 쓰거나 `globalThis.__lsActiveCharId`(동기, 엔진이 설정)를 읽으세요. `env.character`에는 `name`, `description` 같은 카드 데이터가 들어 있지만, 소스 주석에도 id는 채워지지 않는다고 명시돼 있어요.

- **예약된 이름은 등록할 수 없어요.** `lumiScriptActive`와 캐릭터 변수군(`getcvar` / `setcvar` 등과 `*char*` 별칭)은 예약되어 있어요. 앞으로 내장 매크로가 늘어나도 충돌하지 않도록 직접 만든 매크로에는 네임스페이스(`my-script:mood` 등)를 붙이세요.

- **스크립트 간 중복 이름을 쓸 수 없어요.** 먼저 등록한 쪽이 우선하며, 나중에 등록하려는 쪽은 소유 스크립트 이름이 적힌 예외가 발생해요. 다른 사람이 설치할 수 있는 스크립트를 배포한다면 스크립트 접두사가 붙은 이름을 쓰세요.

- **모의 해석 도중의 상태 변경 API 호출은 차단돼요.** 특히 `CHAT_SWITCHED` 시점에 주의하고, 필요하다면 재시도 헬퍼를 쓰거나 변경 시점을 미루세요.

- **푸시가 가능한 곳에 풀을 쓰지 마세요.** 풀 모드는 매 해석마다 RPC 지연을 발생시켜요. 미리 계산해 둘 수 있는 값이라면 이벤트 발생 시 푸시하세요(`MESSAGE_SENT`, `GENERATION_ENDED`, `ls:startup` 등).

- **`args` 스키마는 UI 안내용일 뿐 런타임 검증을 하지 않아요.** 핸들러가 받는 인수는 원시 문자열이므로 직접 검증하고 형변환하세요.

- **등록/해제 시 브로드캐스트가 발생해요.** `register`가 성공할 때마다 `{ name, scriptId, mode }`와 함께 `ls:macro:registered`가, `unregister`할 때마다 `{ name, scriptId }`와 함께 `ls:macro:unregistered`가 발행돼요. 다른 스크립트는 `api.broadcast.on('ls:macro:registered', fn)`으로 구독해 스크립트 간 인지에 쓸 수 있어요. `ls:*` 접두사 정책은 [`concepts/handler-lifetime.md`](../concepts/handler-lifetime.md)를 참고하세요.

## 관련 문서

- **앱 내 레퍼런스, "API Functions → api.macros" 절** — 전체 메서드 시그니처 목록.
- **[`concepts/permissions.md`](../concepts/permissions.md)** — `macro_interceptor`(권한 필요) 대 `register/updateValue/...`(무권한).
- **[`concepts/trigger-model.md`](../concepts/trigger-model.md)** — 이벤트 발생 시 `api.macros.updateValue`를 호출하는 핸들러 동작 원리.
- **[`concepts/handler-lifetime.md`](../concepts/handler-lifetime.md)** — 클로저 지속성: 풀 모드 핸들러는 등록 시점의 상태를 캡처해요. 자세한 설명은 그 문서에 있어요.
- **[LLM 호출하기](llm.md)** — `api.llm.dryRun()`을 사용하면 매크로가 프롬프트에 실제로 어떻게 치환되어 들어가는지 직접 확인할 수 있어요. 조립된 메시지 배열을 반환하므로 매크로가 최종적으로 무엇을 채워 넣는지 정확히 볼 수 있어 디버깅에 매우 유용해요.
