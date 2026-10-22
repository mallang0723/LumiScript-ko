# 트리거 모델 (Trigger model)

LumiScript가 실제로 실행되는 핵심 멘탈 모델이에요. 5분만 투자해서 읽어두시면 프레임워크와 씨름하는 시간을 줄이고 곧바로 활용할 수 있어요.

## 핵심 개념: 본문 자체가 핸들러예요

`api.on(event, handler)` 같은 메서드는 없어요. `addEventListener`도 없고, 구독 레지스트리도 없으며, 설정 시점에 나중에 실행되도록 등록하는 콜백도 없어요. **스크립트 본문 자체가 핸들러로 실행돼요.** 연결된 이벤트가 발생할 때마다 Lumiverse는 스크립트 소스를 새로운 `AsyncFunction`으로 감싸서 위에서 아래로 실행해요. 이벤트 페이로드는 전역 변수 `data`로 전달돼요. 본문의 마지막 줄이 반환되면 해당 실행은 종료돼요.

이것이 모델의 전부예요. 다른 모든 동작은 여기서 파생돼요.

이벤트 연결 — *어떤* 이벤트가 *어떤* 스크립트를 실행할지 — 은 전적으로 스크립트 편집기 UI에서 관리돼요. 스크립트를 열고 상단의 이벤트 다중 선택기를 확인하면 끝이에요. 스크립트 소스 코드 안에서 이벤트를 구독하는 문법은 존재하지 않아요.

기억해 둘 작은 사실: 일부 스크립트 상단에 적혀 있는 `// @triggers MESSAGE_SENT, ...` 같은 주석은 **오직 문서화 용도**일 뿐이에요. 호스트는 이를 해석하지 않아요. `@triggers`를 적는다고 이벤트가 연결되지 않으며, 지운다고 연결이 끊어지지도 않아요. 나중에 코드를 볼 자신이나 다른 사람에게 이 스크립트가 어떤 이벤트에 연결되도록 *의도되었는지* 알려주는 관례일 뿐이에요. 실제 연결은 편집기 UI에서 이루어져요.

## 스크립트 실행의 단계별 흐름

1. Lumiverse의 어딘가에서 연결된 이벤트가 발생해요(사용자가 메시지를 보냄, 채팅이 전환됨 등).
2. 호스트가 이벤트 페이로드를 포장하고, 해당 이벤트에 연결된 스크립트들을 선택하여 각각 디스패치해요.
3. 디스패치된 각 스크립트에 대해, 기본 **AsyncFunction** 엔진의 경우: 스크립트 본문을 감싸는 새로운 `AsyncFunction`이 생성돼요. 이 함수는 본문 내에서 접근할 수 있는 8개의 위치 매개변수를 받아요: `api`, `data`, `script`, `__console`(엔진이 추가하는 서문에서 `console`로 다시 바인딩됨), `z`(Zod 라이브러리), `fetch`(`allowDangerous`가 켜져 있을 때 `api.utils.http.*`를 감싼 보호된 SSRF 강화 `fetch`, 꺼져 있으면 예외를 던지는 스텁), `Bun`, `process`(마지막 둘은 항상 `undefined` — 전역 변수를 섀도잉하여 호스트 런타임에 접근하지 못하도록 매개변수 목록에 포함됨). 선택적 **QuickJS** 격리 엔진에서는 동일한 이름들(`api` / `data` / `script` / `console` / `z` / `fetch`)이 8개의 매개변수가 아닌 VM 전역 변수로 제공되며, 새로운 WASM 렐름에는 애초에 `Bun` / `process`가 존재하지 않아요. 본문이 보게 되는 이름과 동작은 동일하지만 내부 배관이 달라요. [실행 엔진](engine.md) 참고.
4. 본문이 위에서 아래로 실행돼요. `await`는 정상 작동하며 실행 컨텍스트는 이를 기다려요. 본문이 등록하는 핸들러 클로저(아래에서 자세히 설명)는 나중을 위해 캡처돼요.
5. 본문이 반환되거나(또는 에러를 던지면), *flush* 단계에서 unawaited `api.broadcast.emit(...)` 등 본문이 시작한 fire-and-forget 체인을 모두 비워 실행 완료 보고 전에 마무리해요.
6. 함수 인스턴스는 즉시 폐기돼요.

