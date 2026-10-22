# 도구 등록 (Registering tools)

`api.tools.*`는 `api.llm.generateWithTools`의 반대편에 위치하는 기능이에요. LLM 가이드가 생성 도중에 스크립트가 도구를 *소비(호출)*하는 방법을 다룬다면, 이 가이드는 LLM(또는 다른 스크립트)이 호출할 수 있는 도구를 스크립트가 *게시(등록)*하는 방법을 다뤄요.

`api.tools.register`로 등록된 도구는 두 가지 서로 다른 환경에 표시돼요:

- **Lumiverse의 Council** — 성격 필드를 가진 지정된 "Council 멤버"가 생성 도중에 여러분의 도구를 호출하고 그 결과를 어시스턴트 응답에 인라인으로 포함시키는 호스트의 도구 사용 시스템이에요. 도구에 `council_eligible: true`를 지정하면 여기에 참여(opt in)해요.
- **인라인 함수 호출 및 직접 스크립트 호출** — `api.tools.invoke(name, args?)`는 등록된 도구의 핸들러를 직접 호출해요. `api.llm.generateWithTools` 루프 내부에서 사용하거나, 한 확장 기능이 다른 확장 기능이 활용할 수 있는 기능을 노출할 때 스크립트 간에 사용할 수 있어요.

도구 등록에는 `tools` 권한이 필요해요. 목록 조회(`list`), 등록 해제(`unregister`), 직접 호출(`invoke`) 인터페이스는 무료 티어(free-tier)예요.

## 핵심 개념

도구는 LLM(또는 다른 스크립트)이 호출할 수 있는 JSON Schema 타입의 `parameters` 정의를 가진 이름 있는 함수예요. 스크립트의 핸들러는 LumiScript 서브프로세스 내부에서 서버 측으로 실행되며, 완전한 `api.*` 인터페이스를 사용할 수 있고 Lumiverse가 도구 실행 결과로 사용할 문자열을 반환해요.

두 가지 호출 환경은 **하나의** 핸들러 디스패치 경로를 공유해요. 유일한 차이점은 `ctx.councilMember`가 채워져 있는지 여부뿐이에요:

![도구 디스패치 경로: 세 가지 소스 — Lumiverse 호스트 TOOL_INVOCATION 이벤트(Council 경로, ctx 채워짐), 스크립트의 api.tools.invoke(인라인 경로, ctx 없음), api.llm.generateWithTools의 tool_calls(api.tools.invoke를 통해 라우팅됨) — 모두 entry.handler로 수렴](../../diagrams/tools.svg)

어느 쪽이든 동일한 핸들러가 실행돼요. Council을 인식하는 도구는 `ctx?.councilMember`를 사용하여 출력을 개인화할 수 있고, 일반 도구는 `ctx`를 완전히 무시하고 오직 `args`만 가지고 동작해요.

## 빠른 시작 — 최소한의 Council 지원 도구

모든 Council 멤버가 사용할 수 있는 "주사위 굴리기" 도구를 등록해 볼게요:

```js
api.tools.register(
  'roll_dice',
  {
    display_name: 'Roll dice',
    description:  'Rolls a die. Use when the scene calls for a random outcome.',
    parameters: {
      type: 'object',
      properties: {
        sides: { type: 'integer', description: 'Number of sides on the die.', minimum: 2 },
      },
      required: ['sides'],
    },
    council_eligible: true,
  },
  async (args, api, ctx) => {
    // Council 경로는 여러분의 `parameters`를 채워주지 않으므로(아래 참고 사항 참조),
    // Council 호출 시 `args.sides`는 undefined예요 — NaN 대신 기본값 20면체를 굴려요.
    // 직접 호출자(api.tools.invoke / generateWithTools)는 인자를 정상 전달해요.
    const sides  = typeof args.sides === 'number' ? args.sides : 20;
    const result = 1 + Math.floor(Math.random() * sides);
    if (ctx?.councilMember) {
      return `${ctx.councilMember.name} rolled a ${sides}-sided die and got ${result}.`;
    }
    return `Rolled a ${sides}-sided die: ${result}.`;
  },
);
```

