# Council이 사용할 수 있는 도구 등록하기 (Register a tool the Council can use)

Lumiverse **Council** 멤버가 텍스트 생성 도중에 호출할 수 있고, 다른 스크립트에서도 직접 호출할 수 있는 `roll_dice` 도구를 게시해 볼게요. 이 과정에서 Council 도구의 가장 중요한 특성을 배우게 돼요: Council은 여러분의 매개변수 스키마를 채워주지 않는다는 점이에요.

## 사용할 기능

- [`api.tools.register`](../guides/tools.md) — 도구 등록; `tools` 권한 필요.
- [`api.llm.generateStructured`](../guides/llm.md#generatestructuredmessages-schema-options--validated-json) — Council 호출 경로에서 *어떤 주사위를 굴릴지* 결정할 때 사용; `generation` 권한 필요.
- `api.variables.local.set` — 다른 스크립트가 참조할 수 있도록 마지막 주사위 결과 저장 (무료 티어). ([저장소 모델](../concepts/storage-model.md))
- 구조화된 결정을 위한 전역 `z` (Zod). ([트리거 모델](../concepts/trigger-model.md))

## 스크립트 코드

```js
// @triggers ls:startup
// Council(및 api.tools.invoke를 통한 모든 스크립트)을 위한 주사위 도구.
// 필요 권한: tools, generation.

// "NdS+M" 표기법 주사위 굴리기. 외부 라이브러리 없는 자체 완결형 함수.
function roll(notation) {
  const m = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i.exec(notation);
  if (!m) throw new Error(`unparseable notation "${notation}" (try "1d20+3")`);
  const count = Number(m[1] || '1');
  const sides = Number(m[2]);
  const mod   = m[3] ? Number(m[3].replace(/\s+/g, '')) : 0;
  if (count < 1 || count > 100 || sides < 2) throw new Error(`out-of-range notation "${notation}"`);
  const dice  = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
  return { notation, dice, mod, total: dice.reduce((a, b) => a + b, 0) + mod };
}

api.tools.register(
  'roll_dice',
  {
    display_name: 'Roll dice',
    description:  'Resolve an uncertain action with a dice roll. Use when the scene calls for a random outcome.',
    council_eligible: true,
    // 이 스키마는 직접 호출 경로(api.tools.invoke + api.llm.generateWithTools)를 위한 계약이에요.
    // Council 경로는 이 스키마를 채워주지 않아요 — 아래 설명 참고.
    parameters: {
      type: 'object',
      properties: { notation: { type: 'string', description: 'Dice notation, e.g. "1d20+3" or "2d6".' } },
      required: ['notation'],
    },
  },
  async (args, api, ctx) => {
    // 1. 주사위 표기법 결정. 두 경로가 여기서 수렴해요.
    let notation = typeof args.notation === 'string' ? args.notation : '';

    // Council 경로: 호스트는 { context, __deadlineMs }만 전달하며, 스키마의 `notation`은 전달하지 않아요
    // (확장 기능 도구에는 스키마를 채워주는 사이드카 LLM이 없음). 따라서 notation이 없지만 장면 컨텍스트가
    // 존재할 때는 우리가 직접 주사위 표기법을 결정해요.
    if (!notation && typeof args.context === 'string') {
      const decision = await api.llm.generateStructured(
        [
          { role: 'system', content: 'You are a tabletop GM. Choose dice notation to resolve the most uncertain action in the scene, or return "" if no roll is warranted.' },
          { role: 'user',   content: args.context },
        ],
        z.object({ notation: z.string().describe('Dice notation like "1d20+3", or "" for no roll.') }),
        { connectionName: 'fast' },
      );
      notation = decision.notation.trim();
    }

    if (!notation) return 'No roll needed.';

    // 2. 주사위 굴리기. 잘못된 표기법은 에러를 던지는 대신 도구 결과 문자열로 반환하여,
    //    Council 심의 창에 빨간색 에러 대신 유용한 안내 메시지가 표시되도록 해요.
    let r;
    try { r = roll(notation); }
    catch (err) { return `Couldn't roll that: ${err.message}`; }

    // 3. 패널이나 다른 스크립트가 읽을 수 있도록 최신 결과를 저장해요.
    await api.variables.local.set('lastDiceRoll', { ...r, at: Date.now() });

    // 4. Council 경로: 호출한 멤버의 목소리로 서술해요. 직접 호출: 단순 텍스트.
    const who = ctx?.councilMember ? `${ctx.councilMember.name} rolls` : 'Rolled';
    const breakdown = (r.dice.length > 1 || r.mod)
      ? ` [${r.dice.join(', ')}${r.mod ? `, ${r.mod > 0 ? '+' : '−'}${Math.abs(r.mod)}` : ''}]`
      : '';
    return `${who} ${r.notation} → **${r.total}**${breakdown}`;
  },
);

