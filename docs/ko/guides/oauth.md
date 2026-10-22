# OAuth 콜백

`api.oauth.*`는 Spindle이 LumiScript 확장에 제공하는 유일한 수신(inbound) HTTP 훅이에요. 특히 OAuth 방식의 인증 흐름을 위해 마련되었어요 — 사용자가 서드파티 서비스(GitHub, Discord, 자체 호스팅 API 등)에 대한 접근 권한을 스크립트에 부여하고, 제공자가 사용자의 브라우저를 스크립트가 가로채야 하는 특정 URL로 리디렉션하는 경우에 사용해요.

세 가지 메서드를 제공해요: 제공자에 등록할 URL을 확인하는 `getCallbackUrl()`, CSRF 방지용 논스를 발급하는 `createState()`, 리디렉션 요청이 도달했을 때 실행될 핸들러를 등록하는 `onCallback(handler)`. 그 외의 모든 작업(인증 URL 생성, 토큰 교환, 저장, 갱신 등)은 스크립트가 직접 처리해요. 호스트는 훅을 제공하고 CSRF 상태를 검증해 주며, 스크립트가 전체 흐름을 조율하는 구조예요.

`oauth` 권한이 필요해요. 세 메서드 모두 권한이 없으면 `Error: PERMISSION_DENIED:oauth — grant this permission to use this API` 오류가 발생해요.

## 핵심 개념

OAuth 2.0 권한 부여 코드(authorization code) 흐름은 8단계로 진행돼요. `api.oauth.*`는 그중 2단계에 관여하며, 나머지는 스크립트가 담당해요:

| 단계 | 동작 | 담당 |
|---|---|---|
| 1 — 인증 URL 구성 | `client_id`, `redirect_uri`, `scope`, `state`를 포함한 URL 생성 | **스크립트** |
| 2 — 브라우저 사용자 유도 | 사용자를 인증 URL로 이동하도록 안내 | **스크립트** |
| 3 — 권한 승인 | 사용자가 제공자 페이지에서 "승인(Authorize)" 클릭 | 제공자 + 사용자 |
| 4 — 리디렉션 | 제공자가 `<redirect_uri>?code=…&state=…`로 리디렉션 | 제공자 |
| 5 — State 검증 | 호스트가 `state`가 최근 발급된 논스와 일치하는지 확인 | **호스트** |
| 6 — 핸들러 디스패치 | 호스트가 쿼리 파라미터와 함께 콜백 핸들러를 호출 | **호스트** + 스크립트 |
| 7 — 토큰 교환 | `code`를 포함해 제공자의 토큰 엔드포인트로 POST 요청 | **스크립트** (`api.utils.http` 사용) |
| 8 — 저장 및 갱신 | 토큰을 안전하게 암호화 저장하고 만료 전 갱신 | **스크립트** (`api.enclave` 사용) |

호스트의 역할은 수신 HTTP 훅 제공, CSRF state 검증, 핸들러 호출로 명확하게 한정되어 있어요. 토큰 교환과 저장, 갱신 방식은 제공자마다 요구하는 파라미터와 만료 정책이 다르므로 스크립트가 직접 작성해야 해요.

## 빠른 시작

토큰 교환에는 `api.utils.http.post`를, 암호화 저장에는 `api.enclave.put`을 사용하는 GitHub OAuth 흐름 예제예요:

