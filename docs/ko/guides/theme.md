# 호스트 UI 테마 적용 (Theming the host UI)

`api.theme.*`는 스크립트에서 Lumiverse의 CSS 변수 — 강조 색상(accent color), 배경, 텍스트, 테두리, 글래스 효과, 타이포그래피, 여백을 제어하는 `--lumiverse-*` 토큰 세트를 재정의할 수 있도록 해줘요. 특정 캐릭터/채팅에 맞춰 앱의 색상을 바꾸거나, 이미지에서 일관된 색상 팔레트를 추출하거나, 사용자의 현재 테마 위에 세밀한 CSS 조정을 적용할 때 사용해요.

제공되는 메서드는 세 가지 작동 모드를 아우르는 6가지예요:

- **`apply(overrides)`** — 원시 CSS 변수 재정의, 선택적으로 라이트/다크 모드별 변형 지원.
- **`applyPalette({ accent })`** — 호스트에 단 하나의 강조 색상만 전달하면, 약 80개의 연관 CSS 변수가 포함된 조화로운 테마를 파생하여 적용.
- **`clear()`** — 현재 스크립트가 적용한 테마 기여분을 제거.
- **`getCurrent()`** — 확장 기능의 재정의가 포함되지 않은 사용자의 기본 테마를 읽어옴.
- **`extractColors(imageId)`** — 저장된 이미지에서 색상 팔레트 추출(`applyPalette`와 함께 사용).
- **`generateVariables(config)`** — 적용하지 않고 약 80개의 변수 세트만 생성(미리보기나 일괄 처리에 유용).

6개 메서드 모두 `app_manipulation` 권한이 필요해요. 권한이 부여되지 않은 경우 `Error: PERMISSION_DENIED:app_manipulation — grant this permission to use this API` 에러가 발생해요.

## 핵심 개념

Lumiverse의 UI는 CSS 커스텀 속성 집합(`--lumiverse-primary`, `--lumiverse-bg`, `--lumiverse-text` 등)을 기반으로 동작해요. 호스트의 테마 엔진은 사용자가 선택한 팔레트와 모드(라이트/다크)로부터 이 변수들을 채워 넣어요. `api.theme.*`는 여러분의 스크립트가 그 위에 재정의 *레이어*를 올릴 수 있게 해주며, 사용자가 테마를 변경하더라도 호스트가 스크립트의 재정의를 다시 적용하므로 테마 전환 후에도 설정이 유지돼요.

여러 스크립트가 동시에 테마를 적용할 수 있어요. 저장소는 개별 변수의 경우 키 단위로 '마지막 적용 우선(last-applied-wins)' 규칙을 따르고, 팔레트의 경우 '가장 최근 적용 우선(most-recent-wins)' 규칙을 따라요. 동일한 변수를 재정의하는 두 스크립트는 가장 최근에 실행된 스크립트의 값으로 자연스럽게 처리되며, 두 스크립트가 모두 팔레트를 적용할 경우 가장 최근 것만 채택되고 이전 것은 버려져요. 즉, 여러 스크립트가 우연히 `--lumiverse-primary`를 동시에 작성하더라도 별도의 조율 없이 자동으로 병합돼요.

정리 작업도 자동이에요: 스크립트가 비활성화되거나 삭제되면 호스트는 해당 스크립트의 기여분을 제거하고 병합된 결과를 다시 계산해요.

## 빠른 시작

활성 캐릭터에 맞게 앱 색상을 바꿔볼게요. 가장 간단한 방법은 캐릭터의 아바타에서 추출한 강조 색상으로 `applyPalette`를 호출하는 것이에요:

```js
// @triggers CHAT_SWITCHED
// @description 활성 캐릭터의 아바타에 맞춰 Lumiverse 색상을 변경해요.

const chat = await api.chats.getActive();
if (!chat?.characterId) return;

const character = await api.characters.get(chat.characterId);
if (!character?.imageId) return;

// 아바타에서 팔레트를 추출해요.
const palette = await api.theme.extractColors(character.imageId);

// 스크립트의 강조 색상으로 적용해요 — 호스트가 약 80개의 변수를 조화롭게 파생해요.
await api.theme.applyPalette({ accent: palette.dominantHsl });
```

