# 올바른 방식으로 상태 영속화하기 (Persist state the right way)

하나의 스크립트는 대개 여러 *종류*의 상태를 동시에 다뤄요 — 임시 세션 카운터, 영구히 보존되어야 하는 점수, 나중에 쿼리할 추가 전용 로그 등. 이 레시피는 모든 데이터에 단 하나의 저장소만 획일적으로 적용하려는 실수를 방지하기 위해 작성되었어요. 세 가지 상태를 세 가지 다른 계층에 나누어 저장하는 관계 추적기(Relationship tracker)를 통해 각 선택의 이유를 알아볼게요.

## 사용할 기능

- `api.scriptStorage.*` — 세션 범위의 키/값 저장소. 워커 축출 및 스크립트 수정 시에도 유지되지만 백엔드 재시작 시 초기화됨. **권한 필요 없음.** ([저장소 모델](../concepts/storage-model.md))
- `api.variables.character.*` — 캐릭터별 영속 JSON 값. 캐릭터가 삭제될 때까지 모든 상황에서 보존됨. **권한 필요 없음.**
- `api.db.*` — 쿼리 가능한 컬렉션 형태의 영속 저장소. **권한 필요 없음.**
- 어시스턴트의 답변이 도착했을 때 발생하는 `GENERATION_ENDED` 트리거. ([트리거 모델](../concepts/trigger-model.md))

핵심 개념: **영속성, 범위, 형태는 세 가지 독립적인 질문이며, 각 데이터마다 대답이 달라요.** 각 질문의 답에 꼭 맞는 저장소 계층을 선택하세요 — 모든 것을 가장 오래 유지되는 저장소에 몰아넣거나(가장 흔히 하는 실수), 쿼리 기능도 없는 곳에 대량의 레코드를 욱여넣지 마세요.

## 스크립트 코드

관계 추적기 스크립트예요. 어시스턴트의 답변에 반응하여 캐릭터별 친밀도(affinity) 점수를 조정하고 모든 변경 내역을 기록해요. 세 가지 데이터, 세 가지 저장소 계층이 사용돼요.

```js
// @triggers GENERATION_ENDED
// 관계 추적기 — 세 가지 상태 종류, 세 가지 저장소 계층.
// 별도 권한 불필요.
//
// GENERATION_ENDED는 어시스턴트의 답변 생성이 완료된 후 발생해요. 페이로드는
// { generationId, chatId, messageId, content } 형태예요 — 답변 텍스트는 `data.content`로,
// 메시지 ID는 `data.messageId`로 읽어요 (이 이벤트에는 `data.message` 객체가 없음).

// ─── 1. 친밀도 증감량 도출 (자체 완결형 키워드 휴리스틱) ───────────────────
const text  = (data.content ?? '').toLowerCase();
const delta =
  /\b(thank|love|smile|glad|appreciate)\b/.test(text) ?  1 :
  /\b(hate|angry|leave|never|refuse)\b/.test(text)    ? -1 : 0;

// ─── 계층 1: api.scriptStorage — 재시작 시 유실되어도 무방한 세션 통계 ─────
// "이번 프로세스에서 어시스턴트 답변을 몇 번 보았는가?"는 백엔드 재시작을 넘어
// 유지될 필요가 없는 가벼운 카운터예요. 세션 범위 계층이 최적의 선택이에요 —
// 여기에 영구 변수(variables)를 쓰는 것은 과도한 설계예요.
const seen = ((await api.scriptStorage.get('turns-seen')) ?? 0) + 1;
await api.scriptStorage.set('turns-seen', seen);

if (delta === 0) return;

// ─── 계층 2: api.variables.character — 반드시 영구 보존되어야 하는 값 ─────
// 친밀도는 활성 캐릭터에 종속된 단일 숫자이며, 확장 기능 재로드와 백엔드 재시작 후에도
// 반드시 살아남아야 해요. 캐릭터 범위 변수가 바로 이 용도예요: 영속적이며,
// 캐릭터별로 관리되고, 복잡한 쿼리가 필요 없어요.
const score = ((await api.variables.character.get('affinity')) ?? 0) + delta;
await api.variables.character.set('affinity', score);

// ─── 계층 3: api.db — 나중에 '쿼리(QUERY)'할 추가 전용 로그 ───────────────
// "무엇이 그녀의 친밀도를 언제 변화시켰는가?"는 여러 레코드에 걸친 질문이에요.
// 이는 (현재 채팅에 범위가 한정된) 컬렉션 계층의 몫이에요 — 단일 변수에 넣어서는 안 됩니다.
const log = await api.db.collection('affinity-log', { scope: 'chat' });
await log.insert({ ts: Date.now(), delta, score, messageId: data.messageId });

console.log(`[rel] turn ${seen}: affinity ${delta > 0 ? '+' : ''}${delta} → ${score}`);
```