스크립트를 저장하고 활성화한 뒤, Lumiverse Council UI에서 Council 멤버에게 이 도구를 할당하세요. 이제 생성 도중 해당 멤버의 확률 주사위가 성공할 때마다 도구가 실행되며, 그 결과가 어시스턴트 메시지에 인라인으로 삽입돼요.

> **주의 — Council은 `parameters`를 채워주지 않아요.** 직접 호출자(`api.tools.invoke` / `generateWithTools`, 아래 참고)는 `sides`를 넘겨주지만, **Council** 경로에서는 Lumiverse가 확장 기능 도구를 오직 `{ context, __deadlineMs }`만 가지고 호출해요. 스키마를 채우기 위한 사이드카 LLM을 실행하지 않기 때문에 Council 호출 시 `args.sides`는 `undefined`가 돼요. 그래서 핸들러에서 기본값을 지정해야 해요(Council 호출 시에는 20면체를 굴림). 진정한 Council 도구는 이보다 더 똑똑하게 동작할 수 있어요: `args.context`를 읽고 장면 컨텍스트에 따라 인자를 **직접 결정**하는 방식이에요. 이 듀얼 모드 패턴은 쿡북 레시피인 [Council이 사용할 수 있는 도구 등록하기](../cookbook/council-tool.md)를 참고하세요.

어떤 스크립트에서든 이 도구를 직접 호출할 수도 있어요:

```js
const text = await api.tools.invoke('roll_dice', { sides: 20 });
console.log(text);  // "Rolled a 20-sided die: 14."
```

<a id="registername-def-handler-reference"></a>

## `register(name, def, handler)` 레퍼런스

```ts
register(name: string, def: ToolDefinition, handler: ToolHandler): void
```

동기 함수예요. `tools` 권한이 필요해요. 권한이 부여되지 않은 경우 `Error: PERMISSION_DENIED:tools — grant this permission to use this API` 에러가 발생해요.

