# API 안정성 (API stability, v1.0)

이 문서는 LumiScript의 **API 안정성 승인 기록**이에요 — 시맨틱 버저닝(SemVer) 약속이 보장하는 범위, 의도적으로 제외된 영역, 고정(freeze) 전 감사에서 결정된 계약 사항들을 기록해요. 여기서 고정된 인터페이스는 아래의 규칙에 따라서만 변경돼요.

**v2.0 상태:** 2.0.0 메이저 버전 변경은 새로운 선택적 QuickJS-WASM 엔진의 도입(아래 *엔진 간 차이* 참고)과 SSRF 사설 호스트 기본 차단 적용을 의미하며, `api.*` 인터페이스의 파괴적 변경을 의미하는 것이 *아니에요*. `script.ts`의 공개 계약은 2.0에서도 엄격하게 하위 호환 추가 방식으로 유지되었으므로 기존 스크립트와 데이터는 그대로 작동해요.

## "안정성"의 의미

v1.0.0부터 LumiScript는 **공개 계약(public contract)**(아래 정의)에 대해 엄격한 SemVer를 준수해요:

- **추가적 변경** (새로운 `api.*` 메서드/네임스페이스, 새 선택적 필드, 새 이벤트, 메시지의 새 선택적 필드, 새 권한)은 **마이너(minor)** 릴리스로 배포돼요 — 기존 스크립트나 데이터를 손상시키지 않아요.
- **파괴적 변경(Breaking changes)** — 공개 메서드/필드/이벤트/권한의 제거 또는 이름 변경, 시그니처나 반환 형태의 변경, 영속화된 필드의 의미 변경 — 은 **메이저(major)** 버전 판올림(v2.0 등)을 필요로 해요.
- 버그 수정 및 계약을 보존하는 내부 리팩토링은 **패치(patch)** 릴리스로 배포돼요.

"파괴적 여부"는 내부 구현이 아닌 아래에 명시된 인터페이스를 기준으로 판단해요.

## 동결된 공개 계약

1. **`api.*` 인터페이스** — 스크립트 대상 API예요. 기준 진실(source of truth): `src/types/script.ts` (`LumiScriptAPI`). 대소문자, 시그니처, 반환 형태(부재 시 `null` 반환 vs 에러 던짐 포함), Promise 반환 여부가 계약의 일부예요. (`src/types/editor-lib.ts`는 **자동 생성된** Monaco 미러예요 — 아래 참고).
2. **영속화 데이터 스키마** — `spindle.userStorage`에 기록되는 모든 것: `scripts.json` (`Script`), 설정 (`LumiScriptSettings`), 어시스턴트 대화 및 인덱스, 어시스턴트 메모리 (`MemoryNote`), `api.db` 컬렉션 레코드 (`DbRecord` 예약 필드 및 디스크 경로 템플릿), 캐릭터별 변수. 아래의 호환성 보장을 참고하세요.
3. **트리거/이벤트 모델** — 편집기 UI의 이벤트 연결 모델, 인식되는 Lumiverse 및 `ls:*` 이벤트 이름, 각 이벤트의 `data` 페이로드 형태 (표준 목록: 레퍼런스의 **Lumiverse Events** 섹션). 스크립트 본문이 핸들러로 실행되며, `data.__event`에 이벤트 이름이 담겨요.
4. **프론트매터 지시문** — 런타임에 해석되는 지시문은 정확히 하나예요: `// @ls:reload-on-edit` (선택적 핫 리로드). `@triggers` / `@name` / `@version` 등은 문서화 용도예요(이벤트 연결 효과 없음).
5. **권한 모델** — `spindle.json`에 선언된 확장 기능 수준의 권한과 `api.*` → 권한 매핑. 권한은 확장 기능 수준(스크립트별이 아님)으로 관리되며, 선언된 권한 세트는 1.0 기준으로 최종 확정된 것으로 간주해요.
6. **IPC 엔벨로프** (`src/types/script-runner-ipc.ts`, `src/types/messages.ts`) — 내부용: 두 프로세스가 단일 빌드로 배포되므로 버전 간 공개 계약은 아니지만, 자식→부모 엔벨로프는 컴파일 타임 드리프트 단언문이 포함된 Zod로 보호돼요.

## 동결 대상에서 제외됨 — 실험적 티어