스크립트를 활성화하고 대화를 나눠보세요. 어시스턴트의 어조에 따라 친밀도가 오르내리며, 모든 변화가 로그 레코드로 기록돼요. LumiScript 패널의 **저장소(Storage)** 탭을 열어 `scriptStorage` 항목과 `affinity-log` 컬렉션이 실시간으로 채워지는 모습을 확인해 보세요.

## 동작 원리

핵심은 *각 데이터가 왜 그 저장소로 갔는가*에 있어요:

**세션 카운터 → `api.scriptStorage`.** 단일 값이고 다시 계산하기 쉬우며 백엔드가 재시작되어 리셋되어도 아무것도 깨지지 않아요. `scriptStorage`가 정확히 이 역할을 해요: 스크립트별로 관리되고, 세션 범위이며, 빈번히 일어나는 일(워커 축출, 스크립트 수정 및 저장)에서는 보존되지만 전체 재시작에서는 초기화돼요. 이를 영구 `variables`에 넣어도 동작은 하겠지만, 이 카운트가 실제보다 더 중요하다는 인상을 슬며시 주게 돼요.

**친밀도 점수 → `api.variables.character`.** 정반대의 경우예요: 모든 상황에서 *반드시* 살아남아야 하고 특정 캐릭터에 귀속되는 단일 값이에요. 4가지 `api.variables.*` 범위는 오직 *데이터의 소유 주체*만 달라요 — 대화별 `local`/`chat`, 사용자별 `global`, 캐릭터별 `character`. 친밀도는 캐릭터별이므로 `variables.character`가 정답이에요. 활성 캐릭터가 없을 때(프리뷰, 콜드 스타트)도 안전하게 기본값으로 읽히므로 `(… ?? 0)` 처리가 안전해요.

**변경 로그 → `api.db`.** "나중에 필터링할 다량의 레코드"는 컬렉션 계층이 존재하는 이유 그 자체예요. `api.db.collection(name, { scope })`로 핸들을 얻고, `insert`로 추가하며, 나중에 Mongo 스타일 필터로 `find` / `query`를 수행해요. 범위를 `'chat'`으로 지정하여 대화마다 로그를 깔끔히 분리해요. 결정적으로, 이 데이터를 `variables`에 넣어서는 **안 돼요** — 배열이 커질 때마다 매번 전체 블롭을 다시 써야 하고 쿼리 기능도 전혀 없기 때문이에요.

**의도적으로 배제한 저장소들.** `globalThis`는 사용하지 않았어요(재시작 시 친밀도 점수가 날아가므로 영속 데이터에 부적합함, 직렬화할 수 없는 캐시에는 좋음). 로그를 위한 거대한 `variables` 배열도 쓰지 않았어요(쿼리 계층 없음, 추가 시마다 전체 재작성). `api.enclave`도 쓰지 않았어요(친밀도는 비밀값이 아니며 암호화는 공짜가 아님). 각 요구사항을 최적의 계층에 맞추는 것이 곧 "올바른 영속화"예요.

