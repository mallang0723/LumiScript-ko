# OAuth 보호 API 호출하기 (PKCE) (Call an OAuth-protected API (PKCE))

사용자가 서드파티 계정(GitHub, Google, 셀프 호스팅 서비스 등)을 연결하고, 클라이언트 시크릿(client secret) 유출 위험이 없는 PKCE 방식으로 사용자를 대신해 API를 호출할 수 있도록 해주는 패턴이에요. 인증 시작, 리디렉션 수신, 코드를 토큰으로 교환, 암호화 저장, 실제 API 호출까지의 전체 흐름을 다뤄요.

## 사용할 기능

- [`api.oauth.*`](../guides/oauth.md) — `createState()` (CSRF 방지 nonce), `getCallbackUrl()` (리디렉션 경로), `onCallback(handler)` (리디렉션 수신). `oauth` 권한 필요.
- `api.utils.http.post` / `.get` — 토큰 교환 및 인증된 API 호출. **위치 기반 인자**: `post(url, body, options?)`. `cors_proxy` + `allowDangerous` 필요.
- `api.enclave.*` — 암호화된 토큰 영속 저장소 (`put` / `get` / `delete`). `allowDangerous` 필요. ([저장소 모델](../concepts/storage-model.md))
- `crypto.subtle` — PKCE 챌린지 계산용. 샌드박스에서 기본 사용 가능.
- `api.commands.*` + `api.chat.sendMessage` — 인증 시작을 위한 슬래시 명령어 등록 및 링크 전송(스크립트가 브라우저를 직접 열 수는 없음). `chat_mutation` 필요.

핵심 원리: **PKCE는 클라이언트 시크릿을 1회용 증명으로 대체해요.** 무작위 `code_verifier`를 생성하고 그 SHA-256 해시값(`code_challenge`)을 인증 URL에 실어 보낸 뒤, 토큰 교환 시 원본 verifier를 다시 전송해요. 프로바이더는 둘이 일치하는지 검증하므로, 코드에 하드코딩된 시크릿이 아니라 verifier 보유 여부 자체로 클라이언트를 인증해요. 스크립트 소스 코드에 어떤 비밀값도 남지 않아요.

## 스크립트 코드

```js
// @triggers ls:startup
// PKCE OAuth 프로바이더를 연결하고 API를 호출해요. 활성화 시 등록됩니다.
// 필요 권한: oauth · cors_proxy + allowDangerous (http) · allowDangerous (enclave) · chat_mutation.

const CLIENT_ID          = 'YOUR_CLIENT_ID';
const AUTHORIZE_ENDPOINT = 'https://provider.example.com/oauth/authorize';
const TOKEN_ENDPOINT     = 'https://provider.example.com/oauth/token';
const API_ENDPOINT       = 'https://provider.example.com/api/me';
const SCOPE              = 'read';
const LUMIVERSE_ORIGIN   = 'https://your-host.example.com';   // 여러분의 Lumiverse origin

// base64url(SHA-256(input)) — PKCE 챌린지 변환 함수. crypto.subtle, btoa,
// TextEncoder는 모두 샌드박스에서 사용 가능하며, 이것이 필요한 유일한 암호화 연산이에요.
async function base64UrlSha256(input) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── 인증 시작: 인증 URL 구성 및 verifier 임시 보관 ───────────────────────
async function startAuth() {
  const verifier  = crypto.randomUUID() + crypto.randomUUID();   // 64자 이상의 엔트로피
  const challenge = await base64UrlSha256(verifier);
  const state     = await api.oauth.createState();               // 호스트가 반환 시 검증함

  // 사용자가 프로바이더 사이트를 다녀오는 동안 verifier가 유지되어야 해요 —
  // 워커가 중간에 재시작될 수 있으므로 globalThis 대신 enclave를 사용해요.
  // 주의: enclave 키는 [A-Za-z0-9_-.] (1~128자)만 허용해요 — 콜론 금지, 점(dot)으로 네임스페이스 구분.
  await api.enclave.put('pkce.verifier', verifier);

  return `${AUTHORIZE_ENDPOINT}?` + new URLSearchParams({
    response_type:         'code',
    client_id:             CLIENT_ID,
    redirect_uri:          LUMIVERSE_ORIGIN + (await api.oauth.getCallbackUrl()),
    scope:                 SCOPE,
    state,
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  }).toString();
}

// ── 리디렉션 수신: code + verifier를 토큰으로 교환 ────────────────────────
// 실행 간 유지를 위해 본문 상단에 등록해요. 호스트가 이 핸들러 실행 전에
// 이미 `state`를 검증했으므로 `params`를 안전하게 신뢰할 수 있어요.
api.oauth.onCallback(async (params) => {
  if (params.error) return { html: `<h1>Authorization failed</h1><p>${params.error}</p>` };

  const verifier = await api.enclave.get('pkce.verifier');
  const body = new URLSearchParams({
    grant_type:    'authorization_code',
    code:          params.code,
    redirect_uri:  LUMIVERSE_ORIGIN + (await api.oauth.getCallbackUrl()),  // 바이트 단위 일치 필수
    client_id:     CLIENT_ID,
    code_verifier: verifier,                                               // PKCE 증명 — 시크릿 불필요
  }).toString();

  const resp = await api.utils.http.post(TOKEN_ENDPOINT, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
  });
  const tokens = JSON.parse(resp.body);

  await api.enclave.put('access_token', tokens.access_token);
  if (tokens.expires_in) {
    await api.enclave.put('expires_at', String(Date.now() + tokens.expires_in * 1000));
  }
  await api.enclave.delete('pkce.verifier');                 // 1회용 사용 완료 — 정리

  api.broadcast.emit('myapp:connected', {});                 // 확장 기능의 다른 부분에 알림
  return { html: `<h1>Connected!</h1><p>You can close this tab.</p>` };
});

// ── 저장된 토큰으로 API 호출하기 ──────────────────────────────────────────
async function callApi() {
  const token = await api.enclave.get('access_token');
  if (!token) throw new Error('not connected — run the "Connect account" command first');
  const resp = await api.utils.http.get(API_ENDPOINT, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return JSON.parse(resp.body);
}

// ── 슬래시 명령어: 인증 시작용 및 테스트 호출용 ───────────────────────────
api.commands.register([
  { id: 'oauth-connect', label: 'Connect account', description: 'Start the OAuth (PKCE) flow', scope: 'chat' },
  { id: 'oauth-whoami',  label: 'Who am I',        description: 'Call the connected API',       scope: 'chat' },
]);

api.commands.onInvoked(async (commandId) => {
  // onInvoked는 확장 기능이 등록한 모든 명령에 대해 실행되므로 우리 명령만 필터링해요.
  if (commandId === 'oauth-connect') {
    const url = await startAuth();
    await api.chat.sendMessage(`[Click to authorize](${url})`, { role: 'assistant' });
  } else if (commandId === 'oauth-whoami') {
    const me = await callApi();
    await api.chat.sendMessage(`Connected as: ${me.login ?? me.name ?? JSON.stringify(me)}`, { role: 'assistant' });
  }
});
```