- **`api.memories.*`** 및 **`api.council.*`**은 호스트 소유의 `lumiverse-spindle-types` DTO를 직접 별칭으로 사용하는 얇은 패스스루예요(그중 일부는 상위의 `@deprecated` 필드를 포함함). 이 형태는 LumiScript가 아닌 Spindle 호스트 소유이므로 **호스트를 추적하며 1.0 안정성 동결 대상에서 면제돼요** — `lumiverse-spindle-types`의 변경에 따라 LumiScript 메이저 판올림 없이도 변경될 수 있어요. 가장 변화 가능성이 높은 인터페이스로 취급하세요. (나머지 `api.*`는 로컬에서 타입을 소유하거나 LumiScript가 제어하는 구조적으로 동일한 얇은 래퍼예요.)

## 영속 스키마 호환성 보장

디스크에 기록되는 모든 데이터는 **알 수 없는 필드와 누락된 필드를 모두 허용하는 관대한 경로**를 통해 로드돼요 — 의도적으로 **`schemaVersion`이 없으며** 로드 시 엄격한 거부 유효성 검사를 하지 않아요. 이로 인한 특성:

- 최신 빌드에서 작성된 파일을 이전 빌드에서도 계속 읽을 수 있으며(추가 필드 무시), 그 반대도 마찬가지예요(누락된 선택적 필드는 `undefined`로 처리됨).
- 스키마는 **오직 추가적인 방식으로만** 발전해요. 디스크 포맷의 파괴적 변경은 명시적 마이그레이션을 동반하는 메이저 버전 이벤트가 돼요.
- `api.db`의 유일한 유효성 검사는 호출자가 선택적으로 지정하는 쓰기 시점 Zod 스키마뿐이에요. 읽기는 검증되지 않으며, LumiScript의 예약 레코드 필드(`id`/`createdAt`/`updatedAt`)는 엄격한 사용자 스키마 하에서도 보존돼요.

## 감사 과정에서 결정된 주요 사항

- **`api.tools.invoke` / `list` / `unregister`는 의도적으로 권한 검사를 하지 않아요** — 오직 `register`만 `tools` 권한을 검사해요. 이유: 등록이 특권 행위이며, `invoke`는 이미 검증된 핸들러를 실행하고, `list`/`unregister`는 읽기 전용이거나 소유자 범위로 제한되기 때문이에요. 현재 상태로 고정되었어요.
- **어시스턴트 대화는 `contextScriptIds`와 `contextFilePaths`를 병렬 선택적 `string[]`으로 영속화해요.** 고정됨. 향후 원격 소스 첨부는 *세 번째* 추가 선택적 필드로 추가될 수 있으며, 단일 타입의 `contextItems` 목록으로의 통합은 읽기 시점의 프로젝션으로 처리되므로 마이그레이션이나 호환성 파괴가 없어요.
- **위치 기반 인자 시그니처를 그대로 수용함** — `api.ui.toast`, `api.ui.pushNotification`, `api.utils.http.post`/`put`, 그리고 `id/content + options` 주입 메서드들은 후행 옵션 객체를 유지하므로 호환성 파괴 없이 명명된 옵션을 계속 확장할 수 있어요. 형태를 변경하지 않았어요.
- **1.0을 위해 다소 어색한 명명 관례를 수용함** — `ToolDefinition.display_name` / `council_eligible` (snake_case), `api.characters.getByName` (다른 5개 네임스페이스의 `findByName`과 다름), `WorldInfoEntry.keysecondary` (ST 레거시). 동결 직전에 공개 인터페이스와 도구 IPC를 흔들 가치가 없다고 판단했어요. 향후 정리가 필요하다면 깔끔한 이름들(`displayName`, `findByName`, `keySecondary`)을 1.0 이후 **추가적으로** 제공할 수 있어요(비파괴적). 이전 이름을 제거할 때만 메이저 판올림이 필요해요.
- **`api.db` 디스크 경로 템플릿과 컬렉션 이름 정규식은 고정 불변식이에요** — `db/{scope}/…/{name}.json` 구조는 작성기와 관리자 읽기 뷰 양쪽에 하드코딩되어 있으며, 사후 변경 시 기존 컬렉션이 유실될 수 있어요.
- **부모→자식 IPC 엔벨로프는 Zod로 보호되지 않아요** (자식→부모만 보호됨). 수용됨: 양쪽 모두 단일 번들로 배포되며 부모는 신뢰할 수 있는 호스트예요. 위협 모델은 악의적인 *자식* 프로세스이므로 검증 방향이 적절해요.

<a id="engine-divergence-quickjs-isolate-opt-in"></a>

## 엔진 간 차이: QuickJS 격리 (선택적)

스크립트는 기본적으로 **AsyncFunction** 엔진에서 실행돼요. 두 번째 선택적 **QuickJS-WASM 격리** 엔진은 관찰 가능한 전체 표면에서 동작이 일치하지만(이중 엔진 동등성 하네스로 등록-IPC 및 핸들러 실행 동작이 동일함이 입증됨), 알아두어야 할 몇 가지 차이점이 있어요:

