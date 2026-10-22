// LumiScript-ko — Korean catalog: components/assistant/ (Lisa chat UI)
// Key = exact English source string; value = Korean. See src/i18n/ko.ts.

export const KO_ASSISTANT: Readonly<Record<string, string>> = {
  // ── Shared (glossary values) ──
  'Close': '닫기',
  'Save': '저장',
  'Delete': '삭제',
  'Edit': '편집',
  'Copy': '복사',
  'Copied': '복사됨',
  'Remove': '제거',
  'Retry': '다시 시도',
  'Apply': '적용',
  'Loading…': '불러오는 중…',
  'Connection': '연결',
  'Memory': '메모',
  'trigger': '트리거',
  'library': '라이브러리',
  'Error:': '오류:',
  'Remove {name}': '{name} 제거',
  'Delete {name}': '{name} 삭제',

  // ── assistant-logic.ts ──
  'just now': '방금',
  '{n}m ago': '{n}분 전',
  '{n}h ago': '{n}시간 전',
  '{n}d ago': '{n}일 전',
  '(no result recorded)': '(기록된 결과 없음)',

  // ── AssistantModal.tsx — header, connection, empty state ──
  'ASSISTANT': '어시스턴트',
  'Lisa — LumiScript code assistant': 'Lisa — LumiScript 코드 어시스턴트',
  'Ask about LumiScript or Spindle APIs. Response quality depends on the model you select.':
    'LumiScript나 Spindle API에 대해 물어보세요. 답변 품질은 선택한 모델에 따라 달라져요.',
  'Memory — what Lisa remembers about you': '메모 — Lisa가 나에 대해 기억하는 내용',
  '— Pick a connection —': '— 연결 선택 —',
  '{provider} · {model} · default': '{provider} · {model} · 기본',
  'Configure one in Lumiverse Settings → LLM Connections.': 'Lumiverse 설정 → LLM 연결에서 하나 설정하세요.',
  'Ask about LumiScript or Spindle APIs. Try one of these:': 'LumiScript나 Spindle API에 대해 물어보세요. 이런 질문은 어때요:',

  // ── AssistantModal.tsx — errors, toasts ──
  'Pick a connection before sending — see the dropdown at the top of the modal.':
    '보내기 전에 연결을 선택하세요 — 창 위쪽의 드롭다운에서 고를 수 있어요.',
  'Pick a connection before retrying — see the dropdown at the top of the modal.':
    '다시 시도하기 전에 연결을 선택하세요 — 창 위쪽의 드롭다운에서 고를 수 있어요.',
  'Pick a connection before resending — see the dropdown at the top of the modal.':
    '다시 보내기 전에 연결을 선택하세요 — 창 위쪽의 드롭다운에서 고를 수 있어요.',
  'Pick a connection before compacting — see the dropdown at the top of the modal.':
    '압축하기 전에 연결을 선택하세요 — 창 위쪽의 드롭다운에서 고를 수 있어요.',
  'Pick a connection first (top of the modal).': '먼저 연결을 선택하세요 (창 위쪽).',
  'Context compacted — older messages summarized.': '컨텍스트를 압축했어요 — 오래된 메시지를 요약했어요.',
  'Updated trigger script "{name}" in place.': '트리거 스크립트 "{name}"을(를) 덮어써서 업데이트했어요.',
  'Updated library script "{name}" in place.': '라이브러리 스크립트 "{name}"을(를) 덮어써서 업데이트했어요.',
  'Created trigger script "{name}". Open it in the Script Manager to edit.':
    '트리거 스크립트 "{name}"을(를) 만들었어요. 스크립트 관리자에서 열어 편집하세요.',
  'Created library script "{name}". Open it in the Script Manager to edit.':
    '라이브러리 스크립트 "{name}"을(를) 만들었어요. 스크립트 관리자에서 열어 편집하세요.',
  "Couldn't apply to script: {error}": '스크립트에 적용하지 못했어요: {error}',
  'Consolidated {before} → {after} notes.': '메모를 {before}개 → {after}개로 정리했어요.',
  "Couldn't export thread: {error}": '대화를 내보내지 못했어요: {error}',
  'Untitled': '제목 없음',
  'this script': '이 스크립트',

  // ── AssistantModal.tsx — transcript ──
  'Save & resend': '저장 후 다시 전송',
  'Lisa is thinking…': 'Lisa가 생각하는 중…',
  'Re-send the last message': '마지막 메시지 다시 전송',
  'Updated {name} from this conversation': '이 대화로 {name} 스크립트를 업데이트했어요',
  'Created {name} from this conversation': '이 대화로 {name} 스크립트를 만들었어요',
  'Earlier messages compacted — Lisa sees a summary of everything above this point':
    '이전 메시지를 압축했어요 — Lisa는 이 지점 위의 내용을 요약본으로 봐요',
  'user': '사용자',
  'error': '오류',
  'stopped': '중지됨',
  'Copy reply': '답변 복사',
  'Edit & resend': '편집 후 다시 전송',
  'Edit and resend this message': '이 메시지를 편집해서 다시 전송',
  'Hide reasoning': '추론 숨기기',
  'Show reasoning': '추론 보기',
  'Thinking…': '생각하는 중…',
  'Reasoning': '추론',

  // ── AssistantModal.tsx — usage strip, context gauge ──
  "Context window: {used} of {budget} tokens ({pct}%). Click for a breakdown of what's filling it.":
    '컨텍스트 창: {budget} 토큰 중 {used} ({pct}%). 클릭하면 무엇이 차지하고 있는지 볼 수 있어요.',
  'Context usage — click for a breakdown': '컨텍스트 사용량 — 클릭해서 구성 보기',
  '{pct}% ctx': '컨텍스트 {pct}%',
  "Couldn't compute the breakdown — try reopening.": '구성을 계산하지 못했어요 — 다시 열어 보세요.',
  'Calculating breakdown…': '구성 계산 중…',
  'Compact now — summarize the older messages to free up context, keeping the recent ones verbatim. Most useful once the conversation is long; it also runs automatically as the context nears full.':
    '지금 압축 — 오래된 메시지를 요약해 컨텍스트를 비우고, 최근 메시지는 그대로 둬요. 대화가 길어졌을 때 가장 유용해요. 컨텍스트가 거의 차면 자동으로도 실행돼요.',
  'Compact conversation context': '대화 컨텍스트 압축',
  "Estimated client-side via spindle.tokens.countText because the provider didn't surface streaming usage. Treat numbers as approximate.":
    '프로바이더가 스트리밍 사용량을 알려 주지 않아 spindle.tokens.countText로 클라이언트에서 추정했어요. 숫자는 대략적인 값이에요.',
  'in': '입력',
  'out · this turn': '출력 · 이번 턴',
  'Includes at least one estimated turn — treat as approximate.': '추정한 턴이 하나 이상 포함돼 있어요 — 대략적인 값이에요.',
  'total · this thread': '합계 · 이 대화',

  // ── AssistantModal.tsx — composer ──
  'trigger script — attached as context': '트리거 스크립트 — 컨텍스트로 첨부됨',
  'library script — attached as context': '라이브러리 스크립트 — 컨텍스트로 첨부됨',
  'reference file — attached as context': '참고 파일 — 컨텍스트로 첨부됨',
  'Attach a file from your storage': '저장소에서 파일 첨부',
  'Attach a file': '파일 첨부',
  'Ask Lisa…  (Enter to send · Shift+Enter for newline · @ to attach a script)':
    'Lisa에게 질문…  (Enter 전송 · Shift+Enter 줄바꿈 · @ 스크립트 첨부)',
  'Stop generating': '생성 중지',
  'Send (Enter)': '전송 (Enter)',

  // ── AssistantModal.tsx — apply-to-existing confirm ──
  'Update script?': '스크립트를 업데이트할까요?',
  'Update & overwrite': '업데이트 및 덮어쓰기',
  'Review the changes to {name} before overwriting — {added} / {removed} lines.':
    '덮어쓰기 전에 {name}의 변경 사항을 확인하세요 — {added} / {removed}줄.',
  'Review the changes to {name} before overwriting.': '덮어쓰기 전에 {name}의 변경 사항을 확인하세요.',
  "Lisa's code is identical to the current script — applying changes nothing.":
    'Lisa의 코드가 현재 스크립트와 같아요 — 적용해도 바뀌는 게 없어요.',
  'Proposed changes to {name}': '{name}에 제안된 변경 사항',
  '⋯ {count} unchanged line': '⋯ 변경 없는 줄 {count}개',
  '⋯ {count} unchanged lines': '⋯ 변경 없는 줄 {count}개',
  '… diff truncated — review the rest in the editor after applying.': '… 차이가 잘렸어요 — 나머지는 적용한 뒤 편집기에서 확인하세요.',
  'This script is longer than Lisa can see ({cap} chars), so she may not have had the full file — check the diff for code being removed.':
    '이 스크립트는 Lisa가 볼 수 있는 길이({cap}자)보다 길어서 전체 파일을 보지 못했을 수 있어요 — 지워지는 코드가 없는지 차이를 확인하세요.',
  "Overwrites the current code — this can't be undone.": '현재 코드를 덮어써요 — 되돌릴 수 없어요.',

  // ── AssistantModal.tsx — thread sidebar ──
  'Start a new thread': '새 대화 시작',
  'New chat': '새 대화',
  'No threads yet.': '아직 대화가 없어요.',
  'Commit rename': '이름 변경 확정',
  '{time} · {count} msg': '{time} · 메시지 {count}개',
  'Rename thread': '대화 이름 변경',
  'Export thread as Markdown': '대화를 Markdown으로 내보내기',
  'Delete thread': '대화 삭제',

  // ── MemoryPanel.tsx ──
  'Consolidate — merge duplicates and tidy up the notes (uses the LLM)': '정리 — 중복을 합치고 메모를 다듬어요 (LLM 사용)',
  'Consolidating…': '정리하는 중…',
  'Consolidate': '정리',
  'Back to chat': '채팅으로 돌아가기',
  'Durable notes Lisa keeps about you across sessions. The API reference always overrides these — they hold your preferences and project context. Edit or delete anything; Lisa sees your changes on her next turn.':
    'Lisa가 세션이 바뀌어도 기억하는 나에 대한 메모예요. API 레퍼런스가 항상 우선하고, 메모에는 내 취향과 프로젝트 맥락이 담겨요. 무엇이든 수정하거나 삭제할 수 있고, Lisa는 다음 턴에 바뀐 내용을 봐요.',
  'New note — a short hook…': '새 메모 — 짧은 요점…',
  'detail (optional)': '세부 내용 (선택)',
  'category (optional)': '분류 (선택)',
  'Add note': '메모 추가',
  'No notes yet. Lisa adds them as you work, or add your own above.':
    '아직 메모가 없어요. 작업하는 동안 Lisa가 추가하거나, 위에서 직접 추가할 수 있어요.',
  'misc': '기타',
  'Edit hook': '요점 편집',
  'detail': '세부 내용',
  'category': '분류',
  'you': '나',

  // ── UserFilePicker.tsx ──
  'Close file picker': '파일 선택 닫기',
  'No files yet. Add one below — or have a script write text to {path}.':
    '아직 파일이 없어요. 아래에서 추가하거나, 스크립트로 {path}에 텍스트를 써 두세요.',
  'Detach': '첨부 해제',
  'Attach as context': '컨텍스트로 첨부',
  'Delete file': '파일 삭제',
  'Paste the reference text…': '참고할 텍스트를 붙여 넣으세요…',
  'Add file': '파일 추가',
  'Allowed: {exts} … · 256 KB max': '허용: {exts} … · 최대 256 KB',
  'Add a file': '파일 추가하기',

  // ── ContextBreakdownPopover.tsx ──
  'Corpus (API reference)': '코퍼스 (API 레퍼런스)',
  'Memories': '메모',
  'This chat': '이 대화',
  'Attachments': '첨부',
  'Context breakdown': '컨텍스트 구성',
  'Context · ~{total} / {budget}': '컨텍스트 · ~{total} / {budget}',
  'Close breakdown': '구성 닫기',
  'Free': '여유',
  'Over budget — Lisa drops or compacts the oldest turns to fit.': '예산 초과 — Lisa가 가장 오래된 턴을 빼거나 압축해서 맞춰요.',
  "Estimates. Corpus is Lisa's fixed API knowledge — prompt-cached, so it costs little even though it occupies space.":
    '추정치예요. 코퍼스는 Lisa의 고정된 API 지식이에요 — 프롬프트 캐싱되어 자리를 차지해도 비용은 적어요.',

  // ── ScriptMentionMenu.tsx ──
  'No matching scripts': '일치하는 스크립트가 없어요',

  // ── MarkdownContent.tsx ──
  'code': '코드',
  'Copy code': '코드 복사',
  'Apply to script — create a new LumiScript from this code': '스크립트에 적용 — 이 코드로 새 LumiScript 만들기',
  'Apply — create new script': '적용 — 새 스크립트 만들기',
  'Apply this code…': '이 코드 적용…',
  'Create new script': '새 스크립트 만들기',
  'Update “{name}”': '“{name}” 업데이트',
  // Example prompts on an empty thread (dropped into the composer as the user's own message)
  'How do I send a chat message and trigger generation?': '채팅 메시지를 보내고 생성을 시작하려면 어떻게 해요?',
  'Show me an agentic tool-call loop': '에이전트식 도구 호출 루프 예시를 보여 주세요',
  "What's the difference between api.broadcast and api.events?": 'api.broadcast와 api.events는 뭐가 달라요?',
  'What permissions does api.databanks.create need?': 'api.databanks.create에는 어떤 권한이 필요해요?',
};
