# 페르소나 (Personas)

`api.personas.*`는 Lumiverse의 **페르소나** — 사용자의 고유 정체성 프로필(이름, 설명, 대명사, 아바타, 연결된 월드북)에 대한 CRUD 기능과 더불어 활성 페르소나 전환, 페르소나가 보유한 월드북 읽기 훅을 제공해요. "스크립트 UI에서 사용자가 페르소나를 전환하도록 허용"하는 것부터 "페르소나가 활성화될 때 로어북 자동 연결", "외부 프로필로부터 페르소나 메타데이터 동기화"에 이르기까지 다양한 작업에 활용할 수 있어요.

페르소나는 대화에서 캐릭터의 상대역인 **사용자** 측 프로필이에요. 한 번에 정확히 하나의 **활성(active)** 페르소나(또는 없음)가 존재하며, 새 채팅을 시작할 때 기본값으로 사용되는 **기본(default)** 페르소나(`isDefault: true`)가 있어요.

## 인터페이스 규격

두 개의 기본 레이어와 중첩된 애드온 네임스페이스로 구성돼요:

- **페르소나 CRUD + 활성 전환** — `list` / `get` / `getDefault` / `getActive` / `create` / `update` / `delete` / `switchActive`.
- **연결된 월드북** — 페르소나의 `attachedWorldBookId`를 완전한 `WorldInfo` 객체로 확인해주는 편의 읽기 메서드 `getWorldBook`.
- **전역 애드온** (`addons` 아래에 중첩, **v2.0 신규 기능**) — 텍스트 생성 시 페르소나 애드온 상태와 결합되는 주입 가능한 콘텐츠 블록에 대한 `list` / `get` / `update`.

```ts
interface PersonasAPI {
  list(options?):        Promise<{ data: Persona[]; total: number }>;
  get(personaId):        Promise<Persona | null>;
  getDefault():          Promise<Persona | null>;
  getActive():           Promise<Persona | null>;
  create(input):         Promise<Persona>;
  update(personaId, input): Promise<Persona>;
  delete(personaId):     Promise<boolean>;
  switchActive(personaId): Promise<void>;
  getWorldBook(personaId): Promise<WorldInfo | null>;

  addons: {
    list(options?):      Promise<{ data: PersonaAddonInfo[]; total: number }>;
    get(addonId):        Promise<PersonaAddonInfo | null>;
    update(addonId, input): Promise<PersonaAddonInfo>;
  };
}
```

## 권한

페르소나 CRUD, `switchActive`, `getWorldBook`, **그리고** 중첩된 `addons.*`를 포함한 전체 네임스페이스는 단일 권한인 **`personas`**로 보호돼요. 권한이 누락되면 `Error: PERMISSION_DENIED:personas — grant this permission to use this API` 에러가 발생해요.

알아둘 만한 중요한 비대칭성이 하나 있어요: `getWorldBook`은 `WorldInfo`를 반환하지만 `world_books` 권한이 아닌 **`personas` 권한만** 요구해요. 페르소나 자체에 연결된 책을 범위 내에서 읽는 작업이므로 페르소나 권한만으로 허용돼요.

## 참조: UUID만 지원

`api.worldInfo.*`와 달리 모든 페르소나 메서드는 페르소나의 **UUID 문자열**을 받아요 — 이름 기반 확인이나 `getByName`은 지원하지 않아요. 이름만 알고 있다면 `list()`를 호출한 뒤 필터링해야 해요:

```js
const { data } = await api.personas.list();
const persona = data.find(p => p.name === 'Aria');
if (persona) await api.personas.switchActive(persona.id);
```

`list()`는 페이지네이션을 지원해요: `list({ limit, offset })`는 `{ data, total }`을 반환해요. 인자 없이 호출하면 첫 번째 페이지(호스트 기본 페이지 크기)와 전체 `total` 개수를 반환하므로 필요에 따라 페이지를 탐색할 수 있어요.

## `Persona` 객체 형태

`get` / `getDefault` / `getActive` / `create` / `update`는 모두 `Persona` 객체(또는 명시된 경우 `null`)를 반환해요:

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | `string` | 페르소나 UUID. |
| `name` | `string` | 페르소나 이름. |
| `title` | `string` | 페르소나 선택기에 표시되는 짧은 한 줄 소개. |
| `description` | `string` | 페르소나 상세 설명. |
| `imageId` | `string \| null` | 아바타 이미지 ID. `api.images.*`로 조회 가능; 아바타가 없으면 `null`. |
| `attachedWorldBookId` | `string \| null` | 이 페르소나에 연결된 월드북 ID, 없으면 `null`. `getWorldBook` 참고. |
| `folder` | `string` | 정리를 위한 폴더 레이블. |
| `isDefault` | `boolean` | 사용자의 기본 페르소나인지 여부. |
| `subjectivePronoun?` | `string` | 주격 대명사 (예: `"he"`, `"she"`, `"they"`). 선택 사항. |
| `objectivePronoun?` | `string` | 목적격 대명사 (예: `"him"`, `"her"`, `"them"`). 선택 사항. |
| `possessivePronoun?` | `string` | 소유격 대명사 (예: `"his"`, `"her"`, `"their"`). 선택 사항. |
| `metadata` | `Record<string, unknown>` | 임의의 메타데이터. |
| `createdAt` / `updatedAt` | `number` | Unix-ms 타임스탬프. |

