# 에이전틱 도구 루프 만들기 (Build an agentic tool-call loop)

모델이 어떤 도구를 호출할지 스스로 결정하고, 도구를 실행하여 결과를 모델에 다시 전달하며, 최종 답변이 도출될 때까지 이 과정을 반복하는 에이전트 루프예요 — "어시스턴트가 답변 전에 무언가를 스스로 찾아보고 대답하는" 모든 상호작용의 핵심 패턴이에요.

## 사용할 기능

- [`api.llm.generateWithTools`](../guides/llm.md#generatewithtoolsmessages-tools-options-schema--tool-using-generation) — 한 번의 호출당 1회의 왕복(round-trip) 수행; 루프는 **여러분이 직접** 구성해요.
- `generation` 권한. ([권한](../concepts/permissions.md))
- 데모 실행을 위해 활성화 즉시 한 번 실행되는 `ls:startup` 트리거. ([트리거 모델](../concepts/trigger-model.md))

먼저 이해해야 할 중요한 점: **`generateWithTools` 자체는 루프가 아니에요.** 호출할 때마다 *`tool_calls`*(모델이 도구 실행을 원함) 또는 최종 *`content`* 문자열 중 하나를 반환할 뿐이에요. 이를 다단계 에이전트로 엮어내는 것은 여러분의 몫이에요 — 덕분에 최대 반복 횟수(cap), 디스패치 방식, 라운드 사이의 로직을 완전히 제어할 수 있어요.

## 스크립트 코드

```js
// @triggers ls:startup
// 에이전틱 루프: 모델이 로컬 도구를 호출하여 질문에 답변해요.
// 필요 권한: generation.

// 1. 순수 함수로 구현된 도구들. 모델의 인자를 받아 문자열을 반환해요.
const TOOLS = {
  async get_distance({ from, to }) {
    const table = { 'paris|tokyo': 9714, 'new york|paris': 5837, 'new york|tokyo': 10848 };
    const key = [from, to].map((s) => String(s).toLowerCase()).sort().join('|');
    return table[key] ? `${table[key]} km` : `No distance on file for ${from} ↔ ${to}.`;
  },
  async convert_currency({ amount, from, to }) {
    const usd = { USD: 1, EUR: 1.08, JPY: 0.0064, GBP: 1.27 };
    if (!usd[from] || !usd[to]) return `Unknown currency (have: ${Object.keys(usd).join(', ')}).`;
    return `${amount} ${from} = ${((amount * usd[from]) / usd[to]).toFixed(2)} ${to}`;
  },
};

// 2. 모델이 언제, 어떻게 각 도구를 호출할지 판단할 때 읽는 스키마.
//    평탄한 목록 — { type: 'function', function: {...} } 래퍼 없이 작성하면 엔진이 추가해 줍니다.
const toolDefs = [
  {
    name: 'get_distance',
    description: 'Distance in km between two major cities. Use for any "how far" question.',
    parameters: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' } },
      required: ['from', 'to'],
    },
  },
  {
    name: 'convert_currency',
    description: 'Convert an amount between USD, EUR, JPY, GBP. Use instead of guessing rates.',
    parameters: {
      type: 'object',
      properties: { amount: { type: 'number' }, from: { type: 'string' }, to: { type: 'string' } },
      required: ['amount', 'from', 'to'],
    },
  },
];

const question = 'How far is Tokyo from Paris, and what is 250 EUR in JPY?';

const messages = [
  {
    role: 'system',
    content: 'You answer travel questions. Call the tools for any fact you are unsure of — never guess a distance or an exchange rate.',
  },
  { role: 'user', content: question },
];

let answer = '(the model never produced a final answer)';

for (let step = 0; step < 6; step++) {              // 하드 리밋 — 무한 루프 방지 장치
  const result = await api.llm.generateWithTools(messages, toolDefs, { connectionName: 'fast' });

  // 도구 호출이 없으면 모델이 작업을 마친 것이에요. result.content가 최종 답변이에요.
  if (!result.tool_calls?.length) {
    answer = result.content;
    break;
  }

  // (a) 모델의 도구 호출 턴을 tool_use 파트로 구성된 assistant 메시지로 기록해요.
  messages.push({
    role: 'assistant',
    content: result.tool_calls.map((tc) => ({
      type: 'tool_use',
      id: tc.call_id,
      name: tc.name,
      input: tc.args,
    })),
  });

  // (b) 요청된 각 도구를 실행하고 결과를 tool_result 파트로 피드백해요.
  for (const tc of result.tool_calls) {
    const fn = TOOLS[tc.name];
    const output = fn ? await fn(tc.args) : `No such tool: ${tc.name}`;
    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: tc.call_id, content: String(output) }],
    });
  }
}

console.log(answer);
```

스크립트를 활성화하고 편집기 콘솔을 확인해 보세요: 모델이 `get_distance`와 `convert_currency`를 호출한 뒤 두 결과를 종합하여 문장을 작성해요 — 보통 2라운드 안에 끝납니다.

## 동작 원리

**1회 호출, 1회 결정.** `generateWithTools(messages, toolDefs, options)`는 1회의 왕복을 수행하고 [`LLMRawResult`](../guides/llm.md#the-result-shape)를 반환해요. 모델이 도구 사용을 원할 때는 `tool_calls` 배열(각 항목 `{ name, args, call_id }`)이 채워지고, 그렇지 않으면 `content`에 답변이 담겨요. 루프는 `tool_calls`가 빈 배열로 올 때까지 계속해서 모델을 호출해요.

**메시지 프로토콜은 엄격해요.** 도구 호출 라운드가 끝나면 다음 호출 전에 반드시 *두 가지*를 메시지 배열에 추가해야 해요:

1. `content`가 `tool_use` 파트 배열인 `assistant` 메시지 — 호출당 하나씩, 모델 자체의 `call_id`를 `id`로 넣고 `name`과 `input`을 포함함.
2. `content`가 `tool_result` 파트 배열인 `user` 메시지 — 각 파트는 `tool_use_id`로 해당 호출을 참조하며, 도구의 실행 출력을 **문자열** 형태로 `content`에 담음.

`call_id`는 결과를 원래 요청과 연결하는 고유 식별자예요 — 그대로 복사해서 전달하세요. 별도의 `role: 'tool'`은 없어요; 도구 트래픽은 항상 `user` 및 `assistant` 메시지의 `content` 파트 내부에 실려요([메시지 형태](../guides/llm.md#message-shape) 참고).

**반복 상한선(cap)은 여러분이 정해요.** 호스트는 이것이 루프인지 알지 못하므로 무한 루프 방지 장치가 없어요 — 도구가 모델이 해결하지 못하는 결과를 계속 반환할 때 무한 도구 호출 지옥에 빠지지 않도록 막아주는 것은 오직 `step < 6` 상한선뿐이에요. 대부분의 작업은 1~3라운드 안에 끝나므로 그보다 조금 여유 있게 상한을 두세요.

**`connectionName: 'fast'`를 쓰는 이유.** 도구 루프는 작업당 여러 번의 모델 호출을 발생시킬 수 있어요. 조율 단계에서 비싼 주력(flagship) 모델을 낭비하기보다는 저렴하고 지연 시간이 짧은 프로필을 지정하는 것이 좋아요([연결 프로필 참고](../guides/llm.md#connection-profiles--pick-fast-for-sub-agent-work)).

## 내 프로젝트에 맞게 응용하기

- **실제 도구 연결하기.** 위의 예제 스텁은 환경 설정 없이 바로 동작하도록 순수 함수로 작성되었어요. 실제 기능으로 교체해 보세요: `api.databanks.*` 조회, `api.utils.http.get` 페치(`allowDangerous` 필요), `api.worldInfo.*` 쿼리, 장면 컨텍스트를 위한 `api.chat.getMessages`. 루프 본문은 바꿀 필요 없이 `TOOLS` 맵과 `toolDefs`만 바꾸면 돼요.
- **도구를 인라인 대신 외부에 등록하기.** 도구를 [`api.tools.register`](../guides/tools.md)로 등록해 두면 로컬 맵 대신 `await api.tools.invoke(tc.name, tc.args)`로 디스패치할 수 있어요 — 이렇게 하면 Council도 동일한 도구를 함께 쓸 수 있어요. [Council이 사용할 수 있는 도구 등록하기](council-tool.md)를 참고하세요.
- **채팅과 연동하기.** `ls:startup` 트리거와 하드코딩된 `question` 대신 `// @triggers MESSAGE_SENT`를 사용하고, `if (!data.message.is_user) return;`(MESSAGE_SENT는 어시스턴트 자리 표시 메시지에도 발생해요) 및 `const question = data.message.content`로 질문을 읽어온 뒤 `await api.chat.sendMessage(answer, { role: 'assistant' })`로 스레드에 답변하도록 수정하세요(`chat_mutation` 필요).
- **조기 종료 조건 추가하기.** 루프 중간에 도구 출력을 검사하여 충분한 정보가 모였다면 `break`하거나, 호출 사이에 자체적인 `user` 메시지를 주입하여 흐름을 조정하세요.

## 주의사항

- **`generateWithTools`는 루프가 아니에요.** 가장 흔히 하는 오해예요. 1회 호출 = 1회 왕복이에요. (4번째 인자로 최종 스키마를 받는 형태도 루프를 돌지는 않으며, 스키마 불일치 시 예외를 던지는 `generateStructured`와 달리 검증되지 않은 원시 내용을 *조용히* 반환해요. [4인자 형태 스펙](../guides/llm.md#generatewithtoolsmessages-tools-options-schema--tool-using-generation) 참고).
- **`tool_result`의 `content`는 반드시 문자열이어야 해요.** 구조화된 데이터라면 직접 `JSON.stringify(obj)`로 문자열화하고, 시스템 프롬프트에서 모델에게 어떤 형태의 JSON이 반환되는지 알려주세요.
- **`tool_result` 전에 `tool_use` 턴을 추가하는 것을 잊지 마세요.** 이를 건너뛰면 모델이 혼란스러워하며 일부 AI 제공자는 불일치한 대화 이력이라며 요청을 거부해요. 항상 어시스턴트의 `tool_use` 메시지를 먼저 push한 뒤 결과를 push하세요.
- **디스패치 루프 내의 순차 실행 vs 병렬 실행.** 위의 예제에서는 각 도구가 순차적으로 실행돼요. 도구들이 서로 독립적이고 느리다면 `Promise.all`로 병렬화하세요 — 단, 결과를 push할 때 `call_id`의 순서가 꼬이지 않도록 주의하세요.

## 관련 항목

- [LLM 호출하기](../guides/llm.md) — `generateStructured` 및 스트리밍을 포함한 `api.llm` 전체 인터페이스.
- [Council이 사용할 수 있는 도구 등록하기](council-tool.md) — 도구 게시자 측면; 이 루프와 짝을 이룸.
- [핸들러 수명 주기](../concepts/handler-lifetime.md) — 도구 등록을 장기 실행 스크립트로 옮길 때 유용함.