- **`name`** — 네임스페이스 접두사가 없는 순수 도구 이름이에요. 관례상 `lowercase_snake_case`를 사용해요. 다른 스크립트와 이름이 충돌하면 `Error: tool "<name>" already registered by "<scriptName>"` 에러가 발생해요. 동일 스크립트 내에서 다시 등록하면 이전 핸들러가 조용히 대체되므로 개발 중 핫 리로드에 유용해요. 도구에는 매크로와 달리 예약된 이름 목록이 없어요.
- **`def`** — 아래의 [`ToolDefinition` 구조](#tooldefinition-shape)를 참고하세요.
- **`handler`** — 아래의 [핸들러 시그니처](#the-handler-signature)를 참고하세요.

<a id="tooldefinition-shape"></a>
### `ToolDefinition` 구조

```ts
interface ToolDefinition {
  display_name:      string;
  description:       string;
  parameters?:       Record<string, unknown>;
  council_eligible?: boolean;
}
```

| 필드 | 용도 |
|---|---|
| `display_name` | Lumiverse Council UI에서 멤버에게 도구를 할당할 때 표시되는 사람이 읽을 수 있는 레이블이에요. 여기서는 snake_case 이름을 반복하지 마세요. |
| `description` | LLM 대상 설명문 — 모델은 이 설명을 읽고 도구를 언제 호출할지 결정해요. 구현 내용("난수를 생성합니다")보다는 구체적인 **트리거 조건**("장면에서 무작위 결과가 필요할 때 사용하세요")을 명시하세요. |
| `parameters` | 인자 객체를 위한 JSON Schema예요. 표준 형식 — `{ type: 'object', properties: { … }, required: [ … ] }`을 사용해요. Lumiverse는 이를 AI 프로바이더의 네이티브 함수 호출 인터페이스로 전달해요. 도구에 인자가 없는 경우 생략하세요. |
| `council_eligible` | Council UI에서 도구를 할당할 수 있도록 하려면 `true`로 설정하세요. 기본값은 `false`예요 — 인라인 함수 호출에만 유용한 도구로 Council 선택기 목록을 어지럽히지 않도록 하기 위함이에요. |

<a id="the-handler-signature"></a>
### 핸들러 시그니처

```ts
type ToolHandler = (
  args: ToolInvocationArgs,
  api:  LumiScriptAPI,
  ctx?: ToolInvocationContext,
) => string | Promise<string>;
```

비동기 핸들러를 지원해요 — `Promise<string>`을 반환하면 디스패처가 자연스럽게 대기(await)해요.

**`api`가 매개변수로 전달되는 이유** — 스크립트 본문 내에서 `api`가 전역 변수로 존재하더라도, 엔진은 등록 시점에 핸들러를 클로저로 감싸서 호출 시점에 `getApi()`를 호출하고 두 번째 인자로 주입해줘요. 이렇게 하면 도구 핸들러가 오래 유지되더라도 등록 시점과 호출 시점 사이에 차이가 발생했을 때 항상 *최신의 활성* API 객체를 참조할 수 있어요. 구체적인 배경은 `src/engine/api/tools.ts:45-55`에 문서화되어 있어요. 실무에서는 핸들러 내부에서 두 번째 매개변수인 `api`를 사용하기만 하면 안전하게 동작해요.

#### `ToolInvocationArgs`

```ts
interface ToolInvocationArgs {
  context?:      string;             // 호스트가 제공하는 채팅 컨텍스트 문자열 (Council 경로).
  __userId?:     string;             // 범위가 지정된 api.* 호출을 위한 사용자 ID.
  __deadlineMs?: number;             // 핸들러가 결과를 반환해야 하는 절대 타임스탬프 마감 시한.
  [key: string]: unknown;            // 도구의 스키마에 정의된 매개변수들.
}
```

잘 알려진 필드들(`context`, `__userId`, `__deadlineMs`)은 Council 호출 시 호스트에 의해 채워져요. 스크립트의 스키마에 정의된 매개변수는 동일한 객체의 추가 필드로 전달돼요(위의 주사위 예제에서 `args.sides`).

`__deadlineMs`는 상대적인 지속 시간이 아닌 벽시계(wall-clock) 타임스탬프예요 — `Date.now()`와 비교하여 비용이 큰 LLM 호출을 수행할 시간이 충분한지 판단할 수 있어요:

```js
async (args, api, ctx) => {
  const remainingMs = (args.__deadlineMs ?? Infinity) - Date.now();
  if (remainingMs < 2000) {
    return 'Insufficient time for analysis.';
  }
  // ... 작업 수행
}
```

#### `ToolInvocationContext`

```ts
interface ToolInvocationContext {
  requestId?:       string;            // 호스트 상관 관계 ID. Council 경로에서 채워짐.
  councilMember?:   CouncilMemberContext;  // Council 경로에서만 채워짐.
  contextMessages?: LLMMessage[];      // 구조화된 대화 컨텍스트. Council 경로에서 채워짐.
}
```

`api.tools.invoke()`로 호출할 때는 Council 컨텍스트가 없으므로 `ctx` 자체가 `undefined`예요. Council 호출 시에는 `ctx`가 항상 객체이지만 이전 버전의 Lumiverse 호스트에서는 내부 필드가 `undefined`일 수 있어요. 항상 필드를 선택적으로 다루세요:

```js
if (ctx?.councilMember) { /* Council 대응 로직 */ }
```

`requestId`는 시스템 간 추적에 유용해요 — 외부 API 호출 시 함께 로깅해 두면 핸들러 측 추적과 호스트 측 로그를 대조할 수 있어요.

`contextMessages`(Council 전용, 호스트 버전에 따름)는 `args.context`의 구조화된 대응 형태예요 — 동일한 채팅 이력이지만 역할(role) 경계가 보존되어 있어요. 가능하면 평탄화된 `args.context` 문자열보다 이 필드를 사용하는 것이 좋아요. `ls:council-prompt` 헬퍼는 둘 다 제공될 때 자동으로 이 필드를 우선 사용해요.

## Council 대응 패턴

Council 멤버가 도구를 호출할 때 멤버의 전체 신원 정보에 접근할 수 있어요:

```ts
interface CouncilMemberContext {
  memberId:       string;
  itemId:         string;
  packId:         string;
  packName:       string;
  name:           string;
  role:           string;             // 자유 형식 역할 설명.
  chance:         number;             // 생성당 참여 확률 (0–100).
  avatarUrl:      string | null;
  definition:     string;             // Lumia "definition" 필드 — 외모/정체성 설명.
  personality:    string;             // 자유 형식 성격 설명.
  behavior:       string;             // 행동 양식.
  genderIdentity: 0 | 1 | 2;          // 0=미지정, 1=여성, 2=남성.
}
```

자연스러운 패턴은 이러한 필드를 활용하여 도구의 출력을 호출한 멤버에 맞게 개인화하는 것이에요:

```js
async (args, api, ctx) => {
  const member = ctx?.councilMember;
  if (!member) {
    return 'Insufficient context — this tool runs best from a Council member.';
  }

  // 멤버의 정체성 정보를 활용하여 LLM 호출을 개인화해요.
  const result = await api.llm.generate(
    [
      { role: 'system', content: `You are ${member.name}. ${member.personality}` },
      { role: 'user',   content: `Analyse the recent scene: ${args.context ?? ''}` },
    ],
    { connectionName: 'fast' },
  );
  return result;
}
```

<a id="the-lscouncil-prompt-built-in-library"></a>

### 내장 라이브러리 `ls:council-prompt`

Council UI의 *내장* 도구(Lumiverse가 기본 탑재한 도구)는 특정한 프롬프트 형식을 사용해요 — 정체성 블록 + 역할 지침 + 도구별 지침 + 간결성 안내 + 사용자 제어 안내. LumiScript로 등록한 자체 도구에서 이와 똑같은 구조를 재현하려면 `ls:council-prompt` 헬퍼를 사용하세요:

```js
async (args, api, ctx) => {
  if (!ctx?.councilMember) {
    return await api.llm.generate([{ role: 'user', content: args.context ?? '' }]);
  }
  const { buildCouncilMessages } = await script.require('ls:council-prompt');

  const messages = buildCouncilMessages({
    councilMember:   ctx.councilMember,
    contextMessages: ctx.contextMessages,  // 구조화된 대화 컨텍스트, args.context보다 우선됨
    args,                                  // `args.context` 문자열 대체용
    tool: {
      display_name: 'Tone Analyzer',
      description:  'Analyse the emotional register of the scene.',
    },
    maxWordsPerTool: 100,
  });

  return await api.llm.generate(messages);
}
```

헬퍼가 내보내는 주요 기능:

| 헬퍼 | 생성 내용 |
|---|---|
| `buildCouncilMessages(opts)` | `api.llm.generate()`에 즉시 전달할 수 있는 완전한 `LLMMessage[]` — `[system, context?, user]`. |
| `buildCouncilSystemPrompt(opts)` | `buildCouncilMessages` 내부에서 사용되는 시스템 프롬프트 문자열만 생성. |
| `buildCouncilIdentity(member)` | "You are a council member named …" 정체성 블록 및 성격 지침. |
| `roleNote(role)` | 역할 기반 지침 ("As the {role}, focus on …"). `role`이 비어있으면 빈 문자열. |
| `brevityNote(maxWords)` | 단어 수 제한 지침. `maxWords ≤ 0`이면 빈 문자열. |
| `userControlNote(allow)` | 사용자 캐릭터 통제 안내 블록 — `allow=true`이면 허용적, `false`이면 제한적. |
| `debug.format*` | 생성된 내용을 진단하기 위한 스냅샷 헬퍼 — 테스트 픽스처에서 유용함. |

전체 인터페이스는 인앱 레퍼런스의 "내장 라이브러리" 섹션을 참고하세요.

### `api.council.*`을 통한 Council 설정 읽기

특정 호출 맥락 외부에서 Council 상태를 점검해야 하는 도구의 경우:

```ts
api.council.getSettings():           Promise<CouncilSettings>             // 권한 불필요.
api.council.getMembers():            Promise<CouncilMemberContext[]>      // 현재 할당된 멤버 목록.
api.council.getAvailableLumiaItems(): Promise<LumiaItem[]>                // 슈퍼셋 — 설치된 팩의 모든 아이템.
```

`getMembers()`는 *현재 할당된* Council 멤버를 반환해요(도구 핸들러 내부에서 `ctx.councilMember`가 갖는 것과 동일한 `CouncilMemberContext` 형태이지만 모든 멤버가 나열됨). `getAvailableLumiaItems()`는 미할당된 아이템을 포함하여 사용자의 설치된 팩 전반에 걸친 더 넓은 풀을 반환해요.

**도구 핸들러 내부에서는 `api.council.getMembers().find(...)`보다 `ctx.councilMember`를 사용하는 것이 훨씬 좋아요** — IPC 왕복이 없어 더 빠르고 핸들러를 트리거한 호출과 직접 연결되어 있기 때문이에요.

## Council 호출 수명 주기 — 스크립트가 제어하는 것 vs 호스트가 수행하는 것

핸들러가 무엇에 의존할 수 있는지 이해하기 위한 중요한 경계선:

- **도구 호출 시점은 호스트가 결정해요.** Council 멤버는 매 생성 시 자신의 `chance` 확률을 굴려요. 주사위 굴림이 성공하면 Lumiverse는 멤버 컨텍스트를 채워 `TOOL_INVOCATION`을 발생시켜요. 스크립트는 이 확률 굴림에 영향을 줄 수 없으며, 이는 사용자가 제어하는 멤버별 설정이에요.

- **재생성 / 스와이프 시 결과 보존 여부는 호스트 설정이에요.** `CouncilSettings.toolsSettings.retainResultsForRegens`는 사용자가 Council UI에서 설정하는 불리언 값이에요. `true`인 경우 Council 도구 결과는 채팅 메타데이터에 저장되어 스와이프/재생성 시 매번 다시 실행되는 대신 재사용돼요. `false`인 경우 도구가 매번 다시 실행돼요. 핸들러는 결과 보존 로직에 직접 관여하지 않으며, 호스트가 결정할 때 호출될 뿐이에요. 핸들러 동작이 이에 적응해야 한다면 `api.council.getSettings()`로 설정을 읽으세요(예: 출력 로그에 "최초 실행" 대 "재사용된 결과" 표시).

- **사이드카 LLM 차원은 호스트 측에 있어요.** Lumiverse 내장 Council 도구는 사이드카 LLM을 거칠 수 있어요(`CouncilToolsSettings.mode`로 설정). 하지만 확장 기능이 등록한 도구 — 여러분의 도구 — 는 해당 인자와 함께 직접 호출돼요. LumiScript는 디스패치와 핸들러 사이에 사이드카 과정을 끼워 넣지 않아요. 핸들러가 그냥 *호출*되는 것이 전부예요.

## `api.tools.invoke`를 통한 직접 호출

```ts
invoke(name: string, args?: Record<string, unknown>): Promise<string>
```

무료 티어이며 스크립트 간에 작동해요. 주요 활용 사례:

- **`api.llm.generateWithTools` 루프 내부** — 모델의 `tool_calls`를 적절한 핸들러로 디스패치:

  ```js
  for (const tc of result.tool_calls) {
    const out = await api.tools.invoke(tc.name, tc.args);
    messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: tc.call_id, content: out }] });
  }
  ```

- **스크립트 간 호출** — 스크립트 A가 스크립트 B가 등록한 도구를 호출해요. B의 핸들러 관점에서는: `ctx`는 undefined이며, `args`는 A가 전달한 값이 돼요. 한 확장 기능이 재사용 가능한 기능을 게시하고 다른 스크립트가 이를 프로그래밍 방식으로 소비하고자 할 때 유용해요.

- **테스트** — 개발 중에 Council 호출을 띄우지 않고 모의 인자로 자체 도구를 호출하여 핸들러 로직을 검증할 때 사용해요.

도구 이름이 확인되지 않으면 `invoke()`는 에러를 던져요:

```
Error: api.tools.invoke: no handler registered for tool '<name>'
```

이는 동기적 예외 던짐이에요(거부는 반환된 Promise에서 발생하지만 도구 존재 여부 확인은 동기적으로 수행됨).

## 목록 조회 및 정리

```ts
list(): RegisteredToolInfo[]
```

모든 스크립트에 걸쳐 등록된 *모든* 도구의 스냅샷을 반환해요. 각 항목에는 `name`, `display_name`, `description`, `parameters`, `council_eligible`, `scriptId`, `scriptName`이 포함돼요. 무료 티어이며, 진단 UI나 사용 가능한 다른 도구를 탐색하는 용도로 사용해요.

```ts
unregister(name: string): void
```

소유권이 검증돼요 — 현재 스크립트가 소유한 도구만 제거할 수 있어요. 이름이 일치하지 않거나 다른 스크립트의 도구인 경우 아무 작업도 하지 않아요(silent no-op). 무료 티어예요.

**스크립트 비활성화 / 삭제 시 자동 정리.** 스크립트가 비활성화되거나 삭제되면 LumiScript는 등록된 도구를 순회하며 각각을 동기적으로 `unregister`해요(`src/backend.ts:814-816`). LumiScript 저장소와 Spindle의 호스트 측 도구 레지스트리가 모두 정리돼요. 비활성화/삭제를 대비해 명시적으로 `unregister`를 호출할 필요는 없으며, 실행 중에 도구를 제거하고 싶을 때만 호출하면 돼요.

## `TOOL_INVOCATION` 이벤트 및 `ls:tool:*` 브로드캐스트

도구 수명 주기 동안 두 가지 서로 다른 이벤트 인터페이스가 동작해요:

- **`TOOL_INVOCATION`** — 도구 디스패치를 주도하는 Lumiverse 호스트 이벤트예요. LumiScript는 이를 **내부적으로** 구독하여 각 호출을 일치하는 등록 핸들러로 라우팅해요(Council 경로 — `dispatchToolInvocation` 참고). 사용자가 직접 연결할 필요가 없어요: 편집기의 이벤트 선택기에 **없으며**, 호출을 수신하는 올바른 방법은 `api.tools.register`로 핸들러를 등록하는 것이에요. 도구를 직접 소유하지 않고 *다른* 스크립트의 호출을 관찰하거나 전역적으로 로깅하고 싶다면 아래의 `ls:tool:invoked` 브로드캐스트를 사용하세요: `result` 및 `callMs` 소요 시간을 담고 있으며 Council과 `invoke()` 경로 모두에서 발생해요. (참고로 호스트가 디스패처에 전달하는 페이로드는 `{ toolName, args, councilMember, requestId, contextMessages }`예요 — Council 호출 시 `councilMember` / `contextMessages`가 채워지며, `requestId`는 최종 `tool_invocation_result` 응답과 상관 관계를 가져요.)

- **`ls:tool:registered`** — 성공적으로 등록된 후 `api.tools.register` 내부에서 발생해요. 페이로드: `{ name, scriptId }`. 다른 스크립트에서 도구 레지스트리를 감시하고 싶다면 `api.broadcast.on('ls:tool:registered', fn)`으로 구독하세요.

- **`ls:tool:unregistered`** — `:registered`와 대칭되는 이벤트예요. 페이로드: `{ name, scriptId }`.

- **`ls:tool:invoked`** — 도구 핸들러가 성공적으로 반환된 후, Council 및 `invoke()` 경로 모두에서 발생해요. 페이로드: `{ name, args, result, scriptId, callMs, councilMember? }`. Council 경로에서는 `councilMember`가 채워지고 `invoke()`에서는 `undefined`예요. `callMs` 소요 시간이 포함되어 있어 도구 성능 모니터링 대시보드에 유용해요. (전반적인 브로드캐스트 수명 주기는 `concepts/handler-lifetime.md`를 참고하세요.)

## 일반적인 패턴

### Council 대응 분석기 도구

```js
api.tools.register(
  'analyse_tone',
  {
    display_name: 'Tone analyser',
    description:  'Read the recent scene and report on the emotional register.',
    council_eligible: true,
  },
  async (args, api, ctx) => {
    if (!ctx?.councilMember) {
      // 직접 호출을 위한 대비책 — 성격이 덜 반영된 분석을 반환해요.
      const text = await api.llm.generate(
        [{ role: 'system', content: 'You analyse emotional tone.' },
         { role: 'user',   content: args.context ?? '' }],
        { connectionName: 'fast' },
      );
      return text;
    }
    const { buildCouncilMessages } = await script.require('ls:council-prompt');
    const messages = buildCouncilMessages({
      councilMember:   ctx.councilMember,
      contextMessages: ctx.contextMessages,
      args,
      tool: { display_name: 'Tone analyser', description: 'Analyse emotional register.' },
      maxWordsPerTool: 80,
    });
    return await api.llm.generate(messages, { connectionName: 'fast' });
  },
);
```

### 마감 시한이 허용될 때만 무거운 작업을 수행하는 도구

```js
api.tools.register('deep_summary', {
  display_name: 'Deep summary',
  description:  'Produce a detailed multi-paragraph summary of the scene.',
  council_eligible: true,
}, async (args, api, ctx) => {
  const remainingMs = (args.__deadlineMs ?? Infinity) - Date.now();
  if (remainingMs < 5000) {
    return 'Not enough time remaining for a deep summary; sticking to a brief.';
  }
  const text = await api.llm.generate(/* 무거운 호출 */, { connectionName: 'flagship' });
  return text;
});
```

### 특정 기능을 노출하는 스크립트 간 도구

```js
// "weather-provider" 스크립트에서 등록:
api.tools.register('lookup_weather', {
  display_name: 'Weather lookup',
  description:  'Get the weather for a location.',
  parameters: { type: 'object', properties: { location: { type: 'string' } }, required: ['location'] },
}, async (args) => {
  const resp = await api.utils.http.get(`https://wttr.in/${encodeURIComponent(args.location)}?format=3`);
  return resp.body;
});

