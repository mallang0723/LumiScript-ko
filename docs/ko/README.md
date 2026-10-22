# LumiScript 문서 (LumiScript Documentation)

Lumiverse 스크립팅 확장 기능인 LumiScript의 사용자 레퍼런스 문서예요.

## 목차

- [**문서 색인**](./index.md) — 여기서부터 시작하세요: 전체 개념 / 가이드 / 쿡북 트리, 스크립트 실행 방식과 `api`의 정체 안내.
- [**v2.0 새로운 기능**](./whats-new-v2.md) — 핵심인 QuickJS 격리 엔진, 새로운 `api.*` 인터페이스, 업그레이드 주의사항(사설망 송신 차단).
- [**실행 엔진 및 격리**](./concepts/engine.md) — v2.0 엔진 선택(AsyncFunction vs QuickJS 격리) 및 스크립트별 격리, 관련 [워커 풀](./concepts/workers.md), [네트워크 송신](./guides/network.md), [진단](./guides/diagnostics.md) 설정.
- [**CLI 도구**](./cli-tools.md) — LumiScript 팩 아카이브와 개별 `.js` 파일 디렉터리 간 상호 변환을 지원하는 `pack2js` 및 `js2pack`. 외부 편집기에서 편집하거나 버전 관리를 하거나 팩을 직접 작성할 때 사용하세요.

기능 확장에 따라 더 많은 문서가 추가될 예정이에요.

## 기타 문서 리소스

- **인앱 레퍼런스(Reference)** — LumiScript 스크립트 관리자에는 런타임 인터페이스(이벤트, 권한, 매크로, 주요 타입, `api.*` 함수, 내장 라이브러리, 스크립트 팩 가져오기/내보내기)를 문서화한 **레퍼런스** 탭이 있어요. 툴바의 `Export Markdown` 버튼으로 마크다운 사본을 내보낼 수 있어요.
- **소스 코드 주석** — `src/` 트리는 풍부한 JSDoc 주석을 갖추고 있어요. 엔진 모듈, API 빌더, 공유 유틸리티의 상단 주석 블록에 다른 곳에 중복되지 않는 설계 의도와 예외 케이스가 상세히 설명되어 있어요.
