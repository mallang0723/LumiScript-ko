# 권한 체계 (Permissions)

`api.*` 인터페이스에서 권한이 적용되는 기준, 처음 접할 때 혼란스러울 수 있는 `allowDangerous`의 정체, 그리고 권한이 승인되지 않았을 때 스크립트가 우아하게 예외를 처리(graceful degradation)하는 방법을 알아볼게요.

## 핵심 개념: 권한은 스크립트별이 아니라 확장 기능 단위예요

LumiScript의 권한은 **단 한 곳**에서 나와요: LumiScript의 `spindle.json` 매니페스트에 선언된 `permissions` 배열이에요. 사용자는 다른 모든 Lumiverse 확장 기능과 마찬가지로 LumiScript 확장 기능을 활성화할 때 모든 권한을 한 번에 승인해요. 일단 승인되면 **LumiScript 내부의 모든 스크립트가 동일한 승인 권한 집합을 공유**해요 — 스크립트별 권한 선언도 없고, 특정 스크립트가 권한을 거부할 방법도 없으며, 추가 권한을 개별적으로 요구할 방법도 없어요.

스크립트 소스 코드에 권한을 작성하던 다른 스크립팅 시스템(SillyTavern의 `@permissions` 헤더가 대표적)을 사용해 보셨다면, 그 방식을 잊으셔야 해요. LumiScript는 그렇게 동작하지 않으며 편집기는 스크립트 헤더의 권한 지시문을 읽지 않아요. `spindle.json`에 선언된 내용이 곧 바닥이자 천장이에요.

명심해야 할 두 가지 사실:

- **스크립트 작성자인 여러분이 대개 사용자 자신이기도 해요.** 즉 LumiScript를 설치할 때 모든 권한에 "예"라고 답한 사람이 바로 *여러분*이에요. 권한을 취소하거나 다시 승인해야 한다면 스크립트 편집기가 아니라 Lumiverse의 확장 기능 패널에서 수행해야 해요.
- **권한은 트리거 시스템이 아니라 `api.*` 메서드 호출을 제어해요.** `MESSAGE_SENT` 본문에서 `data.message.content`를 읽는 것은 `chat_mutation` 권한이 필요하지 않아요 — 호스트가 이미 이벤트 페이로드를 스크립트에 무료로 전달해 주었기 때문이에요. 권한은 스크립트가 API를 통해 호스트에 다시 접근할 때(`api.chat.getMessages`, `api.chat.editMessage` 등)에만 요구돼요.

## 두 가지 게이트

LumiScript의 기능들은 최대 두 개의 게이트로 보호돼요:

1. **Spindle 권한** — 확장 기능 활성화 시점에 사용자의 확장 기능 패널에서 승인돼요. 예: `api.chat.*` 쓰기를 위한 `chat_mutation`, `api.ui.dom.*` 및 `api.theme.*`를 위한 `app_manipulation`, `api.imageGen.*`를 위한 `image_gen`. 모든 스크립트가 공유하는 게이트예요.
2. **`allowDangerous`** — LumiScript 편집기의 스크립트 목록 행에 있는 스크립트별 UI 토글이에요(활성화/비활성화 토글 옆의 "dangerous" 뱃지). Spindle 권한이 아니며 `spindle.json`에 선언되지도 않아요. 스크립트 작성자가 편집기에서 스크립트마다 직접 설정해요.

대부분의 기능은 하나의 게이트만 사용해요. 일부 기능은 두 게이트를 모두 사용해요 — 인앱 레퍼런스의 **권한 매트릭스**에서는 이러한 기능 옆에 흐린 글씨로 `+ allowDangerous`라고 표기되어 있으며, 두 게이트가 모두 켜져 있어야 해당 메서드가 동작해요. 대표적인 예가 아웃바운드 HTTP예요: `api.utils.http.*`는 `cors_proxy`(확장 기능 수준에서 승인됨) **및** `allowDangerous`(스크립트별로 토글됨)를 모두 요구해요.

## `allowDangerous`가 적용되는 대상과 적용되지 않는 대상

LumiScript에서 가장 흔히 혼동하는 부분이므로 명확히 짚고 넘어갈게요. `allowDangerous`는 **오직 정해진 4가지 영역**에만 적용되며 그 외의 어떤 것에도 적용되지 않아요:

