# UI 탐색 (UI navigation)

`api.ui`에는 사용자를 이미 존재하는 화면 — 서랍(drawer), 설정 모달, 커맨드 팔레트(command palette) — 으로 안내하는 소규모의 **탐색(navigation)** 메서드가 포함되어 있어요. 내장 커맨드 팔레트가 사용하는 것과 동일한 원시 기능이며, 온보딩 안내, 에이전트 주도 워크스루, "문제 해결" 딥링크 등 스크립트가 사용자를 특정 화면으로 유도할 수 있도록 노출되어 있어요. 모두 무료 티어(free-tier)로 별도의 권한이 필요하지 않아요.

## 직접 추가하기(Contribute) vs 탐색하기(Navigate)

이 두 가지 개념의 차이를 명확히 알아두세요:

- **직접 추가하기 (Contribute)** — `api.ui.registerDrawerTab(...)`은 현재 스크립트가 소유하고 렌더링하는 *새로운* 탭을 추가해요([DOM 주입](dom-injection.md) 가이드 참고).
- **탐색하기 (Navigate)** — `openDrawerTab(id)` / `openSettings(viewId?)` / `openCommandPalette()`는 *이미 존재하는* 화면 — 내장 화면 또는 다른 확장 기능(본인 포함)이 추가해 둔 탭으로 사용자를 이동시켜요.

이 가이드는 두 번째인 탐색에 대해 다뤄요.

## 탭 목록 열거 후 탐색하기

`getDrawerTabs()`와 `getSettingsTabs()`는 이동 가능한 대상 목록을 반환하므로 목표 대상을 선택하거나 맞춤형 '바로가기 선택기'를 구성할 수 있어요:

```js
const tabs = await api.ui.getDrawerTabs();
for (const t of tabs) {
  console.log(t.id, '·', t.tabName, '·', t.source);   // 'builtin' | 'extension'
}

await api.ui.openDrawerTab('connections');   // id로 딥링크 이동
```

`UIDrawerTab` 객체는 `{ id, shortName, tabName, tabDescription, keywords, source, extensionId? }`를 가져요. `source`는 `'builtin'` 또는 `'extension'`이며, 확장 기능이 추가한 탭에는 `extensionId`가 설정돼요. 탐색 메서드는 ID를 그대로 전달하므로 ID를 알고 있다면 **다른 확장 기능의** 탭으로도 딥링크할 수 있어요.

`getSettingsTabs()`는 `UISettingsTab`(`{ id, shortName, tabName, tabDescription, keywords, role? }`)을 반환해요. 역할 제한이 있는 탭(`role: 'admin' | 'owner'`)은 해당 권한이 없는 사용자에게는 목록에서 제외돼요.

## 탐색 호출 메서드

```js
await api.ui.openDrawerTab('characters');   // 특정 탭 id로 서랍 열기
await api.ui.closeDrawer();                  // 열려 있는 서랍 닫기

await api.ui.openSettings('connections');    // 특정 뷰 id로 설정 모달 열기…
await api.ui.openSettings();                  // …생략 시 기본 'display' 뷰로 열림
await api.ui.closeSettings();

await api.ui.openCommandPalette();            // Ctrl+K 오버레이 열기
await api.ui.closeCommandPalette();
```

각 `open*` / `close*` 호출은 **호스트가 탐색 명령을 디스패치했을 때 완료(resolve)**돼요 — 프론트엔드가 이후 비동기적으로 화면을 전환하므로 promise를 await하는 것은 "요청이 정상 접수되었음"을 의미하며 "화면 애니메이션이 끝났음"을 의미하는 것은 아니에요.

## 사용 예제: 온보딩 안내

최초 실행한 사용자를 연결(Connections) 설정으로 안내하여 프로바이더를 등록하도록 유도:

```js
// @triggers ls:startup
const seen = await api.variables.global.get('onboarded');
if (seen) return;

const ok = await api.ui.confirm(
  'Set up an LLM connection now?',
  'Welcome to this script',
  { confirmLabel: 'Open settings', cancelLabel: 'Later' },
);
if (ok) await api.ui.openSettings('connections');

await api.variables.global.set('onboarded', true);
```

## 사용 예제: 바로가기 선택기

모든 서랍 탭의 검색 가능한 목록을 띄우고 선택된 탭으로 이동:

```js
const tabs = await api.ui.getDrawerTabs();
const chosen = await api.ui.showContextMenu({
  position: { x: 200, y: 200 },
  items: tabs.map((t) => ({ key: t.id, label: t.tabName })),
});
if (chosen) await api.ui.openDrawerTab(chosen);
```

## 참고 사항

- **무료 티어.** 탐색 메서드는 권한이 필요하지 않아요. (다른 `api.ui.*` 메서드는 각자의 권한이 필요해요 — `showAdvancedModal` / DOM / 컴포넌트는 `app_manipulation`, `pushNotification`은 `push_notification` 등).
- **ID는 게터에서 가져오세요.** `getDrawerTabs()` / `getSettingsTabs()`에서 확인하지 않은 ID를 하드코딩하지 마세요 — 내장 화면 ID는 고정되어 있지만, 확장 기능이 추가한 화면을 찾는 안전한 방법은 목록을 열거하는 것이에요.
- **활성 사용자가 암시적으로 지정돼요** — 사용자 ID를 직접 넘겨줄 필요가 없어요.

전체 `UIDrawerTab` / `UISettingsTab` 필드 목록과 기타 `api.ui` 기능은 인앱 **레퍼런스 탭**을 확인하세요.
