# 반응형 UI 상태 (Reactive UI state)

`api.ui.events.*`는 스크립트가 Lumiverse의 실시간 UI 상태 — 가상 키보드, 사이드 서랍(drawer), 설정 모달의 상태를 읽고 반응할 수 있도록 해줘요. 각 영역마다 **스냅샷 게터**(현재 시점의 상태)와 **변경 구독**(변경될 때마다 실행)을 제공해요. 무료 티어이므로 별도의 권한이 필요하지 않아요.

대표적인 사용 사례는 **모바일 안전 위치 지정(mobile-safe positioning)**이에요: 화면 키보드가 열릴 때 키보드의 `insetBottom`을 활용하여 플로팅 위젯이나 주입된 DOM의 위치를 위로 살짝 올려주는 식이에요.

## 스냅샷 (Snapshots)

```js
const kb = await api.ui.events.getKeyboardState();   // { visible, insetBottom, viewportWidth, viewportHeight }
const dr = await api.ui.events.getDrawerState();      // { open, tabId }
const st = await api.ui.events.getSettingsState();    // { open, view }
```

게터는 **비동기(async)**예요 — `DOMHandle.read()`처럼 워커 경계를 넘나들지만, 프론트엔드가 항상 최신으로 유지하는 캐시로부터 값을 가져오므로 호출 시마다 네트워크 왕복이 발생하지 않아요. 프론트엔드가 상태를 보고하기 전(연결 직후 극초기)에는 자연스러운 기본 꺼짐 값(`visible: false`, `open: false` 등)으로 반환돼요.

## 변경 구독 (Subscriptions)

각 `on*Change(handler)`는 상태가 변경될 때마다 새 상태를 인자로 받아 실행되며, 구독 해제(unsubscribe) 함수를 반환해요:

```js
const unsub = api.ui.events.onKeyboardChange((state) => {
  if (state.visible) console.log(`keyboard up, safe inset ${state.insetBottom}px`);
});

// 나중에 작업이 끝나면 해제:
unsub();
```

상태 객체의 형태는 스냅샷과 동일해요:

- **키보드 (Keyboard)** `{ visible, insetBottom, viewportWidth, viewportHeight }` — `insetBottom`은 콘텐츠를 키보드 위에 안전하게 유지하기 위한 CSS 픽셀 단위 안전 영역이에요.
- **서랍 (Drawer)** `{ open, tabId }` — `tabId`는 활성화된 서랍 탭의 ID예요(없으면 `null`).
- **설정 (Settings)** `{ open, view }` — `view`는 활성화된 설정 뷰의 ID예요.

## 사용 예제: 플로팅 위젯을 키보드 위에 유지하기

```js
const widget = api.ui.createFloatWidget({ /* … */ });   // ui_panels 권한 필요

api.ui.events.onKeyboardChange((kb) => {
  // 키보드가 열릴 때 키보드의 안전 인셋만큼 위젯을 올리고, 닫힐 때 원래 위치로 내립니다.
  const pos = widget.getPosition();
  widget.moveTo(pos.x, kb.visible ? pos.y - kb.insetBottom : pos.y);
});
```

## 사용 예제: 사용자가 서랍 탭을 열었을 때 반응하기

```js
api.ui.events.onDrawerChange(({ open, tabId }) => {
  if (open && tabId === 'my-script-tab') {
    refreshMyTabContents();   // 사용자가 실제로 볼 때만 지연 로딩
  }
});
```

## 수명 주기

활성 구독은 **스크립트를 워커 풀에 고정(pin)**해요 — 핸들러가 등록되어 있는 동안에는 스크립트가 워커 풀에서 축출되지 않으므로 백그라운드 구독이 즉각적으로 응답할 수 있어요. 구독이 종료되는 방법은 두 가지예요:

- **반환된 구독 해제 함수(unsub) 호출** — 구독이 더 이상 필요 없을 때 호출하면 고정 상태가 해제돼요.
- **스크립트 비활성화 / 재로드** — 모든 구독을 자동으로 정리해요(정리를 위해 직접 추적할 필요 없음).

따라서 백그라운드에서 계속 실행되는 반응형 작업의 경우 구독 후 해제하지 않아도 되며, 일시적인 UI(직접 연 모달 등)에 연결된 구독이라면 닫힐 때 구독 해제 함수를 호출하여 즉시 고정 상태를 해제하는 것이 좋아요.

## 참고 사항

- **무료 티어**이며 사용자 ID를 받지 않음 — 현재 활성 사용자에게 자동으로 범위가 지정돼요.
- **키보드 이벤트는 주로 모바일 / PWA 환경용이에요.** 데스크톱 환경에서는 서랍과 설정 채널이 주로 활성화되며, 키보드 채널은 보통 `{ visible: false }` 상태를 유지해요.
- 핸들러는 스크립트 샌드박스 내부에서 실행돼요 — 핸들러를 `async`로 작성하고 내부의 모든 비동기 작업을 `await`하세요(호스트는 컴포넌트 콜백/DOM 이벤트 핸들러와 마찬가지로 await 체인이 유지되는 동안 실행 컨텍스트를 유지해요).
- `UIKeyboardState`, `UIDrawerState`, `UISettingsState` 필드 목록은 인앱 **레퍼런스 탭**을 참고하세요.
