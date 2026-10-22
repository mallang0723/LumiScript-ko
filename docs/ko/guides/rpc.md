# 확장 기능 간 RPC (Cross-extension RPC)

`api.rpc.*`는 여러분의 스크립트가 명명된 채널에 경량 상태를 게시하여 **다른 Lumiverse 확장 기능**들이 읽을 수 있도록 해줘요. 이 기능은 동일한 설치 환경의 모든 확장 기능이 `read`할 수 있는 호스트 측 엔드포인트 레지스트리인 Spindle의 `rpcPool`을 래핑해요. 자체 HTTP 서버를 구성하거나 파일을 통해 조율할 필요 없이, 동일한 Lumiverse 환경에서 실행 중인 다른 확장 기능에 스크립트 소유의 데이터(상태 스냅샷, 계산된 값, 요청 시 응답 등)를 공개할 때 사용해요.

제공되는 메서드는 4가지이며, 별도의 권한이 필요하지 않아요:

```ts
interface RpcAPI {
  sync<T>(channel: string, value: T, options?: { as?: string; policy?: RpcPolicy }): Promise<string>;
  handle<T>(channel: string, handler: (ctx: RpcRequestContext) => T | Promise<T>, options?: { as?: string; policy?: RpcPolicy }): Promise<string>;
  read<T>(endpoint: string): Promise<T>;
  unregister(channel: string, options?: { as?: string }): Promise<void>;
}
```

`sync`와 `handle`은 둘 다 **정규화된 전체 엔드포인트 문자열**(예: `'lumiscript.tracker.state'`)을 반환하므로, 접두사를 직접 다시 계산할 필요 없이 로깅하거나 다른 곳에 전달할 수 있어요.

## 핵심 개념

Spindle의 RPC 풀은 모든 확장 기능이 게시하고 읽을 수 있는 호스트 측 키스페이스예요. LumiScript는 동일한 LumiScript 환경 내의 사용자 스크립트끼리 충돌하지 않도록 2단계 네임스페이스로 이를 감싸요:

```
lumiscript.<scriptSlug>.<channel>
```

- **`lumiscript.`** — Spindle에 의해 자동 추가되는 확장 기능 식별자 접두사예요.
- **`<scriptSlug>`** — LumiScript가 스크립트 이름으로부터 파생(`[a-z0-9_-]+` 형태로 슬러그화)하여 추가해요. 자동 생성된 형태가 적합하지 않을 경우 `options.as`로 재정의할 수 있어요.
- **`<channel>`** — 사용자가 직접 지정하는 부분이에요(다단계 경로를 위해 `.`을 포함할 수 있어요).

예를 들어 이름이 "Story Tracker"인 스크립트가 `api.rpc.sync('state', currentState)`를 호출하면 `lumiscript.story-tracker.state`로 게시돼요. 이름이 서로 다른 두 스크립트가 동일한 `'state'` 채널을 게시하더라도 서로 다른 엔드포인트를 가지므로 충돌이 발생하지 않아요.

## 권한 필요 없음

`api.rpc.*`는 **무료 티어(free tier)**예요. `assertPerm` 권한 검사가 없으며, `spindle.json`에 권한을 선언할 필요도 없어요. 다만 등록 행위는 추적 가능해요: LumiScript는 모든 `sync` / `handle` 등록을 백엔드 콘솔에 한 줄씩 기록하여(서버 측 콘솔이며 사용자 스크립트 콘솔이 아님) 확장 기능 간 노출을 감사할 수 있도록 지원해요:

```
[Spindle:lumiscript] [LumiScript] script "Story Tracker" registered lumiscript.story-tracker.state (sync) for cross-extension visibility
```

읽기(`read`)는 기록되지 않으며, 등록 작업만 기록돼요.

## `sync` vs `handle` — 스냅샷 vs 요청 시 계산

두 게시 메서드는 **값이 계산되는 시점**이 달라요:

