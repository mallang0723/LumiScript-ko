# 호스트 공유 컴포넌트 마운트하기

`api.ui.components.*`는 스위치, 텍스트 입력창, 배지, 스피너 등 Lumiverse의 퍼스트 파티 테마 React 컴포넌트를 내 스크립트가 소유한 컨테이너에 마운트해 줘요. 현재 활성화된 Lumiverse 테마(강조 색상, 글래스 효과, 다크/라이트 모드, 여백 밀도)를 자동으로 상속받으므로, **별도의 CSS를 작성하지 않고도** 완전한 네이티브 외관을 얻을 수 있어요. `app_manipulation` 권한이 필요해요.

> **전체 컴포넌트 카탈로그가 연결되어 있어요 (v1.0.0-rc.9).** 호스트 컴포넌트 16종을 모두 사용할 수 있어요: `mountBadge`, `mountSpinner`, `mountSwitch`, `mountTextInput`, `mountTextArea`, `mountNumericInput`, `mountNumberStepper`, `mountCheckbox`, `mountRangeSlider`, `mountSelect`, `mountMultiSelect`, `mountFolderDropdown`, `mountModelCombobox`, `mountPagination`, `mountCloseButton`, `mountCollapsibleSection`. 각 컴포넌트의 전체 옵션 필드는 **레퍼런스 탭**을 확인하세요. 두 가지 편의 핸들 메서드인 `focus()`/`blur()`(텍스트 입력창), `open()`/`close()`(선택창), 그리고 `refresh()`(모델 콤보박스 수동 모드)는 후속 작업으로 미뤄져 있고 아직 연결되지 않았어요 — 해당 메서드 없이도 컴포넌트의 핵심 기능은 온전히 동작해요(연결에 바인딩된 콤보박스는 모델 목록을 스스로 관리해요).

## 마운트 모델

CSS 선택자와 HTML을 받는 `api.ui.dom.inject`와 달리, 컴포넌트는 **이미 소유하고 있는 컨테이너** 안에 마운트돼요. 먼저 빈 슬롯을 주입한 다음, 그 안에 컴포넌트를 마운트하세요:

```js
const slot   = api.ui.dom.inject('body', '<div></div>');   // DOMHandle 반환 (동기)
const toggle = api.ui.components.mountSwitch(slot, {        // 핸들 반환 (동기)
  checked: true,
  onChange: (on) => console.log('toggled →', on),
});
```

`mountX(target, options?)`는 핸들을 **동기적으로** 반환해요(실제 마운트 명령은 `inject`와 마찬가지로 비동기로 전송돼요). 여기서 `target`은 앞서 주입한 `DOMHandle`이에요.

모든 컴포넌트 핸들은 다음 메서드를 제공해요:

- `update(patch)` — 마운트 옵션의 일부를 실시간 컴포넌트에 병합 반영해요. 실행 후 잊기(fire-and-forget) 방식이에요.
- `destroy()` — 마운트를 해제하고 리소스를 정리해요. 멱등성을 지원하며, 컨테이너 자체는 그대로 남아요.

상호작용이 가능한 컴포넌트(`mountSwitch`, `mountTextInput` 등)는 추가로 다음 메서드를 지원해요:

- `getValue()` — 현재 값을 읽어와요. **`Promise`를 반환해요** (아래 설명 참고).

## 호스트 API와 다른 두 가지 주의점

1. **여기서의 `getValue()`는 비동기예요.** 호스트 네이티브 환경의 `getValue()`는 동기식이지만, LumiScript의 워커 프로세스 경계를 넘어 실시간 값을 읽어오려면 프런트엔드와의 통신 왕복이 필요해요. 따라서 `Promise<T>`를 반환해요(`DOMHandle.read()`가 비동기인 것과 같은 이유예요). 상태를 스크립트 변수에 일일이 미러링해 둘 필요 없이 호스트가 값을 보유하고 있어요.

   ```js
   const input = api.ui.components.mountTextInput(slot, { placeholder: 'Name…' });
   // …나중에, 예: 버튼 클릭 핸들러 내부에서:
   const text = await input.getValue();
   ```

2. **마운트 대상은 일반 선택자가 아니라 `DOMHandle`이어야 해요.** 이를 통해 컴포넌트가 스크립트가 직접 소유한 DOM 영역 안에만 마운트되도록 안전하게 제한해요(일반 선택자를 허용하면 호스트의 내부 UI를 침범할 수 있어요). 슬롯을 주입하고, 그 슬롯 핸들에 마운트하세요.

## 스크립트로 전달되는 콜백

옵션 콜백(`onChange` 등)은 프런트엔드가 아니라 내 스크립트의 샌드박스 안에서 실행돼요. 사용자가 컴포넌트를 조작하면 변경된 새 값과 함께 콜백이 호출돼요:

