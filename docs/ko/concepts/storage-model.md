# 저장소 모델 (Storage model)

LumiScript에는 데이터를 보관할 수 있는 6개의 저장 공간이 있어요. 각 공간은 (영속성, 범위, 필요 권한, 저장 크기)의 조합이 서로 달라요. 실제로 필요한 요구사항에 맞춰 선택하세요 — 무조건 "가장 오래 유지되는 것"을 기본값으로 고르는 것이 여기서 사람들이 하는 가장 큰 단일 실수예요.

## 핵심 개념

실행 간에 무언가를 기억해야 하는 스크립트에게는 6가지 선택지가 있으며, 이들은 서로 대체할 수 없어요. 고려해야 할 중요한 차이점들:

- **영속성(Durability)** — 데이터가 얼마나 오래 살아남는가? 다음 실행 때까지? 확장 기능이 재로드될 때까지? 백엔드가 재시작될 때까지? 모든 상황에서 영구히?
- **범위(Scope)** — 데이터의 소유 주체는 누구인가? 해당 스크립트 단독? 특정 캐릭터나 채팅? 확장 기능 전체? LumiScript 내부의 모든 스크립트?
- **권한(Permission)** — `allowDangerous`가 필요한가, 특정 권한이 필요한가, 아무런 권한도 필요 없는가?
- **형태(Shape)** — 단순 키-값 저장소인가, 쿼리 가능한 레코드 배열인가, 디스크 상의 원시 바이트인가, 암호화된 비밀값인가?

아래의 결정 트리는 "저장하려는 대상"을 "적합한 저장소 계층"으로 매핑해 줘요. 계층을 결정한 뒤 효율적으로 활용할 수 있도록 계층별 세부 레퍼런스와 모범 사례/안티패턴이 이어져요.

## 결정 트리

![저장소 계층 결정 트리: "현재 실행 이후에도 유지되어야 하는가?"에서 시작하여 "백엔드 재시작 후에도 유지되어야 하는가?"와 "어떤 데이터 형태인가?"로 분기되어 저장소 옵션(로컬 let/const, globalThis, api.scriptStorage, api.variables, api.db, api.enclave, api.files) 중 하나로 귀결됨](../../diagrams/storage-model.svg)

실질적인 스크립트 대부분은 이 중 두세 가지를 함께 사용해요. 전형적인 패턴: 프로세스별 캐시를 위한 `globalThis`, 캐릭터별 영속 상태를 위한 `api.variables.character`, 추가 전용 이벤트 로그를 위한 `api.db.*`.

<a id="per-tier-reference"></a>

## 계층별 상세 레퍼런스

| 계층 | 영속성 | 범위 (Scope) | 필요 권한 | 크기 제한 | 비동기 여부 |
|---|---|---|---|---|---|
| `globalThis.<key>` | 스크립트 러너 서브프로세스 재시작 시까지 (확장 기능 재로드 / 백엔드 재시작) | 스크립트 러너 서브프로세스 단위, 내부의 모든 스크립트가 공유 (QuickJS *스크립트별* 격리 환경에서는 스크립트 단위) | 없음 | 호스트 RAM 용량 | 동기 (sync) |
| `api.scriptStorage` | 스크립트 비활성화 / 삭제 / 백엔드 재시작 시까지. 워커 축출 및 스크립트 소스 수정 시에도 유지됨. | 스크립트 단위 | 없음 | 스크립트당 1MB | 비동기 (async) |
| `api.variables.local` | 영속적, 사용자가 대화 변수를 초기화할 때까지 | 대화(채팅) 단위 | 없음 | 호스트 한도 | 비동기 (async) |
| `api.variables.global` | 영속적, 사용자가 초기화할 때까지 | 사용자 단위 (대화 및 캐릭터 초월) | 없음 | 호스트 한도 | 비동기 (async) |
| `api.variables.character` | 영속적, 캐릭터가 삭제되거나 직접 초기화할 때까지 | 캐릭터 단위 | 없음 | 호스트 한도 | 비동기 (async) |
| `api.variables.chat` | 영속적, 사용자가 대화 변수를 초기화할 때까지 | 대화(채팅) 단위 | 없음 | 호스트 한도 | 비동기 (async) |
| `api.db.*` | 영속적, 컬렉션을 drop할 때까지 | 3개 하위 범위: `script` (기본값) / `character` / `chat` | 없음 | 컬렉션당 10MB 소프트 경고 / 50MB 하드 차단 | 비동기 (async) |
| `api.enclave.*` | 영속적, 디스크에 AES-256-GCM 암호화 저장 | 사용자 및 확장 기능 단위 (LumiScript 내 스크립트 간 공유) | `allowDangerous` | 값 ≤ 64KB (출력 가능한 ASCII), 키는 `[A-Za-z0-9_\-.]{1,128}` | 비동기 (async) |
| `api.files.{userRead,userWrite,...}` | 영속적 | 사용자 및 확장 기능 단위 | `allowDangerous` | 호스트 한도 | 비동기 (async) |
| `api.files.{sharedRead,sharedWrite,...}` | 영속적 | 확장 기능의 모든 사용자가 공유 | `allowDangerous` | 호스트 한도 | 비동기 (async) |
| `api.files.{tempRead,tempWrite,...}` | TTL 기반 자동 만료 | 사용자 및 확장 기능 단위 | `allowDangerous` + `ephemeral_storage` | 호스트 한도 + 할당량 | 비동기 (async) |