- `api.utils.http.*` — 호스트의 CORS 프록시를 통한 아웃바운드 HTTP 요청.
- `api.enclave.*` — 사용자별/확장 기능별 AES-256-GCM 암호화 비밀값 저장소.
- `api.files.*` — 파일 I/O (사용자별 / 공유 / 임시 계층).
- `api.chat.clearAllInjections` — 대화 주입 내용을 일괄 삭제하는 강력한 초기화 기능.

그 밖의 모든 기능은 자체 Spindle 권한으로 보호되며 `allowDangerous`를 요구하지 **않아요**:

| 기능 영역 | 제어하는 권한 |
|---|---|
| DOM 주입 (`api.ui.dom.inject`, `addStyle`, `delegate` 등) | `app_manipulation` 전용 |
| 테마 조작 (`api.theme.apply`, `applyPalette` 등) | `app_manipulation` 전용 |
| 고급 모달 (`api.ui.showAdvancedModal`) | `app_manipulation` 전용 |
| 이미지 업로드 / 조회 (`api.images.*`) | `images` 전용 |
| 이미지 생성 (`api.imageGen.*`) | `image_gen` 전용 |
| 캐릭터 아바타 업로드 (`api.characters.setAvatar`) | `characters` 전용 |
| 캐릭터 수정 (`api.characters.*`) | `characters` 전용 |
| OAuth 콜백 (`api.oauth.*`) | `oauth` 전용 |
| 대화 주입 (`api.chat.inject`) | `interceptor` 전용 |
| 자료 저장소 (`api.databanks.*`) | `databanks` 전용 |
| 프리셋 (`api.presets.*`) | `presets` 전용 |
| 월드북 (`api.worldInfo.*`) | `world_books` 전용 |

올바른 멘탈 모델: `allowDangerous`는 *"이 스크립트가 외부 세계나 로컬 디스크에 접근할 수 있도록 신뢰함"* — 즉 네트워크, 파일시스템, 암호화된 비밀값을 의미해요. 만능 마스터 키가 **아니에요**. DOM, 테마, 이미지, 캐릭터, OAuth 기능을 쓰기 위해 `allowDangerous`를 켜려고 한다면 멈추세요 — 해당 기능들은 각자의 권한으로 제어돼요.

## `// @permissions` 지시문은 존재하지 않아요

LumiScript는 스크립트 헤더의 `@permissions`나 `@permission` 지시문을 해석하지 않아요. 이를 작성해도 아무런 효과가 없는 no-op이에요 — 권한을 부여하는 것처럼 보이지만 실제로는 아무것도 하지 않으며, 실행 시점에 권한 제한 메서드를 호출하면 에러가 발생해요.

```js
// @permissions chat_mutation, generation    ← 아무런 효과가 없어요

// 위의 주석은 문서화용 플레이스홀더일 뿐이에요. 실제 권한은
// LumiScript의 spindle.json 매니페스트로부터 오며, 확장 기능 활성화 시
// 단 한 번 승인됩니다. 이 스크립트는 확장 기능이 승인받은 권한 내에서만
// 동작할 수 있으며, 이 주석은 아무것도 바꾸지 못해요.
```

문서화 목적으로 적고 싶다면 런타임 효과를 암시하지 않는 솔직한 표현 — `// 필요 권한: chat_mutation, generation` — 을 사용하는 것이 좋아요.

## 권한 거부를 우아하게 처리하기

두 가지 상호 보완적인 접근 방식이 있어요.

**선제적 방식 — 호출 전에 미리 확인하기 (권장).** **v2.0**부터 `api.permissions`를 통해 스크립트 자체에 별도 권한 없이도 현재 어떤 권한이 승인되어 있는지 확인할 수 있어요:

```js
// 특정 권한이 승인되어 있는지 확인:
if (await api.permissions.has('images')) {
  await api.images.upload(bytes);
}

// …또는 전체 승인된 권한 목록 읽기:
const granted = await api.permissions.getGranted(); // 예: ['chat_mutation', 'generation', …]
```

`script.allowDangerous` 상태는 사용자 코드에 노출되지 않으므로, 이 토글이 제어하는 기능(아웃바운드 HTTP, 암호화 인클레이브, 파일 I/O)은 선제적으로 확인할 수 없으며 아래의 사후 감지 방식을 사용해야 해요.