스크립트를 활성화하고, 채팅창에서 **/Connect account**를 실행한 뒤, 전송된 링크를 클릭하여 프로바이더 페이지에서 인증하면 "Connected!" 탭으로 돌아와요. 그 후 **/Who am I**를 실행하면 저장된 토큰으로 API를 호출하여 결과를 채팅창에 표시해요.

## 동작 원리

**3줄로 끝나는 PKCE.** `base64UrlSha256(verifier)`가 `code_challenge`를 생성해요. 인증 URL에는 이 *챌린지*와 `code_challenge_method: 'S256'`이 실리고, 토큰 교환 시에는 원본 *verifier*가 전송돼요. 프로바이더는 전달받은 verifier를 해시하여 보관 중이던 challenge와 일치하는지 검증함으로써, 공유 시크릿 없이도 인증을 시작했던 바로 그 클라이언트가 교환을 요청하고 있음을 증명해요. `crypto.subtle.digest('SHA-256', …)`와 `crypto.randomUUID()`는 샌드박스에서 바로 사용할 수 있어요.

**`createState()`와 호스트 측 CSRF 검증.** `api.oauth.createState()`는 호스트가 기억하는 1회용 nonce를 발급해요; 이를 인증 URL의 `state` 파라미터로 넘겨요. 프로바이더가 리디렉션으로 돌아올 때, 호스트는 반환된 `state`를 자체 저장소와 대조하여 *불일치할 경우 여러분의 핸들러가 실행되기도 전에 요청을 거부*해요 — 따라서 `onCallback` 내부에서는 state를 직접 검증할 필요 없이 `params`를 신뢰할 수 있어요.

**프로세스 경계를 넘는 verifier — 안전하게 보관하세요.** `startAuth()`와 콜백 수신 사이에 사용자는 외부 프로바이더 화면으로 이동하며, 그동안 워커 서브프로세스가 재시작될 수 있어요. `globalThis`는 이때 유실되지만 `api.enclave`는 보존돼요(인증 절차의 비밀값을 담기에 가장 적합한 곳이기도 해요). **인클레이브 키는 `[A-Za-z0-9_\-.]` (1~128자)로 제한되므로 콜론을 쓰지 마시고** 점으로 구분하세요(`pkce.verifier`). 값은 64KB 이하의 출력 가능한 ASCII여야 하고, JWT 같은 토큰은 충분히 들어가요.

