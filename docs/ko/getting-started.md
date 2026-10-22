# 시작 가이드 (Getting started)

10분 만에 완성하는 첫 번째 스크립트예요. 가이드를 마치면 스크립트가 실행되는 모습을 확인하고, 편집기와 콘솔의 위치를 익히며, "LumiScript 스크립트란 무엇인가"에 대한 멘탈 모델을 갖추게 될 거예요.

## 준비 사항

- LumiScript 확장 기능이 활성화된 실행 중인 Lumiverse 환경. (설정 → 확장 기능; 켜져 있지 않다면 토글을 켜세요.)
- 최소 하나 이상의 열려 있는 채팅. 일부 스크립트는 채팅이 활성화되어 있을 때만 실행돼요. 우리의 첫 스크립트는 `MESSAGE_SENT`에서 트리거되므로 메시지를 보낼 채팅이 필요해요.
- 준비는 이것으로 끝이에요. 별도의 CLI도, `npm install`도, 빌드 단계도 필요 없어요.

## 스크립트 편집기

LumiScript 독(dock) 패널을 여세요(기본값은 화면 오른쪽 끝 — 설정에서 변경 가능). 패널에는 3개의 탭이 있어요:

- **관리 (Manage)** — 스크립트 목록과 편집기. 작업 시간의 95%를 여기서 보내게 돼요.
- **상태 (Status)** — 런타임 상태: 현재 실행 중인 스크립트, 최근 실행 결과, 등록된 매크로 / 도구 / DOM 주입 항목.
- **저장소 (Storage)** — 스크립트 소유 데이터(`api.variables`, `api.db` 컬렉션, `api.scriptStorage`)를 관리하는 관리자 뷰.

**관리(Manage)** 탭을 클릭한 뒤, **+** 버튼을 눌러 새 스크립트를 만드세요. 상단에 두 개의 필드가 보여요 — 스크립트 **이름**(원하는 이름 입력)과 **타입** 드롭다운이에요. 타입은 지금은 `trigger`로 두세요(다른 옵션인 `library`는 다른 스크립트가 import하여 사용하는 스크립트를 위한 것이에요 — 인앱 레퍼런스의 **내장 라이브러리** 섹션에서 사용 패턴과 내장 `ls:*` 라이브러리를 확인할 수 있어요). 이름 아래에는 **이벤트** 다중 선택기가 있어요 — 여기서 스크립트를 Lumiverse 이벤트와 연결해요.

## 첫 번째 스크립트 작성

이벤트 선택기에서 **`MESSAGE_SENT`** 이벤트를 선택하세요. 이렇게 하면 활성 채팅에서 여러분(사용자)이 메시지를 보낼 때마다 Lumiverse가 스크립트를 실행해요.

스크립트 편집기 본문에 다음 코드를 붙여넣으세요:

```js
// 첫 번째 LumiScript 스크립트.
// 트리거: MESSAGE_SENT — 채팅에 메시지가 생성될 때마다 실행됩니다.

// MESSAGE_SENT는 채팅에서 생성되는 *모든* 메시지에 대해 발생해요 —
// 어시스턴트의 빈 플레이스홀더도 포함됩니다. 사용자가 보낸 메시지에만
// 반응하도록 non-user 메시지를 건너뜁니다 (이 가드가 없으면 스크립트가
// 두 번 로깅되며, 두 번째는 내용이 빈 상태가 됩니다).
if (!data.message.is_user) return;

console.log('Hello from LumiScript!');
console.log('You just sent:', data.message.content);
```

스크립트를 저장하세요(Ctrl/Cmd+S 또는 디스켓 아이콘). 스크립트 목록 행의 토글을 확인하여 스크립트가 **활성화(enabled)** 상태인지 확인하세요.

이제 대화창으로 가서 아무 메시지나 전송해 보세요. 스크립트 본문 아래의 **편집기 콘솔**을 살펴보세요. 다음과 같이 출력될 거예요:

```
[10:23:45] LOG: Hello from LumiScript!
[10:23:45] LOG: You just sent: <whatever you typed>
```

만약 실행되지 않았다면 다음을 확인하세요:

- 스크립트가 **활성화**되어 있는지 (목록 행의 토글).
- 이벤트 선택기에 `MESSAGE_SENT`가 포함되어 있는지.
- 스크립트가 **저장**되었는지 (저장되지 않은 변경 사항이 있으면 편집기에 표시됨).
- 채팅에서 실제로 메시지를 전송했는지. (`MESSAGE_SENT`는 메시지가 생성될 때마다 실행돼요 — 위의 `is_user` 가드가 사용자가 전송한 메시지만 골라내며, 어시스턴트의 완성된 답변은 `GENERATION_ENDED`에서 도착해요.)

## 내부 동작 원리

이 과정에서 꼭 기억해야 할 3가지 핵심:

**1. 스크립트 본문 자체가 핸들러예요.** `api.on('MESSAGE_SENT', handler)`나 `addEventListener` 같은 호출이 없어요. 연결된 이벤트가 발생하면 Lumiverse는 스크립트 본문을 새로운 `AsyncFunction`으로 감싸서 위에서 아래로 실행해요. 이벤트 연결 정보는 스크립트 소스 코드가 아니라 편집기 UI(선택한 이벤트 다중 선택기)에 저장돼요. (이는 기본 AsyncFunction 엔진의 동작이며, 선택적 QuickJS 격리 환경 역시 매 실행마다 새로운 인스턴스를 띄워요 — 아래의 독립 스코프 원리는 두 엔진 모두 동일해요. [실행 엔진](concepts/engine.md) 참고.)

**2. 전역 변수 `data`에 이벤트 페이로드가 담겨요.** `MESSAGE_SENT`가 실행될 때 `data`의 형태는 대체로 다음과 같아요:

```js
{
  __event:  'MESSAGE_SENT',
  chatId:   '<chat UUID>',
  message:  { id, content, is_user, name, send_date, ... },
  // 이벤트 타입별 추가 필드
}
```

각 이벤트마다 고유한 페이로드 형태가 있어요. 이벤트별 전체 구조는 인앱 **레퍼런스** 탭의 "Lumiverse Events" 항목에서 확인할 수 있어요.

**3. `api.*`는 모든 기능으로 향하는 관문이에요.** 첫 스크립트에서는 사용하지 않았지만, 전역 `api` 객체를 통해 `api.chat.*`(메시지 읽기/쓰기), `api.llm.*`(LLM 호출), `api.variables.*`(영속 저장소), `api.ui.*`(알림, 모달, UI 화면) 및 15개 이상의 네임스페이스를 활용할 수 있어요. 다음 단계에서 차근차근 다룰 거예요.

## UI 기능 추가해보기

편집기 콘솔 외부에서도 눈에 보이는 동작을 하도록 스크립트를 수정해 볼게요. 본문 코드를 다음과 같이 바꿔보세요:

```js
const text = data.message.content;
const words = text.trim().split(/\s+/).filter(Boolean).length;

api.ui.toast(`You sent ${words} word(s)`, 'info');
```

저장한 뒤 메시지를 보내보세요. 앱 한구석에 단어 수가 적힌 작은 알림이 나타나요. `api.ui.toast(message, level?)`는 무료 티어로 권한이 필요하지 않아요. 레벨은 `'info'`, `'success'`, `'warning'`, `'error'`를 사용할 수 있어요.

권한이 필요 없는 몇 가지 유용한 `api.ui.*` 원시 기능들:

- `api.ui.prompt(message, defaultValue?, options?)` — 테마가 적용된 텍스트 입력창. `Promise<string | null>`을 반환해요(입력된 텍스트, 취소 시 `null`).
- `api.ui.confirm(message, title?, options?)` — 확인/취소 대화상자. `Promise<boolean>`을 반환해요.
- `api.ui.showModal(items, options)` — 여러 섹션으로 구성된 모달(`options`는 필수이며 `title`을 포함해야 함); `ModalHandle`을 반환해요(`handle.result`를 await).

DOM 주입, 테마 변경, 서랍 탭, 플로팅 위젯 등 호스트 셸을 수정하는 화면 기능의 경우 스크립트에 `app_manipulation` 권한이 필요해요(`concepts/permissions.md` 참고).

## 초기에 꼭 알아두어야 할 두 가지

처음 시작할 때 가장 많이 겪는 함정들이에요:

**모든 실행은 새로운 함수 스코프예요.**

```js
let counter = 0;
counter += 1;
console.log(counter);
```