console.log('roll_dice registered. Assign it to a Council member, or: api.tools.invoke("roll_dice", { notation: "2d6+1" })');
```

스크립트를 활성화하세요. 그런 다음 Lumiverse Council UI에서 **Roll dice**를 Council 멤버에게 할당하거나(생성 중 확률 성공 시 실행되며 답변에 인라인 삽입됨), 다른 스크립트에서 직접 테스트해 보세요:

```js
console.log(await api.tools.invoke('roll_dice', { notation: '1d20+5' }));
// → "Rolled 1d20+5 → 17 [12, +5]"
```

## 동작 원리

**한 번 등록으로 두 가지 호출 경로 지원.** [`api.tools.register(name, def, handler)`](../guides/tools.md#registername-def-handler-reference)는 도구를 Lumiverse Council(`council_eligible: true` 설정 덕분)과 직접 호출 인터페이스(`api.tools.invoke`, 그리고 `api.llm.generateWithTools` 루프) 모두에 게시해요. 동일한 핸들러가 양쪽 경로를 모두 처리해요.

**핸들러 시그니처는 `(args, api, ctx)`예요.** 클로저의 `api`가 아니라 두 번째 매개변수인 `api`를 사용하세요 — 엔진이 호출 시점의 최신 활성 API 객체를 주입하므로 몇 분 전에 등록된 도구라도 문제없이 동작해요([왜 `api`를 매개변수로 사용하는가](../guides/tools.md#the-handler-signature) 참고). `ctx?.councilMember`는 **오직 Council 경로에서만** 채워지며, `invoke`나 `generateWithTools`에서는 `undefined`예요. 항상 옵셔널 체이닝(`?.`)을 사용하세요.

**핵심적인 미묘함: Council은 여러분의 스키마를 채워주지 않아요.** 많은 분들이 여기서 혼란을 겪어요. 직접 호출 경로에서는 *모델*이 `parameters` 스키마에 맞춰 구조화된 인자를 생성하므로 `args.notation`이 전달돼요. 하지만 **Council** 경로에서는 Lumiverse가 여러분의 도구를 `{ context, __deadlineMs }` — 장면 텍스트와 마감 시한 — 만 가지고 호출하며, `notation`은 전달하지 **않아요**. 확장 기능 도구를 위해 스키마를 채워주는 사이드카 LLM이 없기 때문이에요. 따라서 `args.notation`만 순진하게 기다리는 핸들러는 Council 멤버가 호출했을 때 아무런 일도 하지 못해요. 해결책은 위의 듀얼 모드 분기예요: `args.notation`이 있으면 사용하고, 없으면 `args.context`를 읽어 가벼운 `generateStructured` 호출로 어떤 주사위를 굴릴지 *스스로 결정*하는 것이에요. 이 내부 호출은 사용자의 `'fast'` 프로필로 지정하세요 — 보조 작업이니까요.

**에러 던지기 vs 결과 반환하기.** 문자열을 반환하는 것이 성공 경로예요. 반환된 문자열이 Council에 표시되고 `invoke`의 반환값이 돼요. 반면 예외를 던지면(throw) 스크립트가 에러 상태(빨간색 상태 표시 + 알림)로 표시되고 Council은 실패로 기록해요. 따라서 표기법 오류와 같은 "예상 가능한" 잘못된 입력에 대해서는 예외를 던지지 말고 안내 문자열을 반환하고, 예외 던지기는 진짜 결함에만 쓰세요.

## 내 프로젝트에 맞게 응용하기

- **개발 중 핫 리로드.** 스크립트 상단에 `// @ls:reload-on-edit`를 추가하면 저장 시마다 본문이 다시 실행되어 핸들러가 즉시 재등록돼요(동일 스크립트 재등록은 자동으로 대체됨). 그렇지 않으면 비활성화/활성화 전까지 이전 핸들러가 유지돼요.
- **풍부한 GM 로직 추가.** 실전 주사위 도구라면 난이도(DC), 성공/실패 마진, "불가능한 DC" 자체 보정 루프, `api.db`에 캐릭터별 주사위 이력 저장 등을 결합할 수 있어요.
- **Council 멤버 목소리 입히기.** 서사적 표현이 풍부한 도구의 경우, 단순 문자열 서술 대신 Lumiverse 내장 Council 도구와 똑같은 시스템 프롬프트를 조립해 주는 `ls:council-prompt` 내장 라이브러리를 사용하세요 — `const { buildCouncilMessages } = await script.require('ls:council-prompt')`. [도구 등록 → `ls:council-prompt` 라이브러리](../guides/tools.md#the-lscouncil-prompt-built-in-library) 참고.
- **에이전트 내부에서 활용하기.** 도구로 등록되어 있으므로 [에이전틱 루프](agentic-tool-loop.md)에서 로컬 함수 맵 대신 `await api.tools.invoke(tc.name, tc.args)`로 이 도구를 디스패치할 수 있어요.
- **모든 실행 관찰하기.** `ls:tool:invoked` 브로드캐스트를 구독(`api.broadcast.on('ls:tool:invoked', …)`)하면 양쪽 경로 모두에서 `{ name, args, result, callMs, councilMember? }`를 받아볼 수 있어 도구 모니터링 패널 제작에 유용해요.

## 주의사항

- **Council 호출 ≠ 구조화된 인자.** 위에서 설명했듯 가장 흔한 함정이에요. `args.context` 대체 로직을 구현하지 않으면 Council 멤버에게는 도구가 동작하지 않아요.
- **핸들러는 반드시 문자열을 반환해야 해요.** 객체를 반환하면 볼품없이 문자열 변환돼요. 구조화된 데이터는 직접 `JSON.stringify`를 호출하고 `description`에서 모델에게 형식을 안내하세요.
- **도구 이름은 단일 전역 레지스트리를 공유해요.** 두 스크립트가 동시에 `roll_dice`를 등록할 수 없어요(두 번째 등록은 실패함). 다른 사람과 공유할 스크립트라면 접두사(`mygame_roll_dice`)를 붙이세요.
- **`council_eligible` 기본값은 `false`예요.** Council 선택기에 도구가 나타나지 않는다면 `true` 설정을 빠뜨렸기 때문이에요.
- **자동 정리가 지원돼요.** 스크립트 비활성화/삭제 시 LumiScript가 도구를 알아서 등록 해제해 주므로, 실행 중에 제거할 때만 `api.tools.unregister`를 호출하면 돼요.

## 관련 항목

- [도구 등록](../guides/tools.md) — `api.tools` 전체 인터페이스, Council 컨텍스트 필드, `ls:council-prompt` 헬퍼.
- [에이전틱 도구 루프 만들기](agentic-tool-loop.md) — 소비자 측면: 모델이 이러한 도구를 호출하도록 하는 방법.
- [LLM 호출하기](../guides/llm.md) — `generateStructured` 및 `api.llm` 전체 기능.
