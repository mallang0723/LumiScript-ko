# 두 스크립트 간 상태 공유하기 (Share state between two scripts)

서로의 트리거를 알 필요 없이, 한 스크립트가 상태를 생성하고 다른 스크립트가 이에 실시간으로 반응하도록 만드는 패턴이에요. "백그라운드 워커가 무언가를 계산하고, UI 스크립트가 이를 화면에 표시한다"는 구조의 핵심 뼈대이며, 동일 이벤트로 동시에 트리거되는 스크립트 간의 고전적인 경쟁 상태(race condition)를 방지해 줘요.

## 사용할 기능

- [`api.broadcast.*`](../guides/broadcast.md) — 변경 사항을 알리는 `emit`, 반응하는 `on`. 프로세스 내부에서 동기식으로 동작하며 **권한 불필요**.
- `api.scriptStorage.*` — 두 스크립트가 공유하는 세션 범위의 무료 키/값 저장소. ([저장소 모델](../concepts/storage-model.md))
- 편집기에서 연결하는 두 가지 트리거: `MESSAGE_SENT` (생산자) 및 `CHAT_SWITCHED` (소비자 콜드 스타트용). ([트리거 모델](../concepts/trigger-model.md))

핵심 개념: **`api.broadcast.on` 구독은 자신을 등록한 트리거 실행 수명보다 오래 지속돼요.** 따라서 소비자 스크립트는 본문을 한 번 실행하여 구독을 등록할 *최초의 트리거*만 있으면 되며, 이후에는 생산자가 이벤트를 발행할 때마다 핸들러가 자동으로 실행돼요 — 생산자와 동일한 트리거에 연결되어 있을 필요가 없어요.

## 스크립트 코드

두 개의 독립된 스크립트로 구성돼요. 생산자는 메시지마다 지표를 계산하여 저장하고 이벤트를 발행하며, 소비자는 발행될 때마다 반응해요.

**생산자 (Producer)** — `MESSAGE_SENT`에 연결:

```js
// @triggers MESSAGE_SENT
// 생산자: 각 사용자(USER) 메시지로부터 지표를 도출하고, 저장한 뒤, 변경을 알립니다.
// 별도 권한 불필요.

// MESSAGE_SENT는 어시스턴트의 빈 플레이스홀더에도 발생하므로 건너뜁니다.
if (!data.message?.is_user) return;

const text  = data.message?.content ?? '';
const words = text.trim() ? text.trim().split(/\s+/).length : 0;

// 먼저 공유 저장소에 상태를 기록해요...
await api.scriptStorage.set('msg-metric', { words, at: Date.now() });

// ...그 후에 변경을 알립니다. 쓰기 완료 후 emit하는 것이 경쟁 상태를 방지하는 핵심이에요.
api.broadcast.emit('myapp:metric-updated', { source: 'message-sent' });
```

**소비자 (Consumer)** — `CHAT_SWITCHED`에 연결 (본문을 한 번 실행하여 구독을 등록하기 위한 용도):

```js
// @triggers CHAT_SWITCHED
// 소비자: 한 번 구독해 두면 생산자가 emit할 때마다 핸들러가 실행됩니다.
// 별도 권한 불필요.

// 본문 상단에서 무조건적으로 구독해요 — 구독은 이 스크립트의 자체 트리거 실행 간에도 유지됩니다.
api.broadcast.on('myapp:metric-updated', (payload) => {
  // 핸들러는 emit 내부에서 동기식으로 실행되므로, 비동기 작업은 자체 완결형 IIFE로 감쌉니다.
  void (async () => {
    try {
      const metric = await api.scriptStorage.get('msg-metric');
      console.log(`[consumer] ${metric?.words ?? '?'} words (via ${payload?.source})`);
    } catch (err) {
      console.warn(`[consumer] handler failed: ${err.message}`);
    }
  })();
});

// 콜드 스타트 경로: 채팅이 열렸을 때 이미 저장된 데이터가 있다면 렌더링해요.
if (data.chatId) {
  const metric = await api.scriptStorage.get('msg-metric');
  console.log(`[consumer] (cold start) ${metric?.words ?? 'nothing yet'}`);
}
```

두 스크립트를 모두 활성화하고, 채팅창을 연 뒤(소비자 콜드 스타트), 메시지를 보내보세요. 메시지를 보낼 때마다: 생산자가 데이터를 저장하고 이벤트를 발생시키며, 소비자의 핸들러가 새 지표를 콘솔에 출력해요 — 소비자 스크립트가 `MESSAGE_SENT`에 연결되어 있지 않은데도 실시간으로 반응해요.

## 동작 원리

**쓰기 *이후에* emit을 호출하는 것이 핵심이에요.** 순진한 접근법은 두 스크립트를 모두 `MESSAGE_SENT`에 연결하고 소비자가 저장소를 직접 읽게 하는 것이에요. 하지만 Lumiverse는 동일 트리거의 스크립트들을 동시에 실행하므로: 생산자의 `await … .set(…)` 쓰기가 끝나기 전에 소비자의 읽기가 먼저 끝나 이전의 오래된 상태를 읽는 경쟁 상태가 발생해요. 읽기 로직을 브로드캐스트 핸들러 안으로 옮기고 쓰기가 끝난 *이후에* `emit`을 호출하면 순서가 결정론적으로 보장돼요 — 핸들러는 `emit`이 호출될 때까지 실행되지 않으며, `emit`은 쓰기가 완전히 끝난 뒤에만 호출되기 때문이에요.