이 코드는 매번 `1`을 출력해요. `let counter` 선언은 본문을 감싸는 AsyncFunction의 로컬 변수이므로 다음 실행까지 유지되지 않아요. 실행 간에 유지되는 상태가 필요하다면 여러 단계의 저장소 계층(`globalThis`, variables, db, scriptStorage, enclave, files)을 사용할 수 있어요 — [`concepts/storage-model.md`](concepts/storage-model.md)를 참고하세요. 간단한 인메모리 테스트용이라면 다음과 같이 쓸 수 있어요:

```js
globalThis.myCounter ??= 0;
globalThis.myCounter += 1;
console.log(globalThis.myCounter);
```

`globalThis.*`는 스크립트 실행기 서브프로세스의 수명 동안 유지돼요(즉, 확장 기능이 다시 로드될 때까지). 영구적으로 보존되어야 하는 상태라면 `api.variables.global` / `.local` / `.character` / `.chat`을 사용하세요.

**일반적인 JavaScript처럼 보이지만 스크립트에서 작동하지 않는 몇 가지 패턴이 있어요.**

샌드박스는 디스패치 단계에서 다음 패턴들을 거부해요 — 스크립트가 전혀 실행되지 않으며 편집기 콘솔에 `[security]` 항목이 표시돼요:

- `import('module-name')` — 스크립트 간 의존성에는 `script.require('library-name')`를 사용하세요.
- `require('module-name')` — 위와 동일; 순수 `require()`는 차단되며 `script.require(...)`가 LumiScript API예요.
- `new Function('code')` / `Function('code')` — 함수를 일반적인 문법으로 정의하세요. Function 생성자는 차단돼요.
- `.constructor.constructor` — Function 생성자로 우회하는 프로토타입 체인 백도어로, 동일한 이유로 차단돼요.
- `globalThis.Bun.X` / `globalThis.process.X` — 호스트 런타임 API는 스크립트에 노출되지 않아요.

이것들을 외우려 애쓰지 마세요 — 해당 패턴을 사용하면 에러 메시지에서 대체 방안을 친절히 안내해 줘요. 전체 목록과 상세 배경은 인앱 레퍼런스의 **샌드박스 강화 (Sandbox hardening)** 및 [`concepts/trigger-model.md`](concepts/trigger-model.md#the-sandbox-boundary)의 요약을 참고하세요.

## 다음 단계

이제 실용적인 스크립트를 작성하기에 충분한 기초를 갖추셨어요. 다음 순서로 읽어보시는 것을 추천해요:

1. **[트리거 모델](concepts/trigger-model.md)** — 이벤트, 전역 `data`, `ls:startup` / `ls:teardown`, `@ls:reload-on-edit`가 어떻게 유기적으로 동작하는지 5분 만에 살펴보는 멘탈 모델 가이드.
2. **[권한](concepts/permissions.md)** — 어떤 메서드에 어떤 권한이 필요한지, `allowDangerous`의 정체와 권한 거부 시 예외를 안전하게 처리하는 방법.
3. **[저장소 모델](concepts/storage-model.md)** — variables / db / scriptStorage / enclave / files 중에서 적절한 계층 선택하기.
4. **[DOM 주입](guides/dom-injection.md)** — 호스트 앱 셸 내부에 UI 직접 제작하기. LumiScript를 Lumiverse의 일체형 기능처럼 느끼게 만들어 주는 가장 강력한 도구예요.
5. **[LLM 호출하기](guides/llm.md)** — `api.llm.*` — 텍스트 생성, 검증된 구조화 출력, 도구 사용 생성, 시험 실행(dry-run), 취소 처리. 실질적인 스크립트 대부분이 이 기능을 사용해요.
6. **[커스텀 매크로](guides/macros.md)** — `api.macros.*` — 푸시 vs 풀 모드, 프롬프트에 계산된 값을 주입하는 `{{name}}` 연동, 템플릿 수준 재작성을 위한 인터셉터.
7. **[도구 등록](guides/tools.md)** — `api.tools.*` — LLM이 호출할 수 있는 도구 등록(`generateWithTools`의 반대편). Council 연동, `ls:council-prompt` 패턴, 스크립트 간 호출.
8. **인앱 레퍼런스 탭** — 그 밖의 모든 기능. 어디에 어떤 기능이 있는지 한 번 훑어보세요.

문서를 읽다가 이해가 안 되거나 문서에 없는 예외 케이스를 마주친다면 알려주세요(함께 완성해 나가는 문서이므로 피드백은 언제나 환영해요).