## 내 프로젝트에 맞게 응용하기

- **상태 다시 읽어오기.** 현재 친밀도를 `await api.variables.character.get('affinity')`로 가져와 UI에 표시하거나, "최근 긍정적인 반응 3개"를 `await log.find({ delta: { $gt: 0 } })`로 조회하세요 — 컬렉션 계층을 사용했기 때문에 이러한 조회가 단 한 번의 호출로 끝나요.
- **로그 범위 변경하기.** `api.db.collection`은 `scope: 'script'`(기본값 — 모든 대화와 캐릭터 공유), `'character'`, `'chat'`을 지원해요. 대화별이 아니라 캐릭터 전체에 걸친 단일 친밀도 이력을 원한다면 `'character'`로 변경하세요.
- **직렬화 비용이 아까울 때는 `globalThis` 사용하기.** 정규식 매처 객체, 실시간 `Map`, 클래스 인스턴스 등 JSON으로 직렬화할 수 없는 라이브 객체는 네임스페이스가 지정된 `globalThis` 키(`globalThis.lsRelTracker_cache ??= new Map()`)에 두고 재시작 시 리셋을 감수하세요.
- **비밀값 안전하게 추가하기.** 외부 API를 호출하는 경우 토큰은 평문 변수가 아닌 `api.enclave`(`put` / `get`, 디스크에 AES-256-GCM 암호화 저장)에 보관하세요(`allowDangerous` 필요). [저장소 모델](../concepts/storage-model.md#per-tier-reference)의 인클레이브 항목을 참고하세요.

## 주의사항

- **`scriptStorage`는 *영구* 저장소가 아니에요.** 워커 축출, 핫 리로드, 코드 수정에서는 살아남지만 백엔드가 재시작되면 지워져요. 재시작 후에도 남아야 하는 데이터(점수)는 반드시 `variables`나 `db`에 넣어야 해요 — 이 레시피가 바로 이 경계선을 기준으로 구성되어 있어요.
- **`variables`는 JSON 직렬화를 거쳐요.** 함수, `Map`, 클래스 인스턴스는 `set`/`get` 후 온전히 유지되지 않아요. 순수 JSON 데이터만 넣고 라이브 객체는 `globalThis`에 두세요.
- **`insertOne`이 아니라 `insert`예요.** `api.db` 컬렉션 인터페이스는 쓰기용 `insert` / `insertMany`와 읽기용 `find` / `findOne` / `count` / `query`예요 — Mongo와 유사하지만 이름이 완전히 같지는 않아요. 필터도 임의의 Mongo 연산자가 아닌 서브셋(`$gt`, `$gte`, `$lt`, `$in`, `$regex` 등)만 지원해요.
- **저장 용량 상한선에 유의하세요.** `scriptStorage`는 스크립트당 1MB에서 하드 차단되고, `api.db` 컬렉션은 10MB에서 소프트 경고, 50MB에서 하드 차단돼요. 대량의 로그는 주기적으로 오래된 레코드를 정리(`delete`)하거나 범위를 좁히세요.

## 관련 항목

- [저장소 모델](../concepts/storage-model.md) — 전체 저장소 계층 레퍼런스, 결정 트리, 안티패턴. 이 레시피는 그 개념 문서의 목표 지향 짝꿍 문서예요. 이 레시피에서 다루지 않은 계층(`globalThis`, `enclave`, `api.files`)이 필요할 때 읽어보세요.
- [두 스크립트 간 상태 공유하기](share-state-broadcast.md) — 생산자와 소비자 사이의 *공유* 채널로 `scriptStorage` 활용하기.
- [핸들러 수명 주기](../concepts/handler-lifetime.md) — 오래 유지되는 핸들러가 상태를 캡처할 때 적절한 저장소 계층을 선택하는 법.