// "weather-consumer" 스크립트에서 스크립트 간 호출:
const summary = await api.tools.invoke('lookup_weather', { location: 'Tokyo' });
// summary: "Tokyo: ⛅️  +18°C"
```

소비하는 측 스크립트는 조회를 위해 자체 `app_manipulation`이나 `cors_proxy` 권한을 가질 필요가 없어요 — 등록된 도구를 소유한 스크립트만 권한을 가지면 돼요. 이는 훌륭한 캡슐화 지점이 돼요.

## 자주 하는 실수

- **`council_eligible` 기본값은 `false`예요.** 도구가 Council 선택기 목록에 나타나지 않는다면 옵트인하지 않았기 때문이에요. 도구 정의에 명시적으로 `council_eligible: true`를 설정하세요.

- **`api.tools.invoke`로 호출할 때 `ctx`는 `undefined`예요.** `ctx.councilMember`라고 쓰지 마시고 `ctx?.councilMember`로 작성하여 직접 호출 및 인라인 함수 호출 경로에서도 안전하게 옵셔널 체이닝되도록 하세요.

- **핸들러는 반드시 문자열을 반환해야 해요.** 객체(또는 문자열이나 `Promise<string>`이 아닌 값)를 반환하면 어색하게 문자열 변환돼요. 구조화된 데이터를 전달해야 한다면 직접 `JSON.stringify`를 호출하고, 모델이 해당 JSON을 어떻게 해석해야 하는지 설명문(description)에 명시하세요.

- **도구 이름은 단일 레지스트리를 공유해요 — 네임스페이스가 없어요.** 두 스크립트가 둘 다 `analyse_tone`을 등록할 수는 없어요. 두 번째 등록 시 에러가 발생해요. 다른 사용자가 설치하는 스크립트를 배포한다면 충돌을 줄이기 위해 스크립트 접두사 관례(`my-script_analyse_tone`)를 사용하세요.

- **`api`는 클로저가 아니라 매개변수를 사용해야 해요.** 핸들러 내부에서 `api`는 함수 매개변수를 참조해요(엔진이 주입하는 현재 api 객체). 외부 스크립트 본문의 클로저 범위 `api`를 참조해도 당장은 작동할 수 있지만, 공식적인 방식은 매개변수 버전이에요 — `(args, api, ctx) => api.llm.generate(...)` 형태로 작성하여 엔진이 주입하도록 하세요. 이렇게 하면 오래 등록되어 있던 핸들러가 이미 정리된 옛 `api` 클로저를 참조하는 미묘한 버그를 방지할 수 있어요.

- **결과 보존 동작은 호스트 측에서 처리돼요.** 핸들러 내부에서 "스와이프 시 재실행 건너뛰기" 로직을 직접 구현하려 하지 마세요. `CouncilSettings.toolsSettings.retainResultsForRegens`가 true이면 호스트가 이미 이 작업을 처리해요 — 핸들러는 호스트가 새로운 결과가 필요하다고 판단할 때만 호출돼요. 이번 호출이 최초 실행인지 보존된 결과의 재실행인지 구분하는 정보는 현재 호스트에서 노출하지 않으므로, 모든 호출을 독립적으로 처리할 수 있도록 설계하는 것이 가장 안전해요.

- **`__userId`는 활성 캐릭터 ID가 아니라 호출한 사용자 ID예요.** 둘을 혼동하지 마세요. 활성 캐릭터 ID는 `globalThis.__lsActiveCharId`(동기) 또는 `await api.chats.getActive().then(c => c?.characterId)`를 통해 확인하세요.

## 관련 항목

- **인앱 레퍼런스, "API 함수 → api.tools" 섹션** — 전체 시그니처가 포함된 자동 생성 메서드 목록.
- **[LLM 호출하기](llm.md)** — `api.llm.generateWithTools`는 도구 인터페이스의 소비자 측면이며, 이 가이드는 게시자 측면이에요. 두 인터페이스는 깔끔하게 짝을 이뤄요.
- **[`concepts/permissions.md`](../concepts/permissions.md)** — `tools` 권한 및 무료 티어 메서드(`list`, `unregister`, `invoke`).
- **[`concepts/handler-lifetime.md`](../concepts/handler-lifetime.md)** — 등록된 도구 핸들러는 실행이 끝나도 유지돼요. 더 넓은 핸들러 수명 주기 전반은 그쪽에서 다뤄요.
- **내장 라이브러리 `ls:council-prompt`** — 자체 LLM 호출 내부에서 Council 형식의 프롬프트를 구성하기 위한 표준 헬퍼. 레퍼런스의 "내장 라이브러리" 섹션 참고.
- **`tool_invoked` 이벤트 종류를 가진 `api.events.track(...)`** — 도구 실행의 영속적 감사 로그를 남기기 위해 `ls:tool:invoked` 브로드캐스트와 함께 활용.
