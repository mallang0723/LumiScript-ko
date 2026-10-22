# 전체 화면 앱 서피스 마운트하기

`api.ui.mountApp()`은 Lumiverse 앱 셸에 **라우트 변경에도 유지되는 전체 화면(full-bleed) 포털**을 마운트해요. 독 패널, 서랍 탭, 플로팅 위젯의 한계를 넘어 스크립트가 직접 제어하는 전체 화면 오버레이나 영구적인 크롬 UI 영역을 만들 수 있어요. `app_manipulation` 권한이 필요해요.

```js
const mount = api.ui.mountApp({ position: 'app-overlay' });
mount.root.update('<div class="my-overlay"><h1>Focus mode</h1></div>');
// …later
mount.destroy();
```

## 적용 위치와 용도

LumiScript는 범위에 따라 단계별로 스크립트 전용 UI 서피스를 제공해요:

| 서피스 | 주 용도 |
|---|---|
| `showAdvancedModal` | 일시적인 모달 대화상자 |
| `createFloatWidget` | 드래그 가능한 작은 오버레이 (`ui_panels`) |
| `registerDrawerTab` | 사이드바 서랍 안의 탭 |
| **`mountApp`** | 라우트가 바뀌어도 유지되는 전체 화면 포털 — 전체 화면 오버레이 / 영구 크롬 UI |

범위가 제한된 서피스로는 부족할 때 `mountApp`을 사용하세요. 예를 들어 전체 화면 읽기 모드, 커스텀 랜딩 화면, 라우트 이동 중에도 유지되어야 하는 크롬 UI 등에 적합해요.

## 핸들 다루기

```ts
mountApp(options?: {
  className?: string;
  position?: 'start' | 'end' | 'app-overlay';  // 메인 뷰 앞/뒤에 두거나 전체를 덮음
}): MountedAppHandle
```

`MountedAppHandle`은 `{ mountId, root, setVisible(visible), destroy() }` 형태예요:

- **`root`** — 마운트된 콘텐츠 컨테이너에 바인딩된 `DOMHandle`이에요. 일반적인 주입 요소와 **동일한 `api.ui.dom.*` 파이프라인**으로 렌더링하고 연결할 수 있어요: `root.update(html)`, `root.on(event, handler)`, `root.injectChild(...)`, `api.ui.dom.addStyle(css)` (마운트에 `data-ls-script`가 부여되므로 `@scope` 규칙이 내부 콘텐츠와 일치해요). 호출은 프런트엔드에서 마운트를 생성할 때까지 버퍼링돼요.
- **`setVisible(visible)`** — 마운트를 파괴하지 않고 표시/숨김을 전환해요.
- **`destroy()`** — 마운트를 제거해요. 멱등성을 갖추고 있어서 핸들을 여러 번 호출해도 오류 없이 조용히 무시돼요.

## 구현 예제

```js
// 닫을 수 있는 전체 화면 오버레이
const mount = api.ui.mountApp({ position: 'app-overlay', className: 'reading-mode' });

api.ui.dom.addStyle(`
  .reading-mode-body { padding: 2rem; max-width: 60ch; margin: 0 auto; }
`);
mount.root.update(`
  <div class="reading-mode-body">
    <button data-act="close">Close</button>
    <article>…</article>
  </div>
`);
mount.root.on('click', (ev) => {
  if (ev.target?.dataset?.act === 'close') mount.destroy();
});
```

## 수명 주기

플로팅 위젯이나 서랍 탭과 마찬가지로, 활성화된 마운트는 워커가 퇴출되지 않도록 **스크립트를 고정(pin)**해요. 덕분에 `.root`의 이벤트 핸들러가 계속 동작할 수 있어요. 또한 스크립트가 비활성화되거나 다시 불러와질 때 스크립트가 생성한 모든 마운트는 **자동으로 파괴**되므로, 정리(teardown)를 위해 직접 마운트를 추적할 필요가 없어요. 오버레이 작업이 끝나면 직접 `destroy()`를 호출해 정리해 주세요.

## 참고 사항

- **`app_manipulation` 권한 필요** (`showAdvancedModal` 및 `api.ui.dom.*`과 동일한 권한).
- `.root`는 버퍼링돼요: `mountApp()` 호출 직후 동기적으로 실행한 작업은 프런트엔드가 마운트를 생성한 뒤 적용돼요 (호스트가 마운트를 확인하고 `.root`를 바인딩하는 순간 호출이 해결돼요).
- `position`의 기본값은 호스트에서 정의해요. 화면 전체를 덮는 레이어가 필요하면 `'app-overlay'`를 전달하세요.

`MountAppOptions` 및 `MountedAppHandle`의 전체 필드 목록은 앱 내 **레퍼런스 탭**을 확인하고, `.root` 콘텐츠 API는 [DOM 주입](dom-injection.md) 문서를 참고하세요.
