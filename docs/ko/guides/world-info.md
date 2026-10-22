# 월드 인포 (World info)

`api.worldInfo.*`는 Lumiverse의 월드북(로어북) 및 그 엔트리에 대한 완전한 CRUD 기능을 제공하며, 두 가지 프롬프트 조립 훅도 함께 지원해요: 특정 채팅에서 활성화된 엔트리를 확인하는 `getCapturedActive`와 활성화 시점에 엔트리를 동적으로 비활성화/활성화/수정할 수 있는 `registerInterceptor`예요. "스토리 트래커 스크립트에서 로어 엔트리 생성", "턴 수에 따라 로어 엔트리를 기능 플래그 형태로 제어", "외부 검색 인덱스로부터 엔트리 내용을 동적으로 재작성"하는 등 다양한 작업에 활용할 수 있어요.

네임스페이스 이름(`worldInfo`)은 TavernScript 용어를 계승한 것이며, Lumiverse 내부에서는 이를 **월드북(world books)**과 **엔트리(entries)**라고 불러요. 둘은 같은 개념이에요.

## 인터페이스 규격

세 가지 레이어로 구성돼요:

- **월드북 CRUD** — `list` / `get` / `create` / `update` / `delete`. 월드북은 컨테이너 역할을 하며, 각각 이름, 설명, 메타데이터를 가져요.
- **엔트리 CRUD** (`entries` 아래에 중첩) — `list` / `get` / `create` / `update` / `delete` / `listByAutomationIdPrefix`. 엔트리는 프롬프트 조립 시 대화 내용과 매칭되는 개별 로어 레코드예요.
- **프롬프트 조립 훅** — `getCapturedActive`(어떤 엔트리가 활성화되었는지 확인) 및 `registerInterceptor`(활성화 결과를 가로채서 수정).

```ts
interface WorldInfoAPI {
  list(options?): Promise<{ data: WorldInfo[]; total: number }>;
  get(ref):       Promise<WorldInfo | null>;
  create(input):  Promise<WorldInfo>;
  update(ref, input): Promise<WorldInfo>;
  delete(ref):    Promise<boolean>;

  entries: {
    list(ref, options?):         Promise<{ data: WorldInfoEntry[]; total: number }>;
    get(entryId):                Promise<WorldInfoEntry | null>;
    create(ref, input):          Promise<WorldInfoEntry>;
    update(entryId, input):      Promise<WorldInfoEntry>;
    delete(entryId):             Promise<boolean>;
    listByAutomationIdPrefix(prefix): Promise<WorldInfoEntry[]>;
  };

  getCapturedActive(chatId?):    Promise<ActivatedWorldInfoEntry[]>;

  // 전역(모든 채팅 대상) 활성화 — v2.0 신규 기능
  getGlobal():                   Promise<string[]>;
  setGlobal(refs):               Promise<string[]>;
  activateGlobal(ref):           Promise<string[]>;
  deactivateGlobal(ref):         Promise<string[]>;

  registerInterceptor(handler, options?): WorldInfoInterceptorHandle;
  listInterceptors():            RegisteredWorldInfoInterceptorInfo[];
}
```

## 권한

- **`world_books`** — `registerInterceptor` 및 `listInterceptors`를 제외한 이 네임스페이스의 모든 기능에 필요해요. 권한이 없으면 `Error: PERMISSION_DENIED:world_books — ...` 에러가 발생해요.
- **`generation`** — `registerInterceptor`는 `api.llm.*` 및 매크로/콘텐츠 프로세서 인터셉터와 동일한 권한 게이트를 사용해요. 인터셉터 체인은 프롬프트 조립 파이프라인 내부에서 실행되므로 프롬프트를 다루는 다른 기능들과 동일한 권한이 요구돼요. `listInterceptors`는 진단 인터페이스이므로 권한이 필요하지 않아요.

일반적인 월드 인포 스크립트는 CRUD 작업을 위해 `world_books` 권한이 필요하며, 인터셉터를 등록하는 경우 추가로 `generation` 권한이 필요해요. 대부분의 단순 CRUD 스크립트는 `world_books` 권한만 있으면 돼요.

<a id="refs-uuid-or-name"></a>
## 참조: UUID 또는 이름