사용자가 채팅을 전환하면 `CHAT_SWITCHED`가 발생하고, 스크립트가 새 캐릭터의 팔레트를 다시 계산하여 앱 색상을 변경해요. 스크립트가 비활성화되면 적용되었던 색상은 자동으로 제거돼요.

## 인터페이스 규격

```ts
interface ThemeAPI {
  apply(overrides: ThemeOverride):              Promise<void>;
  applyPalette(palette: ThemePaletteConfig | null): Promise<void>;
  clear():                                       Promise<void>;
  getCurrent():                                  Promise<ThemeInfo>;
  extractColors(imageId: string):                Promise<ColorExtractionInfo>;
  generateVariables(config: ThemeVariablesConfig): Promise<Record<string, string>>;
}
```

모두 비동기이며 `app_manipulation` 권한이 필요해요. 상태를 변경하는 메서드(`apply`, `applyPalette`, `clear`)는 호스트의 매크로 해석 경합에 대응하기 위해 투명한 재시도 메커니즘을 내장하고 있어요(아래의 [매크로 경합 복원력](#macro-race-resilience) 참고).

### `apply(overrides)`

원시 CSS 변수 재정의를 적용해요. 재정의는 현재 스크립트 범위로 관리되며, 다른 스크립트의 기여분에 대해 키 단위로 마지막 적용 우선 방식이 적용돼요.

```ts
interface ThemeOverride {
  variables?:        Record<string, string>;        // 모드 무관 — 항상 적용됨.
  variablesByMode?: {
    dark?:   Record<string, string>;                 // 사용자의 모드가 다크일 때 적용됨.
    light?:  Record<string, string>;                 // 사용자의 모드가 라이트일 때 적용됨.
  };
}
```

```js
await api.theme.apply({
  variables: {
    '--lumiverse-radius': '12px',
    '--lumiverse-transition-fast': '120ms',
  },
  variablesByMode: {
    dark:  { '--lumiverse-bg': '#0f0a1e' },
    light: { '--lumiverse-bg': '#fbf7ff' },
  },
});
```

`variables`와 `variablesByMode` 슬롯은 함께 조합돼요: 두 곳에 모두 존재하는 키는 병합되며, 적용 시점에 모드별 값이 모드 무관 값보다 우선해요. 사용자가 모드를 전환하면 호스트가 스크립트의 개입 없이도 적절한 값을 다시 평가하여 반영해요.

변수 이름은 `--lumiverse-*` 형식을 따르며, `apply()`에서 적용하든 `addStyle` CSS에서 읽든 동일한 이름을 사용해요. 분류별 목록은 아래의 [토큰 참조](#token-reference)를 확인하세요. `generateVariables(...)`는 런타임에 적용 가능한 전체 세트를 반환하며, 기본 `:root` 목록 외에 엔진이 파생한 몇 가지 추가 키(예: `--lumiverse-primary-contrast`)도 포함돼요.

### `applyPalette(palette)`

호스트에 하나의 강조 색상을 넘겨주면, 그로부터 파생된 약 80개의 조화로운 테마 변수 세트를 생성해줘요. `null`을 전달하면 이 스크립트의 팔레트 기여분을 지울 수 있어요(`apply`로 적용한 변수는 유지됨).

```ts
interface ThemePaletteConfig { accent: ColorHSL; }
interface ColorHSL { h: number; s: number; l: number; }  // h: 0-360, s/l: 0-100
```

```js
// 부드러운 보라색 강조:
await api.theme.applyPalette({ accent: { h: 270, s: 70, l: 60 } });

// 이 스크립트의 팔레트를 제거하되 `apply()`로 지정한 변수는 유지:
await api.theme.applyPalette(null);
```

강조 색상은 호스트가 생성하는 모든 조율된 색상 — 배경, 테두리, 호버/포커스 상태, 상태 표시 색상, 글래스 틴트 등에 영향을 줘요. 따라서 개별 변수를 직접 수정할 때 발생하는 어색함 없이 단 한 번의 `applyPalette` 호출로 *조화로운* 색상 변경이 가능해요.

**팔레트는 병합되지 않아요.** 두 스크립트가 `applyPalette`를 호출하면 가장 최근 스크립트의 강조 색상만 활성화돼요. (다만 각 스크립트가 `apply`로 적용한 개별 변수들은 현재 활성화된 팔레트 아래에서 정상적으로 병합돼요.)

### `clear()`

*현재 스크립트*가 기여한 `apply` 변수와 `applyPalette` 팔레트를 모두 제거해요. 다른 스크립트의 기여분에는 영향을 주지 않으며 멱등성을 가져요.

```js
await api.theme.clear();
```

주로 스크립트 내부 명령("테마 초기화" 버튼)이나 스크립트 비활성화 없이 모드를 변경하는 정리 작업에서 유용해요. 스크립트 비활성화나 삭제 시에는 자동으로 정리되므로 분해(teardown) 핸들러에서 명시적으로 `clear()`를 호출할 필요는 없어요.

### `getCurrent()`

사용자의 현재 *기본(base)* 테마를 읽어와요. 스크립트 재정의가 포함되지 않은 호스트의 테마 상태를 반환해요.

```ts
interface ThemeInfo {
  id:              string;
  name:            string;
  mode:            'light' | 'dark';
  accent:          ColorHSL;
  enableGlass:     boolean;
  radiusScale:     number;
  fontScale:       number;
  uiScale:         number;
  characterAware:  boolean;
}
```

```js
const theme = await api.theme.getCurrent();
console.log(`User's accent: hsl(${theme.accent.h}, ${theme.accent.s}%, ${theme.accent.l}%) (${theme.mode} mode)`);
```

사용자가 선택한 테마 톤을 유지하면서 살짝 변형하고 싶을 때 유용해요 — 예를 들어 색조(hue)는 유지한 채 밝기(lightness)만 살짝 높이는 경우:

```js
const current = await api.theme.getCurrent();
await api.theme.applyPalette({
  accent: { ...current.accent, l: Math.min(100, current.accent.l + 10) },
});
```

### `extractColors(imageId)`

Lumiverse의 이미지 테이블에 저장된 이미지로부터 색상 팔레트를 추출해요. `dominantHsl` 필드를 통해 `applyPalette`와 곧바로 연결하여 사용할 수 있어요.

```ts
interface ColorExtractionInfo {
  dominant:    ColorRGB;                              // 전체 이미지에서 가장 지배적인 색상.
  regions:     {                                      // 이미지 영역별 샘플.
    top:    ColorRGB;
    center: ColorRGB;
    bottom: ColorRGB;
    left:   ColorRGB;
    right:  ColorRGB;
  };
  flatness:    {                                      // 영역별 색상 균일도 (0–1).
    top:    number;
    center: number;
    bottom: number;
    left:   number;
    right:  number;
    full:   number;
  };
  average:     ColorRGB;
  isLight:     boolean;                               // 편의 필드: 지배 색상 휘도가 0-255 기준 152 초과(정규화 기준 약 0.596).
  dominantHsl: ColorHSL;                              // `dominant`와 동일한 색상의 HSL 표현 — applyPalette에 전달 가능.
}
```

```js
const palette = await api.theme.extractColors(imageId);
await api.theme.applyPalette({ accent: palette.dominantHsl });
```

`imageId`는 표준 이미지 테이블 ID예요 — `api.images.upload(...)`의 반환값, `character.imageId`의 값, `api.imageGen.generate(...)` 결과에 포함된 값이에요. 파일 경로나 URL을 전달하면 안 돼요.

`regions`와 `flatness` 필드는 보다 정교한 팔레트 구성을 위해 제공돼요 — 예를 들어 상단이 하늘이나 단색 배경일 때 *하단* 영역의 지배 색상을 선택하는 경우:

```js
const palette = await api.theme.extractColors(imageId);
const accent  = palette.flatness.top > 0.8           // 상단이 단색인가요 (하늘/벽)?
  ? rgbToHsl(palette.regions.bottom)                  // 대신 하단 색상을 사용해요.
  : palette.dominantHsl;
await api.theme.applyPalette({ accent });
```

(API는 영역에 대해 RGB만 제공하고 `dominantHsl`에만 HSL을 제공하므로 `rgbToHsl` 헬퍼 함수는 직접 구현해야 해요.)

### `generateVariables(config)`

테마를 직접 적용하지 않고 약 80개의 변수 세트만 생성해요. 팔레트를 미리보거나, 여러 도출 결과를 일괄 처리하거나, 전체 변수 목록을 확인하고 싶을 때 유용해요.

```ts
interface ThemeVariablesConfig {
  accent:        ColorHSL;
  mode:          'light' | 'dark';
  enableGlass?:  boolean;
  radiusScale?:  number;
  fontScale?:    number;
  uiScale?:      number;
  baseColors?:   Record<string, string>;              // 호스트의 기본 팔레트 앵커 선택적 재정의 (ColorHSL이 아닌 CSS 색상 문자열).
  statusColors?: Record<string, string>;              // 상태/에러/경고 앵커 선택적 재정의 (ColorHSL이 아닌 CSS 색상 문자열).
}
```

CSS 변수 이름과 값을 매핑한 `Record<string, string>`을 반환해요. 실제로 적용하려면 `apply({ variables: ... })`에 직접 전달하거나, 미리보기 및 비교 용도로 보관할 수 있어요.

```js
// 테마를 바로 적용하지 않고 미리보기:
const vars = await api.theme.generateVariables({
  accent: { h: 200, s: 70, l: 55 },
  mode:   'dark',
});

renderPreviewSwatches(vars);                          // UI 미리보기 코드.

// 사용자가 "적용"을 클릭했을 때 실제로 적용:
await api.theme.apply({ variables: vars });
```

런타임에 전체 변수 목록을 검사하는 용도로도 쓰여요: 임의의 강조 색상으로 `generateVariables`를 한 번 호출한 뒤 키 목록을 로그로 출력해보면 돼요.

<a id="token-reference"></a>
## 토큰 참조

호스트의 `--lumiverse-*` 디자인 토큰 목록이에요. 어떤 방식을 사용하든 이름은 **동일**해요:

- **`apply({ variables: { '--lumiverse-primary': '...' } })`** — 스크립트 테마 레이어에서 토큰 재정의.
- **`api.ui.dom.addStyle('.box { color: var(--lumiverse-text); }')`** — 스크립트가 주입하는 DOM CSS에서 토큰을 읽어 사용자의 테마를 자동 반영(`api.theme` 호출이 전혀 필요 없음).

아래 표에 기재된 값은 **다크 테마 기본값**이에요 — 사용자의 활성 테마가 이 값을 재정의할 수 있으므로, 하드코딩된 색상 대신 *토큰*을 참조해야 해요. `generateVariables(...)`는 런타임에 적용 가능한 전체 세트(이 기본 목록 외에 엔진에서 파생된 `--lumiverse-primary-contrast` 같은 몇 가지 추가 키 포함)를 반환해요.

| 그룹 | 토큰 (접미사는 그룹 기본 이름 뒤에 붙음) |
|---|---|
| **Accent (강조)** — 브랜드 보라색 | `--lumiverse-primary` (rgba(147,112,219,.9)) + `-hover` `-light` `-muted` `-text` (다크 모드에서 강조 텍스트) `-contrast` (파생됨); 투명도 `-010` `-015` `-020` `-050` |
| **Text (텍스트)** — 강조도 감소 순 | `--lumiverse-text` (.9) · `--lumiverse-text-muted` (.65) · `--lumiverse-text-dim` (.4) · `--lumiverse-text-hint` (.3) |
| **Backgrounds (배경)** — 불투명 표면 | `--lumiverse-bg` `--lumiverse-bg-elevated` (+ `-bg-elevated-040`) `-bg-hover` `-bg-dark` `-bg-darker` `-bg-deep`; 투명도 `-bg-040` `-050` `-070`; `--lumiverse-scene-text-scrim` (배경 장면 아트 위의 텍스트 스크림) |
| **Fills (채우기)** — 반투명 **검정** 스크림 (하부 요소를 어둡게 함) | `--lumiverse-fill-subtle` → `--lumiverse-fill` → `-fill-hover` `-medium` `-strong` `-heavy` `-deepest` |
| **Borders (테두리)** | `--lumiverse-border` (보라색 .12) `-border-hover` `-border-light`; 중립 회색 `--lumiverse-border-neutral` `-border-neutral-hover` |
| **Status (상태)** | `--lumiverse-danger` (#ef4444) · `--lumiverse-success` (#22c55e) · `--lumiverse-warning` (#f59e0b) — 각각 + `-015` `-020` `-050`; `--lumiverse-danger-hover`; `--lumiverse-error` (danger의 별칭) |
| **Radii (반경)** | `--lumiverse-radius-sm` (5px) `--lumiverse-radius` (8) `-radius-md` (10) `-radius-lg` (12) `-radius-xl` (16) |
| **Shadows & sheen (그림자 및 윤택)** | `--lumiverse-shadow` `-shadow-sm` `-md` `-lg` `-xl`; `--lumiverse-highlight-inset` `-md` `-lg` |
| **Transitions (전환)** | `--lumiverse-transition` (200ms ease) · `--lumiverse-transition-fast` (150ms ease) |
| **Typography (타이포그래피)** | `--lumiverse-font-family` (시스템 산세리프) `--lumiverse-font-mono` `--lumiverse-font-scale` `--lumiverse-ui-scale` |
| **Icons (아이콘)** | `--lumiverse-icon` `--lumiverse-icon-muted` `--lumiverse-icon-dim` |
| **Cards & modals (카드 및 모달)** | `--lumiverse-card-bg` (그라디언트) `-card-bg-solid` `-top` `-bottom`; `--lumiverse-modal-backdrop`; `--lumiverse-gradient-modal`; `--lumiverse-swatch-border` |
| **Chat-Sheld 글래스** | `--lcs-glass-bg` `--lcs-glass-border` `--lcs-glass-blur` `--lcs-radius` … — 호스트 내부용; 하드코딩 대신 `getCurrent()`를 통해 읽음 |

**`applyPalette` vs `apply`.** `applyPalette({ accent })`는 하나의 강조 색상으로부터 조화로운 세트 *전체*를 재생성해요. `apply({ variables })`는 *특정* 토큰만 재정의하고 나머지는 그대로 둬요. 한 번의 호출에서 둘을 뒤섞지 마세요. **대체값(Fallbacks).** 토큰은 `:root`에 선언되어 스크립트가 주입한 DOM으로 캐스케이딩돼요 — 하지만 일부 `document.body` 포털 컨텍스트에서 토큰이 설정되지 않은 상태로 읽히는 경우 rgb 대체값을 제공하세요: `var(--lumiverse-text, rgba(255,255,255,.9))`.

## 스크립트별 적용 규칙

여러 스크립트가 동시에 테마를 적용할 수 있어요. 저장소는 다음 규칙을 적용해요:

- **변수** (`apply`로 지정): 키 단위로 병합되며 마지막 적용 우선이에요. 스크립트 A가 `--lumiverse-radius: 12px`를 설정하고 스크립트 B가 `--lumiverse-radius: 8px`를 설정하면 가장 최근에 적용된 것이 활성화돼요. 각 스크립트가 설정한 다른 키들은 그대로 유지돼요.
- **팔레트** (`applyPalette`로 지정): 전체적으로 가장 최근 스크립트 우선이에요. 한 번에 하나의 강조 팔레트만 활성화될 수 있으며, 이후의 `applyPalette` 호출이 이전 호출을 대체해요.
- **모드별 변형** (`variablesByMode.dark`, `.light`): 서로 독립적이며 모드 무관 `variables`와도 독립적으로 병합돼요.

서로 관련 없는 부분을 변경하는 스크립트끼리는 조율 없이도 자연스럽게 어우러져요. 같은 변수를 두고 다투는 스크립트끼리는 마지막 쓰기 우선 규칙이 적용되어 명확하게 동작해요.

결정론적인 우선순위 — "내 스크립트의 강조 색상이 항상 우선해야 함" — 가 필요한 경우, 자주 일어나는 트리거(예: 매 `MESSAGE_SENT`)에서 다시 적용하여 항상 마지막 쓰기 상태를 유지하도록 해야 해요. 더 깔끔한 방법은 스크립트마다 서로 다른 변수를 재정의하여 충돌을 피하는 것이에요.

## 모드별 변형 (Mode-keyed variants)

사용자가 라이트 모드와 다크 모드를 전환할 때, 호스트는 `variablesByMode`를 재평가하여 적절한 변형을 적용해요. 모드 변경 이벤트에 구독할 필요 없이 호스트가 알아서 처리해줘요.

```js
await api.theme.apply({
  variables:       { '--lumiverse-radius': '12px' },          // 항상 적용.
  variablesByMode: {
    dark:  { '--lumiverse-bg': '#0f0a1e', '--lumiverse-text': '#e8e2f5' },
    light: { '--lumiverse-bg': '#fbf7ff', '--lumiverse-text': '#1a0f2e' },
  },
});
```

`variables`는 항상 적용돼요. 사용자가 다크 모드일 때는 `variablesByMode.dark`가 `variables`의 값을 덮어써요(라이트 모드도 동일). 한 가지 모드의 값만 재정의하고 싶다면 다른 모드는 비워두면 돼요:

```js
await api.theme.apply({
  variablesByMode: {
    dark: { '--lumiverse-primary-contrast': '#fff' },                       // 다크 모드만 조정.
  },
});
```

## 스크립트 비활성화 시 자동 정리

스크립트가 비활성화되거나 삭제되면 호스트는 해당 스크립트의 기여분을 제거하고 병합 결과를 다시 계산해요. 분해 경로에서 수동으로 `clear()`를 호출할 필요가 없으며, `flushThemeOnTeardown(scriptId, userId)`(`src/engine/api/theme.ts:246-259`)의 일부로 자동 실행돼요.

따라서 정리 의무 없이 안심하고 테마를 적용할 수 있어요. 실행 중간에 테마를 되돌리고 싶은 경우(예: UI의 "기본값으로 복원" 버튼)에만 명시적으로 `clear()`를 호출하면 돼요.

## 스타일 모드 (`api.chat.setStyleMode`)

> **v2.0 신규 기능.** `api.chat.setStyleMode`는 활성 채팅에 호스트가 적용하는 CSS containment(컨테인먼트)를 완화하여, 메시지에 주입된 전체 화면 오버레이가 메시지 스트림 내부에 갇히지 않고 뷰포트 전체 범위에 그려질 수 있도록 해줘요.

이 메서드는 `api.theme`가 아니라 `api.chat`에 위치하지만 테마 도구 모음의 중요한 일부예요. 앱 색상 변경(`api.theme.*`)과 메시지 내 DOM 주입(`api.ui.dom.*`)은 기본적으로 한정된 채팅 컨테이너 *내부*에 머물러요. 대규모 테마 적용이나 전체 화면 스크립트가 이 틀을 벗어나야 할 때 `setStyleMode`를 스위치로 사용해요.

```ts
setStyleMode(mode: 'bounded' | 'extension-relaxed'): Promise<void>;
```

단일 위치 인자를 받아요. (`api.chat.*`의 다른 기능들과 마찬가지로) **활성 채팅**에 대해 작동하므로 채팅이 열려 있어야 해요 — 현재 활성 컨텍스트에서 채팅 ID를 확인해요. `app_manipulation` 권한이 필요하며(`api.theme.*` 및 `api.ui.dom.*`과 동일한 게이트), 권한이 없으면 `Error: PERMISSION_DENIED:app_manipulation — grant this permission to use this API` 에러가 발생해요.

### 각 모드의 동작

- **`'bounded'` (기본값)** — 확장 기능 및 카드가 주입한 콘텐츠가 제한된 메시지 스트림 내부에 격리돼요. 메시지에 주입한 `position: fixed` 요소는 뷰포트가 아닌 채팅 컨테이너의 CSS 범위 내에 갇혀요. 이는 안전한 기본값으로, 주입된 UI가 대화 영역을 벗어나 앱 크롬을 침범하지 못하도록 막아줘요.
- **`'extension-relaxed'`** — 채팅 컨테이너의 컨테인먼트가 완화되어, 메시지에 주입된 `position: fixed` 콘텐츠가 **뷰포트** 전체 범위에 그려져요. 날씨 효과, 장면 전환 와이프, 시네마틱 비네트, 고정 HUD와 같이 주입된 DOM이나 카드 스크립트가 화면 전체를 덮어야 하는 전체 화면 오버레이에 필수적이에요.

### `'extension-relaxed'`가 필요한 경우

스크립트가 메시지에 DOM을 주입하고 그 DOM이 `position: fixed`를 사용하여 화면 전체를 덮어야 하지만 호스트의 기본 컨테인먼트로 인해 메시지 스트림 내부에 갇힐 때 사용해요. 대표적인 사례: 장면에 연결된 전체 화면 분위기 오버레이, 앱 전체 위에 얹히는 고정 프레임/HUD, 메시지 박스를 벗어나야 하는 시각 효과 등. 일반적인 `--lumiverse-*` 변수 재정의와 일반 흐름의 DOM 주입만 사용하는 경우에는 이 기능이 필요하지 않으므로 채팅을 `'bounded'` 상태로 두세요.

```js
// 채팅에 주입된 전체 화면 오버레이가 뷰포트 전체에 그려질 수 있도록 허용해요.
await api.chat.setStyleMode('extension-relaxed');
```

효과가 끝나면 다시 `'bounded'`로 되돌려 이후 주입되는 콘텐츠가 다시 컨테이너 내부에 격리되도록 하세요:

```js
await api.chat.setStyleMode('bounded');
```

### `api.ui.mountApp`과의 차이점

`setStyleMode('extension-relaxed')`는 메시지에 주입된 콘텐츠가 뷰포트 범위에 닿을 수 있도록 **채팅 내부 컨테이너**를 완화하는 것이에요. DOM 자체를 채팅 밖으로 꺼내는 것은 아니며, 요소는 여전히 메시지 내부에 존재해요. 특정 채팅에 종속되지 않고 document-body 수준에 마운트되는 호스트 소유의 독립적인 화면을 원한다면 별도의 포털 화면인 `api.ui.mountApp`을 사용해야 해요. 시각 효과가 *대화에 닻을 내리고 있으면서* 메시지 상자 밖으로 퍼져나가야 할 때는 `setStyleMode`를 쓰고, 독립적인 앱 셸 오버레이인 경우에는 `mountApp`을 사용하세요.

<a id="macro-race-resilience"></a>
## 매크로 경합 복원력

호스트에는 `commit: false` 상태로 매크로가 해석되는 동안(채팅 제목 재생성, 프롬프트 미리보기 등) 상태를 변경하는 `spindle.*` 호출(테마 쓰기 포함)이 실행되면 에러를 던지는 알려진 경합 문제가 있어요. LumiScript는 변경을 수반하는 테마 메서드(`apply`, `applyPalette`, `clear`)를 투명한 재시도 헬퍼로 감싸 처리해요: 15 / 30 / 60 / 120 / 240ms 백오프로 총 5회 시도해요.

실제로는 스크립트가 이를 인지할 일이 거의 없어요. 5회의 재시도가 모두 실패하여 에러가 노출되는 경우, 하위 Spindle 계층에서 던지는 `... is not allowed during non-committing macro resolution` 에러를 보게 돼요. 이는 지속적인 대량 매크로 해석 상황(가장 흔한 경우는 `CHAT_SWITCHED`로 인한 채팅 제목 재생성)에서만 드물게 발생해요. 이 문제가 반복해서 발생한다면 테마 쓰기 작업을 초기 콜드 스타트 트리거가 아닌 후속 트리거로 미루세요.

(구현 코드: `src/engine/api/theme.ts:165-189`, 재시도 헬퍼는 `withMacroRaceRetry`예요.)

## 자주 하는 실수

- **Hex 색상 문자열은 작동하지 않음 — accent는 HSL이어야 해요.** `api.theme.applyPalette({ accent: '#9370DB' })`는 타입 에러를 일으켜요. `{ h: 270, s: 60, l: 65 }` 형식으로 변환하거나 hex-to-HSL 변환 함수를 사용하세요.

- **`apply` 변수와 `applyPalette` 파생 변수가 기대와 다르게 조합될 수 있어요.** `applyPalette({ accent: ... })`를 실행한 후 `apply({ variables: { '--lumiverse-bg': ... } })`를 호출하면, 팔레트에서 파생된 `--lumiverse-bg`가 사용자의 apply 값으로 덮어씌워져요. 의도한 대로 동작하지만, *다른* 파생 변수들(전경색, 테두리, 글래스 틴트)은 여전히 원래 팔레트 로직에 묶여 있어 수정한 배경과 어울리지 않을 수 있어요. 팔레트 기반 테마 또는 변수 기반 테마 중 한쪽 방식을 일관되게 사용하는 것을 권장해요. 미세한 조정에는 혼합 사용도 괜찮지만 규모가 커지면 조화가 깨질 수 있어요.

- **`extractColors`는 URL이나 파일 경로가 아닌 imageId에 대해서만 작동해요.** imageId는 `api.images.upload(...)`, `character.imageId`, `api.imageGen.generate(...).imageId` 등에서 얻을 수 있어요. URL만 가지고 있다면 먼저 `api.utils.http.get(url, { responseType: 'arraybuffer' })` → `api.images.upload(...)`를 거쳐 업로드해야 해요.

- **`getCurrent`는 병합된 결과가 아닌 기본(BASE) 테마를 반환해요.** 현재 스크립트와 다른 스크립트의 재정의가 포함된 *실제* 적용 상태를 확인하는 공개 메서드는 없어요. 자신이 기여한 내용(`globalThis`나 `api.scriptStorage`에 직접 추적)과 사용자의 기본 테마 정보만 알 수 있어요.

- **팔레트는 병합되지 않아요.** 두 스크립트가 `applyPalette`를 적용하면 "가장 최근 적용"을 두고 경쟁하게 돼요. 조율이 필요하다면 `apply({ variables: { '--lumiverse-primary': ... } })`를 사용하세요 — 변수는 키 단위로 깔끔하게 병합돼요.

- **`CHAT_SWITCHED` 중 테마 쓰기가 일시적으로 실패할 수 있어요.** 매크로 경합 재시도가 대부분의 경우를 해결하지만, 채팅 진입 시의 비정상적인 폭풍 상황에서는 5회 재시도가 소진될 수 있어요. 채팅이 열릴 때마다 무거운 테마 처리를 수행하는 스크립트라면, 적용 시점을 후속 트리거로 미루거나 `generateVariables`(읽기 전용 — 경합 없음)로 미리 생성해 둔 뒤 약간 뒤에 `apply`하는 방식을 고려하세요.

- **사용자 테마의 `enableGlass: false`는 전역적으로 글래스 표면을 비활성화해요.** `getCurrent().enableGlass`로 값을 읽을 수 있으니 이를 존중해 주세요(사용자가 글래스를 꺼두었을 때 글래스 전용 변수를 강제로 주입하면 일관성이 깨질 수 있어요).

## 관련 항목

- **인앱 레퍼런스, "API 함수 → api.theme" 섹션** — 자동 생성된 메서드 목록.
- **[`concepts/permissions.md`](../concepts/permissions.md)** — `app_manipulation` 권한 (`api.ui.dom.*` 및 `api.ui.showAdvancedModal`도 제어).
- **`api.images.*` 레퍼런스** — `extractColors`에 사용할 `imageId` 출처.
- **`api.imageGen.*` 레퍼런스** — `extractColors`와 함께 사용할 수 있는 imageId를 생성하는 이미지 생성 API.
- **Lumiverse 호스트 `frontend/src/theme/variables.css`** — `--lumiverse-*` 변수 정의(기본값 및 그룹화)의 표준 소스.