- **도구 `X`를 등록한 바로 그 스크립트가 `api.tools.invoke('X')`를 호출하는 경우**, AsyncFunction에서는 핸들러 반환값을 반환하지만, QuickJS에서는 캐치 가능한 `ReentrantToolInvokeError` 예외를 던져요. QuickJS 환경에서는 스크립트의 실행과 핸들러 호출이 스크립트당 단일 락으로 직렬화되므로, 실행 중간에 **자신의** 도구를 await하면 교착 상태(deadlock)에 빠지게 돼요. 엔진은 이를 깔끔하게 감지하고 에러로 거부해요. 이는 아키텍처상의 특성이지만(공유 모듈 설계상 엔진 내부 수정 불가) 매우 좁은 영역이에요: 유일한 재진입 차이점이며, 일반적인 경우 — 등록, 목록 조회, **LLM/Council의 도구 호출**, **다른 스크립트의 도구 호출** — 는 엔진 간에 완전히 동일해요. 또한 전체 자식 프로세스를 멈추게 만들던 이전의 행 현상보다 훨씬 안전해요.

  **이식성 높은 패턴** — 자체 호출 대신 로직을 별도 함수로 추출하여 직접 호출하세요(불필요한 디스패치 왕복을 건너뛰므로 어느 엔진에서든 더 우수한 코드예요):

  ```js
  // 스크립트가 자신의 도구를 직접 호출하는 대신 (QuickJS에서 에러 발생):
  //   const r = await api.tools.invoke('summarize', { text });
  const summarize = async (args) => await api.llm.generate(/* … */);
  api.tools.register('summarize', toolDef, summarize); // LLM에 노출되는 래퍼
  const r = await summarize({ text });                 // 함수를 직접 호출 — 두 엔진 모두 동작
  ```

- **순수 `fetch` (`allowDangerous` 기능)는 플랫폼 `fetch`가 아니라 `api.utils.http.*`를 감싼 SSRF 강화 래퍼예요.** 두 엔진 모두에서 스크립트의 `fetch`는 호스트의 보호된 아웃바운드 경로(→ `api.utils.http.request` → cors 프록시 → `safeFetch`)를 타며, 이는 `api.utils.http.*`가 사용하는 것과 동일해요: DNS가 확인되고 고정되며, 루프백 / LAN / 링크 로컬(클라우드 메타데이터 포함) 주소는 기본 차단돼요 — 사용자가 해당 호스트를 허용 목록에 등록하지 않는 한(설정 → 네트워크 → *허용된 사설 호스트*; IP 리터럴 또는 `localhost`, 선택적으로 포트 포함, 일반 호스트명 불가). 이 경로를 타기 때문에 오직 `method` / `headers` / `body`만 전달되며, 응답은 **완료되기 전에 완전히 버퍼링**되고(증분 네트워크 스트리밍 없음), **http/https 전용**이며, 추가 `RequestInit` 필드(`mode`, `credentials`, `cache`, `redirect`, `referrer`, `referrerPolicy`, `integrity`, `keepalive`)는 무시돼요. 두 가지 기능이 **직접(허용 목록에 등록된 로컬) 경로**에서는 작동하지만 cors 프록시 경로에서는 작동하지 않아요(워커 경계를 넘으므로 지원 불가): **`AbortSignal`**로 실행 중인 요청을 취소할 수 있으며(cors 경로에서는 시그널이 전달되지만 효과 없음), 여러 개의 **`Set-Cookie`** 응답 헤더가 `res.headers.getSetCookie()`를 통해 개별 유지돼요(cors 경로에서는 호스트 프록시가 평탄화하므로 하나로 축소됨). URL 문자열 + init 객체를 전달하세요 — `Request` 객체의 `method` / `headers` / `body`는 읽히지 않아요.

  **응답 객체 형태도 엔진에 따라 달라요**: AsyncFunction 엔진은 실제 `Response`를 반환해요 — 모든 리더(`text` / `json` / `arrayBuffer` / `bytes` / `blob` / `formData` / `clone`, 이미 버퍼링된 바이트에 대한 `.body`)가 존재해요. 반면 QuickJS 엔진은 충실하지만 부분적인 VM 내부 `Response`를 반환해요 — `ok` / `status` / `statusText` / `url` / `redirected`, `headers.get` / `.has` / `.forEach` / `.getSetCookie`, 그리고 바디 리더인 `text()` / `json()` / `arrayBuffer()` / `bytes()`는 지원하지만, `blob()` / `formData()` / `clone()` 및 스트리밍 `.body`는 지원하지 않아요. `fetch` 시그니처가 꼭 필요한 경우가 아니라면 **`api.utils.http.*`를 직접 사용하는 것을 권장해요**(권한 제어, 동일한 송신 보안, 두 엔진 간 완전히 동일한 결과 형태).

