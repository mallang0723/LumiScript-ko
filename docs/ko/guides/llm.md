# LLM 호출하기

`api.llm.*`는 스크립트가 사용자가 구성한 LLM 연결과 상호작용할 수 있는 네 가지 방법을 제공해요: 일반 텍스트 생성, 검증된 구조화된 JSON 생성, 도구 사용(tool-using) 생성, 그리고 모델을 호출하지 않고 프롬프트를 조립해 보는 모의 실행(dry-run) — 여기에 일반 텍스트 생성의 스트리밍 변형이 추가돼요. 5가지 기능 모두 `generation` 권한이 필요해요([`concepts/permissions.md`](../concepts/permissions.md) 참고).

호스트가 `spindle.generate.raw()`를 감싸고 있으므로 모든 요청은 사용자가 선택한 연결 프로필을 통해 전달돼요. 스크립트는 프로바이더의 API 키를 보거나 엔드포인트를 직접 고를 필요가 없으며, 사용자가 OpenAI를 쓰는지, Anthropic을 쓰는지, 로컬 모델을 쓰는지 알 필요가 없어요. 메시지를 보내고 응답을 받기만 하면 돼요.

## 네 가지 기본 기능과 의사결정 트리

![LLM API 의사결정 트리: "생성 중간에 도구가 필요한가?"에서 시작하여 "구조화된 출력이 필요한가?"로 분기 — generateWithTools / generateStructured / generate / dryRun 중 하나로 귀결 (dryRun은 트리 외 별도 옵션으로 접근)](../../diagrams/llm.svg)

실제 스크립트에서는 보통 이 중 둘 이상의 기능을 함께 사용해요. 개발 중 프롬프트를 점검하기 위해 `dryRun`을 쓰고, 분석 작업에는 `generateStructured`를 쓰며, LLM이 여러 단계의 상호작용을 주도해야 할 때는 `generateWithTools`를 사용하는 식이에요.

## 빠른 시작

Zod로 검증되는 구조화된 응답을 사용해 메시지의 감정 점수를 매기는 예제예요:

```js
import { z } from 'zod';

const SentimentSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  confidence: z.number().min(0).max(1),
  reason:     z.string(),
});

const result = await api.llm.generateStructured(
  [
    { role: 'system', content: 'You score messages on emotional sentiment.' },
    { role: 'user',   content: data.message.content },
  ],
  SentimentSchema,
  { connectionName: 'fast' },  // 선택 사항 — 아래 "연결 프로필" 참고
);

console.log(result.sentiment, result.confidence, result.reason);
// → 'positive', 0.87, 'Enthusiastic tone, exclamation marks.'
```

