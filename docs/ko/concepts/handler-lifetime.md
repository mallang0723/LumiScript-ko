# 핸들러 수명 주기 (Handler lifetime)

스크립트 본문에서 `broadcast.on(...)`, `tools.register(...)`, `macros.register(...)`, `DOMHandle.on(...)` 등을 등록할 때, 본문 실행이 끝난 후 이 콜백들은 어떻게 될까요? 몇 시간 후에도 여전히 동작하는 이유는 무엇일까요? 콜백은 무엇을 참조하고 있을까요? 그리고 오래 유지되는 핸들러를 작성할 때 흔히 빠지는 클로저 캡처 함정은 무엇일까요?

## 핵심 개념

스크립트 본문은 *이벤트* 핸들러예요(단일 본문이며 연결된 이벤트가 올 때마다 실행됨 — [트리거 모델](trigger-model.md) 참고). 본문 내부에서 코드는 Lumiverse 이벤트로 라우팅되지 않는 다른 동작들을 위한 *추가적인* 콜백을 등록할 수 있어요: 피어 스크립트 브로드캐스트, 커맨드 팔레트 실행, OAuth 콜백, LLM 도구 호출, 매크로 해석, 주입된 DOM 요소의 이벤트 등. 이것들이 바로 **등록된 핸들러(registered handlers)**이며, 스크립트 본문과는 근본적으로 다른 수명 주기를 가져요.

먼저 기억해야 할 3가지 원칙:

1. **등록된 핸들러는 자신을 등록한 실행 수명보다 오래 살아남아요.** 본문의 AsyncFunction이 반환되고 실행이 종료되어도 핸들러 클로저는 엔진에 의해 유지되며 호출될 때까지 대기해요.
2. **핸들러가 호출될 때 핸들러만의 일시적인 *핸들러 실행(handler run)* 컨텍스트에서 실행돼요.** `handler-<ts>-<seq>` 형식의 새로운 `runId`를 가져요(본문 실행의 `run-<ts>-<seq>`와 구분됨). 엔진은 핸들러 호출을 위한 activeRun을 설정하고, 클로저는 그에 맞춰 `api.*` 호출을 디스패치하며, 클로저가 반환되면 해당 실행이 종료돼요.
3. **등록 시점에 클로저가 캡처한 `api` 참조는 계속해서 정상 작동해요.** 설계상 프록시가 특정 본문 실행의 상태가 아닌 스크립트 식별자와 디스패치 경로를 캡처하기 때문이에요. 따라서 본문이 끝난 지 3시간 후에 실행되는 핸들러 내부에서 `api.chat.getMessages()`를 호출해도 여전히 현재 시점의 대화 메시지를 정상적으로 가져와요.

핸들러 클로저는 본문처럼 전역 변수 `data`를 제공받지 않지만(핸들러는 필요한 페이로드를 함수의 매개변수로 받음), 그 외의 모든 것 — `api.*`, `script.*`, [저장소 모델](storage-model.md)의 저장소 계층 — 은 동일하게 사용할 수 있어요.

## 인터페이스별 수명 주기

수명 주기 특성에 따라 분류한 핸들러 등록 API 목록이에요. 각 그룹의 수명 규칙은 속한 모든 인터페이스에 동일하게 적용돼요.

### 본문 실행 간에 초기화됨