```js
const sw = api.ui.components.mountSwitch(slot, {
  checked: false,
  onChange: async (on) => {
    // 스크립트 안에서 실행돼요. await 가능 — 호스트가 실행을 유지해 줘요.
    await api.variables.global.set('featureEnabled', on);
  },
});
```

프런트엔드 → 백엔드 → 샌드박스로 값이 전달되는 약간의 지연 시간이 있으므로, 콜백은 사실상 비동기로 동작해요. 콜백 함수를 `async`로 작성하고 내부의 모든 비동기 작업을 `await`해 주세요. 호스트는 await 체인이 이어지는 동안 해당 실행(run)을 계속 유지해 줘요(비동기 작업을 await하지 않는 동기식 콜백을 쓰면 실행이 이미 종료된 뒤에 `api.*` 호출이 도달해 무시될 수 있어요).

## 수명 주기

- `destroy()`는 개별 컴포넌트의 마운트를 해제하고 등록된 콜백을 정리해요.
- 스크립트가 **비활성화되거나 다시 불러와질 때**, 마운트했던 모든 컴포넌트가 자동으로 파괴돼요(호스트가 컨테이너를 제거하고 React 트리를 해제해요). 직접 정리 과정을 추적할 필요가 없어요.
- 실행할 때마다 매번 새로운 슬롯을 주입해 마운트하는 스크립트를 반복 실행하면 컴포넌트가 누적될 수 있어요. 다시 실행될 수 있는 스크립트라면 고정된 주입 슬롯을 사용하거나 이전 핸들의 `destroy()`를 먼저 호출해 주세요.

## 카탈로그 맛보기

```js
// Badge — 인라인 상태/라벨
const badge = api.ui.components.mountBadge(slot, { text: 'Beta', color: 'warning', size: 'pill' });
badge.update({ text: 'Ready', color: 'success' });

// Switch — 불리언 토글 (onChange + 비동기 getValue)
const sw = api.ui.components.mountSwitch(slot, { checked: true, onChange: (on) => {/* … */} });
const isOn = await sw.getValue();

// Range slider — 두 가지 콜백: 실시간 드래그 + 확정된 값
const opacity = api.ui.components.mountRangeSlider(slot, {
  min: 0, max: 100, value: 35, label: 'Opacity', format: { suffix: '%' },
  onDragValue: (v) => {/* 실시간 미리보기 */},
  onCommit:    (v) => {/* 값 저장 */},
});

// Select — 검색 가능한 단일 선택
const tone = api.ui.components.mountSelect(slot, {
  options: [{ value: 'casual', label: 'Casual' }, { value: 'formal', label: 'Formal' }],
  onChange: (v) => {/* … */},
});

// Model combobox — 연결 바인딩 (호스트가 모델 목록 자동 관리)
api.ui.components.mountModelCombobox(slot, { connection: { kind: 'llm' }, onChange: (m) => {/* … */} });
```

각 컴포넌트의 전체 옵션 필드와 핸들 인터페이스는 **레퍼런스 탭**을 참고하세요.

## 접을 수 있는 섹션 — 본문 슬롯 패턴

`mountCollapsibleSection`은 다른 컴포넌트와 작동 방식이 조금 달라요. 호스트는 **헤더 크롬**(제목, 펼침 화살표, 배지)을 렌더링하고, 스크립트에는 채워 넣을 수 있는 **`body` 요소**를 돌려줘요. 핸들의 `.body`는 일반적인 {@link DOMHandle}이므로, 직접 주입한 요소와 똑같은 방식으로 자식 요소를 주입하고 이벤트를 연결할 수 있어요:

```js
const slot    = api.ui.dom.inject('body', '<div></div>');
const section = api.ui.components.mountCollapsibleSection(slot, {
  title: 'Advanced',
  badge: '3',
  defaultExpanded: false,
  onToggle: (open) => console.log('section is now', open ? 'open' : 'closed'),
});

// 본문 채우기 — DOMHandle이므로 inject/update/on 모두 동작해요
section.body.update('<p>Body content owned by your script.</p>');
const btn = section.body.injectChild('p', '<button data-act="go">Go</button>', { position: 'afterend' });
btn.on('click', (ev) => { if (ev.target?.dataset?.act === 'go') doThing(); });

// 명령형 제어
section.expand();
section.collapse();
section.toggle();
const open = await section.isExpanded();   // 비동기 — 프런트엔드 왕복 필요
```

`title`은 필수 옵션이에요(`mountCollapsibleSection(slot, { title })`처럼 필수 인수로 전달해야 해요). `expand`/`collapse`/`toggle`은 실행 후 잊기 방식이며, `isExpanded()`는 `getValue()`처럼 비동기 메서드예요.