월드북 참조를 받는 모든 메서드는 UUID 문자열 또는 사람이 읽을 수 있는 월드북 이름 문자열을 모두 허용해요:

```js
// 둘 다 동일한 월드북을 가리킵니다:
await api.worldInfo.get('e7a9b1c3-4f2d-…');
await api.worldInfo.get('My Campaign Lore');
```

이름 확인은 실행별로 캐싱돼요 — 첫 번째 이름 조회 시 `list()` 왕복이 발생하고, 동일한 스크립트 실행 내의 후속 조회는 캐시에서 무료로 처리돼요. UUID 조회는 캐시를 완전히 건너뛰어요.

직접 UUID와 이름을 구분할 필요는 없어요. API가 정규식(`^[0-9a-f]{8}-[0-9a-f]{4}-…$`)을 통해 자동으로 판별해요. 월드북 생성 시 이름이 UUID 형식과 겹치지 않도록 검증하므로 혼선이 발생하지 않아요.

존재하지 않는 이름을 전달하면 `Error: api.worldInfo: world book "<name>" not found` 에러가 발생해요.

## 빠른 시작

월드북을 만들고, 엔트리를 추가한 뒤, 활성화된 엔트리를 확인해 볼게요:

```js
// @triggers ls:startup

const book = await api.worldInfo.create({
  name:        'Story Tracker',
  description: 'Auto-generated lore from chat events',
});

await api.worldInfo.entries.create(book.id, {
  key:     ['the tavern', "Drunken Owl"],
  content: 'The Drunken Owl is a dimly-lit roadside tavern, popular with mercenaries and traveling bards.',
  comment: 'Tavern setting',
  // 최근 메시지에 키 중 하나라도 나타나면 활성화됩니다.
  // (기본값 selective: false — 단일 primary key 매칭만으로 활성화됨. 아래 "엔트리" 참고)
});

// 나중에 — 이 채팅에서 실제로 어떤 엔트리가 활성화되었는지 확인:
const active = await api.worldInfo.getCapturedActive();
console.log(active.map(e => `${e.comment} (${e.source})`));
// → ["Tavern setting (keyword)", ...]
```

이것이 기본 루프예요. 월드북은 엔트리를 소유하고, 엔트리는 대화 내용과 매칭되며, 매칭된 엔트리는 LLM 프롬프트에 조립돼요.

<a id="entries--the-key-concepts"></a>
## 엔트리 — 핵심 개념

대부분의 엔트리 필드는 합리적인 기본값을 가진 선택 사항이에요. 보통 `key` + `content`만으로도 충분해요. 알아두면 유용한 주요 필드들:

| 필드 | 설명 |
|---|---|
| `key: string[]` | 기본 키(Primary keys). 검색된 대화 내용에 키 중 하나라도 나타나면 엔트리가 활성화돼요. |
| `keysecondary: string[]` | 보조 키(Secondary keys, 선택 사항). `selectiveLogic` 규칙에 따라 `key`와 조합돼요. |
| `selective: boolean` | true인 경우 기본 키와 보조 키 **둘 다** 매칭되어야 활성화돼요(`selectiveLogic`에 따름). 기본값 false. |
| `selectiveLogic: 0 \| 1 \| 2` | `selective: true`일 때의 조합 규칙: 0 = AND, 1 = NOT (보조 키가 없어야 함), 2 = OR. |
| `constant: boolean` | 항상 활성화되며 키 매칭이 필요하지 않아요. 전역적인 로어에 유용해요. |
| `position: number` | 프롬프트 내에서 엔트리 텍스트가 주입되는 위치. 0 = 메인 프롬프트 앞, 1 = 메인 프롬프트 뒤, 4 = 특정 깊이(depth). |
| `depth: number` | `position: 4`일 때 최신 메시지로부터의 거리. |
| `priority: number` | 토큰 예산이 부족할 때의 우선순위. 높을수록 먼저 유지돼요. |
| `probability: number` | 확률(0–100). `useProbability: true`일 때 매 스캔마다 주사위를 굴려요. |
| `disabled: boolean` | 활성화 단계에서 완전히 건너뛰어요. 인터셉터에서 이를 재정의할 수 있어요. |
| `automationId: string \| null` | **스크립트 간 연동 필드.** 아래 설명 참고. |
| `vectorized: boolean` | true인 경우 키워드 외에도 벡터 유사도 매칭에 참여해요. |

