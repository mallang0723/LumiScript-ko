# 영속 이벤트 (Persistent events)

`api.events.*`는 스크립트가 기록(`track`)하고 다시 읽어올(`query` / `replay` / `getLatestState`) 수 있는 **커스텀 이벤트 영속 로그**예요. 호스트는 각 이벤트를 서버 측 타임스탬프, 선택적 채팅 연결 정보, 심각도(severity level)와 함께 저장해요. 이 로그는 스크립트 재로드, 확장 기능 토글, Lumiverse 재시작 후에도 유지되므로 지속적이고 조회가 가능한 이력이 필요한 곳에 유용해요.

제공되는 메서드는 4가지예요:

```ts
interface EventsAPI {
  track(eventName: string, payload?: Record<string, unknown>, options?: EventTrackOptions): Promise<void>;
  query(filter?: EventQueryFilter):  Promise<EventRecord[]>;   // newest-first
  replay(filter?: EventQueryFilter): Promise<EventRecord[]>;   // oldest-first
  getLatestState(keys: string[]):    Promise<Record<string, unknown>>;
}
```

4개 메서드 모두 `event_tracking` 권한이 필요해요.

## 이 API가 아닌 것

LumiScript에서 가장 혼동하기 쉬운 네임스페이스 이름이므로 먼저 구분을 명확히 짚고 넘어갈게요:

| `api.events.*` | 이런 기능이 아니에요 |
|---|---|
| 기록(`track`)하고 다시 읽어오는(`query` / `replay`) 영속 로그 | Lumiverse 호스트 이벤트(MESSAGE_SENT, GENERATION_ENDED 등) 구독 메커니즘 |
| 감사 내역(audit trail), 상태 복구, 분석 형태의 관측성 지원 | 채팅 / 텍스트 생성 이벤트에 반응하는 기능 |

**호스트 이벤트에 반응(구독)**하고 싶다면(MESSAGE_SENT, CHAT_SWITCHED 등), 편집기의 이벤트 선택기를 통해 스크립트를 연결해야 해요 — [트리거 모델](../concepts/trigger-model.md)을 참고하세요. `api.events.on()`이나 `api.events.subscribe()` 같은 메서드는 존재하지 않으며, 이는 개념상 범주가 달라요. 연결된 이벤트가 발생하면 스크립트 본문 자체가 핸들러로서 실행돼요.

**스크립트 간 메시징**(동일한 LumiScript 확장 기능 내에서 실행 중인 스크립트 간 pub/sub)을 원하신다면 `api.broadcast.*`를 사용하세요 — [브로드캐스트 버스 가이드](broadcast.md)를 참고하세요.

`api.events.*`는 오직 **스크립트가 나중에 조회할 목적으로 자체 커스텀 이벤트를 기록**하기 위한 용도예요. 구조화되고 영속적인 `console.log` 위에 HTTP 스타일의 로그 쿼리 API가 얹혀 있는 모습이라고 생각하시면 돼요.

## 인터페이스 규격

```ts
type EventLevel = 'debug' | 'info' | 'warn' | 'error';

interface EventTrackOptions {
  level?:         EventLevel;       // 기본값 'info'
  chatId?:        string;            // 기본값: 활성 채팅
  retentionDays?: number;            // 기본값: 호스트 측 기본 설정
}

interface EventQueryFilter {
  eventName?: string;
  chatId?:    string;
  since?:     string;                // ISO 8601 타임스탬프
  until?:     string;                // ISO 8601 타임스탬프
  level?:     EventLevel;
  limit?:     number;
}

interface EventRecord {
  id:        string;
  ts:        string;                 // ISO 8601 타임스탬프
  eventName: string;
  level:     EventLevel;
  chatId?:   string;
  payload?:  Record<string, unknown>;
}
```

## 권한

4가지 메서드 모두 **`event_tracking`** 권한이 필요해요. 권한 검사는 LumiScript 래퍼 내부에서 직접 수행되며, 권한이 누락되면 모든 메서드가 다음 에러를 던져요:

```
Error: api.events requires the event_tracking permission
```

**주의 — 다른 LS API와 에러 형식이 달라요.** 대부분의 LumiScript 권한 검사는 `assertPerm()`을 사용하여 `Error: PERMISSION_DENIED:<perm> — grant this permission to use this API` 형식의 메시지를 내요. 하지만 `api.events`는 공유 헬퍼 대신 인라인으로 가드를 처리하여 자체 에러 메시지를 던져요. 따라서 감지할 때 `msg.includes('PERMISSION_DENIED')`를 쓰지 마시고, 리터럴 문자열 `'requires the event_tracking permission'` 또는 단순히 `'event_tracking'` 문자열 매칭을 사용하세요.

