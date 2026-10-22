# 캐릭터 이미지로 앱 테마 꾸미기 (Theme the app from a character's image)

대화 상대에 맞춰 Lumiverse의 색상을 자동으로 바꿔보세요 — 활성 캐릭터의 아바타에서 지배적인 색상을 추출하여 호스트의 팔레트 엔진에 전달하면, 엔진이 약 80개의 조화로운 CSS 변수로 구성된 테마를 파생해 줘요. 앱 전체가 캐릭터의 분위기에 맞게 전환되며, 다른 대화로 이동하거나 스크립트를 끄면 깔끔하게 원래 테마로 복원돼요.

## 사용할 기능

- [`api.theme.*`](../guides/theme.md) — `extractColors(imageId)` (저장된 이미지에서 팔레트 추출) + `applyPalette({ accent })` (강조 색상 → 조화로운 테마 생성) + `clear()`. `app_manipulation` 권한 필요.
- `api.chats.getActive()` + `api.characters.get(id)` — 활성 캐릭터의 아바타 `imageId`를 조회. 각각 `chats` 및 `characters` 권한 필요.
- `CHAT_SWITCHED` 트리거 — 활성 대화가 열리거나 전환되거나 닫힐 때마다 발생. ([트리거 모델](../concepts/trigger-model.md))

핵심 개념: **단 하나의 강조 색상만 전달하면 나머지는 호스트가 모두 생성해요.** `applyPalette({ accent })`는 하나의 HSL 강조 색상으로부터 배경, 테두리, 호버 상태, 글래스 틴트 등 조화로운 변수 세트를 자동으로 파생해요. 따라서 스크립트가 할 일은 좋은 색상(여기서는 아바타의 지배 색상)을 찾아 넘겨주는 것뿐이에요. 사용자가 직접 테마나 모드를 전환해도 호스트가 스크립트의 레이어를 다시 적용해 주며, 스크립트 비활성화 시 자동으로 정리돼요.

## 스크립트 코드

```js
// @triggers CHAT_SWITCHED
// 활성 캐릭터의 아바타에 맞춰 앱 색상을 변경해요.
// 필요 권한: app_manipulation (테마) · chats + characters (아바타 조회).

// CHAT_SWITCHED는 chatId가 null인 홈 화면으로 돌아올 때도 발생해요.
// characterId는 이벤트 페이로드에 없으며(이벤트 발생 직후 비동기로 확인됨),
// 호스트의 실시간 상태에서 읽는 것이 표준 패턴이에요.
const chat = await api.chats.getActive();
if (!chat?.characterId) {
  await api.theme.clear();          // 캐릭터가 없음 (홈 화면) → 색상 변경 해제
  return;
}

const character = await api.characters.get(chat.characterId);
if (!character?.imageId) return;    // 아바타 이미지가 없음 — 테마를 그대로 유지

// 아바타에서 팔레트를 추출하고, 지배 색상을 강조 색상으로 적용해요.
const palette = await api.theme.extractColors(character.imageId);
await api.theme.applyPalette({ accent: palette.dominantHsl });
```

스크립트를 활성화하고 서로 다른 캐릭터와의 대화를 열어보세요: 강조 색상, 배경, 테두리가 각 아바타에 맞춰 변경돼요. 홈 화면으로 나가면 적용되었던 색상이 사라져요. 스크립트를 끄면 사용자의 원래 테마로 복원되며 — 별도의 정리 코드가 필요하지 않아요.

## 동작 원리

