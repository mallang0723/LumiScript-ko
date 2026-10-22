# 호스트 및 사용자 컨텍스트

스크립트가 현재 자신이 실행 중인 환경 정보를 조회할 수 있는 두 개의 가벼운 네임스페이스가 있어요: `api.users`(사용자가 현재 화면을 보고 있는지, 역할은 무엇인지)와 `api.version`(현재 Lumiverse 버전이 무엇인지). 둘 다 읽기 전용이며 현재 활성 사용자의 범위로 자동 한정되므로 사용자 ID를 따로 넘길 필요가 없어요. 별도의 권한도 필요하지 않아요.

## `api.users` — 사용자가 화면을 보고 있는가, 어떤 사용자인가?

```js
const visible = await api.users.isVisible();   // boolean
const role    = await api.users.getRole();      // 'operator' | 'admin' | 'user'
```

- `isVisible()` — 사용자가 하나 이상의 세션에서 앱 화면을 활성화해 보고 있으면 `true`, 모든 세션이 숨겨져 있거나 백그라운드 상태이거나 열린 세션이 없으면 `false`를 반환해요.
- `getRole()` — 사용자의 Lumiverse 역할이에요. 내부 소유자는 `'operator'`, 관리자는 `'admin'`, 일반 사용자는 `'user'`로 반환돼요.

### 푸시 알림 vs 인앱 알림 분기 처리

`isVisible()`의 가장 대표적인 활용법은 사용자에게 알림을 보낼 *방식*을 결정하는 것이에요 — 사용자가 자리를 비웠을 때는 OS 푸시 알림을 보내고, 화면을 보고 있을 때는 조용한 인앱 알림을 띄우는 식이에요:

```js
const msg = 'Your long generation finished.';
if (await api.users.isVisible()) {
  api.ui.toast(msg, 'success');                       // 권한 필요 없음
} else {
  await api.ui.pushNotification('Done', msg);          // push_notification 권한 필요
}
```

### 역할에 따른 권한별 동작 제한

```js
if ((await api.users.getRole()) === 'operator') {
  // 운영자 전용 진단 화면 표시
}
```

## `api.version` — 현재 Lumiverse 빌드 버전 확인

```js
const backend  = await api.version.getBackend();    // 예: '1.0.2'
const frontend = await api.version.getFrontend();   // 예: '1.0.2'
```

두 메서드 모두 semver 문자열을 반환해요. 주요 용도는 **기능 분기(feature-gating)**예요 — 스크립트가 필요로 하는 이벤트나 API를 현재 호스트가 지원하는지 버전을 비교해 분기할 수 있어요.

### 문자열이 아닌 숫자 튜플로 비교하기

문자열로 비교하면 `'1.10.0' > '1.9.0'`이 `false`가 되어 버려요. 따라서 숫자 단위로 비교해야 해요. 간단한 비교 헬퍼 함수 예시예요:

```js
function atLeast(version, min) {
  const norm = (v) => v.split('-')[0].split('+')[0].split('.').map(Number);   // -rc/+build 제거 후 분할
  const a = norm(version), b = norm(min);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;   // 같음
}

if (atLeast(await api.version.getBackend(), '1.0.0')) {
  // 1.0.0에서 도입된 기능을 안전하게 사용
}
```

(LumiScript 자체도 `minimum_lumiverse_version`을 검사할 때 내부적으로 동일한 숫자 비교 방식을 사용해요. 호스트에 별도의 버전 비교 API가 없으므로 위와 같은 작은 헬퍼를 사용하는 것이 표준 패턴이에요.)

## 참고 사항

- **모두 별도 권한이 필요하지 않아요.** 사용자 ID를 전달할 필요도 없어요.
- 실시간 조회 값이에요 — 특히 `isVisible()`은 *지금 이 순간* 사용자의 세션 상태를 나타내므로, 스크립트 시작 시점이 아니라 실제로 알림 방식을 결정해야 하는 바로 그 순간에 호출하세요.

전체 API 정보는 앱 내 **레퍼런스 탭**의 `api.users` 및 `api.version` 항목을 참고하세요.
