# 다이어그램 (Diagrams)

`docs/concepts/` 및 `docs/guides/`의 마크다운 문서에서 참조하는 다이어그램을 위한 Typst + Fletcher 소스 파일과 생성된 SVG 파일들이에요.

## 작업 워크플로

1. 수정하려는 다이어그램의 `.typ` 소스 파일을 편집하세요.
2. 일치하는 `.svg` 파일을 다시 생성하세요:
   - 단일 다이어그램: `typst compile --format svg docs/diagrams/<name>.typ docs/diagrams/<name>.svg`
   - 모든 다이어그램: `bash scripts/build-diagrams.sh`
3. `.typ` 소스와 다시 생성된 `.svg`를 **둘 다** 커밋하세요. 마크다운 파일은 `![alt](path)`를 통해 `.svg`를 직접 참조하므로, 문서가 어디서든 정상 렌더링되려면 SVG 파일이 커밋되어 있어야 해요.

## Typst 설치하기

Typst는 단일 실행 바이너리예요. 선호하는 방식을 선택하세요:

- **바이너리 직접 다운로드**: <https://github.com/typst/typst/releases>
- **winget**: `winget install Typst.Typst`
- **Homebrew**: `brew install typst`
- **Cargo**: `cargo install --locked typst-cli`

Fletcher 다이어그램 패키지(`@preview/fletcher:0.5.8`)는 첫 컴파일 시 Typst Universe에서 자동으로 다운로드되어 로컬에 캐시되므로 별도의 설치 과정이 필요 없어요.

## 스타일 규칙

이 폴더의 모든 다이어그램은 시각적 통일성을 위해 동일한 색상 팔레트를 사용해요:

| 요소 | 색상 | 출처 |
|---|---|---|
| 테두리 및 연결선 | `#9370DB` | Lumiverse 표준 보라색 (rgb 147, 112, 219) |
| 상자 및 레이블 배경 | `#F0EAF7` | 연한 라벤더 보라색 — 밝은 배경과 어두운 배경 모두에서 가독성 확보 |
| 모든 텍스트 | `#2D1B4E` | 짙은 보라색 — 배경과 강한 대비 유지 |

이 팔레트는 Lumiverse의 기본 테마에서 가져온 것이에요(호스트 저장소의 `frontend/src/theme/variables.css`에 표준 토큰 정의가 있음).

새 `.typ` 작성 시 활용할 수 있는 보일러플레이트:

```typst
#import "@preview/fletcher:0.5.8" as fletcher: diagram, node, edge, shapes

#set page(width: auto, height: auto, margin: 0.4cm, fill: none)

#let lumi-purple = rgb("#9370DB")
#let lumi-fill   = rgb("#F0EAF7")
#let lumi-text   = rgb("#2D1B4E")

#set text(
  font: ("Inter", "Segoe UI", "Helvetica", "Arial"),
  size: 10pt,
  fill: lumi-text,
)

#diagram(
  spacing: (2cm, 2.5cm),
  node-stroke: 1.5pt + lumi-purple,
  node-fill:   lumi-fill,
  node-corner-radius: 4pt,
  node-inset:  10pt,

  edge-stroke: 1.5pt + lumi-purple,

  // ... 노드와 엣지 작성 ...
)
```

`#set page(fill: none)`은 SVG 배경을 투명하게 만들어 마크다운 뷰어의 배경색이 비치도록 함으로써 라이트/다크 테마 모두에 자연스럽게 어우러지도록 해줘요.

## 현재 다이어그램 목록

| 소스 파일 | 참조 문서 | 설명 |
|---|---|---|
| `storage-model.typ` | `docs/concepts/storage-model.md` | 저장소 계층 선택을 위한 결정 트리 |
| `llm.typ` | `docs/guides/llm.md` | LLM API 원시 기능 선택 흐름 |
| `tools.typ` | `docs/guides/tools.md` | 핸들러로 수렴하는 도구 디스패치 경로 |

## 왜 Typst + Fletcher인가요? (D2나 Mermaid가 아닌 이유)

문서가 확장됨에 따라 다이어그램 도구는 Mermaid → D2 → Typst+Fletcher 순으로 전환되었어요. 각 전환은 명확한 한계 때문이었어요:

- **Mermaid (dagre 자동 배치)** — 비대칭 트리와 긴 엣지 레이블에서 실패했어요. 한쪽 가지가 깊고 다른 쪽이 단일 리프일 때 레이블이 겹쳤고, 수동 재정의 수단이 없었어요.
- **D2 (ELK 자동 배치)** — 비대칭 트리에서는 훨씬 우수했지만, `edgeLabels.placement` 수동 재정의를 노출하지 않아요. 수렴 지점에서 ELK가 레이블을 겹치게 배치할 때 해결책이 없었어요.
- **Typst + Fletcher** — 명시적 그리드 좌표 기반이에요. 위치를 직접 작성해요. 자동 배치와 싸울 필요가 없으며, 코드가 조금 더 들지만 어떤 다이어그램이든 원하는 레이아웃을 정확히 구현할 수 있어요.

