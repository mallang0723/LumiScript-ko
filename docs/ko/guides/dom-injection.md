# DOM 주입

`api.ui.dom.*`는 LumiScript 스크립트가 Lumiverse 앱 셸 화면에 직접 UI 요소를 배치할 수 있게 해 주는 기능이에요. 메시지 옆의 버튼, 사이드 패널, 플로팅 위젯, 테마가 적용된 배너, 드래그 앤 드롭 오버레이 등을 만들 수 있어요. LumiScript를 단순한 백그라운드 자동화 도구가 아니라 Lumiverse의 완전한 일부처럼 느껴지게 만들 때 가장 유용한 도구예요.

`api.ui.dom.*`의 모든 메서드는 `app_manipulation` 권한이 필요해요. 모든 메서드가 시작 시점에 권한을 확인하며, 권한이 부여되지 않은 경우 `Error: PERMISSION_DENIED:app_manipulation — grant this permission to use this API` 오류가 발생해요(권한 시스템 전반에 대한 내용은 [`concepts/permissions.md`](../concepts/permissions.md)를 참고하세요).

이 API는 일반적인 DOM 조작 방식과 형태가 유사하지만 IPC 경계를 거치도록 설계되었어요. 스크립트는 Bun 하위 프로세스에서 실행되고 DOM은 사용자의 브라우저 화면에 존재하므로, `DOMHandle`이라는 작은 참조 객체를 통해 그 경계를 넘어 요소를 제어해요.

## 첫 번째 주입 스크립트 작성하기

스크립트를 `MESSAGE_SENT` 이벤트에 연결하고 아래 코드를 붙여 넣은 뒤 저장해 보세요:

