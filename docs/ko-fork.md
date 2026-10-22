# LumiScript 한국어판 (포크) 안내

이 저장소는 [mindbound/lumiscript](https://github.com/mindbound/lumiscript) v2.0.0의 화면 문구를 한국어로 옮긴 비공식 포크입니다. 원작은 외부 PR을 받지 않으므로(`FORKING.md`) 독립 포크로 유지합니다. 기능 코드는 원작과 같고, 번역 계층·한국어 카탈로그·확장 정체성만 바꿨습니다.

## 번역 계층 설계

원작에는 i18n 계층이 없고 영어 문구가 `.tsx` 파일 곳곳에 하드코딩돼 있습니다. 이 포크는 가장 작은 계층을 새로 넣었습니다.

- **영어 원문이 곧 키입니다.** `t('Save')`, `t('Deleted {name}', { name })`. 카탈로그(`src/i18n/ko/*.ts`)는 영어 → 한국어 사전이고, 없는 키는 영어 원문을 그대로 보여 줍니다.
- **왜 이 방식인가:** 원작 코드를 고칠 때 문자열을 `t(…)`로 감싸기만 하면 되고, 영어 문구가 원래 자리에 그대로 남습니다. 원작이 문구를 바꾸거나 새 문구를 넣어도 병합 충돌은 그 줄에서만 나고, 번역이 없는 동안에는 영어로 보여 앱이 깨지지 않습니다. 별도 키 이름(`settings.engine.title` 같은)을 만들면 원작 줄마다 키 이름을 새로 지어야 해서 diff가 커지고 병합할 때마다 키를 다시 맞춰야 합니다.
- **언어는 빌드할 때 고정됩니다.** `package.json`의 `build:backend`/`build:frontend`가 `--define 'LUMISCRIPT_LOCALE="ko"'`로 번들을 만듭니다(LumiBooks 한국어판과 같은 방식). 실행 중 언어 전환은 없으므로 `t()`를 모듈 최상단(정적 배열, 기본 props)에서도 쓸 수 있고, React 컨텍스트나 훅이 필요 없습니다.
- **테스트와 타입 검사는 영어입니다.** define 없이 소스를 직접 실행하면(`bun test`, `typecheck`) `t`가 키를 그대로 돌려줍니다. 원작 테스트가 영어 문구를 검사하므로 그대로 통과합니다. 한국어 쪽은 `tests/i18n/ko-catalog.test.ts`가 따로 검사합니다.
- **문장 단위 키, `{이름}` 자리표시자.** 조각을 이어 붙이지 않습니다(한국어 어순이 다름). 영어 복수형은 `n === 1 ? t('{n} script') : t('{n} scripts')`처럼 영어 출력을 바꾸지 않고 키를 둘로 나눕니다.
- **JSX가 섞인 문장**은 `tx('… {link} …', { link: <a>…</a> })`(`src/i18n/react.ts`)로 씁니다.
- **한계:** 같은 영어 단어가 문맥마다 다른 한국어가 필요하면 키가 하나라 구분할 수 없습니다. 지금은 `Memory` 하나가 걸려(Lisa 메모 = `메모`, 진단의 메모리 사용량) 진단 쪽을 영어로 두었습니다. 더 생기면 문맥 인자를 받는 변형(`t(key, args, context)`)을 넣는 것을 검토하세요.
- **번들:** 카탈로그 전체가 프런트엔드와 백엔드 번들 양쪽에 들어갑니다(각각 약 140KB 증가).

## 원작과 다른 파일

| 파일 | 변경 |
|---|---|
| `src/i18n/index.ts`, `src/i18n/react.ts` | **신규.** `t`, `tx`, `APP_LOCALE`, `createTranslator` |
| `src/i18n/ko.ts`, `src/i18n/ko/*.ts` | **신규.** 한국어 카탈로그(화면 영역별로 나눔: common, manage, storage, assistant, panel, cardscripts, backend) |
| `tests/i18n/ko-catalog.test.ts` | **신규.** 카탈로그 검사(아래) |
| `src/**/*.tsx`, 일부 `src/**/*.ts` | 화면 문구를 `t(…)`/`tx(…)`로 감쌈, `import { t } …` 한 줄 추가. 영어 출력은 원작과 같음 |
| `src/assistant/system-prompt.ts` | 한국어 빌드에서만 Lisa에게 한국어로 답하라는 지시 한 문단 추가(`REPLY_LANGUAGE_DIRECTIVE`) |
| `src/i18n/locale-css.ts`, `src/frontend.tsx` | **신규** 한국어 빌드 전용 CSS 한 줄(`word-break: keep-all`) — 한글이 음절마다 줄바꿈되어 `트/리/거`처럼 세로로 깨지는 것을 막음. 패널 CSS 뒤에 붙임 |
| `src/assistant/consolidate-memory.ts`, `src/engine/*.ts`, `src/utils/*.ts`, `src/backend.ts` | 사용자에게 보이는 알림·오류만 `t(…)`로 감쌈 |
| `tests/bundle-size.test.ts` | 백엔드 번들 예산 1,350,000 → 1,550,000 (한국어 카탈로그 약 140KB가 백엔드에도 들어감) |
| `package.json` | `build:backend`, `build:frontend`에 `--define 'LUMISCRIPT_LOCALE="ko"'` |
| `spindle.json` | `identifier`, `version`, `name`, `author`, `github`, `homepage`, `description` |
| `README.md` | 맨 위 한국어 안내 섹션 |
| `docs/ko-fork.md`, `docs/ko-glossary.md` | **신규.** 이 문서와 용어집 |
| `dist/backend.js`, `dist/frontend.js` | 빌드 산출물. 한국어로 다시 생성 (직접 고치지 않음). `dist/script-runner.js`는 번역 대상 코드가 없어 원작 파일 그대로 |

`LICENSE`는 바꾸지 않았습니다.

## 카탈로그 검사 (`tests/i18n/ko-catalog.test.ts`)

`src/`의 모든 `t(`/`tx(` 호출을 정적으로 읽어서 검사합니다.

- 첫 인자가 문자열 리터럴인지 (동적 키 금지)
- **누락 키:** 코드에서 쓰는 키가 카탈로그에 모두 있는지 — 원작 병합 후 새 문구가 생기면 여기서 실패합니다
- **안 쓰는 키:** 카탈로그에만 남은 키 — 원작이 문구를 바꾸거나 지우면 여기서 실패합니다
- **인자 일치:** 키와 번역의 `{자리표시자}` 집합이 같은지
- **미번역:** 번역 값이 비었거나 한글이 없는지 (제품 이름 등 소수 예외는 테스트 안 목록)
- **코드 보존:** 키의 `` `백틱` `` 조각, `api.*` 이름, `UPPER_SNAKE` 이벤트 이름이 번역에 그대로 있는지
- 여러 영역 파일에 같은 키가 있으면 번역이 같은지

## 확장 ID와 그 결과

- **ID: `lumiscript_ko`.** Lumiverse는 같은 `identifier`의 확장을 두 번 설치하지 못하므로(`Extension "…" is already installed`) 원작과 나란히 설치할 수 있게 바꿨습니다. 호스트 규칙 `/^[a-z][a-z0-9_]*$/`를 따릅니다.
- **버전: `2.0.0+ko`.** 원작 버전에 semver 빌드 메타데이터를 붙였습니다. 호스트는 버전을 문자열로만 저장·표시합니다. LumiScript 자체 업데이트 확인(`backend.ts`의 `checkForUpdates`)은 `github` 저장소의 `main` 브랜치 `spindle.json`을 받아 **문자열이 다를 때만** 알림을 띄우므로, 이 포크 저장소(기본 브랜치 `master`)를 보게 되고 `+ko`가 문제를 일으키지 않습니다. 원작과 마찬가지로 기본 브랜치가 `main`이 아니어서 이 확인은 사실상 조용히 건너뜁니다.

### 호스트가 ID로 나누는 것 (자동으로 바뀜)

| 대상 | 근거 (Lumiverse 1.2.5) | 결과 |
|---|---|---|
| 확장 저장소 (`spindle.userStorage`, 공유/임시 파일) | `src/spindle/manager.service.ts` `storageDir()` = `<extensions>/<identifier>/storage`, `ephemeral-pool.service.ts` | **원작과 저장소가 분리됩니다.** 스크립트·설정·변수·스크립트 DB·비밀값·Lisa 대화와 메모가 넘어오지 않습니다 |
| 권한 허용 | `managerSvc.hasPermission(identifier, …)` | 한국어판에 권한을 따로 허용해야 합니다 |
| 공유 RPC 엔드포인트 | `src/spindle/shared-rpc.ts` `normalizeOwnedSharedRpcEndpoint()` (소유자 접두사), LumiScript `src/engine/api/rpc.ts` | `api.rpc`로 공개한 엔드포인트가 `lumiscript_ko.<채널>`이 됩니다. 다른 확장이나 스크립트가 `lumiscript.<채널>`을 읽고 있었다면 이름을 바꿔야 합니다 |
| OAuth 콜백 주소 | `src/routes/spindle-oauth.routes.ts` `/:identifier/callback` | `api.oauth.getCallbackUrl()`이 `/api/spindle-oauth/lumiscript_ko/callback`을 돌려줍니다. 외부 서비스에 등록한 redirect URI를 바꿔야 합니다 |
| 기본 매크로 분류 | `worker-host.ts` `extension:${identifier}` | LumiScript는 분류를 `extension:lumiscript`로 직접 지정하므로 **바뀌지 않습니다** |

### 호스트가 설치(확장 레코드)별로 나누는 것 (충돌 없음)

도구 등록(`extension_id:이름`), 백엔드 프로세스(`kind`/`key` 맵은 확장 워커마다 따로), 독 패널·캐릭터 편집기 탭(`nextId(extensionId, …)`)은 확장마다 따로라서, `lumiscript-script-runner`·`lumiscript-bundled` 같은 이름은 그대로 두어도 원작과 겹치지 않습니다. 다만 Council 등에서 원작의 도구를 골라 두었다면 한국어판 도구는 따로 골라야 합니다.

### 일부러 바꾸지 않은 것

| 이름 | 이유 |
|---|---|
| 캐릭터 카드의 `extensions.lumiscript` | 원작 카드와의 호환. 원작에서 묶은 카드를 한국어판이 읽고, 그 반대도 됩니다 |
| 팩 형식 `lumiscript-pack-v1` / `lumiscript-manifest-v1`, 파일 `*.lumiscript.zip` | 원작과 팩을 주고받기 위해. **원작에서 옮겨 올 때는 팩으로 내보내고 가져오세요** |
| 매크로 분류 `extension:lumiscript`, 내장 매크로 이름(`lumiScriptActive` …) | 프리셋에서 쓰는 이름 그대로 |
| `ls_*` 메시지 타입, `ls-*` CSS 클래스, `data-ls-*` 속성, `__lumiscript_*` 내부 ID | 확장 내부용. 저장 형식과 테스트가 이 이름에 묶여 있음 |
| 다운로드 파일 이름(`lumiscript-diagnostics-….md`, `lumiscript-reference-….md`) | 원작과 같음 |

### 원작과 동시에 켜면

둘 다 설치는 되지만 **하나만 켜세요.**

- 매크로 이름은 호스트 전체에서 하나뿐이고 먼저 등록한 확장이 가집니다(`MacroRegistry`). 나중에 켜진 쪽의 `{{lumiScriptActive}}` 등과 스크립트 매크로는 조용히 등록되지 않습니다.
- 두 확장 모두 캐릭터 카드의 `extensions.lumiscript`를 읽으므로, 카드를 가져올 때 동의 창이 두 번 뜨고 양쪽에서 스크립트가 실행될 수 있습니다.
- 패널 CSS(`ls-*` 클래스)는 전역이라, 두 판의 버전이 달라지면 나중에 불러온 쪽의 스타일이 이깁니다.

### 원작에서 옮겨 오기

1. 원작 LumiScript의 스크립트 목록에서 **내보내기(↓)** 로 팩(`.lumiscript.zip`)을 받습니다.
2. 원작을 끄고 한국어판을 켠 뒤 **가져오기(↑)** 로 팩을 엽니다.
3. 설정(엔진·워커·네트워크 허용 목록·Lisa 연결 등), 변수, 스크립트 DB, 비밀값, Lisa 대화는 팩에 들어 있지 않으니 다시 맞춥니다.
4. OAuth를 쓰는 스크립트는 외부 서비스의 redirect URI를 `/api/spindle-oauth/lumiscript_ko/callback`으로 바꿉니다.

## Lisa의 한국어 답변

`src/assistant/system-prompt.ts`의 `REPLY_LANGUAGE_DIRECTIVE`가 한국어 빌드에서만 "한국어(해요체)로 답하되 코드·`api.*` 이름·식별자·이벤트 이름·권한 ID·런타임 오류 원문은 영어 그대로 두라"는 한 문단을 HOW TO RESPOND 절에 덧붙입니다. 영어 빌드에서는 빈 문자열이라 원작 프롬프트(와 프롬프트 캐시 앞부분)가 그대로입니다. Lisa의 페르소나·API 요약표·지식 자료는 영어 그대로입니다. 빈 대화에 보이는 예시 질문 4개는 한국어로 옮겼습니다(누르면 입력창에 사용자 메시지로 들어감). 실제 모델 호출로 검증하지는 않았습니다.

## 번역하지 않은 것

- **결정 보류:** 레퍼런스 탭의 API 설명(트리거 모델·샌드박스·지시문·매크로·내장 라이브러리·스크립트 팩 설명 문단과 각 표의 설명 칸), `docs/`, Lisa 지식 자료(`src/assistant/corpus/`). 레퍼런스 탭은 절 제목·표 머리글·버튼만 번역했습니다. 그래서 영어 설명 문단이 가리키는 제목(예: "**Permission Matrix**")이 화면에서는 한국어(`권한 표`)로 보입니다.
- 코드 식별자, `api.*` 이름, 이벤트 이름, 권한 ID, 지시문 이름, 저장 키, 코드가 비교·파싱하는 문자열.
- 개발자용 문구: `console.*`·`spindle.log.*`, 스크립트에 던져지는 API 오류(`api.db` 크기 초과 등), 스크립트 콘솔의 `[lumiscript] …`·`[security] …` 줄.
- 내보내는 파일의 틀: 진단 보고서 마크다운(`serialize-markdown.ts`)의 머리글, 레퍼런스 마크다운 내보내기. 단 진단 **검사 이름·메시지**는 `engine/diagnostics.ts`에서 번역되므로 보고서 안에도 한국어로 들어갑니다(Lisa의 `read_diagnostics` 도구도 한국어를 봅니다). 원작 지원 채널에 보고서를 보낼 때는 이 점을 감안하세요.
- 호스트·프로바이더·라이브러리가 준 오류 원문(`String(err)`, Zod/jsonquery 오류)은 그대로 표시합니다. 우리 문장만 `{error}` 자리표시자로 감쌌습니다.

### 화면에 영어로 남는 문구 (의도함)

`dist/frontend.js`를 검색하고 소스의 JSX 문구·속성을 AST로 훑어 확인한 목록입니다.

| 위치 | 문구 | 이유 |
|---|---|---|
| 레퍼런스 탭 | API 설명, 예시 코드, `silent`·`string` 배지 | 결정 보류 / 타입 값 |
| 설정, 진단, 편집기 | `LumiScript`, `AsyncFunction`, `IntelliSense`, `Top-P`, `Lisa` 버튼 | 제품·기술 이름 |
| 상태 탭 | `council` 배지, `ms` 단위, 이벤트 이름 배지(`MESSAGE_SENT`) | 호스트 용어·단위·이벤트 이름 |
| 저장소 | `ID`, `JSON` 버튼, `id`/`createdAt`/`updatedAt` 필드, `scriptStorage ·` 머리글, JSON 타입 칩(`string`, `number` …) | 필드·API·타입 이름 |
| 저장소 → 컬렉션 | 범위 줄의 `characterId:` / `chatId:` 툴팁 | 코드 형식, 테스트가 검사 |
| 진단 | `Memory` 라벨과 표 머리글 | 키 `Memory`가 Lisa 메모 패널에서 `메모`로 쓰여 한 키에 두 뜻을 줄 수 없음(설계 한계 참고) |
| 진단 | 테마 덮어쓰기 줄 안의 `var(s)`, `palette` | 표가 아니라 보고서·Lisa용 메시지 안쪽 |
| 편집기 문제 해결 안내 | `services.msc`, `Windows Font Cache Service`, `C:\Windows\System32\FNTCACHE.DAT`, `about:profiles`, `cdn.jsdelivr.net` | 실제 서비스·경로·주소 |
| 팩 내보내기 | `my-scripts` 자리표시자(기본 팩 이름), `.lumiscript.zip` | 파일 이름 |
| Lisa 파일 첨부 | `name.md` 자리표시자, `userfiles/` | 파일 이름 |
| 콘솔 | 항목 종류(`LOG`, `WARN` …), 복사 형식 | 로그 형식 |
| 백엔드 | `Imported from Lisa — {시각}` 스크립트 이름과 출처 머리글, 카드 설치 바인딩의 `this character` | 저장되는 데이터·코드 |
| 날짜 | 오래된 Lisa 대화 날짜 | `toLocaleDateString`이 브라우저 로캘을 따름 |


## 원작 따라가기

```sh
git fetch upstream
git merge upstream/master
```

충돌이 나기 쉬운 곳과 처리:

- **`src/**` 컴포넌트:** 원작이 문구를 바꾼 줄에서 충돌이 납니다. 원작 줄을 받고 문자열만 다시 `t(…)`로 감쌉니다. `import { t } …` 줄 충돌은 둘 다 살립니다.
- `spindle.json`: 포크 값(ID·이름·작성자·주소·설명)은 유지하고, `version`은 원작 새 버전에 `+ko`를 붙입니다. 권한·`minimum_lumiverse_version` 등 나머지는 원작을 따릅니다.
- `package.json`: 원작 변경을 받고 두 스크립트의 `--define 'LUMISCRIPT_LOCALE="ko"'`만 다시 붙입니다.
- `src/assistant/system-prompt.ts`: 원작 변경을 받고 `REPLY_LANGUAGE_DIRECTIVE` 정의와 그 펼침 한 줄만 다시 넣습니다.
- `README.md`: 맨 위 한국어 섹션만 유지하고 아래는 원작을 받습니다.
- `dist/*`, `src/script-runner/generated/*`, `src/assistant/corpus/*`, `src/types/editor-lib.ts`: 손으로 병합하지 말고 원작 쪽을 받은 뒤(`git checkout --theirs …`) 다시 빌드합니다.

병합 후 번역 상태 확인:

```sh
bun test tests/i18n   # 누락 키(새 문구) · 안 쓰는 키(바뀐/지운 문구) · 인자 불일치 · 미번역
git diff ORIG_HEAD -- 'src/**/*.tsx' | grep "^[-+].*t('"   # 바뀐 문구 훑어보기
```

새로 감싸지 않은 영어 문구는 테스트가 잡지 못합니다(감싸야 검사 대상이 됨). 병합한 diff에서 새 JSX 문구·`title=`·`placeholder=`를 훑어보고, 빌드 뒤 `dist/frontend.js`에서 영어 문구를 검색해 확인하세요. 다 고친 뒤 `bun test && bun run build`를 돌리고 `dist/`를 함께 커밋합니다.

### 빌드 산출물에 대해

`dist/`는 원작처럼 저장소에 커밋합니다(Lumiverse가 설치할 때 `dist/`를 그대로 씀). 로컬 Bun 버전이 원작 CI와 다르면 압축(minify) 결과가 달라서 `dist/` diff가 커 보일 수 있습니다. `bun run build`는 `src/script-runner/generated/vm-*-bundle.ts`도 다시 만드는데, Bun 버전 차이로만 바뀐 경우에는 커밋하지 않고 원작 파일을 유지합니다.