```js
// @triggers ls:startup, CHAT_SWITCHED
// @description GitHub OAuth 예제.

const CLIENT_ID     = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';      // 아래의 공개 클라이언트 + PKCE 절 참고
const LUMIVERSE_ORIGIN = 'https://your-host.example.com';

// 1. 본문 상단에서 콜백 핸들러 등록 — 트리거 실행 사이에도 유지돼요.
api.oauth.onCallback(async (params) => {
  if (params.error) {
    return { html: `<h1>Auth failed</h1><p>${params.error}</p>` };
  }

  // 2. 인증 코드를 토큰으로 교환해요.
  // api.utils.http.post는 위치 인수를 사용해요: post(url, body, options?). 본문은
  // 두 번째 인수이며(options 내부가 아님), 헤더는 options 안에 넣어요.
  const body = new URLSearchParams({
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code:          params.code,
    redirect_uri:  LUMIVERSE_ORIGIN + (await api.oauth.getCallbackUrl()),
  }).toString();
  const resp = await api.utils.http.post(
    'https://github.com/login/oauth/access_token',
    body,
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept:         'application/json',
      },
    },
  );
  const { access_token, refresh_token, expires_in } = JSON.parse(resp.body);

  // 3. 토큰을 암호화하여 저장해요.
  await api.enclave.put('github.access_token',  access_token);
  if (refresh_token) {
    await api.enclave.put('github.refresh_token', refresh_token);
  }
  if (expires_in) {
    await api.enclave.put('github.expires_at', String(Date.now() + expires_in * 1000));
  }

  // 4. 확장의 다른 부분에 연결 완료를 알려요.
  api.broadcast.emit('myapp:github-connected', {});

  // 5. 사용자 브라우저에 성공 화면을 렌더링해요.
  return { html: `<h1>GitHub connected!</h1><p>You can close this tab.</p>` };
});

// UI 화면에서 인증 흐름을 시작할 때 호출할 수 있는 헬퍼 함수
async function buildAuthorizeUrl() {
  const state       = await api.oauth.createState();
  const callbackUrl = await api.oauth.getCallbackUrl();

  return `https://github.com/login/oauth/authorize?` + new URLSearchParams({
    client_id:    CLIENT_ID,
    redirect_uri: LUMIVERSE_ORIGIN + callbackUrl,
    scope:        'repo user',
    state,
  }).toString();
}
```

인증 흐름을 실제로 *시작*하려면 스크립트가 사용자에게 인증 URL을 보여 주어야 해요(스크립트는 서버 측에서 실행되므로 브라우저 탭을 직접 열 수 없어요). 클릭 가능한 링크를 채팅 메시지로 보내거나, `api.ui.dom.*`으로 패널에 인증 버튼을 넣거나, 설정 화면에 링크를 노출하는 패턴을 사용하세요.

`CLIENT_SECRET` 주의사항: 스크립트 소스에 시크릿을 하드코딩하면 코드를 볼 수 있는 누구나 이를 추출할 수 있어요. 배포하거나 공유할 스크립트라면 시크릿이 필요 없는 PKCE 방식(아래 [공개 클라이언트 + PKCE](#public-clients--pkce) 참고)을 사용하세요.

## API 구성

```ts
interface OAuthAPI {
  onCallback(
    handler: (params: Record<string, string>) => Promise<{ html?: string } | void>,
  ): () => void;

  getCallbackUrl(): Promise<string>;
  createState():    Promise<string>;
}
```

세 메서드 모두 `oauth` 권한이 필요해요.

### `onCallback(handler)`

콜백 핸들러를 등록해요. 구독 해제 함수를 동기적으로 반환해요.

```ts
onCallback(
  handler: (params: Record<string, string>) => Promise<{ html?: string } | void>,
): () => void
```

- **`handler`** — 제공자가 콜백 URL로 리디렉션했을 때 호출되는 비동기 함수예요. 핸들러가 실행되는 시점에는 호스트가 **이미 CSRF state 검증을 마친 상태**예요(일치하지 않는 state 요청은 핸들러에 도달하기 전에 차단됨).
- **`params`** — 리디렉션 시 전달된 쿼리 파라미터예요. 성공 시에는 `{ code, state }`, 오류 시에는 `{ error, error_description?, state }`가 들어와요.
- **반환값** — 선택 사항이에요. `{ html: '...' }`를 반환하면 브라우저 탭에 커스텀 HTML 페이지를 렌더링해요. 아무것도 반환하지 않으면(`void`) 호스트의 기본 완료 화면이 표시돼요. 제공자는 몇 초 안에 리디렉션 응답이 끝나기를 기대하므로 핸들러는 신속하게 반환되어야 해요.

```js
const unsub = api.oauth.onCallback(async (params) => {
  // ...
  return { html: '<h1>Done!</h1>' };
});