**`globalThis.<key>`**는 순수한 JavaScript예요. 스크립트 러너 서브프로세스는 내부에서 실행되는 모든 스크립트 간에 하나의 `globalThis`를 공유하므로, 키에 적극적으로 네임스페이스를 붙이세요(`globalThis.lsMyScript_cache ??= {}` 권장). 예외: QuickJS 엔진의 *스크립트별* 격리 환경에서는 각 스크립트가 독립된 `globalThis`를 받으므로 충돌이 일어나지 않아요 — 하지만 기본 엔진 및 QuickJS *공유* 격리 환경을 고려하여 네임스페이스를 붙이는 습관을 유지하는 것이 좋아요. [실행 엔진](engine.md) 참고. 함수, 클래스 인스턴스, 실시간 `Map` 등 직렬화할 수 없는 객체도 자유롭게 담을 수 있으며, 직렬화 비용을 아끼고 싶을 때 `api.scriptStorage` 대신 사용하는 주된 이유예요. 동기 접근이므로 `await`가 필요 없어요.

**`api.scriptStorage`**는 구조화된 `globalThis`라고 볼 수 있어요. 수명 한도(백엔드 재시작 시 유실)는 같지만 스크립트별로 격리되며 LumiScript 패널의 **저장소(Storage)** 탭에서 관리자 검사기를 제공해요. 1MB 용량 제한은 스크립트당 하드 리밋이에요 — 초과 시 `set`이 에러를 던져요. 메모리에 유지 중인 데이터를 디버깅 뷰로 확인하고 싶거나 여러 스크립트가 `globalThis` 키를 두고 충돌할 가능성을 방지하고 싶을 때 사용하세요.

**`api.variables.*`**는 4가지 범위를 제공하는 영속적 JSON 계층이에요. 그중 3가지는 매크로와 호환돼요 — 저장한 값은 Lumiverse의 내장 매크로를 통해 프롬프트에 노출돼요: `local`과 `global`은 `{{getvar}}` / `{{setvar}}`와 짝을 이루고, `chat`은 `{{getchatvar}}` / `{{setchatvar}}`와 짝을 이뤄요. `character`는 캐릭터별 userStorage 파일에 저장되며 매크로에 노출되지 않아요 — 오직 스크립트 코드에서만 읽을 수 있어요. 값은 JSON 직렬화를 거치므로 직렬화할 수 없는 타입(함수, 클래스 인스턴스, Map 등)은 유지되지 않아요.

**`api.db.*`**는 컬렉션 기반의 영속적 계층이에요. `await api.db.collection(name, opts)`로 컬렉션을 생성한 뒤 반환된 핸들러 메서드를 호출해요: `insert` / `insertMany`(쓰기), `find` / `findOne` / `count` / `query`(읽기), `update` / `delete` / `clear`(수정/삭제). 필터 조건식은 Mongo 스타일 서브셋(`$gt`, `$gte`, `$lt`, `$lte`, `$ne`, `$in`, `$nin`, `$exists`, `$regex`)을 지원하며 복잡한 쿼리를 위한 `jsonquery`도 제공해요. `opts.scope`를 통해 3가지 하위 범위를 지정할 수 있어요: `'script'`(기본값, 이 스크립트의 모든 대화/캐릭터 공유), `'character'`(캐릭터별), `'chat'`(대화별). 쓰기 시 선택적 Zod 스키마 검증을 지원해요. 컬렉션당 10MB에서 소프트 경고, 50MB에서 하드 차단이 발생해요. 저장소 탭의 컬렉션 섹션에서 레코드별 편집/삭제가 가능한 정렬 및 필터링 관리자 뷰를 제공해요.