- **`api.broadcast.on(event, fn)`** — 동료 스크립트 브로드캐스트 구독자 등록 (내장 `ls:*` 이벤트 이름은 인앱 레퍼런스의 `LumiScript Events` 섹션 참고). 호스트는 해당 스크립트의 *다음 본문 실행이 시작될 때* 브로드캐스트 구독을 모두 지워요. 따라서 N번째 실행에서 등록된 구독은 N+1번째 실행의 첫 줄에 도달하기 전에 사라져요. 표준 해결책은 아래의 [본문 하단 재등록 관례](#the-bottom-of-body-re-registration-idiom)예요.

### 마지막 쓰기 우선 (범위당 단 하나의 핸들러)

- **`api.commands.onInvoked(fn)`** — 스크립트당 하나의 핸들러. 새로 등록하면 이전 핸들러를 대체해요. 사용자가 LumiScript에 등록된 **어떤** 명령이든 실행할 때 호출돼요(현재 스크립트가 등록한 명령뿐만 아니라 모든 명령 포함). 특정 명령만 처리하고 싶다면 `commandId` 인자로 직접 필터링하세요. 스크립트가 등록 해제될 때까지 유지돼요.
- **`api.oauth.onCallback(fn)`** — *확장 기능*당 하나의 핸들러 (스크립트별이 아님 — LumiScript의 OAuth 인터페이스는 내부의 모든 스크립트가 공유함). 새로 등록하면 이전 핸들러를 대체해요. LumiScript는 스크립트 간 충돌 시 실수로 덮어쓰는 것을 인지할 수 있도록 `spindle.log.warn`을 출력해요. 스크립트가 등록 해제될 때까지 유지돼요.

### 다중 핸들러 등록 가능, 스크립트 등록 해제 시까지 유지

- **`api.macros.register(name, def, fn)`** (풀 모드) — 스크립트당 여러 핸들러 가능, 매크로 이름을 키로 관리. 호스트가 `{{name}}` 매크로를 해석할 때 실행돼요. 동일한 이름으로 다시 등록하면 이전 핸들러를 대체해요.
- **`api.tools.register(name, def, fn)`** — 스크립트당 여러 핸들러 가능, 도구 이름을 키로 관리. LLM이 도구를 호출할 때(Council 또는 인라인 함수 호출) 실행돼요.
- **`api.chat.registerContentProcessor(fn, opts?)`** — 스크립트당 여러 핸들러 가능. 채팅 메시지 렌더링 시 메시지마다 실행돼요.
- **`api.worldInfo.registerInterceptor(fn, opts?)`** — 스크립트당 여러 핸들러 가능. 월드 인포 활성화 시 실행돼요.
- **`api.macros.registerInterceptor(fn, opts?)`** — 스크립트당 여러 핸들러 가능. 매크로 해석 시 실행돼요.

### 다중 핸들러 등록 가능, 스크립트 등록 해제 또는 명시적 정리 시까지 유지

- **`api.ui.dom.delegate(selector, event, fn, opts?)`** — 호스트 채팅 영역에 선택자(selector) 범위로 등록되는 이벤트 위임 DOM 리스너. 스크립트가 등록 해제되거나, `api.ui.dom.cleanup()`(해당 스크립트의 모든 DOM 관련 등록 정리)이 호출될 때까지 유지돼요.
- **`DOMHandle.on(event, fn, opts?)`** — 주입된 특정 요소에 등록되는 요소별 DOM 이벤트 리스너. 상위 `DOMHandle`이 `.remove()`되거나 스크립트가 등록 해제될 때까지 유지돼요.

## "스크립트 등록 해제"에는 새로고침(Reload)도 포함돼요 (v1.0.0-rc.8+)

이 문서 전체에서 "스크립트 등록 해제 시까지"는 다음 중 **어느 하나라도 발생하는 경우**를 의미해요:

- **사용자가 스크립트 관리자에서 스크립트를 비활성화함** (스크립트별 토글).
- **사용자가 스크립트를 삭제함.**
- **사용자가 편집기의 새로고침(Reload) 버튼을 클릭함** — 스크립트별 상태를 완전히 지운 뒤 본문을 다시 실행함 (v1.0.0-rc.8 신규).
- **`// @ls:reload-on-edit` 지시문 상태에서 자동 저장됨** — 새로고침 버튼과 동일한 초기화 + 재실행 경로 (v1.0.0-rc.8 신규).
- **LumiScript 확장 기능 자체가 언로드됨** (확장 기능 토글 끄기, Lumiverse 종료) — Spindle 수준 연쇄 정리.

처음 두 가지 경로(비활성화, 삭제)는 정리 전에 `ls:teardown`을 발생시켜요. 새로고침 버튼 및 자동 저장 재로드 경로는 `ls:teardown`을 발생시키지 않고 본문 재실행 전에 조용히 상태를 초기화해요. 핸들러 관점에서는 결과가 동일해요: 이전 클로저는 사라지며, 다음 본문 실행에 필요한 상태는 다시 구축되어야 해요.

초기화 대상은 LumiScript의 모든 고정 레지스트리(도구, 매크로, 주입 요소, drawerTabs, inputBarActions, worldInfoInterceptors, messageProcessors, macroInterceptors, rpcEndpoints, floatWidgets, advancedModals, handlerClosures, userBroadcastSubs) 및 브로드캐스트 구독과 명령 핸들러를 포함해요. 새로고침 초기화 후에도 보존되는 항목(비활성화/삭제 시에는 보존 안 됨): `api.scriptStorage`, `api.theme.*` 기여분, 워커의 `script.require()` 캐시. 전체 목록은 `src/backend.ts:wipeScriptStateForReload`에 있어요.

실질적 의미: 대화형 UI 화면과 백그라운드 상태를 결합하는 스크립트는 반드시 재실행에 안전(re-fire-safe)해야 해요. 아래의 본문 하단 재등록 관례가 표준 패턴이에요.

## 핸들러 실행 vs 본문 실행

핸들러의 클로저 본문 내부에서는 런타임 환경이 본문 실행과 몇 가지 구체적인 차이를 보여요:

| 구분 | 본문 실행 시 | 핸들러 실행 시 |
|---|---|---|
| 전역 `data` | Lumiverse에서 전달된 이벤트 페이로드 | 클로저 캡처로 인해 렉시컬 스코프에 남아 있지만, **등록한 본문의 페이로드로 동결**되어 있음(오래된 클로저 함정 — 아래 참고). 핸들러의 실제 수신 페이로드는 `data`가 아니라 자체 함수 매개변수로 전달됨. |
| `script.id` / `name` / `type` | 실행 시작 시 바인딩됨 | 등록 시점에 바인딩되어 유효하게 유지됨 |
| `api.*` | 실행 시작 시 바인딩됨 | 등록 시점에 클로저로 캡처되어 디스패치 가능하게 유지됨 |
| `runId` (진단 화면에서만 보임) | `run-<ts>-<seq>` | `handler-<ts>-<seq>` |
| `console.log`, `console.warn`, `console.error` | 캡처되어 편집기 콘솔로 라우팅됨 | 동일 |
| 활성 컨텍스트 인식 읽기 (예: `api.variables.character.get(...)`, `api.db.collection({scope: 'character'})`) | 실행 시작 시점의 활성 컨텍스트 기준 | 핸들러 실행 시점의 **현재** 활성 컨텍스트 기준 |

가장 주목해야 할 부분은 마지막 항목이에요. 핸들러 내부에서 스코프 인식 저장소를 읽을 때 스코프는 등록 시점이 아니라 핸들러가 실행되는 시점에 결정돼요. 예를 들어 캐릭터 A가 활성 상태일 때 본문이 `broadcast.on` 핸들러를 등록했고, 나중에 캐릭터 B가 활성 상태일 때 핸들러가 실행되었다면, 핸들러 내부의 `api.variables.character.get('x')`는 캐릭터 A가 아니라 캐릭터 B의 `x`를 반환해요. `api.db.collection({scope: 'character'})`도 마찬가지예요. 프록시는 활성 컨텍스트를 실시간으로 읽으며 등록 시점에 스냅샷을 뜨지 않아요.

## 클로저가 캡처하는 것

표준 JavaScript 클로저 규칙을 따라요. 핸들러 클로저 내부에서 참조하는 변수는 렉시컬 스코프에 대한 *참조*로 캡처돼요. 본문 자체가 핸들러인 환경에서는 다음과 같은 주의점이 생겨요:

```js
// 본문, 1번째 실행:
let counter = 0;

switch (data.__event) {
  case 'MESSAGE_SENT':
    counter += 1;
    break;
}

api.broadcast.on('peer:ping', () => {
  console.log(`saw ${counter} messages`);
});
```

나중에 `peer:ping`이 발생하면 핸들러는 무엇을 출력할까요? `0`을 출력해요 — 매 본문 실행마다 고유한 `counter`(상단의 `let counter = 0` 재선언)를 가지며, 핸들러는 자신을 등록한 당시 실행의 `counter`를 캡처했기 때문이에요. 다음 본문 실행은 새로운 `counter`를 만들고 이를 캡처하는 새 핸들러를 등록하지만, (`broadcast.on`은 초기화되지만, `commands.onInvoked` 같은 다른 종류의 핸들러처럼 초기화되지 않는 경우) 이전 핸들러는 이미 사라진 옛 `counter`를 계속 참조하게 돼요.

해결 방법:

- **브로드캐스트 핸들러의 경우**, 매 본문 실행마다 초기화 및 재등록 사이클(다음 섹션)을 거치므로 핸들러가 항상 *현재* 본문의 로컬 변수를 캡처하게 돼요. 이것이 `broadcast.on`에서 이 패턴이 잘 작동하는 이유예요 — 매 실행마다 최신 상태를 캡처하는 새 클로저가 설치돼요.
- **더 오래 유지되는 핸들러**(`commands.onInvoked`, `tools.register`, `macros.register` 등)의 경우, 클로저 내부에 본문 단위의 가변 상태를 캡처하지 마세요. 핸들러 실행 시점에 저장소 계층([저장소 모델](storage-model.md))에서 최신 상태를 읽으세요:

```js
api.commands.onInvoked(async (commandId, ctx) => {
  // 모범 사례: 핸들러 실행 시점에 실시간 상태를 읽어요.
  const counter = await api.variables.character.get('messageCount', 0);
  // ...
});
```

언제나 안전하게 캡처할 수 있는 대상:

- `api` 객체 자체 (프록시는 본문 실행이 아닌 스크립트 식별자에 바인딩됨).
- `script.id` / `name` / `type` (특정 스크립트에 대해 불변).
- 본문 상단에 정의된 상수 및 순수 함수.

<a id="the-bottom-of-body-re-registration-idiom"></a>
## 본문 하단 재등록 관례

`api.broadcast.on(...)`은 대개 본문의 *맨 마지막* — `switch` 이후, 모든 이벤트별 작업이 끝난 뒤 — 에 배치해요. 이유는 3가지예요:

1. **구독은 매 본문 실행 시작 시 초기화돼요.** 매 실행의 하단에서 다시 등록해야 구독이 유지돼요. (원래의 근거는 [LumiScript 브로드캐스트 버스](../) 메모를 참고하세요.)
2. **본문 하단 코드는 `ls:startup`과 `ls:teardown`을 포함한 모든 실행에서 실행돼요.** 따라서 확장 기능이 다시 활성화될 때 `ls:startup`이 실행되면서 하단 코드가 다시 실행되어 구독이 자동으로 복구돼요.
3. **클로저는 상단에 정의된 내용을 캡처해요.** 본문 상단에 헬퍼 함수나 상수를 선언하고 `broadcast.on` 핸들러 내부에서 이를 참조하는 경우, 등록 코드를 하단에 두면 해당 참조가 이번 실행의 최신 정의로 안전하게 확인돼요.

표준적인 코드 형태:

```js
// ── 본문 상단 (헬퍼 + 상시 등록 항목) ───────────────────────────────────

const PEER_EVENT = 'my-tracker:state-changed';

async function handlePeerEvent(payload) {
  await api.variables.chat.set('lastSeenState', payload);
}

api.macros.register('myMacro', { /* def */ }, async (ctx) => { /* ... */ });

// ── Switch 문 (이벤트별 작업) ─────────────────────────────────────────

switch (data.__event) {
  case 'MESSAGE_SENT':
    await reactToUserMessage(data.message);
    break;
  case 'GENERATION_ENDED':
    await reactToAssistantMessage(data.messageId);
    break;
}

// ── 본문 하단 (매 실행마다 재등록됨) ─────────────────────────────────────

api.broadcast.on(PEER_EVENT, (payload) =>
  handlePeerEvent(payload).catch(err =>
    console.warn(`[my-script] peer-event handler failed: ${err.message}`)
  )
);
```

`api.macros.register`, `api.tools.register`, `api.commands.onInvoked` 등 "스크립트 등록 해제 시까지 유지" 그룹은 매번 재등록할 필요가 없지만(재등록해도 무작업 또는 동일 ID 대체), 대칭성을 유지하고 상단 코드 역시 매 실행마다 실행되므로 많은 스크립트가 상단에 배치해요.

## 오래 유지되는 핸들러에서의 권한 거부 처리

[권한](permissions.md) 가이드와 동일한 try/catch 구조를 사용하지만, 여기서는 중요성이 더 커요: 등록된 핸들러 내부에서 포착되지 않은 권한 거부 예외는 *핸들러가 실행될 때마다* 처리되지 않은 프로미스 거부(unhandled rejection)로 노출돼요. 자주 호출되는 핸들러(DOM 이벤트 리스너, 빈번한 브로드캐스트 구독자)의 경우 편집기 콘솔에 스팸이 발생하거나 속도 제한으로 요청이 누락될 수 있어요(스크립트당 60초당 10회 거부 초과 시 조용히 드롭됨). 핸들러 내부의 권한 호출은 반드시 감싸주세요:

```js
api.broadcast.on('something:happened', async (payload) => {
  try {
    await api.images.upload({ data: payload.bytes, mimeType: 'image/png' });
  } catch (err) {
    if (err.message.startsWith('PERMISSION_DENIED:images')) {
      console.warn('[my-script] images not granted; ignoring upload');
      return;
    }
    throw err;
  }
});
```

## 안티패턴 (피해야 할 패턴)

- **`switch` 케이스 내부에서 핸들러 등록하기.** `case 'MESSAGE_SENT':` 내부에 `api.broadcast.on(...)`을 두면 오직 `MESSAGE_SENT` 이벤트가 발생할 때만 재등록돼요. 다음 이벤트가 다른 것(`GENERATION_ENDED` 등)이라면 실행 시작 시 브로드캐스트 구독이 지워진 후 재등록되지 않아, 다음 사용자 메시지가 올 때까지 구독이 유실돼요. `broadcast.on` 등록은 switch 외부, 본문 하단(또는 상단)에 두세요.
- **한 번의 실행을 넘어 유지되는 핸들러 클로저 안에 본문 로컬 가변 상태를 캡처하기.** 전형적인 오래된 클로저 함정이에요. 대신 핸들러 실행 시점에 저장소 계층에서 값을 읽으세요.
- **등록 시점에 엔티티(채팅, 캐릭터, 메시지) 참조를 캡처하기.** 엔티티는 삭제될 수 있으므로 참조가 무효화될 수 있어요. 참조 대신 *ID*를 캡처한 뒤, 핸들러 실행 시점에 `await api.characters.get(id)` / `api.chats.get(id)` / `api.chat.getMessages()`로 조회하세요.
- **`broadcast.on`의 다음 실행 시 자동 초기화 특성을 잊어버리기.** "한 번 등록하면 영원히 유지된다"고 착각하기 쉬워요. 다른 핸들러와 달리 브로드캐스트는 실행 시 초기화되므로 본문 하단 재등록 관례를 사용해야 해요.
- **핸들러 내부에서 권한 거부를 처리하지 않기.** 반복적인 unhandled rejection의 원인이 돼요.

## 다음 단계

이제 실질적인 스크립트 작성에 필요한 전체 개념을 이해하셨어요: [트리거 모델](trigger-model.md), [권한](permissions.md), [저장소 모델](storage-model.md), 그리고 핸들러 수명 주기예요. 다음 문서들을 살펴보세요:

1. **[DOM 주입](../guides/dom-injection.md)** — 호스트 앱 셸 내부에 UI 제작하기. LumiScript가 Lumiverse의 1급 구성 요소처럼 느껴지게 하고 싶다면 가장 효과가 큰 기능이에요.
2. **인앱 레퍼런스의 API Functions 섹션** — 이 문서에 언급된 모든 핸들러 등록 메서드의 시그니처 확인.
3. **[쿡북 (Cookbook)](../cookbook/index.md)** — 실제 스크립트 구현 레시피들.
