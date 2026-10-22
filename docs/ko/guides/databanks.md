# 자료 저장소 (Databanks)

`api.databanks.*`는 사용자의 자료 저장소(벡터화된 문서 컬렉션)에 대한 완전한 CRUD 작업과 개별 문서의 업로드, 조회, 이름 변경, 재처리, 삭제 기능을 제공해요. 호스트가 벡터 검색을 통해 프롬프트로 가져오는 참고 자료(지식 베이스, 대화 기록 보관소, 캐릭터 배경 설정 등 키워드 매칭보다 의미 기반 검색이 유리한 텍스트 데이터)를 스크립트로 제어할 때 사용하세요.

자료 저장소 단위의 CRUD를 다루는 `api.databanks.*`와 개별 문서 작업을 다루는 `api.databanks.documents.*`의 2개 계층으로 나뉘어 있어요:

```ts
interface DatabanksAPI {
  list(options?):       Promise<{ data: DatabankInfo[]; total: number }>;
  get(databankId):      Promise<DatabankInfo | null>;
  findByName(name, scope?): Promise<DatabankInfo | null>;
  create(input):        Promise<DatabankInfo>;
  update(databankId, input): Promise<DatabankInfo>;
  delete(databankId):   Promise<boolean>;

  documents: {
    list(databankId, options?):     Promise<{ data: DatabankDocumentInfo[]; total: number }>;
    get(documentId):                Promise<DatabankDocumentInfo | null>;
    findByName(databankId, name):   Promise<DatabankDocumentInfo | null>;
    create(databankId, input):      Promise<DatabankDocumentInfo>;
    update(documentId, input):      Promise<DatabankDocumentInfo>;
    delete(documentId):             Promise<boolean>;
    getContent(documentId):         Promise<{ content: string } | null>;
    reprocess(documentId):          Promise<{ success: true; status: 'processing' }>;
    waitUntilReady(documentId, options?): Promise<DatabankDocumentInfo>;
  };
}
```

15개 메서드 모두 `databanks` 권한이 필요해요. 권한이 없으면 `Error: PERMISSION_DENIED:databanks — grant this permission to use this API` 오류가 발생해요.

<a id="where-the-retrieval-actually-happens"></a>

## 실제 검색이 일어나는 위치

**스크립트는 런타임에 자료 저장소에서 직접 문서를 검색하지 않아요.** 이는 `api.worldInfo`와의 가장 중요한 개념적 차이점이에요. 둘 다 "컨텍스트를 가져오는" 역할을 하지만 동작 방식이 달라요:

- **월드 인포 항목**은 프롬프트 조립 시점에 호스트의 활성화 파이프라인이 채팅 내용과 매칭해요. 스크립트는 `api.worldInfo.registerInterceptor`를 통해 활성화 결과를 가로채거나 수정할 수 있어요.
- **자료 저장소 문서**는 업로드 시 호스트에 의해 벡터화되며, 프롬프트 조립 시점에 프롬프트와의 코사인 유사도를 기준으로 매칭돼요. 스크립트는 문서 저장소를 관리(업로드, 이름 변경, 삭제, 재처리)할 뿐, 검색 과정 자체를 직접 구동하지는 않아요. 검색 과정은 스크립트에게 불투명(opaque)하게 처리돼요.

따라서 `api.databanks.*`는 근본적으로 **문서 저장소 관리 인터페이스**예요. 해당 문서들을 프롬프트 컨텍스트로 변환하는 벡터 검색은 호스트 측의 파이프라인이며, 스크립트는 데이터를 채워 넣을 수 있을 뿐 직접 쿼리를 날릴 수는 없어요. "트리거 핸들러에서 자료 저장소를 검색하고 싶다"는 요구에 맞는 전용 API는 존재하지 않으며, 가장 가까운 방법은 원시 텍스트를 반환하는 `documents.getContent(documentId)`를 호출한 뒤 스크립트 코드에서 직접 매칭을 수행하는 것이에요.