```js
const banner = api.ui.dom.inject(
  '#chat-container',
  '<div class="ls-demo">Hello from LumiScript</div>',
  { position: 'beforebegin' },
);

api.ui.dom.addStyle(`
  .ls-demo {
    background: var(--lumiverse-accent, rgb(147, 112, 219));
    color: var(--lumiverse-accent-fg, #fff);
    padding: 6px 10px;
    border-radius: var(--lumiverse-radius, 6px);
    font-size: 13px;
  }
`);

// 3초 후 배너 제거
setTimeout(() => banner.remove(), 3000);
```

메시지를 보내면 채팅 컨테이너 위에 보라색 배너가 나타났다가 3초 후에 사라져요.

작업을 수행하는 세 가지 기본 요소:

- **`api.ui.dom.inject(target, html, opts?)`** — CSS 선택자와 일치하는 요소를 찾아 상대적 위치에 HTML을 주입해요.
- **`api.ui.dom.addStyle(css, opts?)`** — 내 스크립트 범위로 한정된 `<style>` 요소를 추가하여 다른 스크립트와 스타일이 겹치지 않게 해요.
- **`handle.remove()`** — 작업이 끝난 요소를 화면에서 정리해요.

이 가이드의 다른 모든 기능은 이 세 가지 기본 요소를 바탕으로 확장된 것이에요.

## 페이지 내 요소 타겟팅

기준 위치를 어디에 잡느냐에 따라 HTML을 배치하는 세 가지 방법이 있어요.

### `inject(target, html, opts?)` — 임의의 CSS 선택자 기준

```js
const sidebar = api.ui.dom.inject(
  'body',
  '<aside class="ls-sidebar">...</aside>',
  { position: 'beforeend', id: 'sidebar' },
);
```

`target`은 임의의 CSS 선택자예요. `opts.position`은 [`insertAdjacentHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML)과 동일하게 `'beforebegin'`, `'afterbegin'`, `'beforeend'`, `'afterend'`의 4가지 위치를 받아요. 기본값은 `'beforeend'`예요.

`opts.id`는 **고유 식별자(ID)**예요: 동일한 `opts.id`로 `inject`를 다시 호출하면 기존 리스너를 정리하고 내부 HTML을 제자리에서 업데이트하며 *동일한* 핸들을 반환해요. 스크립트가 실행될 때마다 기존 요소를 새로 고쳐야 할 때 유용해요(아래 [멱등성을 갖춘 재주입](#idempotent-re-injection) 참고).

### `injectAtMessage(messageId, html, opts?)` — 채팅 메시지 기준

```js
const footer = api.ui.dom.injectAtMessage(
  data.message.id,
  '<div class="ls-msg-footer">word count: 42</div>',
  { position: 'footer', id: 'word-count' },
);
```

여기서 `position`은 채팅 메시지 전용 위치인 `'header'` 또는 `'footer'`예요. `id`(`DOMMessageInjectOptions`의 필드 이름)는 멱등성 키로 사용되며, 중복 제거는 스크립트별-ID별로 이루어져요.

**주의해야 할 함정.** ID 키는 `(scriptId, id)` 조합*만*으로 결정되며, `messageId`는 키에 **포함되지 않아요**. 만약 `injectAtMessage(msgA, html, { id: 'foo' })`를 호출한 뒤 나중에 `injectAtMessage(msgB, html2, { id: 'foo' })`를 호출하면, 두 번째 호출은 `msgA`에 붙은 요소를 업데이트하고 `msgB`는 무시해 버려요. 메시지별로 요소를 붙일 때는 반드시 메시지 ID를 포함한 네임스페이스를 지정하세요:

```js
{ id: `footer-${data.message.id}` }
```

### `injectChild(target, html, opts?)` — 기존 핸들의 하위 요소 기준

부모 컨테이너(서랍 탭, 모달 본문, 플로팅 위젯 등)가 마운트된 후에만 하위 요소가 존재하는 경우, `document.querySelector` 대신 부모 핸들을 통해 자식에 접근하세요:

```js
const panel = api.ui.dom.inject('body', `
  <div class="ls-panel">
    <header class="title-bar">Stats</header>
    <div data-grid></div>
  </div>
`, { id: 'stats-panel' });

// 패널을 기준으로 자식 요소를 찾으므로, 패널이 방금 마운트되었더라도 바로 동작해요
const grid = panel.injectChild('[data-grid]', '<table>...</table>', { id: 'grid' });

// 헤더는 그대로 두고 그리드만 업데이트:
grid.update('<table>... refreshed ...</table>');
```

`injectChild`는 호스트의 요소 맵을 통해 선택자를 조회하므로, 부모 요소가 아직 브라우저의 전역 `document.querySelector`에 반영되지 않은 상태에서도 안전하게 동작해요. 반환된 핸들은 일반적인 `DOMHandle`이므로 `update`, `remove`, `on` 등을 모두 쓸 수 있어요.

## 핸들 수명 주기

모든 주입 메서드는 `DOMHandle`을 반환해요:

| 메서드 | 설명 |
|---|---|
| `handle.id` | 읽기 전용 문자열 — 내부 요소 ID. |
| `handle.update(html)` | 요소의 `innerHTML`을 교체해요. `handle.on(...)`으로 등록한 리스너는 업데이트 후에도 유지돼요. |
| `handle.remove()` | 요소를 제거하고 연결된 모든 리스너를 해제해요. 멱등성을 지원해요. |
| `handle.on(event, handler, opts?)` | DOM 이벤트 리스너를 등록해요. 구독 해제 함수를 반환해요. |
| `handle.makeDraggable(handleSelector?)` | 요소를 마우스로 드래그할 수 있게 만들어요. [드래그](#drag) 참고. |
| `handle.injectChild(target, html, opts?)` | 하위 요소 범위의 주입 (위 설명 참고). |
| `handle.read(opts?)` | 비동기 — 프런트엔드에서 요소의 현재 상태 스냅샷을 읽어와요. |

`read`(프런트엔드 왕복 응답을 대기함)를 제외한 모든 메서드는 IPC 경계를 넘어 실행 후 잊기(fire-and-forget) 방식으로 동작해요.

<a id="idempotent-re-injection"></a>

### 멱등성을 갖춘 재주입

동일한 ID가 중요한 두 가지 패턴:

**`opts.id`를 지정한 `inject`** — 기존 리스너가 지워지고 HTML이 제자리에서 갱신되며 동일한 핸들이 반환돼요. 요소 노드 자체가 교체되는 것이 아니라 내부 HTML만 갱신돼요.

**`opts.id`를 지정한 `addStyle`** — 기존 스타일시트가 *제거되고* 새 스타일시트가 주입돼요. 제자리 갱신이 아니라 ID 기반 교체예요. 개발 중 코드를 수정하며 테스트할 때 매우 유용해요:

```js
// 실행할 때마다 최신 CSS로 교체 — 이전 실행의 좀비 스타일시트가 남지 않아요
api.ui.dom.addStyle(myCss, { id: 'styles' });
```

`opts.id`를 생략하면 매번 새로운 `<style>` 태그가 추가돼요. 스타일을 계층적으로 쌓고 싶을 때는 적합하지만 무심코 쓰면 불필요한 스타일이 계속 누적될 수 있어요.

**`inject()` HTML 안에 인라인 `<style>` 태그를 넣을 때의 주의점.** ID 기반 중복 제거 경로는 내부 IPC(`dom_update`)를 사용해 **래퍼의 `innerHTML`을 제자리에서 교체**해요. 브라우저는 이렇게 추가된 `<style>` 태그를 활성 스타일시트 목록에 안정적으로 재반영하지 못할 때가 있어요(태그는 DOM에 있지만 CSS 규칙은 적용되지 않는 현상). 그 결과 첫 번째 실행에서는 스타일이 잘 먹히다가 두 번째 실행부터는 인라인 `<style>`의 모든 규칙이 조용히 사라질 수 있어요. 스크립트 자체 UI의 스타일이 사라지고, 호스트를 겨냥한 규칙(`button[aria-label="..."]` 등)도 더는 적용되지 않아서 스크립트가 고장 난 것처럼 보여요.

따라서 **인라인 `<style>` 블록**을 사용하면서 **반복 실행되는 트리거**(`ls:startup` + `CHAT_SWITCHED` + 수동 실행 버튼)를 가진 스크립트라면 `opts.id` 기반 중복 제거에 의존하지 마세요. 대신 본문 최상단에서 `api.ui.dom.cleanup()`을 먼저 호출하는 패턴을 쓰세요:

```js
// @triggers ls:startup, CHAT_SWITCHED
api.ui.dom.cleanup();   // 이 스크립트가 주입한 이전의 모든 요소와 스타일을 지워요

api.ui.dom.inject('body', `
  <style>${STYLES}</style>
  <label class="my-toggle">…</label>
`, { position: 'beforeend' });
// id 없음 — 명시적으로 cleanup하므로 중복 제거가 필요 없고,
// dom_update로 인한 인라인 스타일 무효화 문제도 피할 수 있어요. 매번 새로 주입돼요.
```

`cleanup()`은 오직 **현재 스크립트**가 주입한 요소와 스타일, 이벤트 위임만 제거하며 다른 스크립트는 건드리지 않아요. 정리 후 다시 주입되는 사이의 미세한 깜빡임(길어야 한 프레임)은 일반적인 `ls:startup` / `CHAT_SWITCHED` 주기에서는 눈에 띄지 않아요. 단, `STREAM_TOKEN_RECEIVED`처럼 빈도가 매우 높은 이벤트에서는 이 패턴을 쓰지 마세요. 그런 경우에는 인라인 태그 대신 일반 `addStyle`을 사용하고, 스크립트 범위 제한을 받아들이며 호스트 요소에 닿는 다른 방법을 찾으세요.

## 이벤트 처리

DOM 이벤트를 처리하는 두 가지 방법이 있어요. 동작 방식과 목적이 서로 달라요.

### `handle.on(event, handler, opts?)` — 해당 요소 범위의 이벤트

가장 일상적으로 사용하는 방식이에요. 주입된 요소에 `addEventListener`를 등록해요. 핸들러는 직렬화된 `DOMEventData`를 받아요:

```ts
{
  type: string;                                // 'click', 'input', 'keydown' 등
  targetId?: string;                           // event.target.id
  targetValue?: string;                        // 폼 요소의 값
  targetChecked?: boolean;                     // 폼 요소의 체크 상태
  dataset?: Record<string, string>;            // event.target.dataset
  detail?: unknown;                            // CustomEvent.detail (JSON 직렬화 가능 값)
  clientX?: number;                            // 포인터 위치
  clientY?: number;
  key?: string;                                // KeyboardEvent.key
  code?: string;                               // KeyboardEvent.code
}
```

**가장 중요한 동작 방식.** 핸들러는 `event.target.dataset`을 **직접** 읽으며, `closest()`를 써서 DOM 트리를 거슬러 올라가지 **않아요**. 버튼 안에 중첩된 SVG 아이콘이나 `<img>`, 스타일용 `<span>`이 들어 있을 때 이 점을 꼭 기억해야 해요:

```js
const panel = api.ui.dom.inject('body', `
  <div class="ls-panel">
    <button data-action="refresh">
      <svg><!-- icon --></svg> Refresh
    </button>
    <button data-action="close">×</button>
  </div>
`);

panel.on('click', (ev) => {
  if (ev.dataset?.action === 'refresh') reload();
  if (ev.dataset?.action === 'close')   panel.remove();
});
```

사용자가 아이콘의 한가운데를 클릭하면 `event.target`은 내부의 `<svg>`가 돼요. `<svg>`에는 `data-action` 속성이 없으므로 `ev.dataset`은 비어 있게 되고 조건문은 무시돼요. 버튼의 빈 여백을 누르면 동작하지만 아이콘을 누르면 동작하지 않는 현상이 생겨요.

**해결 방법**: 버튼 내부의 장식용 콘텐츠에 마우스 이벤트가 투과되도록 CSS를 설정하세요.

```css
.ls-panel button > svg,
.ls-panel button > img,
.ls-panel button > span.icon { pointer-events: none; }
```

이제 클릭이 내부 장식 요소를 통과해 `data-action`을 가진 `<button>` 자체에 도달하므로 정상 작동해요. 아이콘 버튼을 만들 때는 내부 장식 요소에 `pointer-events: none`을 부여하는 것을 기본 규칙으로 삼으세요.

### `api.ui.dom.delegate(selector, event, handler, opts?)` — 문서 전체 대상 위임

여러 메시지에 분산 주입된 요소들의 클릭을 하나의 리스너로 처리하고 싶거나, 내가 주입한 요소가 아니라 호스트가 렌더링한 요소를 대상으로 삼을 때 사용하세요:

```js
api.ui.dom.delegate(
  '[data-msg-action]',
  'click',
  (ev) => {
    console.log('matched:', ev.matched.tagName, ev.matched.dataset.msgAction);
    console.log('in message:', ev.message?.id);
  },
  { root: 'chat' },
);
```

`opts.root`는 `'chat'`(추적 중인 채팅 메시지 내부에서만 발생) 또는 `'document'`(페이지 전체)예요. 전달되는 데이터는 더 풍부한 `DOMDelegatedEventData`예요:

- `matched` — 일치한 요소의 스냅샷 정보 (`tagName`, `id`, `classList`, `dataset`, `attributes`, `textContent` 및 관련 폼 필드).
- `modifiers` — 키보드/마우스 수식어 상태 `{ ctrl, shift, alt, meta, button? }`.
- `message` (채팅 루트인 경우) — `{ id, role, swipeId }`.

이 위임 방식은 `event.target`의 조상 요소를 찾기 위해 `closest()`를 **사용해요**. 따라서 내부 장식 요소를 클릭하더라도 일치하는 상위 요소를 잘 찾아내요(`handle.on`과 반대예요). 문서 전체를 대상으로 넓은 범위를 감시하는 대신 선택자 매칭 편의성을 제공받는 구조예요.

### `preventDefault` 및 `stopPropagation` 사전 등록

핸들러는 IPC 경계를 넘어 비동기적으로 실행되므로, 스크립트 코드가 실행될 때는 이미 브라우저의 기본 동작을 막기에는 너무 늦어요. 따라서 기본 동작을 막으려면 리스너 등록 시점에 미리 의도를 선언해야 해요:

```js
input.on('keydown', (ev) => {
  if (ev.key === 'Enter') submit();
}, { preventDefault: { onKeys: ['Enter'] } });
```

`preventDefault`는 `true`(항상 방지) 또는 조건부 객체(`{ onKeys?, onCodes?, onButtons?, whenModifiers?: { require?, exclude? } }`)를 받아요. 프런트엔드가 핸들러로 이벤트를 전달하기 전에 네이티브 이벤트를 검사하여 동기적으로 기본 동작을 억제해요.

`api.ui.dom.delegate`도 동일한 `preventDefault` 옵션과 `stopPropagation: boolean` 플래그를 지원해요.

## 스타일링

```js
api.ui.dom.addStyle(`
  .ls-mystuff {
    background: var(--lumiverse-fill);
    color: var(--lumiverse-text);
    border: 1px solid var(--lumiverse-border);
    border-radius: var(--lumiverse-radius);
    transition: background var(--lumiverse-transition-fast);
  }
  .ls-mystuff:hover {
    background: var(--lumiverse-fill-hover);
  }
`);
```

스타일을 작성할 때 알아두어야 할 두 가지:

**테마 토큰으로 `--lumiverse-*` CSS 변수를 사용하세요.** 사용자의 현재 테마(다크/라이트 모드, 강조 색상, 글래스 강도, 글꼴 크기 등)를 자연스럽게 따라가요. 하드코딩된 색상을 쓰면 사용자가 테마를 바꿨을 때 이질감이 들 수 있어요.

**스타일시트는 CSS `@scope`를 통해 *스크립트별로 격리*돼요.** Lumiverse는 전달된 CSS를 `@scope ([data-ls-script="<id>"]) { ... }`로 감싸므로, 내가 작성한 규칙은 내 스크립트가 주입한 요소에만 적용돼요. 서로 다른 두 스크립트가 둘 다 `.ls-card` 클래스를 정의해도 충돌하지 않아요.

**포털 모달에서의 주의점.** `createPortal(x, document.body)`로 렌더링되는 요소(대부분의 모달)는 `--lumiverse-*` 변수가 채워진 호스트 스코프의 바깥쪽에 위치하게 돼요. 이 경우 변수들이 `unset` 상태가 되어 강조 색상 버튼 등이 투명하게 보일 수 있어요. 포털 모달용 CSS에서는 `--lumiverse-*` 변수에 항상 RGB 대체값(fallback)을 함께 적어 주세요. 표준 보라색 강조 색상은 `rgb(147, 112, 219)`예요:

```css
.my-modal-btn {
  background: var(--lumiverse-accent, rgb(147, 112, 219));
  color:      var(--lumiverse-accent-fg, #fff);
}
```

### 호스트 UI 스타일링 — `@scope` 격리 벗어나기

`@scope` 격리는 스크립트 간의 충돌을 막아 주는 좋은 기능이지만, 반대로 **`addStyle` 규칙이 호스트 요소에는 닿을 수 없다**는 뜻이기도 해요. 채팅 입력창, 메시지 말풍선, 툴바 버튼, `<body>` 등은 내 스크립트의 `[data-ls-script="<id>"]` 하위에 있지 않으므로 `addStyle` 규칙이 적용되지 않아요.

호스트 UI를 스타일링(버튼 숨기기, 위치 조정, Lumiverse 컨트롤 리스킨 등)해야 한다면 `inject()` 호출 안에 인라인 `<style>` 블록을 함께 넣어 주입하세요:

```js
const STYLES = `
  /* 이 규칙들은 전역으로 적용돼요 — [data-ls-script] 내부뿐만 아니라
     일치하는 모든 곳에 적용돼요. */
  button[aria-label="Attach file"] { display: none; }
  body:has(.my-toggle:checked) [class*="_actionBar_"] { display: none; }

  /* 스크립트 자체 버튼의 스타일도 여기에 함께 둘 수 있어요. */
  .my-toggle {
    display: inline-flex;
    align-items: center;
    color: var(--lumiverse-text, #ccc);
  }
`;

api.ui.dom.inject('body', `
  <style>${STYLES}</style>
  <label class="my-toggle">…</label>
`, { position: 'beforeend' });
```

작동 원리: `<style>` 요소 내부의 CSS 규칙은 DOM의 어느 위치에 있든 문서 전체에 전역으로 적용돼요. 호스트의 `@scope` 래핑은 오직 `addStyle` 페이로드에만 적용되므로, `inject()`를 통해 들어간 인라인 `<style>`은 이 제한을 우회해요. 래퍼 컨테이너(`<div data-ls-script="<id>">`)에는 여전히 정리 추적 정보가 붙어 있으므로, 스크립트가 비활성화되면 래퍼가 지워지면서 인라인 `<style>`도 함께 제거되어 호스트 UI가 원래대로 복구돼요. 수명 주기는 `addStyle`과 같지만 적용 범위가 전역으로 확장되는 것이에요.

**이 패턴을 `opts.id` 기반 중복 제거와 함께 쓰지 마세요.** 위의 [멱등성을 갖춘 재주입](#idempotent-re-injection) 주의사항에서 설명했듯 스타일이 무효화될 수 있어요.

<a id="drag"></a>

## 드래그

```js
const panel = api.ui.dom.inject('body', `
  <div class="ls-floating">
    <header class="title-bar">Drag me</header>
    <div class="body">...</div>
  </div>
`);

panel.makeDraggable('.title-bar');
```

`handleSelector`는 선택 사항이에요. 전달하면 해당 자식 요소를 잡았을 때만 드래그가 시작되고 루트 요소 전체가 이동해요. 생략하면 요소 전체가 드래그 핸들이자 이동 대상이 돼요.

드래그는 프런트엔드에서만 처리돼요 — 이동된 새 위치가 자동으로 저장되지 **않으며**, `DOMHandle`은 사용자 리스너용 `'dragend'` 이벤트를 노출하지 않아요. `makeDraggable`은 내부적인 포인터 리스너로 동작하며 스크립트 핸들러에 드래그 완료 이벤트를 전달하지 않아요. 만약 드래그 후 위치 저장이 필요한 UI라면 다음 세 가지 방법을 고려하세요:

- **내장 `floatingButton` 사용** — `script.require('ls:components').floatingButton(...)`은 위치를 `api.scriptStorage`에 자동으로 저장해 줘요. 가장 간편한 방법이에요.
- **`DOMHandle` 드래그 대신 `api.ui.createFloatWidget(...)` 사용** — `FloatWidgetHandle`은 위치 변경 이벤트를 명시적으로 받을 수 있는 `onDragEnd(handler)`를 제공해요.
- **주입 시점에 scriptStorage에서 위치를 동기화** — 실행될 때마다 저장된 좌표를 기반으로 다시 주입하는 방식이에요. 투박하지만 한 번 정해 두는 고정 위치에는 충분히 동작해요.

대부분의 드래그 요구 사항에는 내장된 `floatingButton`이 가장 좋은 해결책이에요.

## 요소 상태 읽어오기

`handle.read()`는 `DOMHandle`의 유일한 비동기 메서드예요:

```js
const snapshot = await panel.read();
if (snapshot) {
  console.log(snapshot.tag);          // 'div'
  console.log(snapshot.attrs);        // { class: 'ls-panel', ... }
  console.log(snapshot.text);         // 텍스트 내용 전체
  console.log(snapshot.childCount);   // 직계 자식 요소 개수
}
```

`{ html: true }`를 전달하면 현재 `innerHTML`도 스냅샷에 포함돼요. 하위 마크업을 자세히 살펴봐야 할 때 유용하며, 기본적으로는 IPC 데이터 크기를 줄이기 위해 속성과 텍스트 위주로 반환해요.

요소가 더 이상 존재하지 않으면(핸들이 삭제되었거나 부모가 정리된 경우) `null`을 반환해요. 주입한 요소가 화면에 잘 살아 있는지 확인하는 폴링 코드에서 쓰기 좋아요.

## 권한과 데이터 정제(Sanitization)

### `app_manipulation`이 네임스페이스 전체를 제어해요

모든 `api.ui.dom.*` 메서드와 `DOMHandle` 메서드(`update`, `remove`, `on`, `makeDraggable`, `injectChild`, `read`)는 실행 전 `app_manipulation` 권한을 검사해요. 권한이 허용되지 않았다면 동기적으로 오류가 발생해요:

```js
try {
  api.ui.dom.inject('body', '...');
} catch (err) {
  if (String(err.message).startsWith('PERMISSION_DENIED:app_manipulation')) {
    // 권한이 없어도 UI만 표시하지 않고 스크립트 핵심 로직은 동작하도록 처리
    return;
  }
  throw err;
}
```

`PERMISSION_DENIED:<name>` 접두사는 고정된 규격이므로 패턴 매칭으로 확인할 수 있어요. 자세한 권한 처리 방식은 [`concepts/permissions.md`](../concepts/permissions.md)를 참고하세요.

### DOMPurify가 모든 주입 HTML을 정제해요

`inject`, `injectAtMessage`, `update`, `injectChild`로 전달되는 모든 HTML 문자열은 화면에 삽입되기 전 프런트엔드에서 DOMPurify 검사를 거쳐요. 호스트의 금지 태그 규칙에 따라 다음 태그들은 완전히 제거돼요:

- `<iframe>`, `<frame>`, `<object>`, `<embed>`, `<form>` — 보안 문제를 일으킬 수 있는 프레임 및 폼 전송 요소들.

이 태그들은 DOMPurify, 페이지의 엄격한 CSP 설정(`frame-src 'none'; child-src 'none'; object-src 'none'`), 서버의 `X-Frame-Options: DENY`라는 **3중 방어막**에 의해 차단되며 예외 처리는 불가능해요. 외부 임베드와 유사한 경험이 필요하다면 iframe 대신 LumiScript의 네이티브 서피스(`api.ui.showAdvancedModal`, 서랍 탭, 플로팅 위젯 등)를 활용하세요.

또한 DOMPurify의 기본 동작에 따라 인라인 `on*` 이벤트 핸들러 속성(`onclick`, `onerror`, `onload`, `onsubmit` 등)과 `formaction` 속성도 모두 제거돼요. 따라서 **다음과 같은 코드는 동작하지 않아요**:

```html
<!-- onclick 속성이 제거되므로 버튼은 렌더링되지만 클릭해도 반응이 없어요 -->
<button onclick="alert('hi')">Click</button>
```

대신 `handle.on('click', fn)`을 쓰고 트리거 요소에 `data-*` 속성을 붙여 구분하세요:

```js
panel.update('<button data-action="hello">Click</button>');
panel.on('click', (ev) => {
  if (ev.dataset?.action === 'hello') alert('hi');
});
```

`javascript:` URL과 `srcdoc` 속성도 동일한 이유로 제거돼요.

## 흔한 실수

**`injectAtMessage`의 ID는 messageId 전반에 걸쳐 공유돼요** — 위에서 설명했듯 ID 옵션에 항상 메시지 ID를 포함(`'footer-' + messageId`)하세요. (흔한 실수: 옵션을 `id`가 아니라 `stableId`로 전달하는 경우 — `DOMMessageInjectOptions`의 필드 이름은 `id`이며, `stableId`는 조용히 무시돼요.)

**CSS는 JS 코드와 함께 번들링돼요** — `addStyle`로 추가한 스타일시트는 스크립트 소스의 일부예요. 소스를 편집하고 저장하더라도 활성 스타일시트가 저절로 갱신되지는 않아요. CSS 변경 사항을 반영하려면 스크립트 본문이 다시 실행되어야 해요. 개발 중에는 `opts.id`를 지정해 재실행 시 덮어쓰도록 하거나, 확장을 껐다 켜서 전체 리로드를 수행하세요.

**독립된 두 개의 React 루트 — 공유 상태 없음.** LumiScript 패널(독)과 설정 패널은 부모 React 컴포넌트를 공유하지 않는 두 개의 독립된 `createRoot` 트리로 마운트돼요. 양쪽을 모두 다루는 스크립트(예: 스크립트 목록 액션에서 설정 화면의 모달을 띄우는 등)를 작성할 때는 React props 대신 `window`의 CustomEvent 버스를 통해 상태를 주고받으세요.

**스크립트가 비활성화될 때 등록된 요소는 자동 정리돼요.** 사용자가 스크립트를 끄거나 삭제하면 LumiScript가 레지스트리를 검사하여 주입된 모든 DOM 요소, 리스너, 스타일시트, 위임 핸들러, 드래그 핸들을 자동으로 제거해요. `api.ui.dom.cleanup()`은 중간에 상태를 청소하기 위한 탈출구일 뿐, 스크립트 종료 시 수동으로 호출해야 하는 필수 항목은 아니에요. (핸들러 정리 전반에 대해서는 [`concepts/handler-lifetime.md`](../concepts/handler-lifetime.md)를 참고하세요.)

**`handle.on`에서 `closest()`를 기대하지 마세요** — `closest()`는 `api.ui.dom.delegate`의 방식이에요. `handle.on`은 클릭된 `event.target.dataset`을 곧바로 읽으므로, 버튼 안의 내부 장식 요소에는 `pointer-events: none` 스타일을 지정하세요.

## 관련 문서

- **앱 내 레퍼런스, "API Functions → api.ui.dom" 절** — 전체 메서드 시그니처와 권한 태그, 메서드별 상세 설명. 이 API 표면의 기준 문서예요.
- **`script.require('ls:components')`** — `api.ui.dom.*`을 기반으로 만들어진 고수준 위젯 라이브러리(`messageFooter`, `messageHeader`, `progressBar`, 위치 저장이 지원되는 `floatingButton`, `multiSelect` 모달 등). 레퍼런스의 "Built-in Libraries" 절 참고.
- **[`concepts/trigger-model.md`](../concepts/trigger-model.md)** — 스크립트 본문이 핸들러로 동작하는 원리, `data` 구조, 샌드박스 경계.
- **[`concepts/handler-lifetime.md`](../concepts/handler-lifetime.md)** — DOM 주입 요소 및 리스너의 정리 시점과 워커 퇴출-고정 시스템 간의 상호작용.
- **[`concepts/permissions.md`](../concepts/permissions.md)** — `app_manipulation` 권한 및 거부 상황 처리.
