# 스크립트 간 이벤트 브로드캐스팅

`api.broadcast.*`는 두 개 이상의 LumiScript 스크립트가 서로 조율할 수 있도록 해 주는 동일 프로세스 내 발행/구독(pub/sub) 버스예요. 한 스크립트가 상태를 생성하고 다른 스크립트가 이를 렌더링할 때, 워커 스크립트가 비동기 작업 완료를 UI 스크립트에 알리고 싶을 때, 또는 동일한 트리거로 실행되는 스크립트들 사이의 경쟁 상태(race condition)를 해소하고 싶을 때 유용해요.

이 버스는 프로세스 내에서 동작하며, 발생(emit) 시 동기적으로 실행되고 별도의 권한을 요구하지 않아요. Lumiverse 트리거를 대체하기보다는 보완하는 역할을 해요. 각 스크립트가 구독을 등록하려면 최초 1회는 트리거를 통해 본문이 실행되어야 하지만, 일단 구독이 완료되면 다른 스크립트의 emit에 반응하여 트리거 실행 사이에도 핸들러가 동작할 수 있어요.

## 핵심 개념

`api.broadcast.emit(event, payload)`는 모든 LumiScript 스크립트 전반에서 해당 이벤트 이름과 일치하는 모든 구독자에게 동기적으로 이벤트를 전달해요.

`api.broadcast.on(event, handler)`는 핸들러를 구독 등록하고 구독 해제 함수를 반환해요. **구독은 트리거 실행 사이에도 유지돼요.** 현재 실행이 끝날 때 지워지는 것이 아니라, 스크립트의 *다음* 실행이 시작될 때 초기화돼요. 이것이 가장 중요한 동작 방식이에요. 덕분에 다른 스크립트의 이벤트를 수신하기 위해 매번 자신의 Lumiverse 트리거가 실행될 필요가 없어요.

## 빠른 시작

서로 통신하는 두 스크립트의 예시예요:

**`producer.js`** — 생성이 끝난 후 비동기 작업을 수행하고, 결과가 준비되면 이벤트를 발행해요:

```js
// @triggers GENERATION_ENDED
// @description Producer: extracts state, emits when ready.

const extracted = await extractFromContext(data);
await api.scriptStorage.set('latest-state', extracted);

api.broadcast.emit('myapp:state-changed', { source: 'extraction' });
```

**`viewer.js`** — 본문 상단에서 이벤트를 구독해요. 구독은 실행 사이에도 유지돼요:

```js
// @triggers CHAT_SWITCHED
// @description Viewer: re-renders on emit; cold-start on chat-open.

api.broadcast.on('myapp:state-changed', () => {
  void (async () => {
    try {
      const state = await api.scriptStorage.get('latest-state');
      rerender(state);
    } catch (err) {
      console.warn(`[viewer] rerender failed: ${err.message}`);
    }
  })();
});

// 콜드 스타트 경로 — 채팅이 막 열렸을 때 저장소에 있는 내용을 렌더링해요
if (data.chatId) {
  const state = await api.scriptStorage.get('latest-state');
  rerender(state);
}
```

`viewer.js`의 핸들러는 `producer.js`가 emit할 때마다 실행돼요 — viewer를 직접 실행하는 Lumiverse 트리거가 발생하지 않았더라도 말이죠. 두 스크립트는 완전히 분리되어 있어요: producer는 누가 듣고 있는지 알 필요가 없고, viewer는 무엇이 producer를 트리거했는지 알 필요가 없어요.

## API 구성

```ts
interface BroadcastAPI {
  emit(event: string, payload?: unknown): void;
  on(event: string, handler: (payload: unknown) => void): () => void;
}
```

두 메서드 모두 동기식이에요. 별도의 권한은 필요하지 않아요. 별도의 `off()` 메서드는 없으며, `on()`이 반환한 함수를 호출하여 구독을 해제해요.

### `emit(event, payload?)`

실행 후 잊기(fire-and-forget) 방식이에요. 버스는 등록된 순서대로 현재 구독자들을 순회하며 각 핸들러를 동기적으로 호출해요. 특정 핸들러에서 발생한 오류는 버스에서 잡아서 로그에 기록하므로, 잘못 작성된 핸들러 하나 때문에 다른 핸들러 실행이 중단되지 않아요. 반환값은 void예요.