| 메서드 | 동작 방식 | 사용 용도 |
|---|---|---|
| `sync(channel, value, options?)` | 풀에 `value`를 저장해요. 읽는 쪽은 스크립트 콜백 없이 즉시 값을 가져가요. | 최신 값 스냅샷, 접속 플래그, 변경 시마다 다시 게시하는 계산된 상태 |
| `handle(channel, handler, options?)` | 콜백 함수를 저장해요. `read`가 일어날 때마다 콜백이 실시간으로 호출되며, 핸들러가 반환하는 값을 읽는 쪽에 전달해요. | 호출자별 맞춤 응답, 변경 시마다 매번 계산하기엔 비용이 큰 쿼리, `requesterExtensionId` 기반 제어 |

이미 `handle`로 등록된 채널에 `sync`를 호출하거나(그 반대의 경우도 마찬가지), 기존 등록을 **대체**해요. 동일 스크립트의 동일 채널은 단 하나의 슬롯만 차지해요.

### `sync` — 스냅샷 게시

```js
// @triggers ls:startup, MESSAGE_SENT

// "이번 세션의 메시지 수" 카운터를 유지하고 변경될 때마다 게시해요.
globalThis.sessionCount ??= 0;
if (data.__event === 'MESSAGE_SENT' && data.message.is_user) {
  globalThis.sessionCount += 1;
}

await api.rpc.sync('session-stats', {
  messageCount: globalThis.sessionCount,
  startedAt:    globalThis.sessionStartedAt ??= Date.now(),
});
```

이제 다른 모든 확장 기능이 `lumiscript.<your-script-slug>.session-stats`를 읽어 현재 스냅샷을 가져갈 수 있어요. 값은 호스트 레지스트리에 상주하므로 등록이 유효한 한 읽기 작업이 수행될 때 여러분의 스크립트가 실행 중일 필요가 없어요.

### `handle` — 요청 시 실시간 응답

```js
// @triggers ls:startup

await api.rpc.handle('recent-events', async (ctx) => {
  // ctx.endpoint:             'lumiscript.<your-slug>.recent-events'
  // ctx.requesterExtensionId: 예: 'tracker_dashboard'
  // ctx.effectivePermissions: 엔드포인트 정책에 따른 ['chat_mutation', ...]

  const events = await api.events.query({ limit: 50 });
  return {
    caller: ctx.requesterExtensionId,
    events,
  };
});
```

핸들러는 다른 확장 기능이 해당 엔드포인트를 `read`할 때마다 실행돼요. 비동기 핸들러는 완료될 때까지 대기하며, 던져진 예외는 호출한 확장 기능에 거부된(rejected) `read()` 프로미스로 전달돼요.

## 다른 확장 기능으로부터 읽기

`read(endpoint)`는 수신 측 메서드예요. 이때는 **완전한 정규화 엔드포인트 이름(fully-qualified name)**을 전달해야 해요. 읽기 대상은 보통 접두사가 `lumiscript.`가 아닌 다른 확장 기능일 수 있으므로 읽기 경로에서는 자동으로 접두사를 붙여주지 않아요:

```js
// 가상의 날씨 확장 기능으로부터 읽기:
const weather = await api.rpc.read('weather_ext.current');

// 다른 LumiScript 스크립트로부터 읽기 (lumiscript.<slug>. 접두사 사용):
const trackerState = await api.rpc.read('lumiscript.story-tracker.state');
```

다음 상황에서 읽기 프로미스가 거부(reject)되며 구체적인 에러가 발생해요:

- **잘못된 엔드포인트 이름** (형식 오류)
- **등록되지 않은 엔드포인트** (게시자가 비활성화되었거나 등록된 적이 없거나 언로드됨)
- **핸들러 예외 발생** (핸들러 모드 엔드포인트에서 예외를 던짐 — 상위에서 던진 메시지가 포함됨)
- **핸들러 시간 초과** (Spindle 측 기본 타임아웃 제한 도달)

읽기를 호출하는 확장 기능은 `read`를 호출하기 위해 특별한 권한이 필요하지 않지만, 호스트는 게시자가 지정한 `RpcPolicy`를 강제 적용해요(아래 설명 참고).

