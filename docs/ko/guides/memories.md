# 메모리 코텍스 및 대화 기억 (Memory Cortex)

`api.memories.*`는 앱이 대화에 대해 자동으로 기억하는 모든 정보(하이브리드 메모리 아키텍처)를 `memories` 권한 하나로 제어할 수 있는 창구예요. 엔티티 대시보드, 관계 편집기, 보관함(vault) 관리 UI, 대체 검색 전략, 메모리 연동 사이드바 등 기억을 시각화하고 수정하거나 보강할 때 사용하세요.

이 네임스페이스는 두 부분으로 구성돼요:

- **메모리 코텍스 (Memory Cortex)** — 구조화된 그래프(엔티티 + 타입화된 관계), 이야기 전개 정리(consolidation), 청크별 중요도(salience), 동결된 **보관함(vault)**, 대화 **상호 연결(interlink)**, 그리고 **통합 검색(fused retrieval)** 파이프라인.
- **장기 대화 기억 (Long-Term Chat Memory)** — `{{memories}}` 매크로의 기반이 되는 벡터화된 청크 저장소.

사용자가 직접 업로드하는 문서인 [`api.databanks`](databanks.md)와는 달라요. 코텍스는 대화 내용 자체로부터 Lumiverse가 직접 구축하는 기억이에요.

> **소유권 및 범위.** 현재 사용자의 ID가 자동으로 반영되므로 사용자 ID를 넘길 필요가 없어요. 대화 범위의 모든 호출은 호스트 측에서 소유권을 확인하므로, 소유하지 않은 대화를 참조하면 읽기는 `null`을 반환하고 쓰기는 예외가 발생해요. 현재 대화 ID는 `api.chat.getChatId()`로 확인할 수 있어요.

## 9개의 하위 네임스페이스

| 하위 네임스페이스 | 역할 |
|---|---|
| `cortex` | 설정, 통합 `query`, `queryLinked`, 웜 캐시 |
| `entities` | 엔티티 그래프 (캐릭터 / 장소 / 아이템 등) |
| `relations` | 엔티티 사이의 타입화된 연결선 (관계) |
| `consolidations` | 이야기 전개 요약 |
| `salience` | 청크별 중요도 기록 |
| `vaults` | 동결된 코텍스 스냅샷 |
| `links` | 보관함 연결 및 대화 상호 연결 |
| `chatMemory` | `{{memories}}` 청크 저장소 |
| `stats` | 사용량 및 수집 텔레메트리 통계 |

## 통합 검색 (가장 중요한 메서드)

`cortex.query`는 의미론적 검색을 중요도, 최신성, 강화도, 감정 신호, 엔티티 신호와 결합해요. 호스트가 프롬프트 조립 시 사용하는 것과 동일한 랭킹 알고리즘이에요:

```js
const chatId = api.chat.getChatId();
const result = await api.memories.cortex.query({
  chatId,
  queryText: 'recent conflict with Selene',
  topK: 8,
  emotionalContext: ['betrayal', 'fury'],
  includeConsolidations: true,
  includeRelationships: true,
});

for (const m of result.memories) console.log(m.finalScore.toFixed(2), m.content);
console.log('Entities in context:', result.entityContext.map((e) => e.name).join(', '));
console.log('Active arc:', result.arcContext ?? 'none');
```

결과는 대화 + 쿼리 형태별로 **서버에 약 5분간 캐싱**돼요. `cortex.getCached(chatId)`는 검색을 다시 돌리지 않고 캐시된 내용을 즉시 읽어와요(비어 있거나 만료되면 `null` 반환). 현재 생성이 무엇을 참조했는지 가볍게 확인하고 싶을 때 유용해요.

### LLM 답변에 근거 자료로 제공하기

검색된 내용을 프롬프트에 넣어 LLM이 답변하게 할 수 있어요(`generation` 권한도 함께 필요해요 — [LLM 호출하기](llm.md) 참고):

```js
const { memories } = await api.memories.cortex.query({ chatId, queryText: question, topK: 6 });
const context = memories.map((m) => `- ${m.content}`).join('\n');
const answer = await api.llm.generate(
  [
    { role: 'system', content: 'Answer using only the remembered context below.' },
    { role: 'user',   content: `MEMORY:\n${context}\n\nQUESTION: ${question}` },
  ],
  { connectionName: 'fast' },
);
```

## `{{memories}}` 청크 저장소

`chatMemory.get`은 `{{memories}}` 매크로가 사용하는 것과 동일한 top-K 하이브리드(벡터 + BM25) 검색을 실행해요:

```js
const mem = await api.memories.chatMemory.get(chatId, { topK: 6 });
console.log(mem.formatted);            // 프롬프트에 바로 쓸 수 있는 텍스트 블록
console.log(mem.count, 'of', mem.chunksAvailable, 'chunks');
```

이는 **`api.chats.getMemories()`와 동일**해요. `memories` 권한이 따로 필요하지 않다면 `chats` 권한 아래에 있는 해당 가벼운 별칭 메서드로도 동일한 검색을 할 수 있어요. `chatMemory.listChunks(chatId)`는 원시 인덱스를 검사하고, `warm(chatId, { force })`는 오래된 청크를 재구축하며(대화 벡터화가 꺼져 있으면 `status: 'skipped'`로 아무 작업도 하지 않음), `invalidate(chatId)`는 캐시된 결과를 지워요.