## 빠른 시작

채팅 기반 트리거에서 이벤트를 몇 개 기록한 뒤 다시 쿼리해 볼게요:

```js
// @triggers MESSAGE_SENT
// @description 분석 대시보드를 위해 모든 유저 메시지 길이를 기록해요.

if (!data.message.is_user) return;

await api.events.track('user-message', {
  length:    data.message.content.length,
  hasMention: /@\w+/.test(data.message.content),
});
```

나중에 다른 스크립트나 다른 트리거에서 이 이벤트들을 다시 읽어올 수 있어요:

```js
// @triggers ls:startup

// 활성 채팅의 최근 user-message 이벤트 50개 가져오기:
const recent = await api.events.query({
  eventName: 'user-message',
  limit:     50,
});

const totalChars = recent.reduce((sum, e) => sum + (e.payload?.length ?? 0), 0);
console.log(`User has typed ${totalChars} chars across the last ${recent.length} messages`);
```

호출자 관점에서 `track`은 fire-and-forget 방식처럼 쓸 수 있어요 — 호스트가 이벤트를 영속화한 후 완료되는 Promise를 반환하지만, `await`로 대기하는 것 외에 반환값을 처리할 필요는 없어요(영속화 실패 에러를 확인하려면 `await`를 권장해요).

## `query` vs `replay` — 정렬 방향에 따른 선택

두 읽기 메서드는 오직 **정렬 순서**만 달라요:

| 메서드 | 반환 순서 | 사용 용도 |
|---|---|---|
| `query(filter?)` | 최신순 (Newest-first) | 최근 활동 가져오기, 현재부터 과거로 페이지네이션, "최근 N개 이벤트" 패턴 |
| `replay(filter?)` | 시간순 (Oldest-first) | 순차적 상태 복원, 과거부터 이력 재생, "시작 지점부터 순회" 패턴 |

필터 형태는 완전히 동일해요. 둘 다 `limit`을 따르며(기본값은 호스트 측 설정, 보통 100개), 대규모 이력의 경우 제한 없는 `query`보다 명시적인 `since` / `until` 범위를 지정한 `replay`를 권장해요. 명확한 시간 범위에서 시간순 재생을 수행하는 편이 임의의 최신순 검색보다 흐름을 파악하기 쉬워요.

```js
// 채팅 시작 지점부터 퀘스트 상태 재구성:
const activeChat = await api.chats.getActive();
if (!activeChat) return;

const allQuests = await api.events.replay({
  eventName: 'quest-updated',
  chatId:    activeChat.id,
});

let questState = {};
for (const event of allQuests) {
  questState = { ...questState, ...event.payload };
}
```

## `getLatestState` — 재시작 후 빠른 상태 복원

자주 사용되는 패턴: 스크립트가 `track`으로 상태 변경을 점진적으로 기록해두고, 시작 시 전체 이력을 다시 재생하지 않고 각 키의 최신 값을 바로 복원하고 싶은 경우가 있어요. `getLatestState(keys)`가 바로 이 역할을 해요. 요청한 이벤트 이름을 가장 최근 페이로드로 매핑한 `Record<string, unknown>`을 반환해요:

```js
// @triggers ls:startup

const state = await api.events.getLatestState([
  'player-hp',
  'player-mp',
  'quest-active',
]);

console.log(`Resumed: HP=${state['player-hp']?.value}, MP=${state['player-mp']?.value}`);
```

`getLatestState`는 채팅이 아니라 **이벤트 이름**을 키로 사용해요. 반환되는 값은 전체 이력 중에서 해당 이름으로 가장 최근에 `track()`된 페이로드예요. 채팅 범위의 최신 상태가 필요하다면 이벤트 이름에 채팅 ID를 포함하거나(`player-hp:${chatId}`), `chatId` + `limit: 1` 옵션으로 `query`를 사용하세요.

다음과 같은 경우에 제한 없는 `query`나 `replay` 대신 이 메서드를 사용하세요:
- 전체 변화 과정이 아니라 **현재** 값만 필요할 때
- 부팅 시점이나 스크립트 재로드 후 상태를 복원할 때
- 기록된 이벤트가 많아서 O(N 이력) 탐색 대신 O(N 키) 조회를 원할 때