// 나중에 등록을 제거할 때:
unsub();
```

**확장당 하나의 핸들러만 등록할 수 있어요.** 나중에 등록된 핸들러가 이전 핸들러를 대체해요(last-wins). 다른 스크립트와 충돌하면 경고 로그가 남지만 예외가 발생하지는 않아요(아래 [스크립트 간 충돌](#cross-script-collision) 참고).

**핸들러는 실행 사이에도 유지돼요.** 브로드캐스트 구독과 마찬가지로 호스트 측에 등록되어 트리거 실행 사이에도 살아남아요(아래 [핸들러 수명 주기](#handler-lifecycle) 참고).

### `getCallbackUrl()`

콜백 엔드포인트의 **호스트 상대 경로**를 반환해요:

```js
const path = await api.oauth.getCallbackUrl();
// → "/api/spindle-oauth/lumiscript/callback" (한국어판에서는 /api/spindle-oauth/lumiscript_ko/callback)
```

확장 단위로 고정돼요. 모든 스크립트가 같은 콜백 URL을 공유해요. 경로는 불투명한 값으로 다루세요. 정확한 형식은 호스트가 정해요.

제공자가 `redirect_uri`로 요구하는 **절대 URL**을 만들려면 Lumiverse 오리진을 앞에 붙이세요:

```js
const callbackUrl  = await api.oauth.getCallbackUrl();
const absoluteUrl  = LUMIVERSE_ORIGIN + callbackUrl;
// → "https://lumiverse.example.com/api/spindle-oauth/lumiscript/callback"
```

서버 측에서 "내 Lumiverse 오리진"을 알려 주는 범용 API는 없어요. 오리진을 얻는 흔한 방법은 이래요.

- 직접 상수로 적어 둬요(개인 스크립트라면 괜찮아요).
- 프런트엔드 상호작용에서 `window.location.origin`을 가져오는 일회성 UI 명령으로 `api.scriptStorage`에 한 번 저장해 둬요.
- 토큰 교환을 할 때 `api.utils.http` 헤더에서 읽어요(일부 제공자는 값을 되돌려 줘요).

### `createState()`

CSRF 방지용 state 논스(nonce)를 발급해요.

```js
const state = await api.oauth.createState();
// → "f4a8c1b2..."
```

호스트가 이 논스를 기억하고 있다가 **콜백 도달 시점에 검증**해요. 제공자가 돌려준 `state` 파라미터가 최근 발급된 논스와 일치하지 않으면 핸들러를 호출하지 않고 요청을 거부해요.

이 단계는 꼭 필요해요. state 검증이 없으면 공격자가 *자기* 계정으로 얻은 코드를 담아 사용자의 브라우저가 콜백 URL을 호출하게 만들 수 있고, 그러면 사용자가 공격자의 세션에 묶여 버려요. 인증 URL에는 항상 `state=<값>`을 넣으세요.

```js
const state = await api.oauth.createState();
const authorizeUrl = `https://provider.example.com/authorize?...&state=${state}`;
```

state를 직접 검증할 필요는 없어요. 핸들러가 실행될 때는 호스트가 이미 검증을 끝낸 뒤예요.

## `api.utils.http`와 함께 토큰 교환하기

토큰 교환은 제공자의 토큰 엔드포인트로 보내는 POST 요청이에요. `cors_proxy` 권한이 필요해요([`concepts/permissions.md`](../concepts/permissions.md)).

```js
const body = new URLSearchParams({
  grant_type:    'authorization_code',
  code:          params.code,
  redirect_uri:  LUMIVERSE_ORIGIN + (await api.oauth.getCallbackUrl()),
  client_id:     CLIENT_ID,
  client_secret: CLIENT_SECRET,
}).toString();
const resp = await api.utils.http.post(
  'https://provider.example.com/oauth/token',
  body,
  {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept:         'application/json',
    },
  },
);
const tokens = JSON.parse(resp.body);
```

주의할 점 두 가지예요.

- **`redirect_uri`가 정확히 일치해야 해요.** 대부분의 제공자는 토큰 교환의 `redirect_uri`가 인증 URL에 넣었던 값과 바이트 단위로 같기를 요구해요. 두 곳에서 같은 `LUMIVERSE_ORIGIN + callbackUrl` 값을 쓰세요.
- **Content-Type이 중요해요.** 제공자마다 달라요. GitHub, Discord, Google은 토큰 엔드포인트에 `application/x-www-form-urlencoded`를 쓰고, Spotify, Twitch 같은 일부 서비스는 JSON도 받아요. 제공자 문서를 확인하세요.

<a id="pairing-with-apienclave"></a>

## `api.enclave`에 토큰 안전하게 저장하기

토큰은 인클레이브(enclave)에 보관해야 해요. 디스크에는 AES-256-GCM으로 암호화되어 저장되고, `allowDangerous`가 필요해요. 키는 `[A-Za-z0-9_\-.]{1,128}` 형식이어야 하고, 값은 인쇄 가능한 ASCII 64 KB 이하여야 해요. 표준 JWT 방식 토큰은 충분히 들어가요.

```js
await api.enclave.put('github.access_token',  access_token);
await api.enclave.put('github.refresh_token', refresh_token);
await api.enclave.put('github.expires_at',    String(Date.now() + expires_in * 1000));
```

토큰을 다시 읽을 때는 만료 시 갱신하는 패턴을 써요.

```js
async function getValidAccessToken() {
  const token  = await api.enclave.get('github.access_token');
  const expiry = parseInt(await api.enclave.get('github.expires_at') ?? '0', 10);
  if (token && Date.now() < expiry - 60_000) return token;          // 60초 안전 마진
  return await refreshAccessToken();
}