## 범위 (Scope) — 전역, 캐릭터, 채팅

모든 자료 저장소는 생성 시점에 정확히 하나의 범위를 가지며, 생성 후에는 변경할 수 없어요:

| 범위 | `scopeId` 요구 사항 | 활성화 조건 |
|---|---|---|
| `'global'` | 생략 (또는 `null` 전달) | 현재 사용자에게 항상 활성화 |
| `'character'` | 캐릭터 UUID | 해당 캐릭터가 컨텍스트에 있을 때 |
| `'chat'` | 채팅 UUID | 해당 채팅 세션이 컨텍스트에 있을 때 |

문서는 상위 자료 저장소의 범위를 그대로 상속받으며, 문서별로 범위를 재정의할 수는 없어요. 이 범위에 따라 프롬프트 조립 시 호스트가 해당 자료 저장소를 검색 대상에 포함할지 여부가 결정돼요. `scopeId: 'abc-123'`을 가진 `'character'` 범위 자료 저장소는 `abc-123` 캐릭터가 대화 상대로 활성화되어 있을 때만 프롬프트에 기여하며, `'chat'` 범위 자료 저장소는 특정 한 채팅 안에서만 동작해요.

대부분의 스토리 작성 상황에서는 직관적으로 선택할 수 있어요:
- **전역 (Global)** — 사용자가 언제든 참조하고 싶어 하는 백과사전식 참고 자료.
- **캐릭터 (Character)** — 특정 캐릭터에 종속된 과거 배경, 어조 메모, 전용 로어.
- **채팅 (Chat)** — 세션별 세계관 설정, NPC 관련 메모, 축적된 서사 상태.

## 비동기 수집(Ingestion) 수명 주기

문서 생성은 **비차단(non-blocking)** 방식으로 진행돼요. `documents.create(...)`를 호출하면 `status: 'pending'` 상태인 `DatabankDocumentInfo`를 즉시 반환해요. 이후 호스트가 문서를 대기열에 넣고 파싱, 청크 분할, 벡터화를 차례로 진행하며 상태가 다음과 같이 이어져요:

```
pending → processing → ready
                    ↘ error
```

문서를 업로드한 뒤 바로 사용해야 하는 스크립트라면 대부분 `'ready'` 상태가 될 때까지 기다려야 해요. 이때 `documents.waitUntilReady(documentId, options?)`를 사용하세요. 이 함수는 상태가 `'ready'`가 될 때까지 `pollIntervalMs`(기본 500ms) 간격으로 `documents.get()`을 폴링하며, 최대 `timeoutMs`(기본 60초) 동안 대기해요. 실패 상황에서는 명확한 오류를 던져 줘요:

```ts
options?: {
  timeoutMs?:      number;   // 기본값 60_000 (60초)
  pollIntervalMs?: number;   // 기본값 500
}
```

- 상태가 `'error'`가 되면 `… document <id> failed processing: <errorMessage>` 오류가 발생해요.
- 시간 초과 시 `… document <id> did not reach 'ready' within Nms (last status: …)` 오류가 발생해요.
- 폴링 도중 문서가 삭제되면 `… document <id> disappeared (deleted?) before reaching 'ready'` 오류가 발생해요.
- 빠른 경로: 대기 전에 상태를 먼저 확인하므로, 이미 준비된 문서는 지체 없이 즉시 반환돼요.

## 빠른 시작

전역 자료 저장소를 만들고, 문서를 업로드한 뒤, 준비될 때까지 기다려 확인하는 예제예요:

```js
// @triggers ls:startup

const lore = await api.databanks.create({
  name:        'Campaign Lore',
  description: 'Setting notes that should always be reachable.',
  scope:       'global',
});

const doc = await api.databanks.documents.create(lore.id, {
  data:     '# The Drunken Owl\n\nA dimly-lit roadside tavern…',
  filename: 'drunken-owl.md',
});

// 파싱 및 벡터화가 끝날 때까지 대기 (또는 타임아웃/오류 발생)
const ready = await api.databanks.documents.waitUntilReady(doc.id, {
  timeoutMs: 30_000,
});

console.log(`Document "${ready.name}" ready with ${ready.totalChunks} chunks`);
```