**`api.enclave.*`**는 디스크 상의 암호화 저장소예요. 사용자가 직접 제어하지 않는 사용자별/확장 기능별 시크릿에서 파생된 키를 사용하여 AES-256-GCM으로 암호화돼요. OAuth 리프레시 토큰, API 키 등 디스크에 평문으로 남으면 위험한 민감 정보에 사용하세요. `allowDangerous`가 필요해요. 메서드는 `put` / `get` / `delete` / `has` / `list`예요 — `set`이 아니라 `put`이며 `clear` 메서드는 존재하지 않아요(전체 삭제 시 `list` + `delete` 순회 필요). 제약 조건: 값은 반드시 출력 가능한 ASCII이며 64KB 이하여야 하고, 키는 `^[A-Za-z0-9_\-.]{1,128}$` 패턴과 일치해야 해요.

**`api.files.*`**는 실제 디스크 바이트 파일을 위한 계층이에요. 세 가지 영역:

- `api.files.userRead` / `userWrite` / `userDelete` / `userExists` / `userList` / `userMkdir` — 사용자별, 확장 기능별. 영속적. (`userStat`은 없음.)
- `api.files.sharedRead` / `sharedWrite` / `sharedDelete` / `sharedExists` / `sharedStat` / `sharedList` / `sharedMkdir` — 확장 기능의 모든 사용자가 공유. 영속적.
- `api.files.tempRead` / `tempWrite` / `tempReadBinary` / `tempWriteBinary` / `tempDelete` / `tempStat` / `tempList` / `tempClearExpired` — TTL 기반. 텍스트 **및** 바이너리 I/O 지원 — 이미지, PDF 등 텍스트가 아닌 블롭에는 `*Binary` 쌍(`tempReadBinary` → `Uint8Array`, `tempWriteBinary(path, bytes, opts)`)을 사용하세요. 호스트가 오래된 항목을 자동 만료시켜요; 대용량 임시 데이터(처리 대기 중인 다운로드 파일, 장기 작업의 중간 상태)에 사용하세요. 임시 풀은 **할당량 제한(quota-bounded)**이 적용돼요: `tempGetPoolStatus()`로 사용량 스냅샷을 확인하고, 대용량 쓰기의 경우 `tempRequestBlock(sizeBytes, { ttlMs?, reason? })`로 공간을 미리 예약하여 `{ reservationId, … }`를 전달하면 쓰기 도중 공간 부족 실패를 방지할 수 있어요(`tempReleaseBlock(reservationId)`로 미사용 예약 해제).

세 영역 모두 `allowDangerous`가 필요하며, 임시(temp) 영역은 추가로 `ephemeral_storage` 권한이 필요해요.

## 일반적인 패턴

**비용이 큰 연산의 프로세스별 캐시** — 실행 간에 빠르게 유지하되 백엔드 재시작 시 유실을 감수하는 경우:

```js
async function getCharacterCardFor(charId) {
  globalThis.lsMyScript_charCache ??= new Map();
  const cache = globalThis.lsMyScript_charCache;
  if (cache.has(charId)) return cache.get(charId);
  const card = await api.characters.get(charId);
  cache.set(charId, card);
  return card;
}
```

**캐릭터별 영속 상태** — 확장 기능 재로드 후에도 유지되며 특정 캐릭터에 종속된 경우:

```js
const lastReview = await api.variables.character.get('lastReviewTimestamp', 0);
if (Date.now() - lastReview > 24 * 60 * 60 * 1000) {
  await runDailyReview();
  await api.variables.character.set('lastReviewTimestamp', Date.now());
}
```

**추가 전용 이벤트 로그** — `api.db.*`가 가장 적합해요. 대량의 레코드, 필터링 지원, 채팅 범위 종속:

```js
const events = await api.db.collection('events', { scope: 'chat' });
await events.insert({
  ts:   Date.now(),
  kind: 'message_processed',
  messageId: data.message.id,
  outcome: 'success',
});

// 나중에: 최근 1시간 동안의 모든 이벤트 조회
const recent = await events.find({ ts: { $gte: Date.now() - 60 * 60 * 1000 } });
```

**OAuth 리프레시 토큰** — 보안이 중요한 비밀값이므로 암호화 저장:

```js
await api.enclave.put('spotify.refresh_token', refreshToken);
// ...나중에 다른 실행에서:
const stored = await api.enclave.get('spotify.refresh_token');
```

**두 번의 실행에 걸쳐 처리되는 다운로드 바이너리** — 임시에 기록하고 임시에서 읽으며 호스트가 자동 만료시키도록 함:

```js
// 1번째 실행: 가져와서 임시 저장. resp.body는 Uint8Array → 바이너리 계층 사용.
const resp = await api.utils.http.get(url, { responseType: 'arraybuffer' });
await api.files.tempWriteBinary('pending-upload.png', resp.body, { ttlMs: 10 * 60_000 });

// 2번째 실행: 임시 저장소에서 읽어와 처리.
const bytes = await api.files.tempReadBinary('pending-upload.png');
await api.images.upload({ data: bytes, mimeType: 'image/png' });
```