async function refreshAccessToken() {
  const refresh_token = await api.enclave.get('github.refresh_token');
  if (!refresh_token) throw new Error('no refresh token — user must re-authorize');

  const body = new URLSearchParams({
    grant_type:    'refresh_token',
    refresh_token,
    client_id:     CLIENT_ID,
    client_secret: CLIENT_SECRET,
  }).toString();
  const resp = await api.utils.http.post(
    'https://provider.example.com/oauth/token',
    body,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } },
  );
  const next = JSON.parse(resp.body);

  await api.enclave.put('github.access_token', next.access_token);
  await api.enclave.put('github.expires_at',   String(Date.now() + next.expires_in * 1000));
  if (next.refresh_token) {                                          // 일부 제공자는 리프레시 토큰을 순환 갱신해요
    await api.enclave.put('github.refresh_token', next.refresh_token);
  }
  return next.access_token;
}
```

일부 제공자는 순환 리프레시 토큰을 발급해요(갱신 응답에 이전 토큰을 대체하는 *새* `refresh_token`이 들어와요). 조건문 `await api.enclave.put('github.refresh_token', ...)`이 순환하는 제공자와 순환하지 않는 제공자를 모두 처리해요.

<a id="public-clients--pkce"></a>

## 공개 클라이언트 + PKCE

스크립트 소스에 `client_secret`을 적어 두는 것은 **절대 공유하지 않을 개인용 스크립트에서만 안전**해요. 다른 사용자에게 배포하거나 공유할 스크립트라면 시크릿이 전혀 필요 없는 OAuth 2.0 PKCE 흐름을 사용하세요:

1. 제공자 콘솔에서 앱을 공개 클라이언트(Public Client)로 등록해요 (`client_secret` 미발급).
2. 인증 URL에 `code_challenge`(임의의 검증자 문자열의 SHA-256 해시)와 `code_challenge_method=S256`을 포함해요.
3. 토큰 교환 시 원래의 `code_verifier`를 전달하면 제공자가 SHA-256 해시 일치 여부를 검증해요.

```js
// 인증 URL 생성:
const verifier  = crypto.randomUUID() + crypto.randomUUID();        // 64자의 무작위 엔트로피
const challenge = base64UrlSha256(verifier);                        // SHA-256 후 base64url 변환
const state     = await api.oauth.createState();

// 콜백에서 검증자를 쓸 수 있도록 저장소에 보관:
await api.enclave.put('pending_verifier', verifier);

const authorizeUrl = `https://provider.example.com/authorize?` + new URLSearchParams({
  client_id:             CLIENT_ID,
  redirect_uri:          LUMIVERSE_ORIGIN + callbackUrl,
  scope:                 'user.read',
  state,
  code_challenge:        challenge,
  code_challenge_method: 'S256',
}).toString();