`documents.create`의 `data`에는 `string | Uint8Array`를 전달할 수 있어요. 문자열은 내부적으로 UTF-8로 인코딩되므로 `new TextEncoder()`를 직접 쓸 필요가 없어요. 소스가 이미 바이너리인 경우(예: `api.utils.http`의 `responseType: 'arraybuffer'`)에는 `Uint8Array`를 바로 전달하세요.

## 지원 파일 형식 제한

Lumiverse는 **텍스트 기반 파일만** 업로드를 지원해요. 지원되는 확장자는 다음과 같아요:

`.txt` `.md` `.markdown` `.csv` `.tsv` `.json` `.xml` `.html` `.htm` `.yaml` `.yml` `.log` `.rst` `.rtf`

`DatabankDocumentCreateInput.data`의 타입이 `string | Uint8Array`로 되어 있더라도, PDF나 이미지, 압축 파일, 오디오 등 임의의 바이너리 파일은 수집 단계에서 거부돼요(`Uint8Array`는 이미 바이너리 형태로 존재하는 텍스트 파일을 위한 것이에요). **문서당 최대 크기는 10 MB**예요.

텍스트가 아닌 다른 데이터의 영구 저장은 다음 API를 쓰세요:
- `api.files.*` — 임의의 텍스트 파일 저장 (바이너리는 base64로 인코딩 필요).
- `api.images.*` — 원시 이미지 바이트 데이터 저장.
- 벡터화가 필요한 PDF나 오피스 문서: 호스트에는 전용 파서가 내장되어 있지 않으므로 스크립트에서 먼저 텍스트를 추출한 뒤, 추출한 텍스트를 `.txt`나 `.md` 파일로 업로드하세요.

## findByName 편의 메서드

`databanks.findByName(name, scope?)`와 `databanks.documents.findByName(databankId, name)`은 `list()` 결과에 로컬 이름 필터를 적용한 편의 래퍼 메서드예요. 결과 페이지를 순회(`limit: 100`)하며 첫 번째 일치 항목을 반환하고, 일치하는 항목이 없으면 `null`을 반환해요:

```js
// 전역 자료 저장소를 이름으로 검색 (범위가 일치하지 않는 것은 무시):
const lore = await api.databanks.findByName('Campaign Lore', 'global');

// 특정 자료 저장소 안에서 문서를 이름으로 검색:
const doc = await api.databanks.documents.findByName(lore.id, 'drunken-owl.md');
```

**비용**: 각각 O(자료 저장소 수), O(저장소 내 문서 수)예요. 극단적인 계정 환경에서 발생할 수 있는 긴 지연 시간을 방지하기 위해 최대 1000개 항목까지만 탐색하도록 상한선이 설정되어 있어요. 자료 저장소가 1000개를 넘거나 한 저장소 안의 문서가 1000개를 넘더라도, 실제로 그만큼 필요해지기 전에 상한선이 먼저 작동해요. 일반적인 규모라면 빈번히 호출되는 경로에서 써도 문제없어요.

ID를 이미 알고 있다면 목록 순회 없이 바로 조회하는 `get(databankId)` / `documents.get(documentId)`를 우선적으로 사용하세요.

## 문서 본문 내용 읽기

`documents.getContent(documentId)`는 파싱된 일반 텍스트 본문을 `{ content: string } | null` 형태로 반환해요:

- 문서가 존재하지 않거나 상태가 아직 `'ready'`가 아닌 경우(아직 처리 중이거나 청크 생성 전에 오류가 난 경우) `null`을 반환해요.
- 문서 처리가 완료되면 `{ content: '...' }`를 반환해요. 반환 객체로 감싸져 있으므로 결과 자체를 바로 쓰지 않고 `result.content`를 읽어야 해요.