6단계가 초보자들을 당황하게 만드는 부분이에요. 함수 인스턴스는 **완전히 사라져요**. 본문에 선언된 로컬 변수는 다음 실행으로 넘어가지 않아요. 아래의 "실행 간에 유지되지 않는 것들"을 참고하세요.

## 전역 객체 `data`

`data`는 이벤트 페이로드예요. 관례상 읽기 전용인 일반 JSON 객체이며 두 가지 속성을 보장해요:

- `data.__event` — 이벤트 이름 (예: `'MESSAGE_SENT'`, `'GENERATION_ENDED'`, `'CHAT_SWITCHED'`). 항상 존재해요.
- 나머지는 이벤트에 따라 달라져요. `MESSAGE_SENT`는 `{ chatId, message }`, `CHAT_SWITCHED`는 `{ chatId }`, `ls:teardown`은 `{ reason, scriptId, scriptName }` 형태예요. 이벤트별 전체 구조는 인앱 **레퍼런스**의 "Lumiverse Events"에서 확인할 수 있어요.

`data`를 직접 수정하지 마세요 — 여러분의 것이 아니며, 수정하더라도 다음 실행 시 호스트로부터 새로운 페이로드를 받으므로 아무런 효과가 없어요.

## 다중 이벤트 연결과 `__event` 분기

대부분의 실질적인 스크립트는 여러 이벤트에 연결돼요. 본문은 연결된 *모든* 이벤트에 대해 실행되므로, 대개 `data.__event`로 분기 처리를 해요:

```js
switch (data.__event) {
  case 'CHAT_SWITCHED':
    if (data.chatId) await initialiseForChat(data.chatId);
    break;
  case 'MESSAGE_SENT':
    // 메시지 생성 시마다 발생(어시스턴트의 빈 플레이스홀더 포함) —
    // is_user로 가드하여 사용자의 전송에만 반응해요.
    if (data.message.is_user) await reactToUserMessage(data.message);
    break;
  case 'GENERATION_ENDED':
    await reactToAssistantMessage(data.messageId, data.content);
    break;
}
```

흔히 하는 실수가 "이벤트마다 스크립트를 하나씩 따로 만들어야지"라고 생각하는 것이에요. 그렇게 하지 마세요 — 하나의 *관심사(concern)* 단위로 스크립트를 만들고, 그 관심사에 필요한 여러 이벤트에 스크립트를 연결하세요. 스크립트 본문이 바로 통합 지점이에요.

## 수명 주기 이벤트: `ls:startup`, `ls:reload`, `ls:teardown`

세 가지 LumiScript 내부 이벤트는 스크립트가 (재)초기화되거나 종료되는 시점을 나타내요. Lumiverse 호스트가 아니라 LumiScript 엔진이 자체 생성하는 이벤트예요:

- **`ls:startup`** — *콜드 스타트(cold start)*. 스크립트가 활성 상태에 들어갈 때 발생해요: 확장 기능 부팅 시, 그리고 사용자가 비활성화 상태에서 활성화 상태로 토글할 때마다 실행돼요. 스크립트가 실행 가능해질 때마다 수행해야 하는 설정 작업(도구 등록, 캐시 사전 준비, 비활성화로 유실된 브로드캐스트 구독 복구 등)을 처리하기에 적합해요.
- **`ls:reload`** — *핫 재시작(hot restart)*. 편집기의 **새로고침(Reload)** 버튼을 누르거나, 아래의 `@ls:reload-on-edit` 지시문을 사용할 때 수정을 저장하면 발생해요. 엔진은 스크립트별 상태를 완전히 지운 뒤 깨끗한 상태에서 본문을 다시 실행해요: 의미상 새로운 `ls:startup`과 유사하지만 `data.__event`가 `'ls:reload'`이고 `data.reason`이 실행 경로 — `'manual'` (새로고침 버튼) 또는 `'autosave'` (지시문 저장) — 를 알려줘요. `scriptStorage`, 테마 기여분, `script.require()` 캐시는 초기화 후에도 유지되므로 비활성화/활성화 왕복 없이 재초기화할 수 있어요. **이벤트 선택기 트리거가 아니에요.** 체크박스가 아니라 새로고침 버튼이나 지시문에 의해 실행돼요(실행 버튼에도 체크박스가 없는 것과 같아요).
- **`ls:teardown`** — *종료(end of life)*. 스크립트가 비활성화되거나 삭제될 때 발생해요(`data.reason`은 `'disabled'` 또는 `'deleted'`). 10초의 실행 예산이 주어져요. **핸들러가 종료를 거부할 수는 없어요** — 스크립트는 무조건 종료되며, 상태 플러시, 구독자 알림, 종료 로그 작성을 위한 마지막 기회예요. 10초 이내에 완료되지 않은 작업은 강제 중단돼요.