// 토큰 교환 — client_secret 대신 code_verifier 전송:
const verifier = await api.enclave.get('pending_verifier');
const body = new URLSearchParams({
  grant_type:    'authorization_code',
  code:          params.code,
  redirect_uri:  LUMIVERSE_ORIGIN + callbackUrl,
  client_id:     CLIENT_ID,
  code_verifier: verifier,                                           // 흐름을 시작한 주체임을 증명
}).toString();
const resp = await api.utils.http.post(
  'https://provider.example.com/oauth/token',
  body,
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } },
);
await api.enclave.delete('pending_verifier');                        // 임시 검증자 정리
```

`base64UrlSha256` 헬퍼는 내장되어 있지 않아요. 스크립트 런타임에서 쓸 수 있는 `crypto.subtle.digest('SHA-256', ...)`와 표준 base64url 변환(`+`는 `-`로, `/`는 `_`로 바꾸고 `=` 패딩 제거)으로 직접 구현하세요.

<a id="handler-lifecycle"></a>

## 핸들러 수명 주기

콜백 핸들러 등록은 호스트 쪽에 있어요. 수명 경계는 이래요.

| 이벤트 | 핸들러 등록 상태 |
|---|---|
| 스크립트 실행 완료 | **유지됨** — 트리거 실행 사이에도 살아남아요. |
| 스크립트 편집 후 저장 | **유지됨** — 동일한 확장 슬롯에 유지돼요. |
| 스크립트 비활성화 | **해제됨** — 스크립트 정리 시 등록이 취소돼요. |
| 스크립트 삭제 | **해제됨** — 비활성화와 동일해요. |
| 워커 하위 프로세스 재시작 | **해제됨** — 등록 상태는 워커에 있으므로 재시작 시 지워져요. |
| 다른 `onCallback` 호출 | **대체됨** — 마지막 등록이 우선하며 충돌 경고가 기록돼요. |

생각해 둘 항목은 "워커 재시작 시 해제됨"이에요. 사용자가 "승인"을 누른 뒤 제공자가 리디렉션하기 전에 워커 하위 프로세스가 재시작되면, 콜백을 받을 핸들러가 없어서 사용자에게 알 수 없는 기본 오류 페이지가 보여요.

대비책은 두 가지예요.

- **워커 고정(Pin).** 스크립트 본문에서 `ls:*`가 아닌 브로드캐스트 이벤트를 구독해요(고정 정책은 [`concepts/handler-lifetime.md`](../concepts/handler-lifetime.md) 참고). 직접 구독만 하고 한 번도 emit하지 않는 이벤트여도 돼요. 정책은 `ls:*`가 아닌 구독이 있는지만 봐요.
- **실행할 때마다 다시 등록.** 멱등이라서 같은 핸들러로 `onCallback`을 두 번 호출해도 자기 자신으로 대체될 뿐이에요. 본문 상단에 `api.oauth.onCallback(...)`을 두면, 트리거가 *어떤 것이든* 주기적으로 실행되는 한 슬롯이 계속 살아 있어요.

두 번째 방식이 표준이에요. 워커 재시작은 드물기 때문에 실행 시마다 다시 등록하면 콜백이 대체로 잘 동작해요.

<a id="cross-script-collision"></a>

## 스크립트 간 충돌

LumiScript는 확장 전체에서 **단 하나의 OAuth 콜백 핸들러**만 지원해요. 다른 스크립트의 핸들러가 등록되어 있는 상태에서 새 핸들러를 등록하면 기존 핸들러를 조용히 덮어쓰고 백엔드 로그에 경고가 기록돼요:

```
[script-runner] api.oauth.onCallback: script "<scriptName>" is replacing the
OAuth callback handler previously registered by script "<otherScriptName>". Only one
OAuth callback handler is supported per extension — the prior handler will
no longer fire.
```

(`src/script-runner/host-dispatcher.ts:2888-2904` — 실행을 멈추지 않아요. 새 등록이 이어지고 마지막 등록이 우선해요.)

같은 스크립트가 다시 등록할 때는 별도의 (덜 심각한) 경고가 남아요. 개발 중에 스크립트를 다시 불러오면서 본문 상단의 `onCallback`을 지우는 것을 잊었을 때 알아채는 데 도움이 돼요.

<a id="multi-provider-extensions"></a>

### 다중 제공자 지원 패턴

하나의 확장 안에서 여러 서비스(예: GitHub과 Discord 둘 다)의 OAuth를 지원해야 한다면, 단일 핸들러 안에서 분기하도록 작성하세요. 인증 URL을 열기 전에 어떤 흐름인지 저장소에 적어 두고 콜백에서 이를 읽어 분기하는 패턴이 가장 깔끔해요:

```js
async function startGithubAuth() {
  await api.scriptStorage.set('oauth_flow', 'github');
  // ... 인증 URL 열기 ...
}

async function startDiscordAuth() {
  await api.scriptStorage.set('oauth_flow', 'discord');
  // ... 인증 URL 열기 ...
}