- **`event`** — 이벤트 이름이에요. 스크립트 간 충돌을 방지하기 위해 네임스페이스 접두사를 붙여 사용하세요 (`myapp:state-changed`, `tracker:rerun`). `ls:`로 시작하는 이름은 예약되어 있어요(아래 [예약된 `ls:*` 접두사](#reserved-ls-prefix) 참고). 이 접두사로 emit을 호출하면 오류가 발생해요.
- **`payload`** — 선택 사항이에요. 구조화된 복제(structured clone)가 가능한 모든 값(문자열, 숫자, 일반 객체, 배열 등)을 전달할 수 있어요. 다른 스크립트의 핸들러가 원래 형태 그대로 온전히 수신하기를 기대한다면 함수나 클래스 인스턴스처럼 직렬화할 수 없는 타입은 포함하지 마세요.

### `on(event, handler)`

핸들러를 이벤트에 구독 등록해요. 구독 해제 함수를 반환해요.

- **`event`** — 이벤트 이름이에요. `ls:*` 이벤트는 **구독할 수 있어요**(발행 제한만 단방향으로 적용돼요). 자세한 내용은 [`ls:*`로 엔진 상태 관찰하기](#observing-engine-state-via-ls)를 참고하세요.
- **`handler`** — emit에서 전달된 `payload`를 인수로 받아 호출돼요. 반환값은 무시돼요. 핸들러는 `emit` 내부에서 동기적으로 실행되므로, 표준 비동기 패턴은 [비동기 핸들러](#async-handlers)를 참고하세요.

```js
const unsub = api.broadcast.on('myapp:state-changed', (payload) => {
  console.log(payload?.source);
});

// 나중에 구독이 더 이상 필요 없을 때:
unsub();
```

### 제한 사항

`emit`은 api-proxy 경계에서 호출 빈도 제한(rate limit)과 페이로드 용량 제한이 적용돼요:

- **페이로드 용량 제한**: 1회 emit당 1 MiB (`1_048_576` 바이트). 한도를 초과하면 한도 정보가 포함된 오류가 발생해요.
- **호출 빈도 제한**: 지속 기준 초당 100회, 최대 순간 버스트 1000회 (스크립트별 토큰 버킷 방식). 지속 한도를 초과하는 버스트는 버스트 예산을 소모하며, 예산이 고갈되면 버킷이 다시 채워질 때까지 이후 emit 호출 시 오류가 발생해요.

이 제한은 스크립트별로 독립 적용되므로, 여러 스크립트가 서로에게 영향을 주지 않고 각자의 한도 내에서 동작해요. 일반적인 사용 사례(채팅 이벤트 반응, 주기적인 상태 알림 등)에서는 이 한도에 도달할 일이 거의 없어요. 만약 한도에 걸린다면 핸들러 내부에서 무한 루프가 돌고 있지 않은지 패턴을 재검토해 보세요.

## 구독 수명 주기

이 부분은 잘 이해해 두는 것이 중요해요. 구독은 단일 트리거 실행보다 더 오래 살아남아요. 스크립트의 수명 동안 실행 전반에 걸쳐 유지되며, 호스트는 현재 실행이 끝날 때가 아니라 스크립트의 **다음 트리거 실행이 시작될 때** 구독을 초기화해요.

타임라인은 다음과 같아요:

1. 스크립트 A에 대한 트리거가 발생해요.
2. 호스트가 버스에서 스크립트 A의 기존 구독을 지워요(본문이 실행되기 전 `src/script-runner/host-dispatcher.ts`의 `busClearByScriptId`).
3. 스크립트 A의 본문이 실행돼요. `api.broadcast.on(...)` 호출이 새 구독을 다시 등록해요.
4. 스크립트 A의 본문 실행이 끝나요. **구독은 손대지 않은 채 버스에 그대로 남아요.**
5. 스크립트 B가 스크립트 A가 구독 중인 이벤트를 emit해요. 스크립트 A의 핸들러가 실행돼요.
6. 스크립트 A에 또 다른 트리거가 발생해요 → 구독 초기화 → 본문 재실행 → 재구독.

4단계와 다음 초기화 사이의 구간이 바로 핵심이에요. 스크립트 A 자체의 트리거가 발생하지 않아도 스크립트 B의 emit에 반응하여 스크립트 A의 핸들러가 얼마든지 실행될 수 있어요. 실행 *종료*(4단계)가 아니라 실행 *시작*(2단계) 시점에 초기화가 일어나므로, *N*번째 실행에서 등록된 구독은 *N+1*번째 실행이 시작될 때까지 살아남아요.

### 이를 통해 가능한 것

- **구독 전용 스크립트.** 스크립트 B는 스크립트 A를 실행하는 트리거를 굳이 함께 구독할 필요 없이 `myapp:state-changed`만 구독할 수 있어요. 스크립트 B는 본문을 한 번 실행해 구독을 등록하기 위한 *최초 1회의 트리거*(예: 가벼운 `CHAT_SWITCHED` 콜드 스타트)만 있으면 돼요. 그 후에는 스크립트 A가 emit할 때마다 스크립트 B의 핸들러가 영구히 반응해요.
- **경쟁 상태 없는 조율.** 두 스크립트가 모두 `GENERATION_ENDED`를 구독하고 하나는 비동기 쓰기를, 다른 하나는 동기 읽기를 수행하는 경우 쓰기와 읽기 사이에 경쟁이 발생해요. 읽기 작업을 브로드캐스트 핸들러 안으로 옮기고, 쓰기 스크립트에서 쓰기 작업이 *완료된 후* 이벤트를 emit하도록 바꾸면 경쟁 상태가 완전히 사라져요. 아래에 구체적인 예제가 있어요.

## 동일 트리거 스크립트 간의 결합 분리

대표적인 문제 상황을 살펴볼게요. `extractor.js` 스크립트가 `GENERATION_ENDED`를 구독하여 `api.db.*`에 데이터를 기록하는 비동기 LLM 추출(수 초가 걸리는 네트워크 호출)을 수행해요. 동시에 `panel.js`도 `GENERATION_ENDED`를 구독하여 해당 상태를 읽고 화면에 패널을 다시 렌더링해요. Lumiverse는 두 스크립트를 동시에 실행하므로, `panel.js`의 읽기는 수 밀리초 만에 끝나 버리지만 `extractor.js`의 쓰기는 수 초 동안 끝나지 않아요. 결과적으로 패널은 추출 이전의 옛날 상태를 렌더링하고 다시는 업데이트되지 않아요.

해결책 — 생성 스크립트에서는 쓰기 완료 후 emit하고, 소비 스크립트에서는 이를 구독해요:

```js
// extractor.js — 상태가 변경될 때마다 emit
async function runExtraction(...) {
  const events = await llmExtract(...);
  await insertEvents(events);
  api.broadcast.emit('myapp:state-changed', { source: 'llm-extraction' });
}
```

```js
// panel.js — 본문 상단에서 구독; GENERATION_ENDED 의존성 제거
api.broadcast.on('myapp:state-changed', () => {
  void (async () => {
    try { await rerender(); }
    catch (err) { console.warn(`[panel] ${err.message}`); }
  })();
});

// 콜드 스타트 경로 — 채팅이 막 열렸을 때 저장소에 있는 내용을 렌더링해요
if (data.chatId) {
  await rerender();
}
```

이제 뷰어 스크립트의 트리거 목록은 (콜드 스타트용) `CHAT_SWITCHED` 하나로 줄어들어요. 브로드캐스트 핸들러가 경쟁 상태 없이 생성 후의 모든 업데이트를 깔끔하게 처리해요.

<a id="reserved-ls-prefix"></a>

## 예약된 `ls:*` 접두사

`ls:`로 시작하는 이벤트 이름은 엔진 내부 브로드캐스트용으로 예약되어 있어요. 사용자 스크립트에서 `emit('ls:anything', ...)`을 호출하면 오류가 발생해요:

```
Error: api.broadcast.emit: "ls:" prefix is reserved for LumiScript internal events. Use a different event name.
```

(`src/engine/api/broadcast.ts:34-40`에서 강제돼요.)

스크립트에서 `ls:*` 이벤트를 **구독하는 것**은 얼마든지 가능해요. 제한은 오직 emit 쪽에만 적용돼요.

<a id="observing-engine-state-via-ls"></a>

### `ls:*`로 엔진 상태 관찰하기

엔진은 상태 관찰과 스크립트 간 반응을 위해 구독할 수 있는 여러 `ls:*` 이벤트를 발행해요. 도구 수명 주기 이벤트(`ls:tool:registered`, `ls:tool:unregistered`, `ls:tool:invoked`)는 [도구 등록](tools.md) 문서에 설명되어 있어요. 그 외에도 스크립트가 활성 상태로 들어갈 때(부팅 또는 활성화 시점) 발생하는 `ls:startup` 이벤트와 데이터베이스/테마 관련 이벤트 등이 있어요. 페이로드 형태를 포함한 전체 최신 목록은 앱 내 레퍼런스의 "Broadcast Events" 절을 확인하세요.

`ls:*` 구독의 대표적인 활용 사례:

- **스크립트 간 동작 관찰** — 디버깅 스크립트가 세션 전반의 도구 호출을 기록하기 위해 모든 `ls:tool:invoked`를 수집할 수 있어요.
- **엔진 시작 시 재초기화** — 콜드 스타트마다 DOM 바인딩을 다시 맺거나 연결을 열어야 하는 스크립트가 `ls:startup`을 구독할 수 있어요.
- **다른 스크립트의 데이터베이스 변경에 반응** — 뷰어 스크립트가 폴링 없이 화면을 새로고침하기 위해 관련 `ls:db:*` 이벤트를 구독할 수 있어요.

<a id="async-handlers"></a>

## 비동기 핸들러

`emit`은 동기식이에요 — 버스는 핸들러 목록을 순회하며 각 핸들러를 동기적으로 호출해요. 비동기 핸들러를 작성할 때는 **emit 내부에서 `await`하지 마세요** (어차피 emit은 핸들러를 기다려 주지 않으며, 핸들러의 최상위 `await`에서 오류가 나면 처리되지 않은 거부(unhandled rejection)가 발생해요).

표준 패턴은 자체 try/catch를 갖춘 즉시 실행 비동기 함수(IIFE)로 감싸는 것이에요:

```js
api.broadcast.on('my:event', () => {
  void (async () => {
    try {
      await doAsyncWork();
    } catch (err) {
      console.warn(`[my-script] handler failed: ${err.message}`);
    }
  })();
});
```

내부의 try/catch는 매우 중요해요. 이것이 없으면 비동기 오류가 처리되지 않은 거부가 되어 버스의 자체 핸들러별 오류 감지 로직에 도달하지 못하므로, 로그에서 어느 스크립트의 문제인지 추적하기 어려워져요.

## 고정(Pinning) 정책

(참고: 워커 퇴출 및 고정 동작의 전체적인 내용은 [`concepts/handler-lifetime.md`](../concepts/handler-lifetime.md) 문서를 확인하세요.)

워커 퇴출 및 고정 정책은 스크립트마다 "이 스크립트에 중요한 백그라운드 상태가 유지되고 있는가?"를 검사해요. `ls:*`가 아닌 사용자 브로드캐스트 구독은 이 조건에 해당해요. 죽은 워커로 전달된 브로드캐스트는 조용히 유실되므로, 향후 발생할 워커 간 이벤트를 수신할 수 있도록 해당 워커를 메모리에 고정(pin)해 두는 것이에요.

- **`ls:*`가 아닌 일반 구독은 워커를 고정해요.** `on()`이 반환한 구독 해제 함수를 명시적으로 호출하거나 스크립트가 비활성화/삭제될 때까지 워커는 준비 상태(warm)를 유지해요.
- **`ls:*` 구독은 워커를 고정하지 않아요.** 엔진 수명 주기 이벤트는 워커 내부의 로컬 활동에 따른 부수 효과로만 발생하므로, 정의상 이벤트가 발생할 때 워커는 이미 살아 있어요. `ls:*` 구독에까지 고정을 적용하면 `ls:startup`을 수신하는 모든 스크립트가 불필요하게 메모리를 계속 차지하게 돼요.

실제 적용 시 차이점: `ls:startup` 재초기화 핸들러와 사용자 이벤트 핸들러를 함께 등록한 스크립트는 후자 덕분에 워커가 고정돼요. 반면 `ls:*` 구독*만* 가진 스크립트는 유휴 상태일 때 메모리 절약을 위해 퇴출될 수 있어요.

## 권장 규칙

### 네임스페이스 규칙

이벤트 이름은 `<scriptName>:<verb>` 형식을 권장해요:

- `tracker:state-changed`
- `weather-provider:cache-invalidated`
- `myapp:filters-applied`

이렇게 하면 로그를 볼 때 이벤트가 어디서 시작되었는지 한눈에 알 수 있고, 서로 다른 스크립트가 둘 다 `state-changed`라는 이름을 써서 충돌하는 일을 방지할 수 있어요.

### 페이로드의 `source` 필드

관례적으로 어떤 작업으로 인해 이벤트가 발생했는지를 나타내는 `source` 필드를 포함하는 것이 좋아요:

```js
api.broadcast.emit('tracker:state-changed', { source: 'llm-extraction' });
api.broadcast.emit('tracker:state-changed', { source: 'user-edit' });
api.broadcast.emit('tracker:state-changed', { source: 'rollback' });
```

구독자가 이 필드를 반드시 읽을 필요는 없지만 디버깅에 큰 도움이 되며, 나중에 뷰어가 소스에 따라 선별적으로 렌더링(추출 시에는 깜빡임 효과, 사용자 수정 시에는 생략 등)할 때도 유용해요.

## 흔한 실수

- **조건부 구독은 다음 초기화 때 사라져요.** 특정 실행에서만 참이 되는 `if` 문 안에 `api.broadcast.on(...)`을 넣으면 다음 트리거 실행 시 구독이 지워져 버려요. 본문 최상단에서 무조건 구독하거나, 조건부 수명 주기라는 점을 명확히 인지하고 사용해야 해요.

- **`emit`은 비동기 핸들러를 기다려 주지 않아요.** 핸들러는 emit 내부에서 동기적으로 호출되며, 내부의 모든 비동기 작업은 분리되어 따로 실행돼요. 핸들러 간에 취합할 수 있는 반환값도 없어요.

- **`ls:*`를 emit하면 예외가 발생해요.** 스크립트에서 내부 네임스페이스용 이벤트를 발행하고 싶다면 `ls:*` 대신 `myapp:`이나 `<scriptName>:internal:` 같은 접두사를 사용하세요.

- **핸들러는 스크립트 이름 순이 아니라 구독 등록 순서대로 실행돼요.** 스크립트 간의 실행 순서에 의존하지 마세요. 워커가 재시작되면 순서가 바뀔 수 있어요.

- **워커 간 브로드캐스트는 IPC를 거쳐요.** 두 스크립트가 서로 다른 워커 하위 프로세스에서 실행 중인 경우 emit은 호스트 IPC를 통해 전달돼요. 종료된 워커로의 전달은 조용히 무시되지만, 실제로는 고정 정책이 대상 워커를 계속 살려 두므로 문제가 되지 않아요. 등록된 구독 핸들러가 실행되지 않는 현상을 디버깅할 때 알아두면 좋아요.

- **스크립트 코드를 수정해도 구독은 유지되지 않지만, 초기화 및 재실행 모델 덕분에 자연스럽게 갱신돼요.** 본문을 수정하고 저장해도 워커가 재시작되지는 않지만, 다음 트리거 실행 때 기존 구독이 지워지고 새 본문의 구독이 다시 등록돼요. 새 본문에서 필요한 구독을 올바르게 등록한다면 문제없이 전환돼요.

## 브로드캐스트와 다른 이벤트 기능 비교

LumiScript에는 형태가 비슷한 네 가지 이벤트 관련 기능이 있어요. 비슷해 보이지만 서로 다른 문제를 해결해요:

| 요구 사항 | 권장 기능 | 필요 권한 |
|---|---|---|
| Lumiverse 호스트 이벤트(MESSAGE_SENT, GENERATION_ENDED, CHAT_SWITCHED 등)에 반응 | 스크립트 편집기 UI의 이벤트 선택기 — [트리거 모델](../concepts/trigger-model.md) 참고. 연결된 이벤트가 발생하면 스크립트 본문이 핸들러로 실행돼요 | 없음 |
| 동일 환경 내 LumiScript 스크립트 간 실시간 발행/구독(pub/sub) | `api.broadcast.*` — 이 가이드에서 다루는 기능이에요 | 없음 |
| 나중에 조회 가능한 영구 커스텀 이벤트 로그 (감사 추적, 상태 복구, 분석 등) | `api.events.*` — [영구 이벤트](persistent-events.md) 참고 | `event_tracking` |
| 다른 Lumiverse 확장이 내 스크립트의 값을 읽을 수 있는 확장 간 RPC | `api.rpc.*` — [확장 간 RPC](rpc.md) 참고 | 없음 |

**주의해야 할 혼동**: `api.events.*`는 이벤트를 구독하는 기능이 **아니에요**. `track` / `query` / `replay` / `getLatestState`를 제공하는 영구 로그 저장소예요. `api.events.on(...)` 같은 함수는 존재하지 않으니 주의하세요. LumiScript 내부에서 이벤트를 **구독**하는 방법은 딱 두 가지뿐이에요: 편집기 선택기(호스트 이벤트용)와 `api.broadcast.on`(스크립트가 발행한 커스텀 이벤트용).

## 관련 문서

- **앱 내 레퍼런스, "API Functions → api.broadcast" 절** — 자동 생성된 메서드 목록.
- **[`concepts/handler-lifetime.md`](../concepts/handler-lifetime.md)** — 전체 워커 퇴출 및 고정 모델, `ls:*`와 일반 이벤트 정책의 배경 설명.
- **[`concepts/trigger-model.md`](../concepts/trigger-model.md)** — 스크립트 실행 시점과 `data.__event` 구조. 브로드캐스트는 트리거를 보완하는 기능이에요.
- **[도구 등록](tools.md)** — 도구 등록 현황을 관찰하기 위해 `ls:tool:*` 브로드캐스트를 활용하는 방법.