`comment`는 자유로운 설명 필드예요 — UI에서 엔트리의 레이블로 표시되고 `getCapturedActive` 결과에 나타나지만, 활성화 로직 자체에는 영향을 주지 않아요.

## `automationId`를 활용한 동적 엔트리

스크립트가 엔트리를 **동적으로 관리(소유)**할 때의 표준 관례: 각 엔트리의 `automationId`에 스크립트 네임스페이스 접두사를 붙이는 것이에요. 호스트는 이 필드를 직접 해석하지 않지만, LumiScript는 스크립트 소유 엔트리를 열거, 수정, 정리할 수 있도록 `listByAutomationIdPrefix(prefix)`를 제공해요:

```js
// @triggers ls:startup, MESSAGE_SENT, ls:teardown

const NS = `lumiscript:${script.id}:`;

if (data.__event === 'ls:teardown') {
  // 대칭적 정리 — 이 스크립트가 생성한 모든 엔트리를 삭제해요.
  const owned = await api.worldInfo.entries.listByAutomationIdPrefix(NS);
  for (const entry of owned) {
    await api.worldInfo.entries.delete(entry.id);
  }
  return;
}

if (data.__event === 'MESSAGE_SENT' && data.message.is_user) {
  // 새 캐릭터 언급 감지; 로어 엔트리로 승격해요.
  const name = extractCharacterName(data.message.content);
  if (!name) return;

  const book = await api.worldInfo.get('Story Tracker');
  if (!book) return;

  // automationId는 소유권과 콘텐츠 키를 모두 인코딩해요 —
  // 동일한 이름으로 스크립트가 다시 실행되더라도 중복 생성 대신
  // 기존 항목을 확인하여 건너뛰거나 업데이트할 수 있어요.
  const automationId = `${NS}character:${name}`;
  const owned = await api.worldInfo.entries.listByAutomationIdPrefix(automationId);
  if (owned.length > 0) return;   // 이미 추적 중이면 건너뜀

  await api.worldInfo.entries.create(book.id, {
    key:          [name],
    content:      `${name} is a character mentioned in this story. Track and develop them as needed.`,
    comment:      `Auto-tracked: ${name}`,
    automationId,
  });
}
```

이 패턴이 중요한 두 가지 이유:
1. **재실행 시 중복 누적 방지.** 매 메시지마다 확인 없이 `create`만 호출하면 엔트리가 무한정 늘어나요. `listByAutomationIdPrefix` 조회를 사용하면 "이미 존재하는가?"를 한 줄로 확인할 수 있어요.
2. **깔끔한 종료 정리.** 스크립트가 비활성화되거나 삭제될 때 동일한 접두사 순회 + `delete` 루프로 모든 것을 깨끗이 지울 수 있어요. `automationId` 태깅이 없으면 스크립트가 만든 엔트리와 사용자가 직접 작성한 엔트리를 구분할 방법이 없어요.

`listByAutomationIdPrefix`는 O(월드북 수 × 월드북당 엔트리 수) 비용이 들어요. 일반적인 크기(대부분의 사용자는 수십 개 수준)에는 충분히 빠르지만, `STREAM_TOKEN_RECEIVED` 같은 고빈도 핫패스에서는 호출하지 마세요.

## 활성화된 엔트리 읽기 — `getCapturedActive`

`getCapturedActive(chatId?)`는 **Lumiverse의 전체 활성화 파이프라인** — 키워드 매칭, 선택적 로직, 확률 주사위, sticky/cooldown/delay 상태, 그룹 경쟁, 토큰 예산 제한, 벡터 유사도 — 을 실행하고 현재 채팅에 활성화될 엔트리 목록을 반환해요. 각 결과는 완전한 `WorldInfoEntry` 객체에 두 가지 활성화 메타데이터 필드가 추가된 형태예요:

```ts
type ActivatedWorldInfoEntry = WorldInfoEntry & {
  source: 'keyword' | 'vector';
  score?: number;   // 코사인 유사도, source: 'vector'일 때만 존재
};
```

`chatId`가 생략되면 활성 채팅을 기본값으로 사용해요. 열려 있는 채팅이 없으면 에러를 던져요.