`result`는 Zod에서 유추된 타입으로 자동 지정돼요. 만약 LLM이 잘못된 JSON을 반환하거나 스키마 검증에 실패하면 호출 즉시 오류가 발생해요(재시도나 조용한 대체 실행 없음). 자세한 내용은 아래의 [스키마 유효성 검사](#schema-validation--errors-not-retries)를 참고하세요.

## `generate(messages, options?)` — 일반 텍스트

```ts
generate(messages: LLMMessage[], options?: LLMOptions): Promise<string>
```

가장 단순한 호출이에요. 모델의 원시 텍스트 응답을 문자열로 반환해요. 대화 요약, 서사 텍스트 삽입, 일상적인 대화 답변 등 일반 줄글 생성이 필요할 때 사용하세요.

```js
const reply = await api.llm.generate([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user',   content: 'Summarise the last message in five words.' },
]);
```

<a id="message-shape"></a>

### 메시지 형태

```ts
interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | LlmMessagePart[];
  reasoning_content?: string;  // DeepSeek 생각 모드 에코백
}
```

`role`은 세 가지 중 하나예요 — `'tool'`은 지원되지 않아요(도구 호출과 결과는 아래에서 설명하듯 `content` 배열 안에 구별된 파트로 들어있어요).

`content`는 일반 문자열이거나 다중 파트 배열일 수 있어요:

```ts
type LlmMessagePart =
  | { type: 'text';        text: string }
  | { type: 'image';       data: string;        mime_type: string }
  | { type: 'audio';       data: string;        mime_type: string }
  | { type: 'tool_use';    id: string;          name: string;     input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string;  is_error?: boolean };
```

이미지와 오디오 파트는 base64로 인코딩된 `data`와 MIME 타입을 담아요. LLM이 첨부 이미지를 직접 확인해야 할 때 사용하세요(비전 지원 프로바이더 전용).

```js
const text = await api.llm.generate([
  { role: 'user', content: [
    { type: 'text',  text: 'What is in this image?' },
    { type: 'image', data: base64bytes, mime_type: 'image/png' },
  ]},
]);
```

<a id="generatestreammessages-options--streaming-text"></a>

## `generateStream(messages, options?)` — 텍스트 스트리밍

```ts
generateStream(messages: LLMMessage[], options?: LLMOptions): AsyncGenerator<StreamChunk, void, void>
```

`generate`의 스트리밍 변형이에요. 프로바이더로부터 토큰 단위 청크가 도착할 때마다 이를 전달하는 비동기 이터레이터를 반환하며, 마지막에 전체 텍스트와 종료 이유, (프로바이더가 지원하는 경우) `usage` 토큰 사용량이 포함된 단 하나의 종단 `'done'` 청크를 전달해요.

```js
let buffer = '';
for await (const chunk of api.llm.generateStream(messages)) {
  if (chunk.type === 'token')     buffer += chunk.token;
  else if (chunk.type === 'done') console.log('finished:', chunk.finish_reason);
}
```

### 청크 형태

```ts
type StreamChunk =
  | { type: 'token';     token: string }
  | { type: 'reasoning'; token: string }
  | {
      type:          'done';
      content:       string;       // 전체 누적 텍스트
      reasoning?:    string;       // 전체 누적 생각 과정 (존재하는 경우)
      finish_reason: string;       // 'stop' | 'length' | 'tool_calls' | 'content_filter' | 프로바이더 고유 값
      tool_calls?:   ToolCall[];   // finish_reason === 'tool_calls'일 때 설정됨
      usage?:        { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };
```

세 가지 변형이 있으며 `type`으로 분기해요. `'token'` 청크는 화면에 보일 점진적인 내용 델타예요 — 이어 붙이면 스트리밍 텍스트가 돼요. `'reasoning'` 청크는 생각 모드 모델(DeepSeek 생각 모드, Anthropic 확장 생각 모드 등)의 점진적인 생각 과정(chain-of-thought) 델타예요(생각 모드가 없는 프로바이더는 건너뛰어요). 종단 `'done'` 청크는 생성이 성공적으로 완료되었을 때 정확히 한 번 발생해요.

필드 이름은 `LLMRawResult` 및 업스트림 DTO와 일치하도록 전체적으로 snake_case를 사용해요. `usage` 필드는 **스트리밍 전용**이에요 — 비스트리밍 `generate`, `generateStructured`, `generateWithTools`는 현재 토큰 사용량을 반환하지 않아요.

### 스트리밍을 써야 할 때

다음과 같은 경우에 스트리밍을 쓰세요:

- **첫 번째 토큰까지의 지연 시간(TTFT)이 중요할 때.** 전체 응답을 5초 동안 기다리는 것보다 도착하는 대로 부분 출력을 보여 주는 것이 훨씬 빠르고 반응성 있게 느껴져요. 채팅형 UI나 나레이터 상자 등 사용자에게 직접 보이는 화면에 적합해요.
- **출력 도중 조기 중단하고 싶을 때.** `'token'` 청크가 도착할 때 검사하여 원치 않는 내용이 나오면 생성을 즉시 중단하여 토큰 비용을 아낄 수 있어요.
- **`usage` 토큰 사용량이 필요할 때.** 현재는 `generateStream`만 토큰 사용량을 제공해요.

다음과 같은 경우에는 스트리밍을 쓰지 마세요:

- 구조화된 JSON을 생성할 때. `generateStructured`를 쓰세요 — 엔진이 스키마를 검증해 주며 부분적인 JSON 객체는 쓸모가 없어요.
- 도구 호출이 필요할 때. `generateWithTools`를 쓰세요 — `generateStream`은 현재 도구 루프 패턴을 지원하지 않아요.
- 결과를 점진적으로 사용자에게 보여 주지 않을 때. 전체 결과가 나올 때까지 기다릴 거라면 버퍼 관리나 for-await 등의 추가 배관 작업은 이득이 없어요. 그냥 `generate`를 쓰세요.

### 취소 — 두 가지 방법

스트림은 두 가지 취소 방식을 지원하며 서로 조합할 수 있어요:

**소비자 루프 중단(break)** — `for await` 루프를 `break`로 빠져나오면 이터레이터의 `.return()`이 호출되어 업스트림으로 전달되고 진행 중인 HTTP 요청이 정리돼요. 부분 출력을 검사하다가 중단할 때 유용해요:

```js
let buffer = '';
for await (const chunk of api.llm.generateStream(messages)) {
  if (chunk.type !== 'token') continue;
  buffer += chunk.token;

  // 출력해서는 안 되는 내용이 나오는 즉시 생성 중단
  if (/\b(banned-pattern|other-veto)\b/i.test(buffer)) break;
}
```

**외부 `AbortSignal`** — 루프 외부에서 취소하려면 `options.signal`을 전달하세요. 다음 이터레이터 풀링 시 `AbortError`로 거부돼요. 비스트리밍 메서드와 마찬가지로 `AbortSignal.timeout()`이나 `AbortSignal.any([...])`와 조합할 수 있어요:

```js
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 5000);  // 5초 시간 제한

try {
  for await (const chunk of api.llm.generateStream(messages, { signal: ctrl.signal })) {
    if (chunk.type === 'token') process.stdout.write(chunk.token);
  }
} catch (err) {
  if (err.name === 'AbortError') console.log('cancelled');
  else throw err;
}
```

> **QuickJS 엔진:** QuickJS 엔진에서는 외부 `options.signal`이 **시작 시점에 거부돼요** — 시그널을 조용히 무시하지 않고 오류를 던져요. QuickJS 환경에서 스트림을 취소하려면 앞선 예제처럼 `for await` 루프에서 `break`를 사용하세요. 양쪽 엔진 모두에서 잘 작동하며 업스트림 생성을 확실하게 취소해요. 자세한 내용은 [API 안정성 → 엔진별 동작 차이](../api-stability.md#engine-divergence-quickjs-isolate-opt-in)를 참고하세요.

어느 경로를 쓰든 업스트림 연결이 올바르게 정리되므로 소비자가 듣기를 멈춘 후에도 불필요하게 토큰 비용을 지불하지 않아요. 워커 호스트는 비스트리밍 메서드와 마찬가지로 확장 기능이 정리될 때 진행 중인 스트림을 자동으로 중단해요.

### 오류는 첫 번째 반복에서 발생해요

권한 거부, 알 수 없는 프로바이더, 연결 미발견 등의 검증 실패는 함수 호출 위치에서 즉시 던져지지 않고, 이터레이터에 대한 첫 번째 `await`(일반적으로 `for await`의 첫 반복)에서 발생해요. `generateStream`이 반환하는 비동기 제너레이터는 가벼운 핸들이며, 실제 검증과 연결 조회, HTTP 요청은 소비자가 청크를 당겨오기 시작할 때 일어나기 때문이에요. 스트림 도중의 오류와 초기 검증 오류를 구분하고 싶다면 루프를 `try / catch`로 감싸세요:

```js
try {
  for await (const chunk of api.llm.generateStream(messages)) {
    /* … */
  }
} catch (err) {
  console.error('stream failed:', err.message);
  // PERMISSION_DENIED, 알 수 없는 프로바이더, 연결 미발견,
  // 업스트림 HTTP 실패, AbortError 등이 모두 여기로 들어와요.
}
```

<a id="generatestructuredmessages-schema-options--validated-json"></a>

## `generateStructured(messages, schema, options?)` — 검증된 JSON

```ts
generateStructured<T>(
  messages: LLMMessage[],
  schema:   ZodLike<T> | Record<string, unknown>,
  options?: LLMOptions,
): Promise<T>
```

LLM의 역할이 구조화된 데이터(채점, 추출, 분류, 분석 등)를 생성하는 것이고, 데이터를 다루기 전에 파싱과 유효성 검사가 완료되어 있기를 원할 때 사용하세요.

`schema` 인수에는 두 가지 형태를 전달할 수 있어요:

- **Zod 스키마** (`.parse(unknown): T` 메서드를 가진 객체 — `ZodLike<T>` 구조적 인터페이스). 엔진은 Zod의 `toJSONSchema()`를 통해 스키마를 분석하여 프로바이더의 네이티브 구조화 출력 모드(OpenAI structured output, Anthropic `output_config`, Google `responseMimeType` 등)로 전달해 모델의 출력을 제한하는 동시에, 반환된 응답을 동일한 Zod 객체로 검증해요.
- **일반 JSON Schema 객체** (`Record<string, unknown>`). Zod 검증 단계는 건너뛰지만 프로바이더의 네이티브 구조화 출력 모드로 스키마는 계속 전달해요. Zod로 표현하기 까다로운 스키마 형태이거나 검증 오버헤드를 건너뛰고 싶을 때 사용하세요.

<a id="schema-validation--errors-not-retries"></a>

### 스키마 유효성 검사 — 재시도 없는 오류 발생

`generateStructured`가 반환한 내용이 JSON으로 파싱되지 않거나 Zod 검증에 실패하면 **동기적으로 오류를 던져요**:

- **JSON 파싱 실패** → `Error("api.llm.generateStructured: response was not valid JSON: <first 200 chars>")`
- **Zod 검증 실패** → `Error("api.llm.generateStructured: schema validation failed: <zod-error-message>")`

**자동 재시도는 없어요.** 엔진은 루프를 돌거나 모델에게 출력을 수정하라고 요청하거나 더 엄격한 지시문으로 다시 시도하지 않아요. 검증 실패 시 재시도 동작이 필요하다면 직접 함수를 감싸서 구현해야 해요:

```js
async function generateStructuredWithRetry(messages, schema, opts, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await api.llm.generateStructured(messages, schema, opts);
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      console.warn(`Validation failed on attempt ${attempt}, retrying: ${err.message}`);
    }
  }
}
```

실제로는 명확한 스키마 정의와 적절한 성능의 모델, 명확한 시스템 프롬프트를 함께 쓰면 95% 이상의 확률로 올바른 출력이 나와요. 재시도는 정확성을 담보하는 수단이라기보다는 안전망으로 생각하는 것이 좋아요.

<a id="generatewithtoolsmessages-tools-options-schema--tool-using-generation"></a>

## `generateWithTools(messages, tools, options?, schema?)` — 도구 사용 생성

```ts
// 인자 3개 형태
generateWithTools(messages, tools, options?): Promise<LLMRawResult>

// 인자 4개 형태 (최종 출력 스키마 포함)
generateWithTools<T>(messages, tools, options, schema): Promise<LLMRawResultStructured<T>>
```

이 메서드는 예상과 다르게 동작하여 놀라기 쉬우므로 먼저 명확히 짚고 넘어갈게요:

> **`generateWithTools`는 내부적인 자율 에이전트 루프를 돌리지 않아요.** 호출 한 번당 정확히 1회의 통신 왕복(round-trip)만 일어나요. 이 메서드는 `{ tool_calls: [...] }`(모델이 도구를 쓰고자 함) 또는 `{ content: "..." }`(모델이 최종 답변을 도출함) 중 하나를 반환해요. 도구 호출 목록을 돌려받았을 때, 도구를 실제로 실행하고 그 결과를 메시지에 담아 모델에게 다시 전달하는 것은 *내 스크립트*가 직접 작성해야 할 몫이에요.

이렇게 설계된 이유는 루프에 대한 완전한 통제권을 스크립트 작성자에게 주기 위해서예요. 도구 실행을 조기 중단하거나, 병렬로 실행하거나, 라운드 사이에 추가 메시지를 주입하거나, 특정 결과에 따라 중단하는 등의 처리를 자유롭게 할 수 있어요.

### 도구 정의

```ts
tools: Array<{
  name: string;
  description: string;
  parameters?: Record<string, unknown>;  // JSON Schema
}>
```

`tools` 배열은 평면적인 목록이에요(프로바이더별 `{ type: 'function', function: {...} }` 같은 래퍼 레이어가 없으며, 엔진이 알아서 포맷을 맞춰 줘요).

```js
const tools = [
  {
    name: 'get_weather',
    description: 'Get current weather for a location.',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name' },
      },
      required: ['location'],
    },
  },
];
```

<a id="the-result-shape"></a>

### 결과 데이터 형태

인자 3개 형태는 `LLMRawResult`를 반환해요:

```ts
interface LLMRawResult {
  content: string;
  tool_calls?: ToolCall[];
  reasoning_content?: string;  // DeepSeek 생각 모드
}

interface ToolCall {
  name:    string;
  args:    Record<string, unknown>;
  call_id: string;  // 프로바이더 call id 또는 합성 UUID
}
```

인자 4개 형태는 `LLMRawResultStructured<T>`를 반환해요:

```ts
interface LLMRawResultStructured<T> {
  content?:           T;             // `schema`로 검증됨 — 최종 단계에서만 채워짐
  tool_calls?:        ToolCall[];    // content와 상호 배타적
  reasoning_content?: string;
}
```

**인자 4개 형태의 핵심 동작**: `schema`는 모델이 추가 도구 호출 없이 최종 답변을 반환하는 *마지막* 단계의 `content`만 검증해요. `tool_calls`가 반환되는 중간 단계에서는 스키마 검증이 이루어지지 않아요(이때 `content`는 undefined이거나 간단한 확인 문구 정도예요). 도구 인수의 유효성을 검증하기 위해 `schema`를 쓰는 것은 불가능하며, 도구 인수의 유효성은 개별 도구의 `parameters` JSON Schema를 통해 모델 단계에서 제어돼요.

**검증 실패 동작이 `generateStructured`와 달라요.** `generateStructured`는 최종 내용이 Zod 검증에 실패하면 `api.llm.generateStructured: schema validation failed: <zod-error-message>` 오류를 **던져요**. 반면 인자 4개의 `generateWithTools`는 검증에 실패하더라도 오류를 던지지 않고 원시(파싱은 되었으나 검증되지 않은) JSON 내용을 `result.content`로 **조용히 반환해요** — 오류도 경고도 없어요(`llm.ts:412`). 도구 루프 안에서 엄격한 검증이 필요하다면 함수 반환 후 직접 Zod로 파싱하여 오류를 처리하세요. 즉 모델이 기대와 다른 구조의 최종 답변을 내놓았을 때 `generateStructured`는 즉시 에러를 내지만, `generateWithTools+schema`는 조용히 넘어간다는 점을 기억하세요.

### 내가 직접 작성하는 루프 구조

```js
const messages = [
  { role: 'system', content: 'You can call get_weather to look up weather.' },
  { role: 'user',   content: 'What is the weather in Tokyo and Paris?' },
];

const tools = [{ name: 'get_weather', description: '...', parameters: { /* ... */ } }];

for (let step = 0; step < 10; step++) {  // 무한 루프 방지를 위한 최대 반복 횟수 제한
  const result = await api.llm.generateWithTools(messages, tools);

  if (!result.tool_calls || result.tool_calls.length === 0) {
    // 최종 답변 도착
    console.log(result.content);
    break;
  }

  // 모델의 도구 사용 요청 메시지를 messages에 추가
  messages.push({
    role: 'assistant',
    content: result.tool_calls.map(tc => ({
      type:  'tool_use',
      id:    tc.call_id,
      name:  tc.name,
      input: tc.args,
    })),
  });

  // 도구를 실행하고 결과를 messages에 추가
  for (const tc of result.tool_calls) {
    const toolResult = await executeMyTool(tc.name, tc.args);
    messages.push({
      role: 'user',
      content: [{
        type:        'tool_result',
        tool_use_id: tc.call_id,
        content:     JSON.stringify(toolResult),
      }],
    });
  }
}
```

`step` 상한선은 직접 지정해야 해요. 호스트는 이것이 반복 루프인지 알지 못하므로 호스트 차원의 자동 제한이 없어요. 일반적인 작업은 1~3회의 왕복 안에서 완료돼요.

### Mistral 호환성 주의사항

Mistral API는 `response_format`(구조화된 출력)과 `tools`를 동시에 전달하는 요청을 명시적으로 거부해요. 엔진은 요청 경계에서 이를 감지하고 충돌하는 필드를 조용히 제외해요. Mistral을 타겟팅한다면 `options.parallelToolCalls: false`를 지정하여 모델이 더 안정적으로 처리할 수 있도록 직렬(순차) 도구 호출을 유도하세요:

```js
await api.llm.generateWithTools(messages, tools, {
  parallelToolCalls: false,
});
```

Mistral이 아닌 다른 프로바이더는 이 플래그를 지원하지 않으면 그냥 무시해요.

## `dryRun(options?)` — 호출 없이 조립 결과 확인하기

```ts
dryRun(options?: DryRunOptions): Promise<DryRunResult>
```

비용을 지불하고 실제로 모델을 호출하지 않고도 호스트가 실제로 조립하여 LLM에 보낼 전체 데이터(메시지 배열, 파라미터 재정의값, 블록별 토큰 수, 월드 인포 활성화 통계, 장기 기억 검색 통계 등)를 확인하고 싶을 때 사용하세요.

```js
const dry = await api.llm.dryRun({ chatId: data.chatId });
console.log(`Total messages: ${dry.messages.length}`);
console.log(`Total tokens:   ${dry.tokenCount?.totalTokens}`);
console.log(`Model:          ${dry.provider}/${dry.model}`);
console.log(`Breakdown:`);
for (const block of dry.breakdown) {
  console.log(`  ${block.name} (${block.type}): ${block.tokens} tokens`);
}
```

`DryRunResult`에는 다음 정보가 포함돼요:

| 필드 | 타입 | 설명 |
|---|---|---|
| `messages` | `LLMMessage[]` | 완전하게 조립된 메시지 배열. |
| `breakdown` | `DryRunBlock[]` | 순서대로 정렬된 프롬프트 구성 블록(시스템 / 캐릭터 카드 / 월드 인포 / 채팅 기록 등)과 블록별 토큰 수. |
| `parameters` | `Record<string, unknown>` | 최종 병합된 샘플러 파라미터. |
| `model` / `provider` | `string` | 확인된 대상 연결 정보. |
| `tokenCount?` | `DryRunTokenCount` | 블록별 및 전체 토큰 수 (토크나이저가 설정되지 않은 경우 생략). |
| `worldInfoStats?` | `WorldInfoActivationStats` | 활성화된 월드 인포 항목 및 예산 사용 현황. |
| `memoryStats?` | `DryRunMemoryStats` | 장기 기억 청크 검색 통계. |

`dryRun` 역시 `generation` 권한이 필요해요 — 무료로 호출하는 기능이 아니라 "생성 파이프라인의 미리보기" 기능이기 때문이에요.

## `LLMOptions` 옵션 레퍼런스

```ts
interface LLMOptions {
  connectionId?:      string;
  connectionName?:    string;
  provider?:          LLMProvider;
  model?:             string;
  temperature?:       number;
  maxTokens?:         number;
  parallelToolCalls?: boolean;
  signal?:            AbortSignal;
  reasoning?:         GenerationReasoningOverride;
}
```

### 연결 결정 우선순위

실제 요청을 처리할 연결은 다음 우선순위에 따라 결정돼요:

1. **`connectionId`**가 무조건 최우선이에요 — 정확히 일치하는 ID의 저장된 프로필을 사용해요. 다른 필드는 호출 시점에 여전히 재정의값으로 적용돼요(아래 참고).
2. `connectionId`가 지정되지 않았을 때 **`connectionName`**을 확인해요 — 대소문자를 구분하지 않고 저장된 프로필 이름을 검색해요(일치하는 것이 없으면 오류 발생).
3. **기본 프로필** — `is_default: true`로 표시된 연결을 사용하며, 기본값이 지정되어 있지 않다면 첫 번째 사용 가능한 프로필을 써요.

`provider`와 `model`은 결정된 프로필 위에 **추가로 덮어쓰는 재정의값**이에요. 따라서 `{ connectionId: 'X', model: 'gpt-4o' }`를 전달하면 연결 X의 프로바이더와 API 키를 그대로 쓰면서 이번 호출에서만 모델을 `gpt-4o`로 강제해요. 연결의 인증 정보는 유지하면서 프로필의 기본 모델과 다른 모델을 쓰고 싶을 때 활용하세요.

### 샘플러 재정의

`temperature`와 `maxTokens`는 이번 호출에 한해 연결 프로필의 기본 설정을 재정의해요. 생략하면 프로필의 기본 설정을 따라가요.

### 추론(Reasoning) — 호출별 생각 모드 제어

`reasoning`(호스트 0.5.x+)은 연결에 저장된 추론 설정이나 사용자의 전역 설정을 무시하고 *이번 호출*에서 모델이 생각할지 여부와 강도를 제어해요. 요청 시 샘플러 내부가 아니라 `parameters` **옆에 나란히** 실려 전달되므로 `temperature` / `maxTokens`와 충돌하지 않고 함께 적용돼요.

```ts
interface GenerationReasoningOverride {
  source?:          'inherit' | 'off' | 'custom';
  apiReasoning?:    boolean;          // 마스터 스위치 (source: 'custom')
  effort?:          ReasoningEffort;  // 'auto'|'none'|'minimal'|'low'|'medium'|'high'|'max'|'xhigh'
  thinkingDisplay?: ThinkingDisplay;  // 'auto'|'summarized'|'omitted' — Anthropic 전용
}
```

`source` 구분값에 따라 유효한 설정이 결정돼요:

- **`'inherit'`** — 기본값이며 `reasoning`을 생략한 것과 같아요: 연결에 바인딩된 `reasoning_bindings`가 있으면 그것을 쓰고, 없으면 사용자의 전역 추론 설정을 사용해요. 명시적인 의도를 남기고 싶을 때 적어 주세요.
- **`'off'`** — `parameters`에 명시적인 `thinking` / `reasoning` 블록이 들어 있더라도 이번 호출에서는 강제로 생각 모드를 꺼요. 평소에는 생각을 많이 하도록 설정된 연결에서 빠르고 가벼운 비생각 모드 턴이 필요할 때 사용하세요.
- **`'custom'`** — 이번 요청에 한해 `apiReasoning`, `effort`, `thinkingDisplay` 필드를 직접 적용해요. 생략된 필드는 기본값(`apiReasoning: true`, `effort: 'auto'`, `thinkingDisplay: 'auto'`)으로 채워져요. `parameters`를 통해 전달한 원시 값이 있다면 그 값이 우선하며, 재정의 옵션은 비어 있는 값만 채워요.

```js
// 사용자의 설정을 건드리지 않고 어려운 추출 작업 하나에만 높은 생각 예산을 투입:
const verdict = await api.llm.generateStructured(messages, schema, {
  connectionName: 'fast',
  reasoning: { source: 'custom', effort: 'high' },
});

// 평소에는 생각 모드로 동작하는 연결에서 생각 모드를 강제로 끄고 빠른 생성 실행:
const quick = await api.llm.generate(messages, { reasoning: { source: 'off' } });
```

`reasoning`은 모델을 호출하는 모든 `api.llm` 메서드(`generate`, `generateStream`, `generateStructured`, `generateWithTools`)에서 사용할 수 있어요. 연결에 바인딩된 기본 추론 설정은 `Connection.reasoning_bindings`에서 읽기 전용으로 확인할 수 있어요([연결](connections.md) 참고).

<a id="connection-profiles--pick-fast-for-sub-agent-work"></a>

### 보조 작업에는 빠른(fast) 프로필 활용하기

사용자의 연결 환경은 보통 두 가지 이상으로 구성돼요: 메인 플래그십 모델(채팅에서 집중해서 대화하는 고성능 모델)과 빠른 프로필(저렴하고 빠른 속도로 보조 분석을 수행하는 모델). 스크립트가 백그라운드 분석(감정 점수 측정, 내용 추출, 구조화된 분석 등)을 수행한다면 비싼 플래그십 모델의 토큰을 낭비하지 말고 빠른 프로필을 지정하세요:

```js
await api.llm.generateStructured(messages, schema, { connectionName: 'fast' });
```

정확한 프로필 이름은 사용자의 환경에 따라 다르지만 보통 보조 등급에는 `fast`라는 이름을 많이 써요. 지정한 이름의 프로필이 없을 때 기본 프로필로 대체하는 것은 무난하고 친절한 동작이에요 — `connectionName not found` 오류를 try/catch로 잡아서 `connectionName` 없이 다시 호출하세요.

## `AbortSignal`을 통한 취소

호출을 취소할 수 있게 만들려면 `options.signal`을 전달하세요. 시그널이 중단(abort)되면 업스트림 fetch 요청이 즉시 종료되고 반환된 Promise는 `AbortError`로 거부돼요:

```js
const ctrl = new AbortController();
setTimeout(() => ctrl.abort(), 10_000);  // 10초 타임아웃

try {
  const text = await api.llm.generate(messages, { signal: ctrl.signal });
  // ... 결과 활용
} catch (err) {
  if (err instanceof Error && err.name === 'AbortError') {
    console.log('Generation cancelled — not an error.');
    return;
  }
  throw err;  // 그 외의 오류는 실제 예외로 처리
}
```

표준 취소 프리미티브와 함께 조합할 수 있어요:

```js
// 10초 타임아웃
{ signal: AbortSignal.timeout(10_000) }

// 사용자가 취소 버튼을 누르거나 10초 타임아웃이 되었을 때 중단
{ signal: AbortSignal.any([userCancelCtrl.signal, AbortSignal.timeout(10_000)]) }
```

**워커 호스트는 확장이 정리될 때 진행 중인 생성을 자동으로 중단해요.** 사용자가 스크립트를 비활성화했을 때 요청이 새어 나가지 않도록 하기 위해 일일이 시그널을 전달할 필요는 없어요. 스크립트 자체적인 이유(사용자가 취소 버튼을 눌렀거나, 여러 모델을 동시에 호출해 경합을 붙이거나, 요청별 타임아웃이 필요할 때)로 취소해야 할 때 시그널을 연결하세요.

## 자주 쓰이는 패턴

### 스키마 기반 콘텐츠 분석

```js
const Score = z.object({
  helpfulness: z.number().min(0).max(10),
  accuracy:    z.number().min(0).max(10),
  notes:       z.string(),
});

const score = await api.llm.generateStructured(
  [
    { role: 'system', content: 'You evaluate assistant responses on helpfulness and accuracy.' },
    { role: 'user',   content: `Response to evaluate:\n\n${data.message.content}` },
  ],
  Score,
  { connectionName: 'fast' },
);

await api.events.track('response_score', { messageId: data.message.id, ...score });
```

### 취소 UI 버튼이 있는 사용자 액션

```js
const ctrl = new AbortController();

const modal = api.ui.dom.inject('body', `
  <div class="ls-thinking">
    Thinking…
    <button data-action="cancel">Cancel</button>
  </div>
`);

modal.on('click', (ev) => {
  if (ev.dataset?.action === 'cancel') ctrl.abort();
});

try {
  const reply = await api.llm.generate(messages, { signal: ctrl.signal });
  modal.update(`<div class="ls-reply">${reply}</div>`);
} catch (err) {
  if (err.name === 'AbortError') {
    modal.remove();
    return;
  }
  modal.update(`<div class="ls-error">${String(err.message)}</div>`);
}
```

### 도구 사용 연구 에이전트

```js
const tools = [
  { name: 'search_databank',  description: '...', parameters: { /* ... */ } },
  { name: 'fetch_world_info', description: '...', parameters: { /* ... */ } },
];

const messages = [
  { role: 'system', content: 'You research questions using the available tools.' },
  { role: 'user',   content: data.message.content },
];

for (let step = 0; step < 5; step++) {
  const result = await api.llm.generateWithTools(messages, tools, { connectionName: 'fast' });
  if (!result.tool_calls?.length) {
    await api.chat.sendMessage(result.content, { role: 'assistant' });
    break;
  }
  // ... 도구 실행 및 결과 추가 후 계속 진행
}
```

## 흔한 실수

- **`generateWithTools`는 자동 루프가 아니에요.** 호출 한 번당 1회의 왕복만 수행해요. 여러 번의 도구 호출을 거쳐야 한다면 위의 예제처럼 명시적으로 재프롬프트를 보내는 루프를 직접 작성해야 해요.

- **인자 4개 형태의 스키마는 최종 응답만 검증해요.** `tool_calls`가 반환되는 중간 단계의 도구 인수에는 적용되지 않아요(도구 인수는 해당 도구의 `parameters` JSON Schema로 규정돼요). 도구 호출 없이 최종 답변이 도착했을 때 비로소 스키마 검증이 이루어져요.

- **스트리밍은 오직 `generateStream`으로만 가능해요.** rc.9에서 추가된 비동기 제너레이터 [`generateStream`](#generatestreammessages-options--streaming-text)이 유일한 스트리밍 API예요. 프로바이더 스타일의 이름인 `stream` / `quietStream` / `rawStream`이나 다른 메서드의 `AsyncIterable` 반환 타입은 존재하지 않아요. `generateStructured`와 `generateWithTools`는 부분적인 구조화/도구 루프 결과가 쓸모없으므로 스트리밍 변형이 없어요. 점진적인 텍스트가 필요하면 `generateStream`을, 그 밖의 경우에는 전체 응답 메서드를 쓰세요.

- **검증 실패 시 동작 차이에 유의하세요.** `generateStructured`는 스키마 검증 실패 시 동기적으로 오류를 던지지만, `generateWithTools`의 인자 4개 형태는 검증에 실패하면 조용히 원시 파싱 값으로 대체돼요 — 위의 **스키마 유효성 검사 — 재시도 없는 오류 발생** 절에서 다뤘어요. 필요한 곳에서는 직접 재시도 로직을 감싸 쓰고, 도구 루프 경로에서는 오류가 던져질 것이라고 가정하지 마세요.

- **`LLMMessage`에 `role: 'tool'`은 없어요.** 도구 호출 요청과 결과는 모두 `content` 안의 `tool_use` / `tool_result` 파트로 들어가요. `{ role: 'tool', content: '...' }` 형태로 넣으면 거부돼요.

- **Mistral에서 구조화된 출력과 도구를 함께 쓰는 조합은 프로바이더가 거부해요.** 엔진이 이 상황을 감지하면 도구 호출을 유지하기 위해 `response_format`을 조용히 제외해요. Mistral에서 둘 다 엄격하게 써야 한다면 두 번의 독립된 호출로 나누어 처리해야 해요.

- **토큰 예산 초과에 주의하세요.** 큰 시스템 프롬프트에 긴 대화 기록, JSON Schema 구조화 출력까지 더해지면 모델의 컨텍스트 창을 쉽게 초과할 수 있어요. 대화 도중 컨텍스트 넘침 오류가 발생하지 않도록 개발 중 `dryRun()`으로 실제 조립된 토큰 총량을 미리 확인해 두세요.

- **보조 작업에 플래그십 모델을 낭비하지 마세요.** 서브 에이전트나 분석용 호출은 `connectionName: 'fast'`로 라우팅하세요. 사용자의 프리미엄 모델은 스크립트의 백그라운드 감정 분석이 아니라 집중해서 진행하는 실제 채팅을 위해 아껴 두어야 해요.

## 관련 문서

- **앱 내 레퍼런스, "API Functions → api.llm" 절** — 전체 메서드 시그니처와 권한 태그, 상세 설명.
- **[`concepts/permissions.md`](../concepts/permissions.md)** — `generation` 권한 및 거부 상황 처리.
- **[`concepts/trigger-model.md`](../concepts/trigger-model.md)** — 스크립트가 반응하는 `data` 전역 객체와 샌드박스 경계.
- **[커스텀 매크로](macros.md)** — 프롬프트 조립 파이프라인에 계산된 내용을 주입하는 `api.macros.*`. 내가 작성한 매크로가 프롬프트에 어떻게 반영되는지 `dryRun()`과 함께 점검하기 좋아요.
- **[도구 등록](tools.md)** — Council이나 인라인 함수 호출이 실행할 수 있는 도구를 등록하는 `api.tools.*`. `generateWithTools`와 반대되는 역할(도구 소비자 vs 도구 작성자)이에요.
- **`ls:council-prompt` 내장 라이브러리** — 확장에서 작성한 도구 내부에서 Lumiverse의 Council 사이드카 프롬프트 형태를 재현할 수 있는 헬퍼. 레퍼런스의 "Built-in Libraries" 절 참고.