자주 쓰이는 패턴: `waitUntilReady`와 함께 써서 내용이 준비되었음을 보장하기:

```js
await api.databanks.documents.waitUntilReady(doc.id);
const result = await api.databanks.documents.getContent(doc.id);
if (result) {
  console.log(`Document content (${result.content.length} chars):`, result.content);
}
```

`getContent`는 문서에서 특정 문단을 추출하거나, 본문을 대상으로 별도의 LLM 호출을 실행하거나, 변경 감지를 위해 본문 해시를 계산하는 등 문서를 다시 가공해야 하는 스크립트에 유용해요. 프롬프트 조립 시점의 검색 용도로 쓰는 것은 아니에요(위의 [실제 검색이 일어나는 위치](#where-the-retrieval-actually-happens) 참고).

## 재처리(Reprocess) — 언제 써야 할까?

`documents.reprocess(documentId)`는 문서 상태를 `'pending'`으로 되돌리고, 기존 벡터를 삭제한 뒤 전체 재수집 대기열에 넣어요. 호출 즉시 `{ success: true, status: 'processing' }`을 반환해요. 다음과 같은 경우에 사용하세요:

- **임베딩 모델이 변경되었을 때.** 이전 모델로 벡터화된 문서는 새로 업로드된 문서와 유사도 검색 시 잘 섞이지 않으므로, 새 모델에 맞춰 다시 벡터화해야 해요.
- **최초 수집 시 오류가 나서 다시 시도하고 싶을 때.** 상태가 `error → pending → processing → ready` 순으로 다시 진행돼요.
- **인덱스가 손상된 것으로 의심될 때** (흔치 않음). 청크와 벡터를 처음부터 다시 생성해요.

전체 재벡터화가 일어나므로 가볍게 자주 호출해서는 안 돼요. 완료 시점까지 기다려야 한다면 `waitUntilReady(documentId)`와 함께 사용하세요.

## 구현 예제 — 캐릭터 범위의 배경 이야기 수집

실제 활용 패턴: 캐릭터의 배경 이야기를 캐릭터 전용 자료 저장소에 업로드하고, 기존 버전이 있다면 새 내용으로 교체하는 도구 스크립트예요:

```js
// @triggers ls:startup
// 이 스크립트가 배경 설정을 업로드하는 UI 버튼에 연결되어 있다고 가정해 보세요.

async function ingestBackstory(characterId, name, text) {
  const BANK_NAME = `${name} — Backstory`;

  // 멱등성 유지: 기존 자료 저장소가 있는지 확인하고 없으면 새로 생성해요.
  let bank = await api.databanks.findByName(BANK_NAME, 'character');
  if (bank && bank.scopeId !== characterId) {
    // 다른 캐릭터의 저장소와 이름이 겹치면 안전하게 중단해요.
    api.ui.toast(
      `Bank "${BANK_NAME}" exists but belongs to another character`,
      'error',
    );
    return null;
  }
  if (!bank) {
    bank = await api.databanks.create({
      name:        BANK_NAME,
      description: `Backstory + lore for ${name}.`,
      scope:       'character',
      scopeId:     characterId,
    });
  }

  // 기존 배경 문서가 있다면 삭제 (이름 기반 중복 제거).
  const existing = await api.databanks.documents.findByName(bank.id, 'backstory.md');
  if (existing) {
    await api.databanks.documents.delete(existing.id);
  }

  // 새 내용 업로드. 참고: data는 문자열을 직접 받을 수 있어요.
  const doc = await api.databanks.documents.create(bank.id, {
    data:     text,
    filename: 'backstory.md',
    mimeType: 'text/markdown',
  });

  try {
    const ready = await api.databanks.documents.waitUntilReady(doc.id, {
      timeoutMs: 30_000,
    });
    return ready;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    api.ui.toast(`Backstory ingestion failed: ${msg}`, 'error');
    return null;
  }
}
```

눈여겨볼 유용한 패턴들:
- **`findByName`을 먼저 호출하고 없을 때만 `create`** — "이 속성을 가진 저장소가 존재하는지 확인하고 보장하는" 중복 방지 패턴이에요.
- **내용 교체 시 삭제 후 재생성** — Lumiverse는 문서 내용의 제자리 수정을 지원하지 않으며, `documents.update`는 이름 변경만 가능해요. 내용을 바꾸려면 삭제 후 새로 생성해야 해요.
- **try/catch 안에서 `waitUntilReady` 실행** — 파일 형식 거부, 파서 오류, 벡터 백엔드 장애 등으로 수집이 실패할 수 있으므로, 오류를 잡아 사용자 알림으로 안내하세요.

## 오류 처리

세 가지 오류 상황이 발생할 수 있어요:

| 원인 | 오류 메시지 형태 |
|---|---|
| 권한 거부 | `Error: PERMISSION_DENIED:databanks — grant this permission to use this API` |
| `waitUntilReady` 수집 실패 | `Error: api.databanks.documents.waitUntilReady: document <id> failed processing: <upstream-message>` |
| `waitUntilReady` 시간 초과 | `Error: api.databanks.documents.waitUntilReady: document <id> did not reach 'ready' within <N>ms (last status: <pending\|processing>)` |
| `waitUntilReady` 도중 삭제됨 | `Error: api.databanks.documents.waitUntilReady: document <id> disappeared (deleted?) before reaching 'ready'` |

이 외에도 호스트 측의 검증 실패나 호출 빈도 제한, 파이프라인 오류는 호스트가 보낸 메시지와 함께 전달돼요. 데이터 변경 호출은 try/catch로 감싸고 알림이나 콘솔을 통해 메시지를 사용자에게 보여 주세요.

## `api.worldInfo`와의 용도 비교

두 네임스페이스는 겉보기에 비슷해 보이지만 서로 다른 목적을 가지고 있어요:

| 요구 사항 | 권장 기능 |
|---|---|
| 채팅의 키워드 매칭으로 활성화되는 정교하게 작성된 로어 | `api.worldInfo` |
| 호스트 측 벡터 유사도 검색으로 찾아오는 문서형 참고 자료 | `api.databanks` |
| 코드 기반 활성화 제어 (턴 수 기반, 캐릭터 상태 기반 제어) | `api.worldInfo.registerInterceptor` |
| 코드 기반 콘텐츠 관리 (도구 스크립트를 통한 업로드/삭제/이름 변경) | 둘 다 가능 — 단, `api.databanks`는 문서형 데이터에, `api.worldInfo`는 개별 항목 데이터에 최적화 |
| 임베딩 모델 변경에 따른 검색 인덱스 갱신 | `api.databanks.documents.reprocess` |

두 기능 모두 스크립트 측에서는 CRUD 작업을 지원해요. 어떤 항목을 활성화하고 어떤 문서를 매칭할지에 대한 실제 검색 로직은 프롬프트 조립 시점에 호스트 측에서 실행돼요. 스크립트가 데이터를 채우고, 호스트가 이를 검색해요. 두 기능은 충돌 없이 함께 사용할 수 있으며, 많은 사용자 환경에서 정교한 서사 연출에는 월드 인포를, 방대한 배경 텍스트 자료에는 자료 저장소를 함께 활용하고 있어요.

## 버전 참고 사항

**v0.25.2+**에서 네이티브 `spindle.databanks.*` (lumiverse-spindle-types ≥0.4.48)를 기반으로 구현되었어요. `findByName` 헬퍼와 `documents.waitUntilReady` 폴링 헬퍼는 LumiScript 측에서 제공하는 편의 기능이며, 그 외의 기능은 Spindle 기반 API를 가볍게 전달하는 구조예요.