자주 쓰이는 용도: "지금 프롬프트에 어떤 로어가 들어가는가?"를 UI 사이드바에 표시하기:

```js
const active = await api.worldInfo.getCapturedActive();
const items = active.map(e =>
  `<li><strong>${e.comment || 'Untitled'}</strong> — ${e.source}${e.score != null ? ` (${e.score.toFixed(3)})` : ''}</li>`,
);
await widget.root.update(`<ul>${items.join('')}</ul>`);
```

성능: 한 번의 `getActivated` 호스트 호출 + 활성화된 엔트리당 한 번의 병렬 `entries.get` 호출이 발생해요. 일반적인 활성화 규모(5~15개)에서는 매우 빨라요. 활성화 규모가 비정상적으로 크다면 턴당 여러 번 호출할 경우 결과를 캐싱하는 것을 권장해요.

## 전역 활성 월드북 (Globally-active world books)

> **v2.0 신규 기능.** `api.worldInfo`의 4가지 메서드를 통해 사용자의 **전역(global)** 월드북 세트를 조회하고 편집할 수 있어요.

**전역** 월드북은 어떤 캐릭터나 채팅에 묶여 있는지와 무관하게 **모든 채팅**에 적용돼요. "어디서나 항상 유효한" 최상위 월드 인포 계층이에요 — 평소에는 사용자가 Lumiverse UI에서 관리하지만, v2.0부터 스크립트에도 노출되었어요.

```ts
getGlobal():                Promise<string[]>;              // 전역 월드북 목록 조회
setGlobal(refs):            Promise<string[]>;              // 전체 세트 대체
activateGlobal(ref):        Promise<string[]>;              // 월드북 1개 추가
deactivateGlobal(ref):      Promise<string[]>;              // 월드북 1개 제거
```

4가지 모두 **`world_books`** 권한이 필요해요.

### 전역 월드북 vs `constant: true` 엔트리

이 둘은 서로 다른 메커니즘이므로 혼동하지 마세요:

- **`constant: true`** ([위의 엔트리 표 참고](#entries--the-key-concepts))는 단일 **엔트리**를 항상 활성화하지만, 오직 현재 채팅의 범위 내에 포함된 월드북 안에서만 동작해요. 엔트리 단위 설정이며, 채팅이 어떤 월드북을 불러오는지에 종속돼요.
- **전역 활성화** (이 섹션)는 월드북 **전체**를 **모든** 채팅의 범위에 포함시켜요 — 캐릭터나 채팅에 개별 바인딩할 필요 없이 항상 적용돼요. 그 월드북 안의 각 엔트리가 실제로 활성화될지 여부는 각 엔트리 자체의 규칙(키워드, `constant`, 선택적 로직 등)에 따라요.

즉, 전역 활성화는 *어떤 월드북을 어디서나 유효하게 할 것인가*를 제어하고, `constant`는 *월드북이 유효할 때 어떤 엔트리를 무조건 실행할 것인가*를 제어해요.

### 참조 및 반환값

`setGlobal`, `activateGlobal`, `deactivateGlobal`은 월드북 참조로 **UUID 또는 월드북 이름**을 모두 받아요 — `get` / `update` / `delete`와 동일한 [이름 또는 UUID 확인 규칙](#refs-uuid-or-name)이 적용돼요. 이름은 실행별 캐시를 통해 확인되며, 확인되지 않는 이름은 `Error: api.worldInfo: world book "<name>" not found` 에러를 발생시켜요.

4개 메서드 모두 **업데이트된 전역 월드북 ID 목록**을 반환해요 — 월드북 객체가 아니라 UUID의 `string[]` 형태예요. 이름이나 전체 레코드가 필요하다면 `get`을 통해 다시 매핑하세요:

```js
const ids   = await api.worldInfo.getGlobal();
const books = await Promise.all(ids.map(id => api.worldInfo.get(id)));
console.log(books.map(b => b?.name));
```

알아둘 만한 세부 동작:

- **`setGlobal(refs)`는 전체 세트를 통째로 대체해요.** 모든 전역 월드북을 지우려면 `[]`를 전달하세요. 각 참조는 먼저 ID로 변환되므로 이름과 UUID를 자유롭게 섞어서 전달할 수 있어요. 호스트는 존재하지 않는 월드북 ID는 조용히 제거하므로, 반환되는 배열의 길이가 **전달한 목록보다 짧을 수 있어요** — 전달한 입력값이 아니라 반환값을 기준 진실(source of truth)로 취급하세요.
- **`activateGlobal(ref)`는 세트에 1개의 월드북을 추가**하며, 월드북이 존재하지 않으면(참조 확인 실패) 에러를 던져요.
- **`deactivateGlobal(ref)`는 1개의 월드북을 제거**하며, 해당 월드북이 전역 세트에 없었더라도 에러 없이 아무 작업도 하지 않아요(no-op) — 에러를 던지는 대신 변함없는 ID 목록을 반환해요.

### 활용 예제

"House Rules" 월드북을 모든 채팅에 적용하고 정상 반영되었는지 확인하기:

```js
// @triggers ls:startup

// 월드북이 존재하는지 확인 (없으면 get은 null 반환).
let book = await api.worldInfo.get('House Rules');
if (!book) {
  book = await api.worldInfo.create({
    name:        'House Rules',
    description: 'Table conventions that apply to every chat',
  });
}

// 전역으로 활성화해요 — 이름으로 전달하면 UUID로 자동 확인됩니다.
const active = await api.worldInfo.activateGlobal('House Rules');
console.log('Global book IDs:', active);
// → ["e7a9b1c3-4f2d-…", ...]

// getGlobal은 ID를 반환하므로, 이름을 얻으려면 get()으로 매핑해요.
const names = await Promise.all(
  active.map(async id => (await api.worldInfo.get(id))?.name),
);
console.log('Globally active:', names.filter(Boolean));
// → ["House Rules", ...]
```

나중에 다시 제외하고 싶을 때:

```js
await api.worldInfo.deactivateGlobal('House Rules');   // 전역 세트에 없었어도 no-op
```

이 메서드들은 (채팅이나 캐릭터 단위가 아닌) **사용자 단위** 상태를 수정하므로, 스크립트나 사용자가 되돌리기 전까지 채팅과 세션을 넘어 영구적으로 유지돼요. 스크립트에서 월드북을 전역 활성화했다면, 전역 바인딩이 스크립트보다 오래 유지되도록 의도한 경우가 아닌 한 `ls:teardown`에서 `deactivateGlobal`로 짝을 맞춰 정리해 주는 것이 좋아요.

## 인터셉터 — 동적 활성화 제어

`registerInterceptor(handler, options?)`는 **활성화 결과가 프롬프트 조립 단계로 넘어가기 전에 수정**할 수 있는 접점이에요. 핸들러는 후보 엔트리들과 대화 상태가 담긴 컨텍스트를 전달받아 투표 형태의 결정을 반환해요:

```ts
type WorldInfoInterceptorHandler = (ctx: WorldInfoInterceptorCtx) =>
  | { disabled?: string[]; enabled?: string[]; forced?: string[]; mutated?: WorldInfoInterceptorMutation[] }
  | void
  | Promise<...>;
```

네 가지 독립적인 목록:
- **`disabled: string[]`** — 이번 턴에서 억제할 엔트리 ID 목록. **비활성화 투표는 절대적이에요**: 어떤 핸들러든 특정 엔트리 ID에 대해 disabled 투표를 하면 그 엔트리는 비활성화 상태로 유지돼요. 그 어떤 핸들러의 `enabled`나 `forced` 투표로도(심지어 disabled를 투표했던 핸들러 자신이라도) 이를 되살릴 수 없어요. 누적기는 `disabled`의 `else` 분기 내에서만 `enabled`/`forced`를 처리하며, 최종 결과 조립 시 두 번째 방어 계층으로 두 목록을 disabled 세트와 대조해 필터링해요.
- **`enabled: string[]`** — 저장소 상에서 비활성화되어 있음(`entry.disabled === true`)에도 불구하고 이번 턴에 허용할 엔트리 ID 목록. 저장소의 비활성화 플래그를 우회하지만, 다른 핸들러의 `disabled` 투표를 덮어쓰지는 못해요.
- **`forced: string[]`** — 선택적 로직 검사와 확률 주사위를 우회하여 무조건 매칭된 것으로 취급할 엔트리 ID 목록. 동일한 우선순위 규칙이 적용되어 다른 핸들러의 `disabled` 투표를 덮어쓰지 못해요.
- **`mutated: { id, content }[]`** — 엔트리 내용을 실시간으로 대체. ID당 마지막 쓰기 우선.

변경 없이 통과시키려면 `void`를 반환하거나 4개 배열을 모두 생략하세요. 비동기 핸들러는 완료될 때까지 대기(await)해요.

### 턴 기반 제어 예제

```js
// @triggers ls:startup

api.worldInfo.registerInterceptor(async (ctx) => {
  if (ctx.chatTurn < 5) {
    // 처음 5턴 동안은 "endgame-spoiler" 엔트리를 숨깁니다.
    const disabled = ctx.entries
      .filter(e => (e.extensions)?.gate === 'endgame-only')
      .map(e => e.id);
    return { disabled };
  }
}, { priority: 50 });
```

### 확장 기능 상태로부터 내용 재작성

```js
// @triggers ls:startup

api.worldInfo.registerInterceptor(async (ctx) => {
  // 스크립트 소유 데이터베이스에서 동적 재정의 내용을 가져옵니다.
  const overrides = await api.db.collection('wi-overrides').find({});
  return {
    mutated: overrides.map(o => ({ id: o.entryId, content: o.content })),
  };
}, { priority: 100 });
```

### 조합 및 우선순위

여러 핸들러가 체인을 형성해요. **낮은 우선순위 숫자(priority)가 먼저 실행**돼요(기본값 100, 동률 시 등록 순서대로). 각 핸들러는 이전 핸들러의 결정이 반영된 `ctx.entries.disabled`를 보게 되므로, 우선순위가 낮은 "게이트" 핸들러가 우선순위가 높은 "모두 강제" 핸들러보다 먼저 실행되어 비활성화 결정을 확실하게 관철시킬 수 있어요.

`options.id`는 고유 식별자예요 — 동일한 ID로 다시 등록하면 누적되지 않고 이전 엔트리를 대체해요. 스크립트 본문을 다시 실행할 때(새로고침 또는 `ls:reload`) 유용해요:

```js
api.worldInfo.registerInterceptor(myHandler, {
  id: 'turn-gate',
  priority: 50,
});
```

### 중요한 성능 제약

인터셉터 체인은 활성화 **이전에** 실행되고, 활성화는 프롬프트 조립 **이전에** 실행되며, 프롬프트 조립은 LLM 호출 **이전에** 실행돼요. **여기서 발생하는 지연은 첫 번째 스트리밍 토큰이 나오기까지의 체감 지연 시간에 그대로 더해져요.** 각 호출에는 2초 소프트 타임아웃(`options.timeoutMs`로 조정 가능)이 있으며, 호스트의 외부 10초 예산은 모든 확장 기능의 인터셉터가 공유해요.

**엄격한 규칙: 인터셉터 내부에서 `api.llm.*`이나 `api.utils.http.*`를 호출하지 마세요.** 지연 시간이 눈에 띄게 누적돼요. 트리거 핸들러(예: `MESSAGE_SENT`)에서 미리 연산하여 결과를 `api.db.*`나 `api.scriptStorage`에 저장해 두고, 인터셉터에서는 오직 **읽기(READ)**만 수행하세요.

### 등록된 인터셉터 목록 조회

`listInterceptors()`는 현재 체인을 `{ scriptId, scriptName, id, priority, timeoutMs }` 레코드 목록으로 반환해요. 진단 인터페이스이며 권한이 필요하지 않아요. 어떤 인터셉터가 연결되어 있는지 디버깅할 때 사용하세요:

```js
console.log(api.worldInfo.listInterceptors());
```

## 방치된 항목 정리 (Stale-cleanup) 동작

인터셉터는 스크립트 재실행 시 자동으로 정리돼요. N번째 실행에서 `'turn-gate'`라는 ID로 등록되었던 핸들러가 N+1번째 재실행에서 다시 등록되지 않으면, LumiScript의 실행 후 `diffAndCleanStale` 단계가 이를 체인에서 제거해요. 매크로 및 콘텐츠 프로세서와 동일한 메커니즘이에요. 덕분에 오래된 인터셉터의 누적 걱정 없이 자유롭게 인터셉터를 재등록할 수 있어요.

참고: `options.id` 없이 `registerInterceptor`를 호출하면 자동 ID(`auto-1`, `auto-2` 등)가 부여돼요. 자동 ID 인터셉터도 동일한 정리 절차를 따르므로 누적되지는 않지만, 나중에 안정적으로 찾아내기는 어려워요.

## 에러 처리

CRUD 메서드는 다음 상황에서 에러를 던질 수 있어요:

- **권한 거부** — `Error: PERMISSION_DENIED:world_books — grant this permission to use this API` (인터셉터 인터페이스의 경우 `generation`).
- **알 수 없는 참조** — 이름 기반 조회 실패 시 `Error: api.worldInfo: world book "<name>" not found`.
- **유효성 검사 실패** — 생성/수정 페이로드에 대한 호스트 측 유효성 검사 실패 시. 에러 메시지에 해당 필드 이름이 포함돼요.

안전한 예외 처리 패턴:

```js
try {
  await api.worldInfo.entries.create(bookRef, { key: [name], content: '...' });
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('PERMISSION_DENIED')) {
    await api.ui.toast({
      message: 'World info access requires the world_books permission.',
      kind:    'warning',
    });
    return;
  }
  console.error('[my-script] world-info write failed:', err);
}
```

## `api.databanks.*`와 비교

두 네임스페이스는 일부 겹치는 부분이 있지만 서로 다른 역할을 담당해요. 먼저 중요한 전제: **두 인터페이스 모두 스크립트 측에서는 CRUD 인터페이스예요.** 어떤 콘텐츠가 실제로 프롬프트에 도달할지 결정하는 검색(retrieval) 로직은 두 경우 모두 프롬프트 조립 시점에 호스트 측에서 실행돼요. 차이점은 각 인터페이스가 무엇을 저장하고 호스트가 어떻게 검색하는가에 있어요:

| 요구사항 | 적합한 API |
|---|---|
| 대화 내부의 키워드 매칭을 통해 활성화되는 설정 로어 | `api.worldInfo` |
| 키워드 매칭 외에 벡터 유사도로도 검색되는 로어 | 엔트리에 `vectorized: true`를 지정한 `api.worldInfo` |
| 채팅 / 캐릭터 / 전역 범위에 첨부되어 프롬프트 생성 시 호스트 측 벡터 유사도로 검색되는 참조 자료 | `api.databanks` |
| 직접 정성껏 작성한 서사적 로어 (세력, 장소, 등장인물) | `api.worldInfo` |
| 문서 스타일의 참조 자료 (PDF, 기록 전문, 지식 베이스 문서) | `api.databanks` |

월드 인포는 **키워드 및 규칙 기반 + 선택적 벡터 보강** 인터페이스이고, 자료 저장소는 **호스트 측 벡터 검색이 결합된 문서 저장소** 인터페이스예요. 스크립트는 양쪽 모두에서 레코드를 관리해요. 호스트는 LLM 호출 시점에 활성화된 엔트리 또는 벡터 매칭된 청크를 조립된 프롬프트로 가져와요. 스크립트가 런타임에 자료 저장소에서 직접 문서를 검색하는 것이 아니라, 스크립트는 문서 저장소를 관리하고 호스트가 검색을 수행해요. 단, 스크립트는 `api.worldInfo.registerInterceptor`를 통해 월드 인포 활성화를 직접 제어할 수 있으며, 스크립트 트리거 시점에 자료 저장소에서 읽어와(인터셉터 내부가 아님 — 위의 성능 규칙 참고) 월드 인포 내용을 동적으로 재작성하는 것은 가능해요.

## 버전 정보

v1.0.0-rc.1+부터 완전히 구현되었어요(네이티브 `spindle.world_books.*` 사용). `registerInterceptor` 인터페이스는 재실행 시 방치된 엔트리의 diff-cleanup과 함께 **v0.27.0+**에서 추가되었어요. 엔트리 필드는 Lumiverse 자체 월드북 스키마를 camelCase로 1:1 반영하므로, 향후 Lumiverse 버전에 새 필드가 추가되면 `WorldInfoEntry`에 자동으로 반영돼요(매핑이 수작업이 아닌 자동 생성됨).
