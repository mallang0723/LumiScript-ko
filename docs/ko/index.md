# LumiScript

> Lumiverse AI 채팅 애플리케이션을 위한 JavaScript 스크립팅 플랫폼이에요. 대화 이벤트에 반응하고, 동작을 자동화하며, 프롬프트 컨텍스트를 주입하고, 커스텀 도구와 매크로를 등록하며, 반응형 UI를 직접 제작할 수 있어요.

LumiScript는 Lumiverse의 확장 기능이에요. 여러분의 스크립트는 샌드박스로 보호된 Bun 서브프로세스 내부에서 서버 측으로 실행돼요. 스크립트에는 대화 메시지, 월드북, 프리셋, LLM, 영속 저장소, 호스트 앱 셸의 커스텀 DOM 및 15개 이상의 기능 네임스페이스에 접근할 수 있는 `api.*` 객체가 주어져요. 스크립트는 완전히 Lumiverse 내부에서 작성, 편집, 테스트돼요 — 외부 툴체인이나 별도의 IDE, 배포 단계가 전혀 필요 없어요. 스크립트를 저장하면 즉시 반영돼요. 스크립트 본문은 선택 가능한 엔진 — 기본 AsyncFunction 런타임 또는 더 강력한 샌드박스를 제공하는 선택적 QuickJS-WASM 격리 런타임([실행 엔진](concepts/engine.md) 참고)에서 실행돼요.

## 대상 독자

이 문서는 다음을 전제로 해요:

- 일반 사용자로서 Lumiverse를 사용해 보았고, 이제 기능을 직접 확장할 준비가 되셨어요.
- async/await 코드를 무리 없이 읽을 수 있을 만큼 JavaScript를 알고 계세요. 여기서는 JavaScript 자체를 가르치지는 않으며, LumiScript 특유의 구조와 기능만 설명해요.
- 직접 작성한 스크립트를 혼자 사용하거나 소규모 지인들과 `.lumiscript.zip` 팩으로 공유하려고 해요. 현재 LumiScript의 방향은 "소규모 테스트/개발 커뮤니티 중심, 공개 마켓플레이스 없음"이며, 문서도 이 취지에 맞춰 작성되었어요.

LumiScript 확장 기능 자체의 개발에 기여하고 싶다면(확장 기능 내부에서 실행되는 스크립트 작성이 아니라), 저장소의 gitignore 대상인 `notes/` 디렉터리에 있는 설계 기록과 회고 문서를 참고하세요.

## 여기서부터 시작하세요

| 목표 | 추천 문서 |
|---|---|
| 이번 릴리스의 새로운 기능(및 업그레이드 주의사항) 확인 | [v2.0 새로운 기능](whats-new-v2.md) |
| 10분 만에 스크립트 실행해보기 | [시작 가이드](getting-started.md) |
| 스크립트 실행 방식, `data`와 `api`의 정체 이해하기 | [트리거 모델](concepts/trigger-model.md) |
| 권한 체계, `allowDangerous`, 거부 시 예외 처리 이해하기 | [권한](concepts/permissions.md) |
| 적절한 데이터 저장소 선택하기 (variables / db / scriptStorage / enclave / files) | [저장소 모델](concepts/storage-model.md) |
| 등록된 핸들러(`broadcast.on`, `commands.onInvoked`, `macros.register` 등)의 수명 이해하기 | [핸들러 수명 주기](concepts/handler-lifetime.md) |
| 실행 엔진 선택(AsyncFunction vs QuickJS 격리) 및 워커 풀 조정하기 | [실행 엔진](concepts/engine.md) · [워커 풀](concepts/workers.md) |
| 네트워크 차단을 우회하여 로컬 모델 서버나 LAN 기기에 접근하기 | [네트워크 송신](guides/network.md) |
| 문제 진단 및 지원 보고서 내보내기 | [진단](guides/diagnostics.md) |
| 각 사용 사례에 적합한 `api.*` 네임스페이스 찾기 | 인앱 **레퍼런스(Reference)** 탭 (자동 생성된 포괄적 레퍼런스 — LumiScript 패널을 열고 레퍼런스 탭으로 전환하세요) |
| 특정 메서드의 시그니처, 인자, 필요 권한 조회하기 | 위와 동일 — 인앱 레퍼런스 또는 내보낸 치트시트(`src/assistant/corpus/cheat-sheet.md`) |
| 스크립트를 작성하면서 질문하고, 어시스턴트에게 초안 작성이나 수정 요청하기 | [Lisa와 함께 작업하기](guides/lisa.md) |
| 구체적인 기능 구현하기 (DOM 주입, LLM, 매크로, 도구, 브로드캐스트 버스, OAuth, 테마, 이미지 생성, 월드 인포, 자료 저장소, 영속 이벤트, 확장 기능 간 RPC, 공유 컴포넌트, 웹 검색, 연결 프로필, UI 탐색, 호스트/사용자 컨텍스트 등) | [DOM 주입](guides/dom-injection.md) · [LLM 호출하기](guides/llm.md) · [커스텀 매크로](guides/macros.md) · [도구 등록](guides/tools.md) · [브로드캐스트 버스](guides/broadcast.md) · [OAuth 콜백](guides/oauth.md) · [호스트 UI 테마 적용](guides/theme.md) · [이미지 생성](guides/image-gen.md) · [월드 인포](guides/world-info.md) · [페르소나](guides/personas.md) · [자료 저장소](guides/databanks.md) · [영속 이벤트](guides/persistent-events.md) · [확장 기능 간 RPC](guides/rpc.md) · [공유 컴포넌트](guides/components.md) · [웹 검색](guides/web-search.md) · [연결 프로필](guides/connections.md) · [UI 탐색](guides/ui-navigation.md) · [호스트 및 사용자 컨텍스트](guides/host-context.md) · [파일 선택기](guides/file-picker.md) · [반응형 UI 상태](guides/ui-events.md) · [메모리 코텍스 및 대화 메모리](guides/memories.md) · [전체 화면 마운트](guides/app-mount.md) · [캐릭터 카드 스크립트 번들링](guides/card-scripts.md) — 주제별 가이드 지속 추가 예정 |
| 특정 작업 레시피 찾기 (에이전트 루프, Council 도구, 동적 프롬프트 컨텍스트, 드래그 가능한 패널, 이미지 기반 테마, 상태 공유, 저장소 계층 선택, OAuth/PKCE) | **[쿡북 (Cookbook)](cookbook/index.md)** — [에이전틱 도구 루프](cookbook/agentic-tool-loop.md) · [Council 도구](cookbook/council-tool.md) · [동적 프롬프트 컨텍스트](cookbook/dynamic-prompt-context.md) · [드래그 가능한 패널](cookbook/draggable-panel.md) · [이미지 기반 테마](cookbook/theme-from-image.md) · [상태 공유](cookbook/share-state-broadcast.md) · [상태 영속화](cookbook/persist-state.md) · [OAuth (PKCE)](cookbook/oauth-pkce.md) |