다음에 해당하는 경우 Typst+Fletcher가 특히 적합해요:

- 셋 이상의 소스가 단일 싱크로 수렴할 때
- 여러 줄의 엣지 레이블을 특정 위치에 정확히 배치해야 할 때
- 실선과 점선 엣지가 시각적으로 겹치지 않아야 할 때
- 하나의 노드가 매우 많은 자식을 가질 때 (팬아웃 사례 — `storage-model.typ`의 빗살 패턴 참고)

짧은 레이블을 가진 단순한 직선형 플로우차트라면 D2(또는 Mermaid)로도 충분해요. 수동 좌표는 과해요.

## 비교 치트시트

이전 세대의 `.d2` 소스를 사용해 보신 분들을 위한 D2 개념 → Typst + Fletcher 개념 매핑:

| 항목 | D2 | Typst + Fletcher |
|---|---|---|
| 레이아웃 | 자동 (ELK) | 수동 좌표 지정 |
| 노드 위치 | 자동 추론 | `(col, row)` 튜플 |
| 엣지 경로 | 자동 추론 | 웨이포인트 (명시적 또는 `"d,r,u,l"` 축약형) |
| 레이블 위치 | 자동 추론 (재정의 불가) | `label-pos: (seg, %)` + `label-side` |
| 팔레트 | `style: { fill: ..., stroke: ... }` | `node-fill`, `node-stroke`, `edge-stroke` |
| 페이지 배경 | `style.fill: transparent` | `#set page(fill: none)` |
| 여러 줄 노드 레이블 | 따옴표 문자열 내 `\n` | 콘텐츠 블록 `[a\\ b]` |
| 레이블 내 인라인 코드 | 일반 문자열 | `` `monospace` `` 원시 인라인 |
| 재생성 명령 | `d2 --layout elk in.d2 out.svg` | `typst compile --format svg in.typ out.svg` |
| 소스 확장자 | `.d2` | `.typ` |

## 주의사항

- **Fletcher 버전을 `0.5.8`로 고정하세요.** 0.5.9 PDF 매뉴얼은 다운로드 가능하지만 아직 Typst Universe에 실제로 배포되지 않아 `#import "@preview/fletcher:0.5.9"`는 "package not found" 에러를 내요.
- **상대 축약형은 스텝별 꼭짓점을 만들어요.** `edge(<a>, "d,d,r", "-|>")`는 2셀 스텝 다음 1셀 스텝이 아니라 3개의 단일 셀 스텝을 생성해요. 이 중간 꼭짓점 중 한 곳에 레이블을 두면 Fletcher가 거기에 희미한 접합부 마크를 그리는데, 그 접합부 끝이 `label-fill` 마스크 밖으로 삐져나와서 레이블 뒤의 선이 레이블 안쪽에서 다시 시작되는 것처럼 보여요. 해결책: 긴 직선 구간은 명시적 좌표 웨이포인트를 사용하여 하나의 세그먼트로 라우팅하세요(`edge(<a>, (0, 2), <b>, "-|>")`와 `label-pos: (0, 50%)`). `tools.typ`에 적용된 해결책을 참고하세요.
- **마크다운에 삽입된 SVG는 `prefers-color-scheme`을 전달받지 못해요.** `<img src="...">`(`![alt](path)`가 생성하는 태그)로 로드된 SVG는 보안 샌드박스에서 렌더링되므로 상위 페이지의 컬러 스킴 미디어 쿼리가 동작하지 않아요. 테마 감지 없이도 밝은 배경과 어두운 배경 모두에서 잘 보이도록 Lumiverse 보라색 + 라벤더 채우기 팔레트를 선택한 이유예요.
- **폰트 경고는 무시해도 돼요.** 로컬에 설치되지 않은 폰트(Windows의 Helvetica, 깨끗한 Linux의 Inter 등)가 목록에 있으면 `warning: unknown font family: <name>` 경고가 발생해요. 대체 목록의 다음 폰트가 이어받아 SVG는 정상 렌더링돼요. 다음 개발자가 다른 OS를 쓸 수 있으니 목록을 줄이지 마세요.
- **빌드 검증 시 `tail`로 파이프하지 마세요.** `typst compile ... | tail -N`은 실제 종료 코드를 가려요(tail이 항상 0을 반환하여 컴파일 실패가 성공처럼 보임). 명시적으로 종료 코드를 확인하려면 `typst compile ... 2>&1; echo "EXIT=$?"` 형태를 사용하세요.
