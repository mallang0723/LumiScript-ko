/**
 * LumiScript-ko — Korean UI catalog (fork-only file).
 *
 * Key = the exact English source string passed to `t()` / `tx()`.
 * Value = Korean (해요체 for messages, noun form for labels — docs/ko-glossary.md).
 * Keep `{placeholders}` identical. Missing keys fall back to English.
 * Grouped by source file; strings shared by many files live under "Common".
 */

export const KO: Readonly<Record<string, string>> = {
  // ── Common ──
  'Cancel': '취소',
  'Confirm': '확인',
  'OK': '확인',
  'Close (Esc)': '닫기 (Esc)',
  // ── components/common/ErrorBoundary.tsx, frontend.tsx ──
  '{label} hit an error.': '{label}에서 오류가 났어요.',
  'Reopen the panel or reload Lumiverse to retry.': '패널을 다시 열거나 Lumiverse를 새로고침한 뒤 다시 시도하세요.',
  'LumiScript panel': 'LumiScript 패널',
  'LumiScript settings': 'LumiScript 설정',
  'Card-scripts consent': '카드 스크립트 동의',
  'Card-scripts authoring': '카드 스크립트 묶기',
  'Card-scripts delete offer': '카드 스크립트 정리 제안',
  'Card-editor scripts tab': '캐릭터 편집기 스크립트 탭',
};