**핸들러의 지속성 및 명령어 팬아웃.** `onCallback`은 한 번 등록되면 트리거 실행 간에 유지돼요(호스트 측 슬롯, 확장 기능당 하나). 반면 `onInvoked`는 확장 기능이 등록한 *모든* 명령에 대해 실행되므로 `commandId`로 필터링해야 해요. 둘 다 본문 상단에 두어 `ls:startup` 실행 시마다 확실하게 재등록되도록 하세요.

**`http.post`는 위치 기반 인자예요.** `post(url, body, options?)` — 폼 인코딩된 본문이 2번째 인자이고 헤더는 `options.headers`에 넣어야 해요. 자주 하는 실수가 `body`를 `options` 내부에 중첩시키는 것이에요.

## 내 프로젝트에 맞게 응용하기

- **만료 전 자동 갱신.** 프로바이더가 `refresh_token`을 발급한다면 함께 저장해 두고, 읽기 시점에 만료 확인 로직(`expires_at`에서 안전 여유 시간을 뺀 뒤 만료 시 `grant_type: 'refresh_token'`으로 재교환)을 감싸세요. [OAuth 가이드](../guides/oauth.md#pairing-with-apienclave)에 리프레시 토큰 로테이션을 포함한 `getValidAccessToken` 전체 패턴이 나와 있어요.
- **재시작 후에도 핸들러 유지하기.** 인증 시작과 리디렉션 사이에 워커가 재시작되면 콜백 핸들러가 유실될 수 있어요. 비 `ls:*` 브로드캐스트를 구독하여 워커를 고정(pin)하거나 주기적인 트리거에서 `onCallback`을 재등록하여 대비하세요([핸들러 수명 주기](../guides/oauth.md#handler-lifecycle) 참고).
- **여러 프로바이더를 하나의 핸들러로 처리하기.** 확장 기능당 `onCallback`은 단 하나만 등록할 수 있어요. 인증 URL을 열기 전에 `api.scriptStorage`에 "어떤 프로바이더 흐름인가" 플래그를 저장해 두고 핸들러에서 분기 처리하세요([가이드 문서](../guides/oauth.md#multi-provider-extensions) 참고).
- **기밀 클라이언트(Confidential client) 대체.** 혼자만 사용하는 개인용 스크립트라면 고전적인 `client_secret`을 사용할 수도 있어요(챌린지 불필요). 하지만 타인과 공유할 스크립트라면 시크릿이 소스 코드에 노출되므로 절대 배포하지 마세요. 공개 배포용으로는 PKCE가 유일한 안전한 경로예요.

## 주의사항

- **인클레이브 키에는 콜론을 사용할 수 없어요.** 허용 문자셋은 `[A-Za-z0-9_\-.]{1,128}`이므로 콜론(`svc:token`) 대신 점(`svc.token`)이나 밑줄(`svc_token`)을 사용하세요.
- **`redirect_uri`는 바이트 단위로 정확히 일치해야 해요.** 대부분의 프로바이더는 토큰 교환 요청의 `redirect_uri`가 최초 인증 URL의 것과 한 글자라도 다르면 거부해요. `LUMIVERSE_ORIGIN + (await api.oauth.getCallbackUrl())`로 변수에 담아 양쪽에서 동일한 문자열을 사용하세요.
- **리디렉션이 아니라 HTML을 반환하세요.** `onCallback` 핸들러는 사용자의 브라우저에 표시될 페이지를 렌더링해요 — 탭을 닫아도 좋다는 안내 문구가 담긴 `{ html }`을 반환하세요. Lumiverse를 다시 활성화하는 것은 UI가 반응할 별도의 브로드캐스트 이벤트로 처리하세요. 프로바이더는 리디렉션에 수초 내의 짧은 타임아웃을 적용하므로 핸들러를 가볍게 유지하세요.
- **서버 측에는 "내 origin" 정보가 없어요.** 스크립트는 백엔드에서 실행되므로 `window.location.origin`을 참조할 수 없어요 — `LUMIVERSE_ORIGIN`을 상수로 하드코딩하거나 프론트엔드 상호작용 시점에 `api.scriptStorage`에 한 번 저장해 두세요.
- **`state`는 항상 전송해야 해요.** `createState()`를 생략하면 CSRF 및 로그인 가로채기 취약점에 노출돼요. 단 한 번의 `await` 비용이 들 뿐이니 절대 생략하지 마세요.

## 관련 항목

- [OAuth 콜백](../guides/oauth.md) — `api.oauth` 전체 인터페이스, 토큰 갱신 패턴, 핸들러 수명 주기, 다중 프로바이더 디스패치.
- [권한](../concepts/permissions.md) — `oauth`, `cors_proxy` + `allowDangerous` (http), `allowDangerous` (enclave), `chat_mutation` (메시지 전송).
- [저장소 모델](../concepts/storage-model.md) — 비밀값이 `variables`나 `scriptStorage`가 아닌 `api.enclave`에 들어가야 하는 이유.