**구독은 실행 간에 유지돼요.** 소비자의 본문이 실행될 때(`CHAT_SWITCHED`), `api.broadcast.on(...)`이 핸들러를 등록하고 이는 계속 등록된 상태로 남아요. 호스트는 스크립트의 구독을 현재 실행의 끝이 아니라 해당 스크립트의 *다음 실행 시작 시점*에 초기화하므로, 핸들러는 실행 사이의 빈 시간 동안 살아있으면서 생산자의 모든 emit을 포착해요. 소비자가 단 한 번의 콜드 스타트 트리거만 필요한 이유예요.

**`scriptStorage`는 데이터 통로이고, broadcast는 초인종이에요.** 브로드캐스트 페이로드(`{ source }`)는 데이터 자체가 아니라 가벼운 알림이어야 해요 — 실제 상태 데이터는 두 스크립트 모두 읽을 수 있는 `api.scriptStorage`에 실려요. 페이로드를 작게 유지하고(1MB 상한선 및 초당 100회 속도 제한이 있음) 저장소가 실제 데이터를 나르도록 하세요.

**비동기 핸들러에는 IIFE + try/catch가 필요해요.** `emit`은 핸들러를 동기식으로 호출하며 await하지 않아요. 순수 `async` 핸들러에서 에러가 발생하면 버스의 개별 핸들러 에러 처리를 벗어나는 unhandled rejection이 돼요. `void (async () => { try { … } catch { … } })()` 래퍼를 사용하면 비동기 작업과 에러를 안전하게 내부에 격리할 수 있어요.

## 내 프로젝트에 맞게 응용하기

- **UI 패널과 연동하기.** 소비자의 `console.log` 대신 [드래그 가능한 정보 패널](draggable-panel.md)의 `content.update(...)`를 호출하세요 — 생산자의 작업 결과가 패널에 실시간 반영돼요. (패널이 닫힐 때 `on()`이 반환한 구독 해제 함수를 호출하세요.)
- **더 다양한 생산자 작업.** 생산자의 "작업"은 어떤 비동기 작업이든 될 수 있어요: `api.llm.generateStructured` 추출, `api.utils.http` 통신, `api.db` 쓰기 등. 작업이 끝난 뒤 emit하기만 하면 소비자는 이전 작업이 무엇이었는지 신경 쓰지 않아도 돼요.
- **다양한 이벤트 종류 구분.** `source` 필드(`'message-sent'`, `'user-edit'`, `'rollback'`)를 활용하여 소비자가 선택적으로 렌더링하도록 하세요 — 한 출처에는 깜빡임 효과를 주고 다른 출처는 무시하는 식이에요.
- **다자간 통신.** `emit`은 등록된 *모든* 스크립트의 구독자에게 팬아웃(전파)돼요. 두 번째 소비자(로거, 분석 싱크 등)가 동일한 이벤트를 구독하기만 하면 생산자를 전혀 수정하지 않고도 기능을 확장할 수 있어요.

## 주의사항

- **본문 상단에서 무조건적으로 구독하세요.** `api.broadcast.on(...)`을 가끔씩만 참이 되는 `if` 문으로 감싸면 다음 초기화 시 구독이 사라져버릴 수 있어요. 조건부 동작이 필요하다면 구독 호출을 감싸지 마시고 핸들러 *내부*에서 조건을 검사하세요.
- **`ls:` 접두사로 emit하면 에러가 발생해요.** 이 접두사는 엔진 내부 브로드캐스트 전용이에요. 스크립트 고유의 접두사(`myapp:`, `<script>:`)를 붙이세요. 단, `ls:*` 이벤트를 *구독(on)*하는 것은 가능해요([엔진 상태 관찰하기](../guides/broadcast.md#observing-engine-state-via-ls) 참고).
- **비 `ls:*` 구독은 워커를 고정(pin)해요.** 활성화된 스크립트 간 구독은 소비자의 워커를 웜 상태로 유지해요(emit이 축출된 워커로 유실되지 않도록). 이는 의도된 동작이지만, 완전히 작업이 끝났을 때는 구독 해제 함수를 호출해 주어야 워커가 무한히 고정되는 것을 방지할 수 있어요.
- **`scriptStorage`는 세션 범위이며 영구 저장소가 아니에요.** 워커 축출, 핫 리로드, 스크립트 수정에는 유지되지만 백엔드를 완전히 재시작하면 초기화돼요. 재시작 후에도 유지되어야 하는 데이터라면 `api.variables.*`나 `api.db.*`를 사용하세요 — [저장소 모델](../concepts/storage-model.md) 참고.

## 관련 항목

- [스크립트 간 이벤트 브로드캐스트](../guides/broadcast.md) — `api.broadcast` 전체 인터페이스, 구독 수명 주기 타임라인, 워커 고정 정책.
- [저장소 모델](../concepts/storage-model.md) — 공유 상태를 위한 적절한 저장소 계층 선택(`scriptStorage` vs `variables` vs `db`).
- [드래그 가능한 정보 패널 만들기](draggable-panel.md) — 발행된 업데이트를 화면에 표시하는 대표적인 소비자 화면.