## 각 리소스의 위치

- **인앱 레퍼런스(Reference) 탭.** 모든 `api.*` 메서드, 주요 타입, 이벤트, 권한, 브로드캐스트 이벤트, 런타임 지시문에 대해 자동 생성되는 표준 레퍼런스예요. 현재 실행 중인 LumiScript 버전에 항상 맞춰져 있어요 — 산문 문서는 업데이트가 늦어질 수 있지만 레퍼런스는 항상 최신이에요. **세부 스펙의 기준 진실(source of truth)로 삼으세요.**
- **인앱 Lisa (어시스턴트).** LumiScript 스크립팅 관련 질문을 위한 내장 대화형 어시스턴트예요. 레퍼런스와 동일한 말뭉치를 학습하고 있으며, 흔한 환각 방지 리디렉션, 네임스페이스 개념 설명, 트리거/권한 모델 소개 등 추가 컨텍스트를 갖추고 있어요. "이런 기능을 만들고 싶은데 어떤 원시 함수를 써야 할까?" 같은 질문에 유용해요. 자세한 설명은 [Lisa와 함께 작업하기](guides/lisa.md) 가이드를 참고하세요.
- **편집기 콘솔.** 스크립트 편집기 내부에서 스크립트가 출력하는 모든 `console.log` / `warn` / `error`가 여기에 표시되며, 거부된 보안 패턴은 `[security]` 항목으로 노출돼요. 코드를 수정하며 반복 테스트할 때 실시간으로 확인하는 곳이에요.
- **이 문서들.** 각 구성 요소가 어떻게 맞물려 동작하는지, 메서드 목록만으로는 알기 어려운 "왜 이렇게 설계되었는가"에 대한 설명과 일반적인 패턴 레시피를 담고 있어요.

## 문서 표기 규칙

- **코드 블록은 바로 실행 가능해요.** 독립적으로 보이는 스니펫은 스크립트에 필요한 권한만 승인되어 있다면 복사해서 붙여넣었을 때 그대로 작동해요.
- **권한은 명시적으로 표시돼요.** 메서드에 Spindle 권한이나 스크립트별 `allowDangerous` 토글이 필요할 때 인라인으로 안내해요.
- **버전 정보.** LumiScript 버전에 따라 동작이 다른 경우 이를 명시해요. 현재 대상 버전은 **v2.0**이에요.
- **상호 참조.** 아직 작성되지 않은 주제 링크는 *(작성 예정)* 또는 *(주제별 추가 예정)*으로 표기되어 있으며, 문서가 채워지는 대로 링크가 연결될 거예요.

## 다루지 않는 내용

이 문서는 **LumiScript 스크립트 작성**을 다뤄요. 다음 내용은 다루지 않아요:

- **Lumiverse를 일반 채팅 앱으로 사용하는 방법.** Lumiverse 사용자 문서를 참고하세요.
- **Lumiverse 확장 기능 전반을 개발하는 방법.** Lumiverse에 포함된 Spindle 개발자 문서를 참고하세요.
- **LumiScript 확장 기능 자체를 포크하고 수정하는 방법.** LumiScript는 MIT 라이선스이므로 포크가 허용되지만, 비공식적이며 공식 지원 대상이 아니에요. 포크를 진행하는 경우 저장소 루트의 [`FORKING.md`](../../FORKING.md)에 최소한의 시작 지점(빌드 명령, 저장소 구조, 공개 트리에 누락된 항목 등)이 정리되어 있어요.
