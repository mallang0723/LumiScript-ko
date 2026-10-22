# 드래그 가능한 정보 패널 만들기 (Build a draggable info panel)

채팅창 위에 작게 떠 있는 플로팅 패널을 띄우고, 제목 표시줄을 잡고 드래그하여 이동하며, 새로고침하고 닫을 수 있는 UI를 제작해 볼게요 — 스크립트가 소유하는 상시 표시 HUD, 상태 표시기, 컨트롤 패널 등의 훌륭한 기반이 돼요.

## 사용할 기능

- [`api.ui.dom.*`](../guides/dom-injection.md) — 패널을 주입하는 `inject`, 반환된 핸들의 `makeDraggable` / `on` / `update` / `remove`, 그리고 재실행 시 리셋을 위한 `cleanup`. `app_manipulation` 권한 필요. ([권한](../concepts/permissions.md))
- 스코프 스타일시트를 위한 `addStyle`.
- 스크립트 활성화 시 패널이 나타나도록 하는 `ls:startup` 트리거. ([트리거 모델](../concepts/trigger-model.md))

## 스크립트 코드

```js
// @triggers ls:startup
// 채팅창 위에 고정된 드래그 가능한 시계 패널. 재실행 시 기존 패널을 대체해요.
// 필요 권한: app_manipulation.

// 새로고침할 때마다 다시 렌더링됩니다. 헤더에는 드래그 핸들과 닫기 버튼이 포함되어 있으며,
// data-action 속성을 통해 하나의 클릭 핸들러가 모든 동작을 라우팅해요 (아래 설명 참고).
function renderContent() {
  return `
    <div class="ls-panel-header">
      <span class="ls-panel-title">🕒 Clock</span>
      <span class="ls-panel-close" data-action="close" title="Close">×</span>
    </div>
    <div class="ls-panel-time">${new Date().toLocaleTimeString()}</div>
    <button class="ls-panel-btn" data-action="refresh">Refresh</button>
  `;
}

// 재실행(또는 핫 리로드) 시 패널이 중복으로 쌓이지 않고 교체되도록
// 현재 스크립트가 이전에 주입했던 DOM을 모두 정리해요.
api.ui.dom.cleanup();

api.ui.dom.addStyle(`
  #ls-clock {
    position: fixed; top: 80px; right: 24px; z-index: 9998;
    width: 180px; padding: 12px 14px;
    background: var(--lumiverse-fill, rgba(20, 20, 28, 0.96));
    color: var(--lumiverse-text, #e8e8ea);
    border: 1px solid var(--lumiverse-border, rgba(255, 255, 255, 0.12));
    border-radius: 10px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
    font-family: system-ui, sans-serif; font-size: 0.85rem;
  }
  .ls-panel-header { display: flex; align-items: center; justify-content: space-between; cursor: move; user-select: none; }
  .ls-panel-title  { font-weight: 600; pointer-events: none; }
  .ls-panel-close  { cursor: pointer; padding: 0 6px; border-radius: 4px; }
  .ls-panel-close:hover { background: rgba(255, 255, 255, 0.12); }
  .ls-panel-time   { margin: 10px 0; font-size: 1.4rem; font-variant-numeric: tabular-nums; }
  .ls-panel-btn    { font: inherit; cursor: pointer; padding: 3px 10px; border-radius: 5px;
                     border: 1px solid var(--lumiverse-border, rgba(255,255,255,0.15));
                     background: transparent; color: inherit; }
`);

// 1. 플로팅 셸 — fixed 포지션의 컨테이너이며 나중에 드래그 가능해집니다.
const shell = api.ui.dom.inject('body', `<div id="ls-clock"></div>`, { id: 'clock-shell' });

// 2. 패널 내용 — update()를 통해 제자리에서 다시 렌더링할 수 있도록 자체 핸들을 가집니다.
const content = api.ui.dom.inject('#ls-clock', renderContent(), { id: 'clock-content' });

// 3. 헤더 바를 잡고 패널 전체를 드래그할 수 있도록 설정해요.
shell.makeDraggable('.ls-panel-header');

// 4. 단 하나의 클릭 핸들러가 data-action을 기반으로 모든 동작을 처리해요 (이벤트가 셸로 버블링됨).
shell.on('click', (e) => {
  const action = e.dataset?.action;
  if (action === 'close') {
    // 대칭적 정리: 생성했던 DOM(및 리스너)을 제거해요.
    content.remove();
    shell.remove();
    return;
  }
  if (action === 'refresh') {
    content.update(renderContent());
  }
});
```

스크립트를 활성화하면 우측 상단에 시계 패널이 나타나요. 제목 표시줄을 잡고 드래그해보고, **Refresh**를 눌러 시간을 갱신하거나 **×**를 눌러 닫아보세요.

## 동작 원리

**셸과 내용, 2개의 핸들.** `shell`은 `body`에 주입된 fixed 포지션의 빈 컨테이너이고, `content`는 셸(`'#ls-clock'`) 내부에 주입되며 자체 핸들을 유지해요. 이 분리가 핵심적인 구조예요: 셸은 드래그 가능한 프레임으로서 자리를 지키고, `content.update(html)`는 내부 마크업만 제자리에서 교체해요 — 덕분에 패널의 위치나 드래그 바인딩을 건드리지 않고도 내용을 자연스럽게 갱신할 수 있어요.