`ls:startup`에 대해 알아두어야 할 두 가지:

- 콜드 부팅 시 호스트가 스크립트에 활성 채팅을 아직 전달하지 않았을 수 있어요. 확장 기능 초기 로드 시점의 `ls:startup`에서 `api.chats.getActive()`가 유효한 값을 반환한다고 가정하지 마세요. 대화 맥락이 필요한 설정은 `CHAT_SWITCHED`에서, 대화와 무관한 일반 설정은 `ls:startup`에서 수행하세요.
- 본문 상단 코드(`switch` 문 이전)는 `ls:startup`을 포함한 *모든* 실행에서 실행돼요. `api.commands.register(...)`나 `api.broadcast.on(...)` 같은 작업은 대개 switch 상단에 배치하여 startup을 포함한 매 실행마다 재등록되도록 함으로써 재활성화 시 스스로 정상화되도록 구성해요.

### 콜드 스타트와 리로드 작업 분리하기

`ls:reload`는 본문을 `ls:startup`과 동일하게 다시 실행하지만(`data.__event`와 `data.reason`만 다름), 초기화 작업을 *어디서 실행해야 하는지* 분기할 수 있어요:

```js
// 본문 상단 — 모든 실행(startup, reload 및 실제 트리거)에서 실행됨.
// 멱등성을 가진 (재)등록 코드를 여기에 두어 리로드 초기화 후에도 자동 복구되도록 해요.
api.commands.register([{ id: 'my-command', label: 'My Command', description: 'What it does' }]);

switch (data.__event) {
  case 'ls:startup':
    // 콜드 스타트 전용 (부팅, 또는 비활성→활성 전환). 1회성 비멱등 작업:
    // scriptStorage에 기본 설정 시딩, 데이터 마이그레이션, 부팅 시간 기록 등.
    break;

  case 'ls:reload':
    // 핫 리로드 전용. data.reason으로 추가 분기 가능:
    if (data.reason === 'manual') {
      // 새로고침 버튼 클릭 시에만 수행할 작업 — 예: 개발 캐시 비우기, 픽스처 다시 가져오기.
    }
    break;
}
```

1회성 콜드 스타트 작업(기본값 시딩, 마이그레이션)을 `ls:startup` 케이스 내부에 분리해 두면, 코드 작업 중 새로고침 버튼을 누를 때마다 무거운 초기화 작업이 불필요하게 반복되는 것을 방지할 수 있어요.

## `@ls:reload-on-edit`

이벤트가 아니라 개발 루프를 위한 지시문이에요. `ls:reload`는 편집기의 **새로고침** 버튼을 누르면 항상 발생하지만, 소스 코드 아무 곳에나 `// @ls:reload-on-edit`를 추가하면 코드를 **저장할 때 약 500ms 디바운스 후 자동으로** 발생해요. 자동 저장 실행 시에는 `data.reason === 'autosave'`가 전달되며, 전체 페이로드는 `{ reason, previousCodeHash, currentCodeHash, previousLength, currentLength, triggeredAt }`예요. (새로고침 버튼 실행은 `data.reason === 'manual'`을 전달해요. `ls:reload`의 전체 동작은 위의 수명 주기 절을 참고하세요.)