## 이벤트 레벨 — 신중하게 선택하기

4가지 레벨(`'debug' | 'info' | 'warn' | 'error'`)은 일반 로깅 프레임워크의 심각도 티어처럼 동작해요. 이벤트 저장 여부나 방식에는 아무런 차이가 없으며, 모든 레벨이 동일하게 영속화돼요. 레벨 필드는 쿼리 결과에서 **필터링 및 식별**을 위해 사용돼요.

일반적인 용도:
- **`debug`** — 빈번하게 발생하는 "지금 스크립트가 무엇을 하고 있는가" 추적 이벤트. 개발 중에 유용하며, 자동 정리를 위해 짧은 `retentionDays`(예: 1~3일)를 지정하는 것이 좋아요.
- **`info`** — 기본값. 일반적인 애플리케이션 이벤트.
- **`warn`** — 복구 가능한 문제(대체 경로 사용, 비정상적 입력값 보정 등).
- **`error`** — 감사나 디버깅 도구 화면에 표시하고자 하는 실패 상황.

"최근 경고 표시" 디버그 버튼이 있는 스크립트라면, 일상적인 `info` 노이즈를 걸러내기 위해 `level: 'warn'`으로 쿼리할 수 있어요.

## 채팅 연결

`track`과 필터 모두에서 선택적인 `chatId` 속성을 통해 이벤트를 특정 채팅에 연결할 수 있어요:

- **`track`에서 생략 시** → 호출 시점의 활성 채팅으로 기본 설정돼요(엔진의 실행별 활성 컨텍스트 뷰를 통함). `MESSAGE_SENT`, `CHAT_SWITCHED` 등에서 발생한 이벤트의 경우 대부분 이 동작이 자연스러워요.
- **명시적인 `chatId` 전달** → 여러 채팅에 걸쳐 있는 경우(예: 모든 채팅의 통계를 집계하는 스크립트) 활성 채팅 기본값 대신 명확한 출처를 지정할 때 유용해요.

**주의 — 활성 채팅 컨텍스트 내부에서 채팅이 전혀 연결되지 않은 이벤트를 깔끔하게 기록할 방법은 없어요.** `events.ts:36` 래퍼는 널 병합 연산자 `options?.chatId ?? activeContext.chatId ?? undefined`를 사용해요. 따라서 `chatId: undefined`를 명시적으로 전달해도 옵션을 생략한 것과 구분되지 않으며 둘 다 활성 채팅 기본값으로 대체돼요. 현재 채팅 ID가 없는 이벤트를 기록하는 유일한 방법은 활성 채팅이 없는 컨텍스트(예: 채팅이 열리기 전의 시작 핸들러)에서 `track`을 호출하는 것뿐이에요.

읽기 측면에서 `filter.chatId`는 정확히 해당 chatId로 저장된 이벤트만 매칭해요. 활성 채팅이 없을 때(`activeContext.chatId === null`) 기록된 이벤트는 채팅 연결 정보가 없어 채팅 필터 쿼리에 걸리지 않아요.

## 보존 기간 (Retention)

`retentionDays`는 호스트를 위한 선택적 자동 만료 힌트예요. 호스트는 기본 보존 정책을 적용해요(Lumiverse 설치 단위로 설정되며 보통 넉넉함 — 명시적 상한이 없으면 무기한 유지). 다음과 같은 경우에 `retentionDays`를 사용하세요:

- 대량의 `debug` 레벨 이벤트가 영구적으로 쌓이는 것을 방지할 때 — 1~3일로 설정하여 작업 세트를 작게 유지하세요.
- 특정 이벤트 범주가 감사 대상이지만 본질적으로 일시적일 때(예: 세션 범위 진단).
- 저장 용량 증가가 민감한 공유 호스트 환경에서 자원을 절약하고자 할 때.

나중에 필요할 수 있는 과거 이벤트에는 `retentionDays`를 지정하지 마세요 — 사후에 보존 기간을 연장하는 API는 없으며, 만료된 이벤트는 영구 삭제돼요.

## 활용 사례

### 재시작 시 상태 복구

```js
// @triggers ls:startup, MESSAGE_SENT

const KEY = 'session-counter';

if (data.__event === 'ls:startup') {
  const state = await api.events.getLatestState([KEY]);
  globalThis.sessionCount = state[KEY]?.value ?? 0;
  console.log(`Resumed at count=${globalThis.sessionCount}`);
}

if (data.__event === 'MESSAGE_SENT' && data.message.is_user) {
  globalThis.sessionCount = (globalThis.sessionCount ?? 0) + 1;
  await api.events.track(KEY, { value: globalThis.sessionCount });
}
```

