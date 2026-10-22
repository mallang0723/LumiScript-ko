# 한국어 용어집 (LumiScript 한국어판)

`src/i18n/ko.ts`를 번역하거나 고칠 때 이 표를 따릅니다. 호스트(Lumiverse) 한국어 UI에 이미 있는 용어는 호스트 표기를 그대로 씁니다. 형제 포크 LumiBooks 한국어판과 겹치는 용어도 같은 표기를 씁니다.

## 문체

- **라벨·탭·버튼·필드 이름**: 명사형 (`저장`, `새 스크립트`, `스크립트 가져오기`).
- **메시지·설명·도움말(툴팁)**: 해요체 (`스크립트를 저장했어요`, `연결을 선택하세요`).
- **확인 질문**: `~할까요?` (`이 스크립트를 삭제할까요?`).
- **오류**: `~하지 못했어요: {error}` 처럼 짧게. 영어 원문의 `Failed to …` / `Couldn't …` 꼴.
- **빈 상태**: `~이 없어요` (`등록된 도구가 없어요`).
- 말줄임은 원문의 `…`를 그대로 씁니다 (`불러오는 중…`).
- 영어 원문에 있는 화살표(`→`)·키 이름(`Ctrl+R`, `Shift+클릭`)·단위(`ms`, `MB`)는 그대로 둡니다.

## 번역하지 않는 것

- 코드 식별자, `api.*` 이름, 이벤트 이름(`MESSAGE_SENT`, `ls:startup` …), 권한 ID(`chat_mutation` …), 지시문 이름, 저장 키, 설정 키.
- 카드 묶음 키 `extensions.lumiscript`, 팩 형식 이름(`lumiscript-pack-v1`), 파일 확장자(`.lumiscript.zip`).
- 백틱(`` ` ``)으로 감싼 코드 조각, 함수·필드 이름(`allowDangerous`, `lookup_api`, `globalThis`).
- 제품·기술 이름: LumiScript, Lumiverse, Spindle, Monaco, IntelliSense, QuickJS, AsyncFunction, WASM, SSRF, Discord, Council(호스트도 영어 그대로).
- Lisa 지식 코퍼스(`src/assistant/corpus/`)는 영어로 유지합니다(`docs/ko-fork.md` 참고).

## 호스트(Lumiverse) 표기를 따르는 용어

| 영어 | 한국어 |
|---|---|
| extension / extensions | 확장 / 확장 기능 |
| permission | 권한 |
| connection | 연결 |
| character | 캐릭터 |
| chat | 채팅 |
| world book | 월드북 |
| lorebook | 로어북 |
| databank | 자료 저장소 |
| persona | 페르소나 |
| preset | 프리셋 |
| regex script | 정규식 스크립트 |
| diagnostics | 진단 |
| settings | 설정 |
| save / cancel / delete | 저장 / 취소 / 삭제 |
| import / export | 가져오기 / 내보내기 |
| enable / enabled / disabled | 활성화 / 활성화됨 / 비활성화됨 |
| rename | 이름 변경 |
| folder / new folder | 폴더 / 새 폴더 |
| tool | 도구 |
| clear | 지우기 |
| copy | 복사 |
| close | 닫기 |
| confirm | 확인 |
| retry | 다시 시도 |
| search | 검색 |
| prompt | 프롬프트 |
| Prompt Breakdown | 프롬프트 세부 구성 |
| dry run | 모의 실행 |
| tokenizer | 토크나이저 |
| web search | 웹 검색 |
| image / image generation | 이미지 / 이미지 생성 |
| theme | 테마 |
| drawer | 서랍 |
| notification | 알림 |
| injection, inject | 주입 |
| advanced | 고급 |
| reset | 재설정 |
| apply | 적용 |
| send | 전송 |
| stop | 중지 |
| context | 컨텍스트 |

## LumiScript 용어

| 영어 | 한국어 | 비고 |
|---|---|---|
| script | 스크립트 | |
| trigger script / library script | 트리거 스크립트 / 라이브러리 스크립트 | 목록 탭 이름은 `스크립트` / `라이브러리` |
| library (shared code) | 라이브러리 | |
| trigger | 트리거 | 이벤트 이름 자체는 영어 그대로 |
| event | 이벤트 | |
| handler | 핸들러 | |
| directive | 지시문 | 지시문 이름(`@...`)은 그대로 |
| binding | 바인딩 | |
| run / runs (명사) | 실행 | `Last run failed` = 마지막 실행 실패 |
| fire (an event / a script) | 실행 / 발생 | 스크립트는 `실행`, 이벤트는 `발생` |
| reload (a script) | 다시 불러오기 | |
| body (script body) | 본문 | |
| pack (script pack) | 팩 (스크립트 팩) | |
| bundle (into a card) | 카드에 묶기, 묶음 | `Bundled scripts` = 묶인 스크립트 |
| card scripts | 카드 스크립트 | 캐릭터 카드에 묶여 오는 스크립트 |
| consent | 동의 | |
| dangerous mode | 위험 모드 | 설정 키 `allowDangerous`는 그대로 |
| variable | 변수 | |
| scope (local / global / character / chat) | 범위 (로컬 / 전역 / 캐릭터 / 채팅) | |
| storage | 저장소 | |
| collection / record | 컬렉션 / 레코드 | 스크립트별 JSON DB |
| session store | 세션 저장소 | |
| secret | 비밀값 | |
| inspect / inspector | 살펴보기 / 검사기 | |
| console / log entry | 콘솔 / 로그 항목 | |
| worker | 워커 | script-runner 하위 프로세스 |
| engine | 엔진 | |
| sandbox | 샌드박스 | |
| isolation / shared context | 격리 / 공유 컨텍스트 | |
| interceptor | 인터셉터 | |
| pre-assembly / post-assembly | 조립 전 / 조립 후 | 프롬프트 조립 단계 |
| macro | 매크로 | |
| drawer tab | 서랍 탭 | |
| input-bar action | 입력창 동작 | |
| float widget | 플로팅 위젯 | |
| dock panel | 독 패널 | |
| toast | 알림 | |
| autosave | 자동 저장 | |
| editor / code editor | 편집기 / 코드 편집기 | |
| Reference (탭) | 레퍼런스 | `API reference` = API 레퍼런스 |
| Lisa | Lisa | 어시스턴트 이름. 원어 그대로 |
| assistant | 어시스턴트 | |
| thread (Lisa) | 대화 | `New thread` = 새 대화 |
| notes / memory (Lisa) | 메모 | 사용자에 대해 Lisa가 남기는 기억 |
| compact (conversation) | 압축 | `Compact now` = 지금 압축 |
| context window | 컨텍스트 창 | |
| attach (script / file) | 첨부 | 호스트의 `Attach`(연결)와 다른 뜻 |
| cheat-sheet | 요약표 | |
| snapshot | 스냅샷 | |
| report | 보고서 | |
| support | 지원 | |
| network / allowlist | 네트워크 / 허용 목록 | |
| outbound HTTP | 외부 HTTP | |
| private address / LAN | 사설 주소 / LAN | |
| temperature / top-p / max tokens | 온도 / Top-P / 최대 토큰 | |
| parallel tool calls | 병렬 도구 호출 | |
| prompt caching | 프롬프트 캐싱 | |
| master enable | 전체 활성화 | |
| template (starter code) | 템플릿 | |
| unsaved changes | 저장되지 않은 변경 | |

