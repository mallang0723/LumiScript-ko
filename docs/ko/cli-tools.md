# CLI 도구 (CLI Tools)

LumiScript는 앱 외부에서 스크립트 팩을 다루기 위한 두 가지 명령줄 도구를 `scripts/` 아래에 제공해요:

- **`pack2js`** — `.lumiscript.zip` 팩(또는 순수 `pack.json`)을 개별 `.js` 파일들과 `manifest.json`이 담긴 디렉터리로 압축 해제해요.
- **`js2pack`** — 반대 작업: `.js` 파일 디렉터리로부터 `.lumiscript.zip` 팩을 빌드해요.

둘 다 Bun 스크립트예요. 저장소 루트에서 실행되며 인앱 가져오기 기능과 동일한 검증 코드(동일한 Zod 스키마)를 공유하므로, 한 도구가 생성한 출력물은 항상 다른 도구에서 정상적으로 인식돼요.

## 도구가 필요한 이유

인앱 스크립트 관리자(Script Manager)가 스크립트 작성의 기본 인터페이스이며 대부분의 작업에 충분해요. 하지만 다음과 같이 인앱 환경이 적합하지 않은 상황을 위해 CLI 도구가 존재해요:

- **외부 편집기에서 편집할 때.** Monaco(인앱 편집기)는 간단한 수정에 좋지만, 대규모 리팩토링이나 여러 파일에 걸친 검색/바꾸기, 또는 선호하는 개발 환경을 사용할 때는 디스크 파일 형태가 훨씬 편해요.
- **버전 관리 (Git).** 매니페스트와 `.js` 파일 디렉터리 구조를 사용하면 git에서 의미 있는 diff를 확인할 수 있어요 — 파일당 스크립트 하나가 대응되며, 코드 변경과 메타데이터 변경이 명확히 분리돼요.
- **Grep 및 정적 분석 도구.** Ripgrep, ESLint, Prettier 등은 파일 단위로 동작해요. 압축된 단일 JSON 팩은 모든 내용을 내부에 감추고 있어요.
- **수작업으로 팩 작성하기.** 디렉터리에서 스크립트를 작성하고 `js2pack`으로 배포용 아카이브를 조립할 수 있어요.

## 왕복 워크플로 (Round-trip workflow)

### 내보내기-수정-가져오기

1. 스크립트 관리자에서 `↓` 버튼을 눌러 스크립트를 `.lumiscript.zip`으로 내보내세요.
2. 아카이브에 대해 `pack2js`를 실행하세요:
   ```sh
   bun scripts/pack2js.ts my-pack.lumiscript.zip ./work-dir/
   ```
3. 선호하는 편집기로 `./work-dir/` 내부의 `.js` 파일들을 수정하세요. 필요하다면 `manifest.json`을 열어 이름, 트리거, 바인딩, 폴더, 메타데이터를 수정할 수 있어요.
4. `js2pack`을 실행하여 팩을 다시 빌드하세요:
   ```sh
   bun scripts/js2pack.ts ./work-dir/ --output ./my-pack.lumiscript.zip
   ```
5. 스크립트 관리자에서 `↑` 버튼을 눌러 다시 빌드된 아카이브를 가져오세요. 가져온 스크립트는 `enabled: false` 및 `allowDangerous: false` 상태로 추가되므로 검토 후 활성화하세요.

`manifest.json`이 존재할 때 `js2pack`은 이를 기준 진실(source of truth)로 사용하므로 손실 없는 완전한 왕복 변환이 보장돼요.

### 처음부터 직접 작성하기

1. `.js` 파일들이 담길 디렉터리를 만드세요. 각 파일 상단에 선택적으로 `// @...` 프론트매터 지시문을 넣을 수 있어요(아래 레퍼런스 참고).
2. `js2pack`을 실행하여 조립하세요:
   ```sh
   bun scripts/js2pack.ts ./my-pack/
   ```
3. 생성된 `.lumiscript.zip`을 스크립트 관리자에서 가져오세요.