이 지시문은 의도적으로 옵트인 방식이에요. 모듈 스코프에서 비멱등 작업(LLM 호출, DB 삽입, 타이머 등)을 수행하는 스크립트가 저장할 때마다 매번 자동 실행되면 위험할 수 있으므로, 라이브 리로드가 안전한 스크립트(UI 스크립트, 멱등 관찰자 등)에만 명시적으로 선언하여 사용하세요. 지시문이 없으면 저장해도 아무것도 실행되지 않으며, 다음 *자연스러운* 트리거(`MESSAGE_SENT`, 채팅 전환 등)나 새로고침 버튼을 누를 때 새 코드가 적용돼요.

전체 지시문 목록은 인앱 **레퍼런스**의 "Directives" 섹션을 참고하세요.

## 핸들러 등록 vs 본문 실행

본문 모델은 "Lumiverse 호스트 이벤트에 반응"하는 것을 처리해요. 반면 "LumiScript가 사전에 알지 못하는 사건에 반응"하는 다른 형태는 등록 핸들러를 사용해요:

```js
api.broadcast.on('tracker:state-changed', (payload) => { /* ... */ });
api.commands.onInvoked(async (commandId, ctx) => { /* ... */ });
api.macros.register('myMacro', { /* def */ }, async (ctx) => '...');
api.tools.register('myTool', { /* def */ }, async (args) => '...');
```

이들은 엔진이 나중에 실행할 *클로저*를 등록해요 — 동료 스크립트가 브로드캐스트를 전송할 때, 사용자가 Cmd/Ctrl+K로 명령을 실행할 때, 호스트가 프롬프트에서 `{{myMacro}}`를 해석할 때, LLM이 여러분의 도구를 호출할 때 실행돼요. 클로저는 프록시의 `api`를 캡처하므로 자신을 등록한 본문 실행이 끝난 후에도 계속 동작해요.

등록 핸들러에 대해 알아두어야 할 3가지:

- **본문 실행 간에 유지돼요.** 한 번 등록되면 스크립트가 비활성화/삭제되거나, 다음 본문 실행에서 이전 등록을 초기화할 때까지 살아있어요(인터페이스마다 다름 — 브로드캐스트와 명령 핸들러는 초기화 규칙이 다름; 인앱 레퍼런스 참고).
- **핸들러 실행은 자신을 등록한 본문과 수명을 공유하지 않아요.** 등록한 본문이 실행된 지 3시간 후에 호출된 `broadcast.on` 핸들러도 정상 작동하는 `api`를 받아요. 핸들러 실행은 폴백 규칙에 따라 스크립트의 현재 activeRun을 통해 라우팅되기 때문이에요.
- **비활성화 시 자동으로 정리돼요.** 10초간의 `ls:teardown` 과정에 레지스트리 정리가 포함되어 있으므로, 등록했던 핸들러를 직접 해제하지 않아도 안전하게 정리돼요.

각 인터페이스별 수명 주기와 클로저 상세 내용은 [`concepts/handler-lifetime.md`](handler-lifetime.md)를 참고하세요.

## 실행 간에 유지되지 않는 것들

로컬 선언 변수는 유지되지 않아요:

```js
let counter = 0;
counter += 1;
console.log(counter);
```

이 코드는 매번 `1`을 출력해요. `let counter`는 본문을 감싸는 AsyncFunction의 로컬 변수이므로, 함수가 반환되면 가비지 컬렉션돼요.

지속성을 위한 세 가지 탈출구:

- **`globalThis.<key>`** — 스크립트 러너 서브프로세스의 수명 동안 유지됨(확장 기능 재로드 시까지). 가장 가벼운 옵션이며 인메모리 캐시에 적합해요. `globalThis.myCounter ??= 0; globalThis.myCounter += 1;` AsyncFunction 및 QuickJS 공유 격리에서는 워커 내 스크립트 간에 공유되므로 키에 네임스페이스를 붙이세요. QuickJS *스크립트별(per-script)* 격리에서는 각 스크립트가 자기만의 `globalThis`를 가져요. [실행 엔진](engine.md) 참고.
- **`api.scriptStorage.*`** — 세션 범위의 스크립트별 KV 저장소. 워커 재생성 및 스크립트 수정 시에도 유지되지만 비활성화/삭제/백엔드 재시작 시 초기화돼요. 1MB 제한.
- **`api.variables.{local, global, character, chat}`** — 영구 JSON 직렬화 저장소, 4개 범위. 확장 기능 재로드 후에도 유지돼요. "진정한" 영속 계층이에요.