## `RpcPolicy` — 권한 위임 제어

`sync`와 `handle`에서 선택적으로 전달할 수 있는 `policy` 옵션은 소유자(OWNER)의 권한이 요청자(requester) 주도 호출에 어떻게 전달될지 제어해요. 세 가지 모드가 있어요:

| 정책 형태 | 소유자 권한 위임 방식 | 사용 용도 |
|---|---|---|
| `options.policy` 생략 | 레거시 기본값: 요청자는 소유자가 현재 가진 **모든** 권한을 반드시 보유해야 함. 권한 남용 대리(confused-deputy) 방지. | RC2 이전 스크립트를 위한 하위 호환용 기본값. 새 엔드포인트에는 권장하지 않음 |
| `policy: { requires: [] }` | 권한 위임 없음. 모든 확장 기능이 엔드포인트를 읽을 수 있으며, 핸들러는 소유자 권한이 0인 상태로 실행됨. | 요청자의 권한 보유 여부와 무관한 공개/단순 엔드포인트 (접속 플래그, 버전 정보, 상태 핑 등) |
| `policy: { requires: ['perm', ...] }` | 소유자와 요청자 **둘 다** 목록에 지정된 모든 권한을 보유해야 함. 핸들러 내부에서 권한이 필요한 `api.*` 호출은 이 선언된 집합으로 제한됨. | 명시적인 좁은 위임 — "이 엔드포인트는 요청자에게 명시된 권한만 부여함" |

`requires` 배열은 **명시적 계약**이에요: 핸들러 실행 컨텍스트에 흘러 들어갈 권한 목록을 정의해요. 목록 외의 소유자 권한은 핸들러로 새어나가지 않아요.

### 예제 — 공개 접속 신호 (Public presence beacon)

권한 복잡성 없이 모든 확장 기능이 읽을 수 있는 단순한 "이 스크립트가 활성 상태인가?" 엔드포인트:

```js
// @triggers ls:startup

await api.rpc.sync('alive', true, {
  policy: { requires: [] },   // 의도적으로 공개
});
```

읽는 쪽은 `await api.rpc.read('lumiscript.<your-slug>.alive')`를 호출할 수 있으며, 자체 권한 보유 여부와 무관하게 `true`를 반환받아요.

### 예제 — 명시적 권한 범위 지정

```js
// @triggers ls:startup

// 최근 메시지 50개를 공개하되, chat_mutation 권한을 보유한 읽기 요청자에게만 허용해요.
// 핸들러 내부에서는 chat_mutation으로 제한된 api.* 호출만 사용할 수 있으며,
// 소유자가 가진 다른 권한은 누출되지 않아요.
await api.rpc.handle('recent-messages', async (ctx) => {
  return api.chat.getMessages({ last: 50 });
}, {
  policy: { requires: ['chat_mutation'] },
});
```

`chat_mutation` 권한이 없는 읽기 확장 기능은 거부돼요. `chat_mutation` 권한이 있는 확장 기능은 메시지를 가져올 수 있으며, 핸들러가 수행하는 권한 작업은 오직 `['chat_mutation']`에 대해서만 검증돼요. 소유자가 가진 `databanks`나 `image_gen` 같은 다른 권한은 위임되지 않아요.

### `RpcRequestContext.effectivePermissions`

핸들러는 `ctx.effectivePermissions: readonly string[]` 속성을 받아요 — 이는 정책 적용 후 이번 호출에 실제로 위임된 권한 목록이에요. 핸들러에서 분기 처리를 위해 활용할 수 있는 안내 신호예요:

```js
await api.rpc.handle('audit-feed', async (ctx) => {
  if (!ctx.effectivePermissions.includes('event_tracking')) {
    // 호출자가 추적 이벤트를 읽을 수 없으므로 대체 안내를 반환해요.
    return { available: false, reason: 'event_tracking not delegated' };
  }
  return { available: true, events: await api.events.query({ limit: 100 }) };
}, {
  policy: { requires: ['event_tracking'] },
});
```