**`makeDraggable(selector)`**는 핸들의 요소를 자식 중 `selector`와 일치하는 부분을 잡았을 때 드래그되는 대상으로 변환해요 — 여기서는 `.ls-panel-header`를 지정했으므로 패널 전체가 아닌 제목 표시줄을 잡고 드래그하게 돼요(패널 전체가 잡히면 텍스트 선택이나 버튼 클릭이 방해받음). 선택자는 주입된 하위 트리 내에서 확인돼요.

**단일 핸들러와 `data-action` 라우팅.** `shell.on('click', …)`는 패널 내부 어디서든 버블링되어 올라오는 클릭을 잡아내요. 콜백은 **클릭된 요소**의 `data-action` 속성인 `e.dataset?.action`을 읽어 분기 처리해요. 새 버튼을 추가할 때도 개별 리스너를 일일이 연결할 필요 없이 새로운 `data-action` 값과 분기문 하나만 추가하면 돼요.

**`cleanup()`으로 재실행 멱등성 보장.** `api.ui.dom.cleanup()`은 현재 스크립트가 이전에 주입했던 모든 요소를 제거해요. 본문 상단에서 이를 호출하면 스크립트를 두 번 활성화하거나 핫 리로드(`// @ls:reload-on-edit`)할 때 패널이 중복으로 쌓이지 않고 깨끗이 교체돼요. 비활성화/삭제 시에는 호스트가 DOM을 알아서 정리해 주며, 닫기 버튼 내부의 `content.remove()` + `shell.remove()`는 사용자가 직접 닫을 때의 정리 동작이에요.

## 내 프로젝트에 맞게 응용하기

- **실시간 데이터 표시하기.** `renderContent()`가 실제 상태를 읽도록 수정하세요 — 메시지 수를 세기 위해 `await api.chat.getMessages()` 호출(`chat_mutation` 필요), `api.variables.*`, `api.scriptStorage.*` 등. `renderContent`는 문자열을 반환하는 순수 함수로 유지하고 데이터가 바뀔 때마다 `content.update(renderContent())`를 호출하세요.
- **이벤트에 반응하기.** `ls:startup` 외에 `MESSAGE_SENT` / `GENERATION_ENDED` 이벤트도 함께 연결하세요. 본문에서 `if (data.__event === 'MESSAGE_SENT') content.update(renderContent())` 형태로 매 턴마다 시각적으로 갱신할 수 있어요. (패널 주입은 한 번만 하도록 `#ls-clock`의 존재 여부를 검사하거나 `cleanup()` 후 재주입 방식을 유지하세요.)
- **다른 스크립트에서 갱신하기.** 형제 스크립트가 `api.broadcast.emit('myapp:state-changed', …)`를 발행하고 여기서 이를 구독하여 화면을 갱신하도록 구성할 수 있어요 — [두 스크립트 간 상태 공유하기](share-state-broadcast.md) 참고. 이 경우 `on()`이 반환하는 구독 해제 함수를 보관해 두었다가 닫기 분기에서 호출해 주어야 구독(및 워커 핀 고정)이 패널 종료 후에도 남는 것을 방지할 수 있어요.
- **위치 기억하기.** `makeDraggable`은 사용자가 패널을 어디에 두었는지 자동으로 기억하지 않아요. 드래그 종료 핸들러에서 최종 좌표를 `api.scriptStorage`에 저장해 두고 다음 주입 시 인라인 `top`/`left` 스타일로 적용하세요.

## 주의사항

- **핸들러가 읽을 요소에 `data-action`을 지정하고 — 내부 아이콘에는 `pointer-events: none`을 부여하세요.** `handle.on`은 트리 상위로 `closest()`를 탐색하지 않고 *실제 클릭된* 요소의 `dataset`을 읽어요. 단순 텍스트 `×`는 문제없지만 버튼 안에 `<svg>`, `<img>`, `<span>` 아이콘이 들어 있는 경우 클릭이 `data-action`이 없는 내부 노드에 떨어져 라우팅을 놓칠 수 있어요. 내부 아이콘 요소에는 `pointer-events: none`을 부여하세요(위의 `.ls-panel-title`처럼).
- **패널 전체가 아닌 핸들 부분을 드래그 대상으로 지정하세요.** `makeDraggable('#ls-clock')`처럼 패널 전체를 지정하면 버튼 클릭이나 텍스트 선택이 드래그 동작과 충돌해요.
- **`cleanup()` 없이 재실행하면 패널이 겹쳐서 쌓여요.** 이것이 초기화 첫 줄에 `api.ui.dom.cleanup()`을 두는 이유예요 — 없으면 활성화나 리로드 시마다 이전 패널이 화면에 방치돼요.
- **`position: fixed`와 높은 `z-index`**로 패널이 채팅창 위에 뜨도록 유지하세요. 화면 구석에 닻을 내리세요; 일반적인 문서 흐름은 호스트 채팅 UI가 소유하고 있어요.

## 관련 항목

- [DOM 주입](../guides/dom-injection.md) — `api.ui.dom` 전체 인터페이스: `inject`, `addStyle`, 핸들 메서드(`update` / `remove` / `on` / `makeDraggable` / `read`), `cleanup`.
- [핸들러 수명 주기](../concepts/handler-lifetime.md) — DOM 리스너와 브로드캐스트 구독이 명시적 정리를 필요로 하는 이유와 호스트의 자동 정리 보장 범위.
- [두 스크립트 간 상태 공유하기](share-state-broadcast.md) — 별도의 워커 스크립트에서 데이터를 받아 패널 갱신하기.