## 엔티티 및 관계 그래프

```js
// 엔티티 — upsert는 정식 이름 및 별칭을 기준으로 스마트하게 병합해요.
const selene = await api.memories.entities.upsert(chatId, {
  name: 'Selene', type: 'character', aliases: ['the Lady of Ashes'], confidence: 0.95,
});
await api.memories.entities.addFacts(selene.id, ["Carries a dagger inscribed with her mother's name"]);
await api.memories.entities.updateStatus(selene.id, { status: 'deceased' });
await api.memories.entities.updateEmotionalValence(selene.id, { betrayal: 0.6, grief: 0.4 });

const list = await api.memories.entities.list(chatId);                 // 활성 엔티티, 중요도 순
const found = await api.memories.entities.findByName(chatId, 'Selene'); // 이름 또는 별칭으로 검색
```

관계(relation)는 엔티티 **이름**을 사용하지만(호스트가 ID를 알아서 해석함), **양쪽 엔티티가 모두 이미 존재해야 해요**. 엔티티를 먼저 upsert하지 않으면 관계선이 조용히 누락되고 `upsert`가 `null`을 반환해요:

```js
await api.memories.entities.upsert(chatId, { name: 'Marcus', type: 'character' });
const edge = await api.memories.relations.upsert(chatId, {
  source: 'Selene', target: 'Marcus', type: 'rival', label: 'duel pending', sentiment: -0.4,
});
if (!edge) console.warn('relation dropped — an endpoint was missing');

const active = await api.memories.relations.list(chatId);             // 활성 관계선 목록
const seleneEdges = await api.memories.relations.forEntity(chatId, selene.id);
```

## 이야기 정리(Consolidations) 및 중요도

```js
const arcs    = await api.memories.consolidations.list(chatId, { tier: 2 });
const current = await api.memories.consolidations.latestArc(chatId);
await api.memories.consolidations.run(chatId);   // 백그라운드 추출 전용 실행 — 아래 참고

const salience = await api.memories.salience.list(chatId, { limit: 50 });
```

## 보관함(Vaults)과 연결(Links)

대화의 코텍스 상태를 보관함 스냅샷으로 저장한 뒤, 다른 대화에 읽기 전용 지식으로 연결할 수 있어요:

```js
const vault = await api.memories.vaults.create({ chatId, name: 'Campaign — Act 1' });
// 엔티티와 관계는 동기적으로 복사되고, 청크 복사는 백그라운드에서 진행돼요.

await api.memories.links.attach({ chatId: otherChatId, linkType: 'vault', vaultId: vault.id });

// 또는 두 대화를 상호 연결하여 서로의 실시간 그래프를 보게 할 수도 있어요:
await api.memories.links.attach({
  chatId: 'chat-a', linkType: 'interlink', targetChatId: 'chat-b', bidirectional: true,
});
```

연결된 데이터는 `cortex.queryLinked(chatId, { queryText })`로 검색돼요. 임베딩 모델을 변경한 후에는 `vaults.reindex(vaultId)`로 청크 복사를 다시 수행하고, `vaults.delete` / `links.remove`로 정리할 수 있어요.

## 텔레메트리

```js
const usage = await api.memories.stats.usage(chatId);        // 엔티티/관계/정리/중요도 수량
const phase = await api.memories.stats.ingestionStatus(chatId); // 실시간 단계 및 대기 작업 수 (없으면 null)
```

## 주의점 및 팁

- **`relations.upsert`는 양쪽 엔티티가 먼저 생성되어 있어야 해요** — 엔티티가 하나라도 누락되면 생성이 실패하고 `null`을 반환해요. 관계를 맺기 전에 항상 엔티티를 먼저 upsert하고 결과를 확인하세요.
- **`consolidations.run`은 추출(extractive) 전용이에요** — 사이드카 LLM이 아닌 규칙 기반 휴리스틱으로 동작해요. LLM 기반의 심층 정리는 수집 시점에 호스트가 자동으로 수행해요. `run`은 실행 후 잊기 방식이므로 `list()`를 폴링해 결과를 확인하세요.
- **보관함 `create`는 반쯤 비동기예요** — 엔티티와 관계는 즉시 복사되지만, 백그라운드 LanceDB 청크 복사가 끝날 때까지 청크 검색은 구조적 검색으로만 제한돼요. 다시 수행하려면 `reindex`를 사용하세요.
- **벡터화가 꺼져 있으면 `chatMemory.warm`은 아무 작업도 하지 않아요** (`status: 'skipped'`, `reason: 'chat_vectorization_disabled'`) — 먼저 사용자의 임베딩 설정을 확인하세요.
- **코텍스 캐시는 대화별로 약 5분의 TTL을 가져요.** `getCached`는 새로운 조회를 발생시키지 않아요.
- **`processChunk` / `runMaintenance` / 합성 청크 주입 메서드는 없어요** — 코텍스 수집은 계속 호스트의 책임이며, 스크립트 API는 읽기 및 구조화된 편집에 집중되어 있어요.

전체 메서드 목록과 `CortexQuery`, `CortexResult`, `MemoryEntity`, `MemoryRelation`, `Vault`, `ChatLink`의 데이터 구조는 앱 내 **레퍼런스 탭**을 확인하세요.