## 각 계층을 사용하지 말아야 할 때

- **`globalThis`**: 백엔드 재시작 후에도 유지되어야 하는 데이터. 백엔드가 재시작되면 스크립트 러너 서브프로세스가 재생성되어 `globalThis`가 비워져요. `api.scriptStorage`(서브프로세스 재시작 견딤)나 `api.variables.*`(진정한 영속성)를 사용하세요.
- **`api.scriptStorage`**: 백엔드 재시작 후에도 유지되어야 하는 데이터. `scriptStorage`는 백엔드 레벨의 메모리에 상주하며 디스크에 저장되지 않아요. 스크립트 비활성화, 삭제, 백엔드 재시작 시 비워져요. 영구 보존이 필요하다면 `api.variables.*`를 사용하세요.
- **`api.variables.*`**: 대량의 레코드(수백 개 이상으로 증가하는 데이터). 매 `set`마다 내부 파일이나 메타데이터 블롭 전체를 다시 쓰기 때문에 크기가 커지면 성능이 저하되며 쿼리 계층이 없어요. 레코드 형태의 데이터에는 `api.db.*`를 사용하세요.
- **`api.variables.*`**: 바이너리 블롭. 저장소가 JSON 기반이므로 바이트 데이터를 base64로 인코딩해야 하며, 읽기/쓰기 시마다 크기가 3배 증가하는 오버헤드가 발생해요. `api.files.*`를 사용하세요.
- **`api.db.*`**: 단일 플래그나 단순 카운터. "사용자가 현재 선택한 모드"를 위해 컬렉션 핸들을 열고 문서를 삽입하는 것은 낭비예요. `api.variables.*`를 사용하세요.
- **`api.enclave.*`**: 민감하지 않은 일반 데이터. 암호화에는 비용이 듭니다 — `get`과 `put` 모두 AES-256-GCM 연산을 거쳐요. 일반 데이터를 암호화할 정책적 이유가 없으며 디버깅 시 데이터를 확인하기만 어려워져요. 인클레이브는 실제 비밀값에만 사용하세요.
- **`api.files.*`**: 구조화된 JSON 데이터. 파일에 대한 네이티브 쿼리 계층이 없으므로 파일 전체를 읽고, JSON을 파싱하고, 수정한 뒤 다시 써야 해요. 작은 데이터는 `api.variables.*`, 큰 데이터는 `api.db.*`가 훨씬 적합해요.

## 관련 항목

저장소와 유사한 형태를 띠지만 다른 문제를 해결하는 세 가지 인접 기능:

- **`api.events.*`** — `track` / `query` / `replay` / `getLatestState`를 제공하는 영속 이벤트 추적. 호스트가 색인해 주는 추가 전용 이벤트 로그와 현재 상태 재생 기능이 필요할 때 사용해요. `event_tracking` 권한 필요. API가 이벤트 형태라는 점에서 `api.db.*`와 구분돼요(페이로드와 함께 이벤트를 `track`하며, 원시 레코드 CRUD는 제공되지 않아요).
- **`api.databanks.*`** — 전역 / 캐릭터 / 대화 범위에 연결되는 벡터화된 참조 자료. 자료 저장소의 문서는 프롬프트 조립 시 의미론적 검색을 위해 임베딩돼요. LLM이 의미 기반으로 문서를 검색하도록 하고 싶을 때 사용하며, 키-값 저장소나 레코드 저장소가 필요할 때는 쓰지 마세요. `databanks` 권한 필요.
- **`api.images.*`** — 이미지 바이트를 위한 이미지 저장소 CRUD. Lumiverse 이미지 테이블의 표준 식별자인 `id`를 가진 `ImageInfo`를 반환하며, `api.theme.extractColors`, `api.characters.setAvatar` 등에 곧바로 전달할 수 있어요. 바이트가 Lumiverse가 이미지로 다루길 원하는 이미지라면 `api.files.*`가 아니라 이것을 사용하세요. `images` 권한 필요.

## 다음 단계

1. **[핸들러 수명 주기](handler-lifetime.md)** — `broadcast.on`, `commands.onInvoked`, `macros.register`, `tools.register`의 클로저 지속성에 관한 이야기예요. 한 번의 실행에서 핸들러를 등록해 두고 몇 시간 뒤에도 동작해야 한다면, 핸들러가 캡처한 상태를 어떤 저장소 계층에 두었는지가 중요해요. 이 문서가 그 이유를 설명해요.
2. **인앱 레퍼런스의 API Functions 섹션** — 이 문서에 언급된 모든 네임스페이스의 전체 메서드 시그니처를 확인할 수 있어요.