실제 권한 제약은 호스트가 강제하므로, 이 필드는 전체 경로에 필요한 권한보다 위임된 권한이 좁을 때 핸들러 로직이 점진적으로 기능 저하(graceful degradation)할 수 있도록 돕는 용도예요.

## 슬러그와 채널

두 필드의 문자 제한 조건은 약간 달라요:

| 필드 | 허용 문자 | 자동 생성 규칙 | 유효하지 않을 때 |
|---|---|---|---|
| `scriptSlug` (이름에서 자동 파생, 또는 `options.as`) | `[a-z0-9_-]+` | 소문자 변환, 공백을 `-`로 변환, 매핑 불가능 문자 제거, 연속된 `-` / `_` 축소, 앞뒤 잔여 문자 제거(trim) | 빈 문자열이 되면 예외 발생; 사용자가 제공한 `options.as`가 형식에 맞지 않으면 예외 발생 (자동 교정 없음) |
| `channel` | `[a-z0-9_.-]+`, 비어있지 않음 | 없음 — 항상 리터럴 그대로 사용 | 예외 발생 |

슬러그 변환 규칙은 엄격해요: "Story Tracker!"라는 스크립트는 `story-tracker`가 돼요. 문자가 없는 "!!!" 같은 스크립트는 슬러그가 `""`가 되어 에러를 던지므로 `options.as`를 전달하여 재정의해야 해요.

`options.as`는 **자동 정규화되지 않고 엄격하게 검증**돼요. 재정의 시의 오타가 조용히 다른 값으로 변형되기보다는 명확히 실패해야 한다는 원칙 때문이에요. 대문자와 공백이 포함된 `options.as: 'Story Tracker'`는 에러를 던지며, `'story-tracker'` 형태로 전달해야 해요.

채널은 슬러그 아래 다단계 경로를 위해 `.`을 포함할 수 있어요 — 따라서 `'chat.messages.recent'`는 유효한 채널이며, `lumiscript.<slug>.chat.messages.recent`가 생성돼요.

## 수명 주기

다음과 같은 상황에서 엔드포인트는 자동으로 등록 해제(unregister)돼요:

- **스크립트 비활성화** — `ls:teardown`을 발생시키는 동일한 정리 절차를 통해 해제돼요(RPC 저장소가 스크립트 소유의 모든 엔드포인트를 순회하며 각각 `spindle.rpcPool.unregister`를 호출함).
- **스크립트 삭제** — 동일한 해제 경로를 따라요.
- **재실행 후 방치된 엔드포인트 정리(Stale-after-re-run)** — 매크로, 도구 및 기타 등록 엔티티에 적용되는 diff-and-clean 절차가 적용돼요. 스크립트가 다시 실행될 때 이전에 게시했던 엔드포인트를 다시 등록하지 않으면 방치된 항목이 자동으로 정리돼요.
- **확장 기능 언로드** — LumiScript 자체가 언로드될 때(확장 기능 토글 끄기, 앱 종료 등) Spindle의 수명 주기 보장에 따라 모든 LumiScript 소유 엔드포인트가 해제돼요.

`unregister(channel, options?)`를 사용하여 명시적으로 등록을 해제할 수도 있어요 — 멱등성을 가지므로 등록된 적 없는 채널이어도 안전해요. 등록 시 사용했던 것과 동일한 `options.as`를 전달하세요.

## 활용 사례

### 확장 기능 간 상태 공유

LumiScript 기반의 스토리 트래커가 풍부한 채팅 상태를 유지하고 있어요. 비 LumiScript 대시보드 확장 기능이 사이드바에 그 상태를 렌더링하고 싶어 해요. 게시자 측:

```js
// @triggers ls:startup, MESSAGE_SENT, GENERATION_ENDED

await api.rpc.sync('tracker-state', currentState, {
  policy: { requires: [] },   // 공개 — 권한 제약 없음
});
```

