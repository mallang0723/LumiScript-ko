# 연결 프로필

`api.connections.*`는 사용자의 LLM 연결 프로필을 **읽기 전용**으로 조회할 수 있는 창구예요. `api.llm`이 텍스트 생성을 요청할 때 사용하는 바로 그 프로필이자 Lumiverse UI에서 관리하는 연결 설정이에요. 사용자가 연결을 직접 선택하게 하거나, 현재 구성된 연결 정보를 확인하거나, 특정 생성을 지정된 프로필로 라우팅할 때 사용하세요. 별도의 권한이 필요하지 않아요.

```js
const conns = await api.connections.list();
for (const c of conns) {
  console.log(c.name, '→', c.provider, c.model, c.is_default ? '(default)' : '');
}
```

## 네 가지 조회 메서드

- `list()` → `Connection[]` — 사용자가 가진 모든 프로필 목록.
- `get(connectionId)` → `Connection | null` — ID로 특정 프로필 조회 (없으면 `null`).
- `getDefault()` → `Connection | null` — `is_default`로 지정된 기본 프로필. 기본값이 없으면 첫 번째 사용 가능한 프로필을 반환하고, 등록된 프로필이 전혀 없으면 `null`을 반환해요.
- `findByName(name)` → `Connection | null` — 대소문자를 구분하지 않는 이름 일치 검색.

## 안전한 `Connection` 데이터 구조

`Connection` 객체는 호스트의 프로필 정보를 **snake_case** 형태로 반영해요:

```js
{
  id, name, provider, api_url, model,
  preset_id,            // 바인딩된 생성 프리셋 ID (없으면 null)
  is_default,           // boolean
  has_api_key,          // boolean — API 키가 저장되어 있는지 여부
  metadata,             // 제공자별 메타데이터 맵
  reasoning_bindings,   // ConnectionReasoningBindings | null — { settings, promptBias? }
  created_at, updated_at,
}
```

여기서 **절대 찾을 수 없는 한 가지 필드가 바로 API 키**예요. 연결 정보에는 키가 구성되어 있는지 여부를 나타내는 `has_api_key: boolean`만 포함될 뿐, 실제 키 문자열은 절대로 노출되지 않아요. 이는 의도된 설계이며 LumiScript의 모든 자격 증명 관련 인터페이스에 동일하게 적용되는 원칙이에요.

`reasoning_bindings`는 연결에 저장된 추론 구성이에요. `settings` 스냅샷(추론 강도(effort), 생각 과정 표시 여부, 구분자 파싱 규칙 등)과 선택적인 `promptBias`("Start Reply With" 접두어)를 담고 있으며, 바인딩된 설정이 없으면 `null`이에요. 여기서는 읽기 전용으로만 제공돼요. 프로필 설정을 건드리지 않고 *단일* 생성 호출의 추론 동작만 변경하고 싶다면 `api.llm` 호출 시 `reasoning` 옵션을 직접 전달하세요([LLM 가이드](llm.md)의 **추론** 절 참고).

## 읽기 전용으로 설계된 이유

이 네임스페이스에는 `create`, `update`, `delete` 같은 변경 메서드가 없어요. 연결 프로필은 외부 제공자의 인증 자격 증명을 담고 있으므로 오직 사용자 본인만 소유하며 Lumiverse 설정 화면을 통해서만 수정할 수 있어요. 스크립트는 어떤 연결이 존재하는지 확인하고 거기로 생성을 라우팅할 수는 있지만, 연결을 새로 만들거나 설정을 변조할 수는 없어요. (만약 *사용자를 연결 설정 화면으로 안내*하고 싶다면 탐색 API인 `api.ui.openSettings('connections')`를 호출하세요. [UI 탐색](ui-navigation.md) 참고.)

## 원하는 연결로 생성 요청 라우팅하기

연결의 `id`와 `name`은 `api.llm`의 `connectionId` 및 `connectionName` 옵션에 그대로 매핑돼요. 따라서 "연결을 찾아서 거기로 생성하기"는 단 두 줄로 구현할 수 있어요:

```js
const conn = await api.connections.findByName('Claude Opus');
if (conn) {
  const reply = await api.llm.generate(
    [{ role: 'user', content: 'Write a haiku about cron jobs.' }],
    { connectionId: conn.id },     // 또는 { connectionName: conn.name }
  );
}
```

`connectionId`가 `connectionName`보다 우선 적용돼요. 전체 옵션에 대해서는 [LLM 호출하기](llm.md) 문서를 참고하세요(LLM 생성 호출 자체는 `generation` 권한이 필요해요).

## 연결 선택기 만들기

`list()`와 호스트의 `mountSelect` 컴포넌트를 조합하면 테마가 적용된 멋진 드롭다운을 만들 수 있어요([호스트 공유 컴포넌트 마운트하기](components.md) 참고):

```js
const conns = await api.connections.list();
const slot  = api.ui.dom.inject('body', '<div></div>');   // app_manipulation 권한 필요

api.ui.components.mountSelect(slot, {
  options: conns.map((c) => ({ value: c.id, label: `${c.name} · ${c.provider}` })),
  onChange: async (id) => {
    await api.variables.global.set('preferredConnection', id);
  },
});
```

모델 목록까지 연동되는 선택기를 원한다면 `mountModelCombobox`를 연결에 바인딩하세요. 호스트가 모델 목록을 알아서 관리해 줘요.

## 참고 사항

- **권한 필요 없음(Free tier)**. 다만 데이터는 사용자별로 구분되며, 현재 활성 사용자의 범위로 자동 한정되므로 사용자 ID를 따로 넘길 필요가 없어요.
- `getDefault()`는 특정 연결을 지정하지 않았을 때 `api.llm`이 연결을 결정하는 방식과 동일하게 동작해요: `is_default`가 먼저이고, 없으면 목록의 첫 번째 프로필을 선택해요.
- 내부적으로 영구 캐싱되지 않아요 — 최신 상태를 확인해야 할 때마다 `list()`를 호출하세요(예: 사용자가 이전 조회 이후에 새 프로필을 추가했을 수 있어요).

전체 `Connection` 필드 목록은 앱 내 **레퍼런스 탭**을 확인하세요.