**사후 감지 방식 — 호출하고 에러 잡기(catch).** 권한 메서드를 호출하고, 발생하는 에러를 catch하여 분기 처리해요. 에러 메시지는 접두사로 안전하게 매칭할 수 있어요:

- 누락된 Spindle 권한은 `.message`가 `PERMISSION_DENIED:<permission-name>`으로 시작하는 `Error`를 던져요. 대부분의 거부는 표준 형식인 `PERMISSION_DENIED:<name> — grant this permission to use this API`를 사용하며 던지기 전에 백엔드 로그에 `[LumiScript] ...` 경고를 출력해요. 한 가지 예외: `cors_proxy`는 백엔드 경고 없이 `PERMISSION_DENIED:cors_proxy — grant this permission to use api.utils.http`를 던져요(검사가 공유 `assertPerm` 헬퍼 외부에 위치함). 하위 호환성을 위해 전체 메시지 대신 접두사(`startsWith('PERMISSION_DENIED:<name>')`)로 매칭하세요.
- 누락된 `allowDangerous`는 `.message`에 리터럴 문구 `must have "Allow Dangerous" enabled`가 포함된 `Error`를 던져요(스크립트 이름이 포함됨). 이 경로 역시 백엔드 로그에 `[LumiScript] ...` 경고를 출력해요.

기본 패턴:

```js
try {
  await api.chat.editMessage(messageId, { content: newContent });
} catch (err) {
  if (err.message.startsWith('PERMISSION_DENIED:chat_mutation')) {
    console.warn('[my-script] chat_mutation not granted; skipping edit');
    return;
  }
  throw err; // 관련 없는 다른 에러는 다시 던집니다
}
```

권한과 `allowDangerous`가 모두 필요한 기능(HTTP, 인클레이브, 파일)의 경우 두 에러 형태를 모두 매칭하세요:

```js
try {
  const resp = await api.utils.http.get('https://example.com/data.json');
  return resp.body;
} catch (err) {
  if (err.message.startsWith('PERMISSION_DENIED:cors_proxy')
      || err.message.includes('must have "Allow Dangerous" enabled')) {
    console.warn('[my-script] http unavailable; falling back to cached data');
    return await api.scriptStorage.get('cached:data', null);
  }
  throw err;
}
```

오래 유지되는 핸들러 — 브로드캐스트 구독자, 도구 콜백, 등록된 매크로 — 에서는 이 패턴이 더욱 중요해요. 핸들러 내부에서 포착되지 않은 거부는 핸들러가 실행될 때마다 편집기 콘솔에 처리되지 않은 프로미스 거부(unhandled rejection)로 쌓이기 때문이에요:

```js
api.broadcast.on('something:happened', async (payload) => {
  try {
    await api.images.upload({ data: payload.bytes, mimeType: 'image/png' });
  } catch (err) {
    if (err.message.startsWith('PERMISSION_DENIED:images')) {
      console.warn('[my-script] images not granted; ignoring upload request');
      return;
    }
    throw err;
  }
});
```

참고: 스크립트 작성자가 곧 사용자인 개인 환경에서는 권한 거부 처리가 주로 방어적 목적이에요 — 거부가 발생하면 확장 기능 설정에서 권한을 켜주면 그만이에요. 하지만 작성한 스크립트를 다른 사용자에게 배포하거나 팩으로 공유할 때는 사용자의 권한 승인 상태가 다를 수 있으므로 위의 예외 처리 패턴이 필수적이에요.

## 권한 요약 일람

인앱 레퍼런스의 **권한 매트릭스**가 공식적인 메서드-권한 매핑 표예요 — 특정 `api.foo.bar()` 호출에 어떤 권한이 필요한지 확인할 때 열어보세요. 오프라인 참고용으로 LumiScript가 선언하는 각 권한의 설명은 다음과 같아요:

- **`chat_mutation`** — 채팅 메시지 읽기 / 전송 / 수정 / 삭제. 대부분의 `api.chat.*` 작업에 필요.
- **`chats`** — 대화 세션 메타데이터 및 채팅 목록 CRUD. 메시지 내용(`chat_mutation`)과 구분됨.
- **`characters`** — `setAvatar`를 포함한 `api.characters.*`를 통한 캐릭터 CRUD.
- **`personas`** — `api.personas.*`를 통한 페르소나 CRUD.
- **`presets`** — `api.presets.*`를 통한 생성 프리셋 및 프롬프트 블록 CRUD.
- **`world_books`** — `api.worldInfo.*`를 통한 월드북 및 엔트리 CRUD.
- **`regex_scripts`** — 정규식 찾기/바꾸기 스크립트 CRUD.
- **`generation`** — `api.llm.*`를 통한 LLM 프로바이더 호출. 월드 인포 인터셉터 등록에도 필요.
- **`interceptor`** — 실행 중간에 조립된 프롬프트를 수정하는 `api.chat.inject` 프롬프트 주입 등록. (콘텐츠 프로세서와 월드 인포 인터셉터는 각자의 권한 사용 — `macro_interceptor` / `generation` 참고.)
- **`context_handler`** — `api.chat.inject(..., { mode: 'context' })` 주입이 거치는 컨텍스트 핸들러 단계를 위한 호스트 측 배관. LumiScript는 `spindle.json`에 `interceptor`와 함께 선언하지만, LumiScript 코드 레벨에서는 검사하지 않으며 `interceptor`만 강제돼요. 확장 기능 권한 프롬프트에 둘 다 표시되므로 완전성을 위해 기재함.
- **`macro_interceptor`** — 매크로 해석 인터셉터 등록. 성능에 민감하므로 `interceptor`와 별도로 제어됨.
- **`cors_proxy`** — `api.utils.http.*`를 통한 아웃바운드 HTTP 요청. `allowDangerous`와 짝을 이룸(둘 다 필요).
- **`ui_panels`** — 플로팅 위젯 / 독 패널 — 앱 셸에 영구적인 자체 UI 영역을 유지하는 화면.
- **`app_manipulation`** — DOM 주입 (`api.ui.dom.*`), 고급 모달 (`api.ui.showAdvancedModal`), 테마 조작 (`api.theme.*`). "스크립트가 호스트 앱 셸의 픽셀을 직접 소유함"을 의미하는 게이트. `api.ui.showContextMenu`(시스템 테마, 무료 티어)나 단순 UI 원시 기능(`toast`, `confirm`, `prompt`, `showModal`)에는 요구되지 않음.
- **`push_notification`** — `api.ui.pushNotification`을 통한 OS 수준 푸시 알림.
- **`ephemeral_storage`** — 자동 만료 TTL이 적용된 `api.files.temp*` 임시 저장소.
- **`tools`** — `api.tools.*`를 통한 Council 지원 LLM 도구 등록.
- **`event_tracking`** — `api.events.*`를 통한 영속 이벤트 기록 및 쿼리(트리거 시스템이 아님).
- **`databanks`** — `api.databanks.*`를 통한 자료 저장소 및 문서 CRUD.
- **`images`** — `api.images.*`를 통한 Lumiverse 이미지 저장소의 이미지 영속화 및 조회.
- **`image_gen`** — 사용자의 연결 프로필을 대상으로 `api.imageGen.*`를 통한 이미지 생성.
- **`oauth`** — `api.oauth.*`를 통한 OAuth 콜백 핸들러 등록. Spindle이 노출하는 유일한 인바운드 HTTP 훅.
- **`web_search`** — `api.webSearch.*`를 통한 웹 검색 실행.
- **`memories`** — `api.memories.*`를 통한 메모리 코텍스 및 대화 메모리 접근.

## 관련 항목

1. **[저장소 모델](storage-model.md)** — `api.variables.*`, `api.db.*`, `api.scriptStorage`, `api.enclave.*`, `api.files.*` 중 적절한 저장소 선택하기. 이 중 여럿은 권한으로 제어되며, 이 문서와 그 문서는 서로를 교차 참조해요.
2. **[핸들러 수명 주기](handler-lifetime.md)** — `broadcast.on`, `commands.onInvoked`, `macros.register`, `tools.register`의 클로저 수명. 위에서 본 오래 유지되는 핸들러에서의 권한 거부 처리 패턴이 실질적인 동기예요.
3. **인앱 레퍼런스의 권한 매트릭스** — 공식 메서드별 권한 표. 항상 최신 유지.