전체 결정 매트릭스는 [`concepts/storage-model.md`](storage-model.md)를 참고하세요.

<a id="the-sandbox-boundary"></a>
## 샌드박스 경계

사용자 스크립트는 순수 Bun 런타임이 아니라 강화된 샌드박스 내부에서 실행돼요:

- 일부 리터럴 소스 패턴은 **디스패치 시점에 거부돼요** — 스크립트가 아예 실행되지 않으며 편집기 콘솔에 `[security]` 항목이 표시돼요. 대상 패턴: `import('...')`, 순수 `require('...')`, `new Function('...')` / `Function('...')`, `.constructor.constructor`, 리터럴 `globalThis.Bun` / `globalThis.process`. 각 패턴마다 문서화된 대체 방안이 있어요(`import()` 대신 `script.require('library-name')` 사용, `new Function` 대신 일반 함수 문법 사용 등).
- 여러 `globalThis` 속성이 런타임에 **`undefined`로 대체**돼요 — `Worker`, `WebSocket`, `XMLHttpRequest`, 브라우저 대화상자(`alert`/`prompt`/`confirm`), Node 호환 모듈 전역 변수(`fs`, `http`, `net` 등). 표준 ES 내장 객체(`Object`, `Array`, `Promise`, `JSON`, `Math`, `Date` 등), 웹 데이터 객체, Web Crypto, 스트림, 타이머는 정상 동작해요. (`fetch`는 예외적이에요: `globalThis.fetch`는 잠겨 있지만, `allowDangerous`가 켜진 스크립트는 최상위 보호된 래퍼 `fetch`를 제공받아요. [네트워크 송신](../guides/network.md) 참고.)

거부되는 패턴 전체 목록과 접근 가능한 전역 변수는 인앱 **레퍼런스** → **Sandbox hardening** 섹션을 확인하세요. 표준 접근 가능 목록은 `src/script-runner/child-entry.ts`의 `SAFE_GLOBALS`예요.

샌드박스에 대해 기억할 두 가지:

- **스크립트별로 또는 스크립트 소스 코드에서 설정할 수 없어요.** 샌드박스를 우회하는 옵션은 없으며 런타임 계약의 일부예요. (엔진 선택 및 QuickJS 컨텍스트 격리는 설정에서 전역으로 조정할 수 있지만 샌드박스를 약화시키지는 않아요. [실행 엔진](engine.md) 참고.)
- **스크립트의 외부 접근 기능은 `api.*`를 통해 안전하게 제공돼요.** HTTP는 `api.utils.http.*` (`cors_proxy` + `allowDangerous`), 파일시스템은 `api.files.*` (`allowDangerous`), 비밀값은 `api.enclave.*` (`allowDangerous`) 등을 통해 라우팅돼요. 샌드박스가 기능을 막는 것이 아니라, 사용자가 확장 기능을 켤 때 명시적으로 승인한 권한 게이트를 통하도록 안내하는 것이에요.

## 다음 단계

이제 핵심 멘탈 모델을 갖추셨어요. 다음 문서들을 살펴보세요:

1. **[권한](permissions.md)** — 메서드별 필요 권한, `allowDangerous`의 의미, 권한 거부 처리.
2. **[저장소 모델](storage-model.md)** — variables / db / scriptStorage / enclave / files 선택 가이드.
3. **[핸들러 수명 주기](handler-lifetime.md)** — `broadcast.on`, `commands.onInvoked`, `macros.register`, `tools.register`의 클로저 수명.
4. **인앱 레퍼런스 탭** — 그 밖의 모든 기능 탐색. 한 번 열어서 섹션 목록을 훑어보면 나중에 어디를 봐야 할지 알 수 있어요.