- **QuickJS에서 `AbortSignal` 지원이 불완전해요.** 세 가지 경우:
  - **`api.llm.generateStream(messages, { signal })`**는 QuickJS에서 조용히 무시하는 대신 즉시 명확한 "AbortSignal is not yet supported in the QuickJS engine" 에러를 던져요. AsyncFunction 엔진은 정상적으로 스트림을 중단해요. QuickJS에서 스트림을 취소하려면 `for await` 루프를 break하세요(또는 완료될 때까지 두세요) — 상위 텍스트 생성은 어느 쪽이든 취소돼요.
  - **일반 호출의 메서드 수준 `signal`** — `api.utils.http.*(url, …, { signal })`, `api.llm.generate(…, { signal })` — 은 QuickJS에서 **조용히 무시**돼요(`AbortSignal` 객체가 VM 경계를 넘지 못함). 따라서 요청이 끝까지 실행돼요. AsyncFunction에서는 동일한 시그널이 *직접*(사용자 허용 로컬 호스트) 경로에서 요청을 취소하며, SSRF 프록시 경로에서는 두 엔진 모두 효과가 없어요.
  - **순수 `fetch(url, { signal })`**는 QuickJS에서도 취소 **가능해요** — 전용 VM 내부 abort 브리지를 타기 때문이에요. QuickJS에서 동작하는 유일한 시그널 경로예요.

  `api.*` 메서드를 위한 일반적인 VM 내부 `AbortSignal` 브리지는 후속 과제로 추적 중이에요. 그전까지 QuickJS에서 취소를 구현하려면 스트림의 경우 `for await`를 break하거나 단발성 요청의 경우 signal을 동반한 순수 `fetch`를 사용하세요.

- **실행된 핸들러는 QuickJS에서 빈 환경을 바라봐요.** 나중에 실행되는 등록 핸들러 — `broadcast.on` 구독자, 모달 `onDismiss`, 타이머 콜백 — 의 경우, AsyncFunction은 등록 시점에 어휘적으로 캡처된 `data`와 목록 상태를 제공해요. 하지만 QuickJS는 실행마다 새로운 환경을 시딩하므로 *이러한 핸들러 내부에서* `data`는 `{}`이고 동기 목록 스냅샷 조회(`api.tools.list`, `api.macros.list`, `api.macros.listInterceptors`, `api.chat.getInjections`, `api.chat.listContentProcessors`, `api.worldInfo.listInterceptors`)는 `[]`를 반환해요. 이는 아키텍처상의 특성이에요 — 핸들러 실행은 이벤트이지 본문 실행이 아니기 때문이에요. 핸들러별 환경 스냅샷은 후속 과제로 추적 중이에요. **이식성 높은 패턴:** 실행된 핸들러 내부에서 `data`나 동기 목록을 직접 읽지 마세요 — 필요한 값은 등록 시점에 클로저 변수에 캡처해 두거나 비동기 호출을 통해 다시 조회하세요.

## 편집기 타입 생성

`src/types/editor-lib.ts` — `api.*` 인터페이스의 Monaco IntelliSense 미러 — 는 `gen:editor-lib`에 의해 `src/types/script.ts`로부터 **자동 생성**돼요(`bun run build` 시 타입 검사 전에 자동 실행됨). 편집기 힌트가 동결된 계약 자체로부터 생성되므로 소스 코드와 조용히 어긋날 위험이 없어요. 이로써 수동 복사로 인한 드리프트 위험이 완전히 해소되었어요(v2.0 이전까지 이 파일은 수작업으로 관리되는 문자열이었음). `editor-lib.ts`를 수동으로 수정하지 마시고 다시 생성하세요.

## 감사 출처

(1) 공개 `api.*` 인터페이스, (2) 영속 스키마 및 IPC, (3) 트리거/이벤트/권한 계약을 포괄하는 3자 병렬 감사(2026-05-29)를 통해 도출되었어요. 발견 사항은 조치 전에 소스 코드와 대조해 검증했어요. 두 건의 "반드시 수정" 발견(코퍼스 지시문 관련 주장, 이벤트 집합 "불일치")은 검증 결과 대체로 정확하거나 설계상 의도된 것으로 확인되어 등급을 낮췄어요. 나머지 정확성 수정(범위를 좁힌 코퍼스 정정, 레퍼런스 이벤트 주석 두 건, 정리 작업)은 이 메모와 함께 반영되었고, 외관상의 이름 변경은 결정에 따라 보류되었어요(위 내용 참고).