이 경로(`manifest.json` 없음)는 새 작업에 간편하지만 `bindings`를 표현할 수 없어요 — [제약 사항](#limitations)을 참고하세요.

---

## `pack2js` — 팩을 디렉터리로 변환

### 사용법

```
bun scripts/pack2js.ts <input> <output-dir> [--force]
bun run pack2js       <input> <output-dir> [--force]
```

두 형태는 동일해요 — `bun run pack2js`는 `package.json` 별칭이에요.

### 인자

- **`<input>`** — `.lumiscript.zip` 아카이브 또는 순수 `pack.json` 파일 경로. 확장자로 형식을 자동 감지해요.
- **`<output-dir>`** — 내용을 풀 디렉터리 경로. `--force`를 전달하지 않는 한 이미 존재하는 디렉터리를 덮어쓰지 않아요.

### 옵션

- **`--force`** — 기존 출력 디렉터리를 덮어써요. 현재 실행으로 생성되지 않은 기존 파일은 유지되며 경고 메시지에 목록으로 표시돼요(최대 10개까지 표시).

### 출력 디렉터리 구조

```
<output-dir>/
├── manifest.json       손실 없는 메타데이터. 아래 포맷 레퍼런스 참고.
└── <slug>.js           스크립트당 하나의 파일. 코드는 그대로 복사됨 —
                        추가 프론트매터 없음, 주석 변형 없음.
```

파일명은 스크립트 이름의 슬러그(slug) 형태예요: 소문자, 발음 구별 부호 제거, 영숫자가 아닌 문자는 `-`로 축소. 충돌 시 `-2`, `-3`, … 접미사가 붙어요. 빈 슬러그 이름(모두 문장부호인 경우 등)은 `script`로 대체돼요.

### 실행 예시

```sh
# 압축된 팩 풀기
bun scripts/pack2js.ts ./my-pack.lumiscript.zip ./work-dir/

# 순수 pack.json 풀기
bun scripts/pack2js.ts ./pack.json ./work-dir/

# 기존 디렉터리 덮어쓰기
bun scripts/pack2js.ts ./my-pack.lumiscript.zip ./work-dir/ --force
```

---

## `js2pack` — 디렉터리를 팩으로 변환

### 사용법

```
bun scripts/js2pack.ts <directory> [--name <pack-name>] [--output <path>]
bun run js2pack        <directory> [--name <pack-name>] [--output <path>]
```

두 형태는 동일해요 — `bun run js2pack`은 `package.json` 별칭이에요.

### 인자

- **`<directory>`** — `.js` 스크립트 파일들이 담긴 폴더 경로. 파일들과 함께 `manifest.json`이 선택적으로 포함될 수 있어요(아래 모드 참고).

### 옵션

- **`--name <name>`** — 기본 출력 파일명에 사용될 팩 이름. 기본값: 디렉터리의 기본 이름(base name).
- **`--output <path>`** — `.lumiscript.zip`의 출력 경로. 기본값: 현재 작업 디렉터리의 `./<name>.lumiscript.zip`.

### 두 가지 작동 모드

`js2pack`은 디렉터리 내용에 따라 입력 모드를 자동 감지해요. 출력의 첫 번째 줄에서 어떤 모드를 사용하는지 알려줘요.

#### 매니페스트 모드 (Manifest mode — 권장, 무손실)

입력 디렉터리에 `manifest.json`이 있을 때 실행돼요. 매니페스트가 모든 메타데이터의 기준 진실이 되며, 각 항목의 `file` 필드가 코드를 담고 있는 `.js` 파일을 가리켜요. 이 모드에서는 `.js` 파일 내부의 `// @...` 프론트매터가 무시되고 매니페스트가 완전히 우선해요.

`pack2js`가 생성하는 형태이며, `bindings`(프론트매터 지시문으로 표현 불가능함)를 왕복 보존하는 유일한 방법이에요.

`js2pack`은 매니페스트에서 참조하지 않는 디렉터리 내의 `.js` 파일에 대해 경고를 출력해요 — 이러한 파일은 고아 파일로 취급되어 빌드된 팩에서 제외돼요.

#### 프론트매터 모드 (Frontmatter mode — 직접 작성 시 대체 방식)

`manifest.json`이 없을 때 사용돼요. 각 `.js` 파일 상단의 `// @...` 주석 블록이 메타데이터를 제공해요. 지시문이 누락된 경우 기본값이 적용돼요:

- `name` — 파일명에서 파생 (`foo.js` → `"foo"`).
- `type` — `"trigger"`.
- `triggers`, `folder`, `metadata.*` — 없음.
- `bindings` — 항상 없음 (프론트매터로 표현 불가).

새 팩을 손수 작성할 때 유용해요. 바인딩이 필요하다면 매니페스트 모드 디렉터리에서 시작하세요(예: `pack2js`로 스크립트 하나를 내보내 템플릿으로 활용).

### 프론트매터 지시문 레퍼런스

프론트매터 지시문은 `.js` 파일 맨 위에 위치하는 `//` 한 줄 주석이에요. 주석이나 빈 줄이 아닌 첫 번째 줄을 만나면 해석이 중단돼요.

| 지시문 | 타입 | 설명 |
|--- |--- |--- |
| `@name` | string | 표시 이름. 파일명(확장자 제외)이 기본값. |
| `@type` | `trigger`/`library` | 스크립트 타입. 기본값 `trigger`. |
| `@triggers` | 쉼표로 구분된 목록 | Lumiverse 이벤트 이름 (`MESSAGE_SENT`, `ls:startup` 등). |
| `@folder` | string | 사이드바 폴더 레이블. |
| `@description` | string | 스크립트 관리자 메타데이터 패널에 표시되는 설명. |
| `@author` | string | 메타데이터 작성자 필드. |
| `@version` | string | 시맨틱 버전 문자열. |
| `@tags` | 쉼표로 구분된 목록 | 검색 가능한 태그 목록. |

프론트매터 라인은 일반적인 JS 주석이므로 가져온 후에도 스크립트에 그대로 남아 있어요 — 사용 전에 제거할 필요가 없어요.

### 실행 예시

```sh
# manifest.json이 있는 디렉터리에서 빌드 (매니페스트 모드)
bun scripts/js2pack.ts ./work-dir/

# 직접 작성한 디렉터리에서 빌드 (프론트매터 모드)
bun scripts/js2pack.ts ./my-pack/

# 팩 이름 및 출력 경로 재정의
bun scripts/js2pack.ts ./my-pack/ --name shared-utilities --output ./dist/shared-utilities.lumiscript.zip
```

---

## `manifest.json` 포맷 레퍼런스

`pack2js`에 의해 생성되며 매니페스트 모드의 `js2pack`에 의해 사용돼요. 구조를 알면 직접 작성할 수도 있어요. `src/utils/pack-schema.ts`의 `ManifestSchema`로 유효성을 검증하며, 유효하지 않은 매니페스트는 파일 쓰기 전에 Zod 에러로 거부돼요.

```jsonc
{
  "format": "lumiscript-manifest-v1",
  // 출처 필드 — 선택 사항, 추적용.
  "sourcePack":   "my-pack.lumiscript.zip",
  "sourceFormat": "lumiscript-pack-v1",
  "exportedAt":   "2026-04-17T00:00:00.000Z",
  "convertedAt":  "2026-04-17T06:05:50.954Z",

  // 1~100개의 스크립트 엔트리.
  "scripts": [
    {
      "name":     "Dice Roller",
      "file":     "dice-roller.js",           // 매니페스트 디렉터리 기준 상대 경로
      "type":     "trigger",                  // "trigger" | "library"
      "triggers": ["MESSAGE_SENT", "ls:startup"],
      "bindings": [
        { "type": "character", "characterId": "abc-123", "displayName": "Aphrodite" },
        { "type": "chat",      "chatId":      "def-456", "displayName": "Greeting 1/2" }
      ],
      "folder":   "Demos",
      "metadata": {
        "description": "Rolls dice",
        "author":      "mindbound",
        "version":     "1.0.0",
        "tags":        ["demo", "dice"]
      }
    }
    // ...
  ]
}
```

`scripts[n]` 아래의 모든 필드는 `name`, `file`, `type`을 제외하고 선택 사항이며, 비어 있거나 누락된 경우 생성되는 매니페스트에서 생략돼요.

<a id="limitations"></a>
## 제약 사항

- **프론트매터 모드는 `bindings`를 표현할 수 없어요.** 프론트매터 모드로 팩을 수작업하는 경우, 내보내기 전 스크립트 관리자에서 설정했던 바인딩이나 새로 추가하려는 바인딩은 `manifest.json`에 직접 작성하거나 가져온 후 인앱 바인딩 편집기에서 설정해야 해요.
- **팩당 최대 100개 스크립트** (스키마에서 강제). 인앱 가져오기 제한과 동일해요.
- **비재귀적 디렉터리 스캔.** `js2pack`은 입력 디렉터리의 최상위 레벨에서만 `.js` 파일을 읽어요. 하위 디렉터리는 무시돼요. `pack2js`가 평탄한 구조로 출력하는 방식과 일치해요.
- **도구 내부에서 JavaScript 코드를 실행하지 않음.** 스크립트는 불투명한 텍스트로 취급되며 구문 분석, 린트, 실행되지 않아요. `.js` 파일의 구문 오류는 그대로 사용자의 스크립트 관리자에 전달돼요.
- **타임스탬프가 재생성됨.** 매 `js2pack` 실행 시마다 새로운 `exportedAt`이 기록돼요. 타임스탬프는 팩의 의미적 정체성의 일부로 간주되지 않아요.

## 문제 해결

| 증상 | 원인 및 해결 방법 |
|--- |--- |
| `Error: output path already exists` | `pack2js`는 기본적으로 덮어쓰지 않아요. `--force`를 전달하거나 다른 경로를 지정하세요. |
| `Error: manifest entry "…" references missing file: …` | 매니페스트의 `file` 필드가 디렉터리에 없는 `.js`를 가리키고 있어요. 파일 이름을 바꾸거나 복원하거나 매니페스트를 수정하세요. |
| `Error: manifest.json failed schema validation` | Zod 에러 상세를 확인하세요. 대개 `type`의 오타(`"trigger"` 또는 `"library"`여야 함)이거나 잘못된 형식의 binding 항목 때문이에요. |
| `No .js files found in <dir>` | 빈 디렉터리에서 프론트매터 모드의 `js2pack`을 실행했어요. 최소 하나 이상의 `.js` 파일을 추가하거나 해당 파일을 가리키는 `manifest.json`을 추가하세요. |
| 가져온 스크립트가 `enabled: false`, `allowDangerous: false` 상태임 | 정상 동작 — 인앱 가져오기는 안전을 위해 매번 두 플래그를 초기화해요. 검토 후 수동으로 활성화하세요. |