api.oauth.onCallback(async (params) => {
  const flow = await api.scriptStorage.get('oauth_flow');
  await api.scriptStorage.delete('oauth_flow');                      // 정리

  switch (flow) {
    case 'github':  return handleGithubCallback(params);
    case 'discord': return handleDiscordCallback(params);
    default:        return { html: `<h1>Unknown OAuth flow</h1>` };
  }
});
```

`state` 논스 값 자체에 제공자 이름을 임의로 이어 붙이지 마세요. 호스트의 state 검증은 `createState()`가 반환한 값과의 엄격한 일치를 검사하므로 검증에 실패하게 돼요.

## 흔한 실수

- **인증 URL과 토큰 교환의 `redirect_uri` 불일치.** 대부분의 제공자는 `redirect_uri`가 처음 인증 URL에 넣었던 값과 바이트 단위로 같지 않으면 토큰 요청을 거부해요. `LUMIVERSE_ORIGIN + (await api.oauth.getCallbackUrl())`로 한 번만 만들어 두 곳에서 같은 문자열을 쓰세요.

- **핸들러는 리디렉션이 아니라 `html` 페이지를 반환해요.** 핸들러 안에서 사용자를 Lumiverse로 되돌려 보내려 하지 말고, 탭을 닫으라고 안내하는 HTML 페이지를 반환하세요. Lumiverse UI를 다시 여는 일은 따로 처리할 수 있어요(예: UI 스크립트가 반응하는 브로드캐스트 이벤트).

- **스크립트 소스에 `client_secret`을 둠.** 공유하지 않을 개인 스크립트라면 괜찮아요. 배포하는 스크립트라면 PKCE로 바꾸세요.

- **CSRF state 생략.** "내부용"이나 "개인용" 스크립트라면 `createState()`를 건너뛰고 싶을 수 있어요. 하지 마세요. 비용은 거의 없고(흐름을 시작할 때 `await api.oauth.createState()` 한 번) 실패하면 계정 탈취로 이어져요. 항상 `state=…`를 넘기세요.

- **(PKCE) 인증과 콜백 사이에 `code_verifier`를 잃어버림.** verifier는 사용자가 제공자를 다녀오는 동안 살아 있어야 해요. `api.enclave`나 `api.scriptStorage`에 보관하세요. 두 이벤트 사이에 워커가 재시작될 수 있으니 `globalThis`에 의존하지 마세요.

- **핸들러 안의 오래 걸리는 토큰 교환.** 제공자는 리디렉션 응답을 길어야 몇 초 기다려요. 토큰 교환이 더 걸리면(느린 제공자, 재시도 로직) 핸들러가 반환하기 전에 사용자의 브라우저가 포기할 수 있어요. 핸들러 작업은 짧게 하세요. 코드를 교환하고 토큰을 저장한 뒤 HTML 응답을 반환하면 돼요. 오래 걸리는 후속 작업은 브로드캐스트 구독자에게 넘기세요.

- **만료 시 갱신 없음.** 오래 이어지는 세션은 액세스 토큰을 만료 시 갱신하는 래퍼(위의 `getValidAccessToken` 패턴)로 감싸야 해요. 없으면 토큰이 처음 만료될 때 스크립트가 조용히 멈춰요.

- **사용자가 인증을 다녀오는 동안 워커가 퇴출됨.** 위의 [핸들러 수명 주기](#handler-lifecycle)에 있는 고정 또는 재등록 패턴으로 대비하세요.

## 관련 문서

- **앱 내 레퍼런스, "API Functions → api.oauth" 절** — 자동 생성된 메서드 목록.
- **[`concepts/permissions.md`](../concepts/permissions.md)** — `oauth` 권한, 그리고 일반적인 OAuth 흐름에 모두 필요한 `cors_proxy`(`api.utils.http.*`용)와 `allowDangerous`(`api.enclave.*`용).
- **[`concepts/handler-lifetime.md`](../concepts/handler-lifetime.md)** — 위에서 언급한 퇴출 고정 정책.
- **[스크립트 간 이벤트 브로드캐스팅](broadcast.md)** — 토큰을 얻었을 때 확장의 다른 부분에 알리는 자연스러운 방법.
- **`api.enclave.*` 레퍼런스** — 암호화 저장 계층의 상세(키, 값 크기, `put`/`get`/`delete`/`has`/`list` 표면).