읽는 쪽 (대시보드 확장 기능 내부):

```js
const state = await spindle.rpcPool.read('lumiscript.story-tracker.tracker-state');
renderSidebar(state);
```

### 호출자별 맞춤 RPC

스크립트가 "현재 퀘스트 상태"를 제공하되 요청자에 따라 필터링하고 싶을 때:

```js
await api.rpc.handle('quest-status', (ctx) => {
  if (ctx.requesterExtensionId === 'trusted-dashboard') {
    return { full: true, ...allQuestState };
  }
  return { full: false, activeQuestId: allQuestState.activeId };
});
```

### 공개 버전 및 기능 안내

```js
await api.rpc.sync('version', {
  scriptVersion:  '2.3.1',
  apiVersion:     'rpc-v1',
  features:       ['quest-tracking', 'inventory'],
}, {
  policy: { requires: [] },   // 누구나 읽을 수 있음
});
```

다른 확장 기능은 이를 읽어 어떤 기능이 지원되는지 감지하고, 예상 기능이 누락된 경우 안전하게 대체 동작을 수행할 수 있어요.

## `api.broadcast`와 비교

두 인터페이스 모두 pub/sub 형태를 띠지만 대상 범위가 달라요:

| 요구사항 | 적합한 API |
|---|---|
| 동일 설치 환경 내 LumiScript 스크립트 간 실시간 이벤트 전달 | `api.broadcast.*` (페이로드를 동반한 프로세스 내 이벤트 emit/on) |
| 확장 기능 간(LumiScript ↔ 기타 Lumiverse 확장 기능) 풀(Pull) 기반 상태 조회 | `api.rpc.*` |
| 다른 확장 기능이 폴링할 수 있는 최신 값 스냅샷 | `api.rpc.sync` |
| 스크립트 상태 / API 호출이 관여될 수 있는 호출자 주도 연산 | `api.rpc.handle` |
| 확장 기능 외부에 노출할 필요 없는 스크립트 간 메시징 | `api.broadcast` (더 가볍고 호스트 측 레지스트리가 없음) |

두 API는 깔끔하게 공존해요. 자주 쓰이는 패턴: LumiScript 스크립트 간 대화에는 `api.broadcast`를 사용하고, LumiScript 외부 확장 기능이 소비할 수 있는 집계 상태 게시에는 `api.rpc.sync`를 사용하는 것이에요.

## 에러 처리

| 원인 | 에러 형태 |
|---|---|
| 유효하지 않은 채널 형식 | `Error: api.rpc: invalid channel "<channel>" — must match /^[a-z0-9_.-]+$/ and be non-empty.` |
| 자동 파생 결과 빈 슬러그 발생 | `Error: api.rpc: cannot derive a slug from "<name>" — pass options.as with a valid slug (lowercase letters, numbers, _, -).` |
| 유효하지 않은 `options.as` 재정의 | `Error: api.rpc: invalid slug override "<slug>" — must match /^[a-z0-9_-]+$/.` |
| 등록되지 않았거나 비활성화된 엔드포인트에 `read` 호출 | 호스트가 던지는 에러 (메시지 다양함) |
| `read` 핸들러 예외 발생 | 상위에서 발생한 예외 메시지를 담아 프로미스 거부 |
| `read` 핸들러 시간 초과 | 호스트가 던지는 타임아웃 에러 |

`unregister`는 멱등성을 가지므로 존재하지 않는 채널이어도 에러를 던지지 않아요.

## 버전 정보

**v0.26.0+**에서 구현되었어요. 2단계 네임스페이스(`lumiscript.<scriptSlug>.<channel>`)는 도입 이후 안정적으로 유지되고 있어요. `RpcPolicy`와 `effectivePermissions`는 호스트 측 권한 위임 강제 적용과 함께 **RC2**에서 추가되었어요. `options.policy`를 생략하는 스크립트는 RC2 이전 레거시 동작(요청자가 소유자의 모든 권한을 상속받아야 함)을 따르도록 설계되어 하위 호환성을 보장해요.