필드는 **camelCase**로 제공돼요 — LumiScript가 호스트의 snake_case DTO(`attached_world_book_id`, `is_default`, `image_id`, 대명사 필드 등)를 camelCase로 자동 매핑해주므로 스크립트는 원시 DTO 구조를 신경 쓰지 않아도 돼요.

## 빠른 시작

페르소나를 생성하고, 기본으로 설정한 뒤 활성화해 볼게요:

```js
// @triggers ls:startup

const persona = await api.personas.create({
  name:              'Aria',
  title:             'The wandering scholar',
  description:       'A soft-spoken researcher with a knack for forgotten lore.',
  subjectivePronoun: 'she',
  objectivePronoun:  'her',
  possessivePronoun: 'her',
  isDefault:         true,   // 이전 기본 설정을 해제함
});

// 라이브 세션을 이 페르소나로 전환해요.
await api.personas.switchActive(persona.id);

const active = await api.personas.getActive();
console.log(active?.name); // → "Aria"
```

`create` 호출 시 `name`만 필수이고 나머지 필드는 모두 선택 사항이에요. `update(personaId, input)`는 **부분 업데이트(partial update)**를 수행해요 — 전달한 필드만 변경되고 생략된 필드는 그대로 유지돼요. 두 메서드 중 하나에서 `isDefault: true`를 지정하면 기존에 기본으로 지정되어 있던 페르소나의 기본 플래그가 해제돼요.

## 활성 페르소나 전환

```js
// 페르소나 활성화:
await api.personas.switchActive(persona.id);

// 비활성화 — 활성 페르소나 없음:
await api.personas.switchActive(null);
```

`switchActive`는 `Promise<void>`를 반환하며 **`SETTINGS_UPDATED`** 이벤트를 발생시키므로, 수동 새로고침 없이도 프론트엔드의 페르소나 선택기가 즉시 업데이트돼요. 활성화하려는 페르소나 UUID를 전달하거나, 활성 페르소나를 두지 않으려면 `null`을 전달하세요.

`getActive()`는 현재 활성화된 페르소나를 읽어오며(없으면 `null`), `getDefault()`는 `isDefault`로 지정된 페르소나를 읽어와요(사용자가 설정하지 않았으면 `null`). 둘은 서로 구분돼요: 기본 페르소나는 새 채팅을 시작할 때 지정되고, 활성 페르소나는 현재 세션을 제어해요.

## 연결된 월드북 읽기 — `getWorldBook`

페르소나는 월드북(`attachedWorldBookId`)을 연결하여 가질 수 있어요. `getWorldBook(personaId)`는 별도의 `api.worldInfo.get` 호출 없이 단 한 번의 호출로 완전한 `WorldInfo`를 반환해주는 편의 메서드예요:

```js
const active = await api.personas.getActive();
if (active) {
  const book = await api.personas.getWorldBook(active.id);
  if (book) {
    console.log(`Persona "${active.name}" carries lorebook "${book.name}"`);
    // world-info 인터페이스를 통해 엔트리를 열거해요:
    const { data: entries } = await api.worldInfo.entries.list(book.id);
    console.log(`${entries.length} lore entries`);
  }
}
```

페르소나에 연결된 월드북이 없으면 `null`을 반환해요. 앞서 언급했듯이 이 메서드는 `personas` 권한만 필요하며, 어떤 월드북이 연결되어 있는지 *읽는* 것만으로는 `world_books` 권한을 요청하지 않아도 돼요. (위 예제처럼 월드북 엔트리에 대해 CRUD를 수행하려면 `api.worldInfo.*`를 위한 `world_books` 권한이 필요해요.)

## 전역 애드온 (Global add-ons)

> **v2.0 신규 기능.** `api.personas.addons.*`는 Lumiverse의 **전역 애드온**을 제공해요 — 페르소나와 함께 사용할 수 있는 이름이 지정되고 정렬 가능한 주입형 콘텐츠 블록이에요. 애드온의 생성 및 삭제는 호스트 UI에서 관리되며, 스크립트에서는 기존 애드온을 **조회, 읽기, 업데이트**할 수 있어요.

