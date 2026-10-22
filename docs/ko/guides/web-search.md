# 웹 검색 (Web search)

`api.webSearch.*`는 사용자가 설정한 검색 프로바이더(현재는 SearXNG)를 대상으로 검색을 실행하고 순위가 매겨진 결과를 반환해요 — 또한 선택적으로 스크랩된 웹 페이지 텍스트와 LLM 호출에 즉시 주입할 수 있는 프롬프트용 컨텍스트 블록도 함께 제공해요. `web_search` 권한이 필요해요.

제공되는 메서드는 두 가지예요:

- `query(options)` — 검색 실행.
- `getSettings()` — 안전한 프로바이더 설정 정보 조회(API 키는 절대 노출되지 않음).

## 먼저 설정 확인 후 검색하기

웹 검색은 사용자가 검색 프로바이더를 실제로 구성해 두었을 때만 동작해요. 설정된 프로바이더가 없으면 `query()`는 `"Web search is disabled"` 에러로 **거부(reject)**되므로, 검색 전에 `getSettings().enabled`로 분기 처리하는 것이 좋아요:

```js
const settings = await api.webSearch.getSettings();
if (!settings.enabled) {
  api.ui.toast('Web search is not configured.', 'warning');
  return;
}
const res = await api.webSearch.query({ query: 'site reliability engineering' });
```

`getSettings()`는 **안전한(safe)** 뷰를 반환해요 — `enabled`, `provider`, `apiUrl`, `defaultResultCount`, `maxResultCount`, `maxPagesToScrape`, `maxCharsPerPage`, `language`, `safeSearch`, `engines`, `requestTimeoutMs`, `hasApiKey`. 의도적으로 **`apiKey` 필드가 제외**되어 있어요 — 키가 설정되어 있는지 여부(`hasApiKey`)만 확인할 수 있을 뿐 키 원문은 절대 볼 수 없어요.

## `scrape` 옵션이 핵심이에요

```js
// 기본값: scrape 켜짐 — 검색 결과 + 스크랩된 페이지 텍스트 + 프롬프트용 context 블록.
const full = await api.webSearch.query({ query: 'mars helicopter', count: 5 });

// 빠른 경로: 페치 없이 결과 목록(제목 / URL / 스니펫)만 반환.
const quick = await api.webSearch.query({ query: 'mars helicopter', scrape: false });
```

`query(options)` 옵션:

- `query` (필수) — 자유 형식 검색어. 호스트에서 앞뒤 공백을 다듬으며, 빈 문자열이면 거부돼요.
- `count?` — 원하는 결과 수. `maxResultCount` 이하로 제한되며 생략 시 `defaultResultCount`가 적용돼요.
- `scrape?` — **기본값은 `true`**. 켜져 있으면 상위 검색 결과 페이지를 가져와 텍스트를 추출해요.

응답 객체 형태는 `scrape` 여부에 따라 달라져요:

```js
{
  query:    'mars helicopter',           // 실행된 검색어 (공백 정리됨)
  results:  [ { title, url, snippet, engine?, score? }, ... ],
  documents?: [ { title, url, snippet, content?, contentLength?, sourceType?, error? }, ... ],
  context?:   '…assembled, prompt-ready text…',
}
```

`documents`와 `context`는 **`scrape`가 켜져 있을 때만(기본값) 제공**돼요. `scrape: false`인 경우 `results`만 반환돼요.

## LLM 응답 그라운딩 (가장 대표적인 활용 사례)

`context` 블록은 바로 이 목적으로 설계되었어요 — 프롬프트에 그대로 삽입하여 모델이 최신 출처 정보를 바탕으로 답변하도록 할 수 있어요:

```js
const { context } = await api.webSearch.query({ query: userQuestion, count: 5 });

const answer = await api.llm.generate(
  [
    { role: 'system', content: 'Answer using only the search context provided. Cite URLs.' },
    { role: 'user',   content: `CONTEXT:\n${context}\n\nQUESTION: ${userQuestion}` },
  ],
  { connectionName: 'fast' },
);
```

(LLM을 호출하려면 추가로 `generation` 권한이 필요해요 — [LLM 호출하기](llm.md) 참고.)

프롬프트를 직접 조립하고 싶다면 `documents`를 순회하세요(각 항목은 추출된 본문인 `content`를 담고 있으며, 특정 페이지 스크랩 실패 시 `error` 필드가 포함돼요):

```js
const { documents } = await api.webSearch.query({ query: topic });
for (const doc of documents ?? []) {
  if (doc.error) continue;            // 스크랩 실패한 페이지 건너뛰기
  addToPrompt(`## ${doc.title}\n${doc.url}\n${doc.content}`);
}
```

## Council 도구로 등록하기

웹 검색은 `api.tools.register`와 자연스럽게 어울려요 — Council에 "정보 검색" 기능을 부여하여 최신 정보를 바탕으로 추론하도록 할 수 있어요:

```js
api.tools.register(
  'web_lookup',
  { display_name: 'Web lookup', description: 'Search the web for current information', council_eligible: true },
  async (args) => {
    const { context } = await api.webSearch.query({ query: args.query, count: 4 });
    return context ?? 'No results.';
  },
);
```

도구 인터페이스 전체는 [도구 등록](tools.md) 가이드를 참고하세요.

## 참고 사항

- **권한.** `query`와 `getSettings` 모두 `web_search` 권한이 필요해요. 권한이 없으면 `PERMISSION_DENIED` 에러가 발생해요.
- **활성 사용자가 암시적으로 지정돼요.** 사용자 ID를 전달하지 않으며, 현재 활성 사용자의 범위에서 자동으로 실행돼요.
- **결과는 영속화되지 않아요.** 각 `query`는 실시간 네트워크 요청이에요. 결과를 재사용해야 한다면 직접 캐싱하세요(`api.scriptStorage` / `api.db`).

전체 `WebSearchOptions`, `WebSearchResponse`, `WebSearchResult`, `WebSearchDocument`, `WebSearchSettings` 필드 목록은 인앱 **레퍼런스 탭**을 확인하세요.