스크립트 본문의 `globalThis.sessionCount`는 워커 서브프로세스 수명 동안만 유지되지만, `getLatestState`를 사용하면 Lumiverse가 재시작되어도 상태를 복구할 수 있어요.

### 민감한 작업의 감사 내역 기록

```js
// @triggers ls:startup

// 파괴적인 작업을 감사 추적 호출로 감쌉니다:
async function deleteWithAudit(databankId, reason) {
  await api.events.track('databank-deleted', {
    databankId,
    reason,
    deletedBy: globalThis.__lsActiveUserId,
  }, { level: 'warn' });

  return api.databanks.delete(databankId);
}
```

이제 `api.events.query({ eventName: 'databank-deleted' })`가 감사 로그가 돼요. 이벤트는 스크립트 수명과 무관하게 유지되므로 스크립트를 비활성화했다가 다시 활성화해도 이력이 보존돼요.

### 분석 형태의 관측성

```js
// @triggers GENERATION_ENDED

await api.events.track('generation-completed', {
  contentLength: data.content?.length ?? 0,
  generationId:  data.generationId,
  messageId:     data.messageId,
}, { level: 'info' });
```

(참고: `GENERATION_ENDED` 페이로드는 `{ generationId, chatId, messageId, content }`이며 `model` 필드가 없어요. 모델 정보까지 필요하다면 페이로드가 `{ generationId, chatId, model }`인 `GENERATION_STARTED` 추적기와 함께 사용하여 쿼리 시점에 `generationId`로 두 이벤트를 조인하세요.)

별도의 "대시보드" 스크립트에서 이 이벤트를 `replay`하고 시간/채팅/모델별로 롤업하여 사용 패턴을 파악할 수 있어요.

## 이 API를 사용하지 말아야 할 때

| 요구사항 | 대체 방안 |
|---|---|
| 설정값의 현재 상태 | `api.scriptStorage` 또는 `api.variables.*` (더 저렴하고 빠르며 권한 불필요) |
| 스크립트 간 메시징 (스크립트 A가 실시간으로 스크립트 B에 알림) | `api.broadcast.*` |
| 호스트 이벤트 반응 (MESSAGE_SENT 등) | 편집기의 이벤트 선택기 연결 (`api.events.*`가 아님) |
| 저장된 상태(at rest)의 암호화된 비밀값 | `api.enclave.*` |
| 이력 없이 단순 키 단위 set/get | `api.scriptStorage` |
| 연산자를 지원하는 스크립트별 JSON 마이크로 DB | `api.db.*` |

`api.events.*`는 **구조화된 쿼리가 필요한 영속 이력**이 필요할 때 적합해요. 최신 값만 읽으면 되고 이력의 흐름이 중요하지 않다면 `scriptStorage`나 `variables`가 훨씬 간단하며 권한 승인도 필요 없어요.

## 에러 처리

가장 자주 발생하는 실패 유형:

| 원인 | 에러 |
|---|---|
| 권한 거부 | `Error: api.events requires the event_tracking permission` |
| `track` 호출 시 호스트 검증 실패 (잘못된 페이로드 형식, 필드 크기 초과 등) | 호스트가 던지는 에러 — 메시지 다양함 |
| 네트워크 / 호스트 응답 없음 | `spindle.events.*`로부터 전파됨 |

안전한 예외 처리 패턴:

```js
try {
  await api.events.track('my-event', payload);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('event_tracking')) {
    // 권한 누락 — scriptStorage로 대체하거나 감사를 건너뜁니다.
    await api.scriptStorage.set('my-event-fallback', payload);
    return;
  }
  console.error('[my-script] events.track failed:', err);
}
```

`msg.includes('event_tracking')` 형태에 주목하세요 — 서브스트링 `'event_tracking'`은 커스텀 에러 메시지(`requires the event_tracking permission`)와 권한 이름을 언급하는 호스트 측 에러 메시지 모두에서 안전하게 매칭돼요.

## 버전 정보

네이티브 `spindle.events.*`를 통해 **v0.11.0+**에서 구현되었어요. 4가지 메서드(`track`, `query`, `replay`, `getLatestState`) 모두 도입 이후 안정적으로 유지되고 있어요. LumiScript 래퍼는 권한 검사와 `track`의 기본 활성 채팅 연결 처리를 담당하는 얇은 패스스루 계층이에요.