**`extractColors`는 URL이 아니라 반드시 `imageId`를 받아요.** 이 ID는 Lumiverse 이미지 테이블의 표준 핸들러예요 — `character.imageId`(아바타), `api.images.upload(...)`, `api.imageGen.generate(...)`가 반환하는 것과 정확히 같아요. `extractColors`는 [`ColorExtractionInfo`](../guides/theme.md#extractcolorsimageid)를 반환해요: `dominant` 색상, 영역별 샘플(`top` / `center` / `bottom` 등), `flatness` 균일도 점수, `isLight`, 그리고 `applyPalette`에 바로 넘길 수 있는 HSL 형태의 `dominantHsl`이 포함돼요.

**`applyPalette`는 HSL을 받아 나머지를 모두 파생해요.** `applyPalette({ accent: { h, s, l } })` 호출 하나로 전체 색상 변경이 끝나요 — 호스트가 해당 강조 색상에 어울리는 약 80개의 연관 변수를 생성해요. hex 문자열을 넘기면 타입 에러가 발생해요; `dominantHsl`이 이미 올바른 형태이므로 둘을 곧바로 연결할 수 있어요. 팔레트는 스크립트 간에 가장 최근 적용된 것이 우선하므로(병합되지 않음), 마지막으로 `applyPalette`를 호출한 스크립트가 강조 색상을 소유해요.

**페이로드가 아닌 실시간 상태에서 캐릭터를 확인하세요.** `CHAT_SWITCHED`는 오직 `{ chatId }`만 가지고 발생해요 — `characterId`가 없으며, 호스트는 이벤트 발생 후 약간의 시차를 두고 캐릭터를 확인해요. `await api.chats.getActive()`는 호스트의 안정화된 상태를 읽으므로 `chat.characterId`를 안정적으로 가져올 수 있어요. 홈 화면에서는 `chatId`가 `null`이 되므로, 가드가 `clear()`를 호출하여 이전 캐릭터의 색상이 남아있지 않도록 정리해요.

**정리 작업은 완전 자동이에요.** 스크립트가 비활성화되거나 삭제되면 호스트가 해당 스크립트의 기여분을 제거하고 병합된 테마를 다시 계산해요 — 분해(teardown) 코드를 작성할 의무가 없어요. `clear()`는 위의 홈 화면 분기처럼 실행 중간에 원래대로 되돌리고 싶을 때만 명시적으로 호출하면 돼요.

## 내 프로젝트에 맞게 응용하기

- **단색 배경 피하기.** 아바타 상단이 하늘이나 단색 벽인 경우 지배 색상이 밋밋한 배경색일 수 있어요. `extractColors`는 영역별 `flatness`를 반환하므로 — `palette.flatness.top > 0.8`일 때 `palette.regions.bottom` 색상을 대신 사용하는 방식을 적용할 수 있어요(영역별 색상은 RGB로 오므로 작은 `rgbToHsl` 헬퍼 필요).
- **사용자의 기본 모드 존중하기.** `await api.theme.getCurrent()`로 사용자의 `mode`, `accent`, 그리고 글래스 효과 비활성화 여부(`enableGlass`)를 읽어와서, 아바타 색상으로 완전히 덮어쓰기보다는 조화롭게 블렌딩하세요 — 예: 색조는 유지하고 밝기만 살짝 조정.
- **생성된 이미지로 테마 꾸미기.** `api.imageGen.generate(...)` 역시 `imageId`를 반환해요 — 챕터마다 장면 이미지를 생성하고 아바타 대신 그 이미지의 색상으로 테마를 바꿀 수 있어요.
- **아바타 수정 감지.** `CHARACTER_EDITED` 이벤트도 함께 연결하여 채팅 전환뿐 아니라 아바타가 변경되었을 때도 테마가 즉시 갱신되도록 하세요.

## 주의사항

- **`applyPalette`는 hex가 아니라 HSL을 요구해요.** `{ accent: '#9370DB' }`는 타입 에러예요. `dominantHsl`(이미 HSL임)을 사용하거나 직접 만든 hex-to-HSL 변환기를 거치세요.
- **`extractColors`는 저장된 이미지가 필요해요.** 오직 `imageId`만 받아요. URL을 가지고 있다면 먼저 페치(`api.utils.http.get(url, { responseType: 'arraybuffer' })`)하여 `api.images.upload(...)`로 업로드한 뒤 ID를 얻어야 해요.
- **채팅 진입 시의 폭풍 상황에서 테마 쓰기가 일시적으로 실패할 수 있어요.** 변경 수반 테마 호출은 매크로 경합 주변에서 자동으로 재시도하지만, 극단적인 `CHAT_SWITCHED` 상황에서는 재시도 횟수가 소진될 수 있어요. 채팅이 열릴 때마다 무거운 테마 처리를 수행한다면 적용을 약간 지연시키거나 `generateVariables`(읽기 전용, 경합 없음)로 사전 계산하세요. [매크로 경합 복원력](../guides/theme.md#macro-race-resilience) 참고.
- **`getCurrent()`는 최종 병합 결과가 아니라 기본(BASE) 테마를 반환해요.** 완전히 병합되어 실제로 적용된 상태를 읽는 공개 API는 없어요 — 필요하다면 자신이 기여한 내용을 직접 추적하세요.

## 관련 항목

- [호스트 UI 테마 적용](../guides/theme.md) — `api.theme` 전체 인터페이스, 스크립트별 적용 규칙, 모드별 변형, [토큰 참조](../guides/theme.md#token-reference).
- [권한](../concepts/permissions.md) — `app_manipulation` (테마) 및 `chats` / `characters` (아바타 조회).
- [저장소 모델](../concepts/storage-model.md) — 업로드되거나 생성된 이미지로 테마를 적용할 때의 `imageId` 출처인 `api.images`.