애드온은 프롬프트 콘텐츠의 재사용 가능한 스니펫(작성 스타일 지침, 표준 안내문, 주의 경고 등)으로, `label`, `content` 본문, `sortOrder`를 가져요. 텍스트 생성 시 각 애드온은 요청마다 생성 옵션의 `personaAddonStates` 맵(`ChatGenerationOptions.personaAddonStates`, 애드온 ID를 키로 하는 `Record<string, boolean>`)을 통해 켜고 끌 수 있어요. 이 상태 맵에는 애드온의 **ID**만 담겨 있으므로, `api.personas.addons.*`를 사용하여 ID를 사람이 읽을 수 있는 `label`과 `content`로 확인할 수 있어요.

### `PersonaAddonInfo`

`addons.get` / `addons.update`의 반환값 및 `addons.list().data`의 각 요소 형태:

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | `string` | 애드온 UUID. 텍스트 생성 시 `personaAddonStates`에 표시되는 ID예요. |
| `label` | `string` | 호스트 UI에 표시되는 사람이 읽을 수 있는 이름. |
| `content` | `string` | 주입되는 프롬프트 콘텐츠 본문. |
| `sortOrder` | `number` | 호스트 UI에서의 정렬 순서 (호스트의 `sort_order`에서 매핑됨). |
| `metadata` | `Record<string, unknown>` | 임의의 메타데이터. |
| `createdAt` / `updatedAt` | `number` | Unix-ms 타임스탬프. |

### 메서드

- **`addons.list(options?)`** — `list({ limit, offset })` → `{ data: PersonaAddonInfo[]; total: number }`. 페이지네이션을 지원하며 `personas.list`와 형태가 같아요.
- **`addons.get(addonId)`** — UUID로 단일 애드온을 확인해요. 찾지 못하면 `null`을 반환해요.
- **`addons.update(addonId, input)`** — 부분 업데이트를 수행해요. `input`은 `PersonaAddonUpdateInput` 타입으로, `label` / `content` / `sortOrder` / `metadata` 중 원하는 필드만 선택적으로 전달할 수 있어요. 전달된 필드만 변경되며 업데이트된 `PersonaAddonInfo`를 반환해요.

여기에는 의도적으로 **`create`나 `delete`가 존재하지 않아요** — 애드온은 호스트 UI 소유예요. 스크립트는 사용자가 이미 작성해둔 애드온을 읽고 수정하는 역할을 해요.

### 예시: 요청에서 활성화된 애드온 확인하기

```js
// 모든 애드온을 나열한 뒤, on/off 상태 맵을 레이블로 매핑해요.
const { data: addons } = await api.personas.addons.list();
const byId = new Map(addons.map(a => [a.id, a]));

// 여기서 `states`는 스크립트가 다른 곳에서 얻은 ChatGenerationOptions.personaAddonStates
// 형태의 맵(addonId → 활성화 여부 boolean)이에요.
const enabled = Object.entries(states)
  .filter(([, on]) => on)
  .map(([id]) => byId.get(id)?.label ?? `(unknown add-on ${id})`);

console.log('Active add-ons:', enabled.join(', '));
```

### 예시: 애드온 내용 수정하기

```js
const addon = await api.personas.addons.get(addonId);
if (addon) {
  await api.personas.addons.update(addon.id, {
    content: `${addon.content}\n\nAlways write in second person.`,
  });
}
```

## 에러 처리

다음 상황에서 에러가 발생해요:

- **권한 거부** — `addons.*`를 포함하여 이 네임스페이스의 어떤 메서드든 권한이 없으면 `Error: PERMISSION_DENIED:personas — grant this permission to use this API` 에러가 발생해요.
- **유효성 검증 실패** — `create` / `update` 페이로드에 대한 호스트 측 유효성 검사 실패 시(예: `name` 누락). 에러 메시지에 문제가 된 필드가 포함돼요.

단순 조회 실패 시에는 에러를 던지지 않아요: `get`, `getDefault`, `getActive`, `getWorldBook`, `addons.get`는 항목을 찾지 못하면 `null`을 반환해요. `delete`는 삭제된 항목이 없으면 `false`를 반환해요.

```js
try {
  await api.personas.switchActive(personaId);
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('PERMISSION_DENIED')) {
    api.ui.toast('Persona switching requires the personas permission.', 'warning');
    return;
  }
  throw err;
}
```

## 버전 정보

`api.personas.*`(페르소나 CRUD + `switchActive` + `getWorldBook`)는 v1.0.0-rc.1+부터 구현되었어요. 중첩된 **`api.personas.addons.*`** 전역 애드온 인터페이스는 호스트의 `spindle.global_addons.*`를 래핑한 **v2.0 신규 기능**이에요. 페르소나 및 애드온 필드는 Lumiverse의 스키마를 따라 camelCase로 매핑되며, 호스트의 snake_case DTO(`sort_order`, `attached_world_book_id`, `is_default`, `image_id`)는 자동으로 변환돼요.
