# 이미지 생성

`api.imageGen.*`는 사용자가 설정한 연결 프로필을 기반으로 이미지 생성을 실행하고, base64 데이터 URL과 함께 저장을 위한 고유 `imageId`를 반환해 줘요. 또한 프로바이더(provider), 연결, 모델 메타데이터를 제공하므로 스크립트 코드에 하드코딩하지 않고도 동적인 파라미터 UI를 구성할 수 있어요. 이전 `imageId`를 프로바이더별 파라미터에 전달하면 img2img 및 인페인팅(inpainting)도 지원해요.

5가지 메서드와 1가지 권한:

- **`generate(input)`** — 이미지 생성을 실행하고, 이미지 바이트 데이터 및 영구 저장 핸들을 반환해요.
- **`getProviders()`** — 사용 가능한 이미지 프로바이더 목록과 기능 스키마를 열거해요.
- **`listConnections()`** / **`getConnection(id)`** — 사용자의 연결 프로필 목록을 조회해요(API 키는 노출되지 않아요).
- **`getModels(connectionId)`** — 특정 연결에서 사용 가능한 모델 목록을 조회해요(네트워크 요청이 발생할 수 있어요).

5개 메서드 모두 `image_gen` 권한이 필요해요. 권한이 없으면 `Error: PERMISSION_DENIED:image_gen — grant this permission to use this API` 오류가 발생해요.

## 핵심 개념

LumiScript는 자체 이미지 생성 백엔드를 내장하고 있지 않아요. Lumiverse가 이미 훌륭한 백엔드를 갖추고 있기 때문이에요. Lumiverse에는 프로바이더 레지스트리(Stable Diffusion, ComfyUI, DALL-E, Imagen, Midjourney 프록시 등)와 사용자별 연결 프로필(API URL + 키 + 기본 모델 + 기본 파라미터), 그리고 선택된 연결의 프로바이더로 요청을 라우팅해 주는 통합 `generate(request)` 엔트리포인트가 있어요. `api.imageGen.*`는 이를 가볍게 감싼 것이며, 스크립트는 사용자가 어떤 프로바이더를 설정해 두었는지 구체적으로 알 필요 없이 이미지 생성을 실행할 수 있어요.

따라서 스크립트 작성자는 `await api.imageGen.generate({ prompt: '...' })` 한 줄만 작성하면 돼요. 사용자가 로컬 ComfyUI를 쓰든, 클라우드 엔드포인트의 Stable Diffusion을 쓰든, OpenAI 이미지 계정을 쓰든 상관없이 알아서 동작해요. 사용자의 기본 연결이 자동으로 사용되므로, 연결을 강제로 지정해야 할 특별한 이유가 있을 때만 `connectionId`를 전달하면 돼요.

나머지 네 가지 메서드는 설정을 탐색하기 위한 것이에요. 특정 연결을 고르는 선택기나 모델 드롭다운을 만들고, 생성을 실행하기 전에 프로바이더가 선언한 스키마에 맞춰 `parameters`의 유효성을 검사하고 싶을 때 사용하세요.

## 빠른 시작

가장 간단한 이미지 생성 스크립트: 채팅 메시지 내용에 맞는 장면 설명을 프롬프트로 만들어 이미지를 생성한 뒤, 채팅창에 어시스턴트 메시지로 삽입해요.

```js
// @triggers MESSAGE_SENT
// @description 사용자의 마지막 메시지를 시각화 — 이미지를 생성해 어시스턴트 메시지로 삽입해요.

if (!data.message.is_user) return;

// 사용자의 기본 이미지 생성 연결 사용 — connectionId를 전달할 필요가 없어요.
const result = await api.imageGen.generate({
  prompt: `Cinematic illustration of: ${data.message.content}. Detailed, dramatic lighting.`,
  parameters: { width: 1024, height: 1024, steps: 30 },
});

// `imageDataUrl`은 base64 형식이에요. <img> 태그에 바로 넣을 수 있어요.
// 저장된 `imageId`는 채팅을 다시 불러와도 유지되므로, 나중에 다시 가져와야 할 때
// api.images.get으로 전달할 수 있어요.
await api.chat.sendMessage(
  `<img src="${result.imageDataUrl}" alt="${data.message.content}" data-image-id="${result.imageId ?? ''}">`,
  { role: 'assistant' },
);
```

이것이 전체 흐름이에요. 사용자의 기본 연결이 프로바이더와 모델, 기본 파라미터 세트를 결정하고, 스크립트는 프롬프트와 재정의할 파라미터만 제공해요. `result.imageId`는 영구 저장을 위한 정식 핸들이며(아래 [다른 API와의 연동](#integration-with-the-rest-of-the-api) 참고), 채팅이 다시 로드되어도 유지되고 이미지 핸들을 받는 다른 모든 `api.*`의 입력값으로 쓰여요.

## API 구성

```ts
interface ImageGenAPI {
  generate(input: ImageGenInput):              Promise<ImageGenResult>;
  getProviders():                              Promise<ImageGenProviderInfo[]>;
  listConnections():                           Promise<ImageGenConnectionInfo[]>;
  getConnection(connectionId: string):         Promise<ImageGenConnectionInfo | null>;
  getModels(connectionId: string):             Promise<Array<{ id: string; label: string }>>;
}
```

입력 및 결과 데이터 형태:

```ts
interface ImageGenInput {
  prompt:             string;          // 필수.
  connectionId?:      string;          // 기본값: 사용자의 기본 연결.
  negativePrompt?:    string;          // 프로바이더 지원 여부에 따름.
  model?:             string;          // 연결의 기본 모델을 재정의.
  parameters?:        Record<string, unknown>;
                                       // 프로바이더별 파라미터 (width/height/steps/cfg_scale/input_images/...).
                                       // 호스트 측에서 연결의 `defaultParameters`와 병합돼요.
  ownerCharacterId?:  string;          // 저장 결과에 캐릭터 소유권 태그 부여.
  ownerChatId?:       string;          // 저장 결과에 채팅 소유권 태그 부여.
}

interface ImageGenResult {
  imageDataUrl:  string;               // base64 데이터 URL — <img src>에 바로 할당 가능.
  model:         string;               // 실제로 실행된 모델 (input.model과 다를 수 있음).
  provider:      string;               // 생성을 처리한 프로바이더 ID.
  imageId?:      string;               // 영구 저장 핸들 (저장에 성공한 경우 존재).
  imageUrl?:     string;               // 저장된 이미지의 인증 불필요 공개 URL.
}
```

두 가지 결과 필드는 서로 다른 렌더링 경로를 지원해요:

- **`imageDataUrl`**은 인라인 바이트 데이터예요. `<img src="...">`나 `<canvas>` 렌더링처럼 스크립트 출력과 동일한 프로세스 안에서 렌더링할 때 사용하세요. 네트워크 왕복이나 인증이 필요 없어요.
- **`imageUrl`**은 영구 저장된 공개 URL이에요. *클라이언트*가 직접 가져와야 하는 외부 환경(푸시 알림, 외부 임베드 등 채팅 UI 세션 밖)에서 사용하세요. 브라우저는 원래 Lumiverse 내부 이미지 저장소 URL에 접근할 때 인증이 필요하지만, `imageUrl`은 별도 인증 없이 가져올 수 있어요.
- **`imageId`**는 영구 저장 핸들이에요. 데이터 URL(스크립트 메모리에 든 바이트)이나 임시 주소보다 오래 유지돼요. 나중에 이미지가 다시 필요하다면 `imageId`를 보관해 두세요.

## 명시적으로 연결과 모델 선택하기

사용자 기본값을 넘어선 제어가 필요한 경우(예: 사용자의 채팅 설정과 무관하게 항상 특정 고품질 연결을 써야 하는 도구 스크립트), 연결 목록을 조회하고 이름으로 선택할 수 있어요:

```js
const connections = await api.imageGen.listConnections();

// 이름으로 연결 찾기 (provider나 hasApiKey: true 조건으로 필터링할 수도 있어요)
const target = connections.find(c => c.name === 'ComfyUI – Local');
if (!target) {
  api.ui.toast('No "ComfyUI – Local" connection configured', 'warning');
  return;
}

// 해당 연결이 지원하는 모델 목록 선택 (선택 사항)
const models = await api.imageGen.getModels(target.id);
const preferredModel = models.find(m => m.id.includes('sdxl'))?.id ?? target.model;

const result = await api.imageGen.generate({
  connectionId: target.id,
  model:        preferredModel,
  prompt:       'A cyberpunk skyline at dusk',
});
```

`listConnections`는 절대 API 키를 노출하지 않아요. `hasApiKey: boolean` 필드만 포함되어 반환되며 키는 호스트 외부로 나가지 않아요. 스크립트에서 연결을 *실제로 사용할 수 있는지*(키가 입력되어 있는지) 확인해야 한다면 `hasApiKey`를 검사하고, 키가 없으면 부드럽게 대체 동작으로 넘어가도록 처리하세요.

`getModels`의 동작은 프로바이더에 따라 달라져요:

- **`modelListStyle: 'static'`** 프로바이더 (보통 로컬 호스팅): 프로바이더가 선언한 `capabilities.staticModels`에서 가져와요. 네트워크 요청 없이 빠르고 가벼워요.
- **`modelListStyle: 'dynamic'`** 프로바이더 (대부분의 클라우드 API): 매 호출 시 업스트림 API에서 실시간으로 가져와요. 본문 안에서 여러 번 호출해야 한다면 결과를 캐싱해 두세요.
- **`modelListStyle: 'google'`**: 프로바이더 특화 동작이 있는 동적 방식이에요. 캐싱 관점에서는 동적 방식으로 취급하세요.

## 프로바이더 기능 스키마

`getProviders()`는 프로바이더별 특성을 하드코딩하지 않고도 파라미터 UI를 구성할 수 있게 해 주는 스키마 정보예요:

```js
const providers = await api.imageGen.getProviders();
const sd = providers.find(p => p.id === 'stable-diffusion');
if (!sd) return;

// 각 파라미터는 타입, 범위, 기본값, 설명을 선언해요.
for (const [key, schema] of Object.entries(sd.capabilities.parameters)) {
  console.log(`${key}: ${schema.type}, default=${schema.default}, ${schema.description}`);
}
// width: integer, default=512, Image width in pixels.
// height: integer, default=512, Image height in pixels.
// steps: integer, default=30, Sampling steps. Higher = slower but more detail.
// cfg_scale: number, default=7.5, Classifier-free guidance scale.
// …
```

각 항목은 `ImageGenParameterSchema` 규격을 따라요:

```ts
interface ImageGenParameterSchema {
  type:         'number' | 'integer' | 'boolean' | 'string' | 'select' | 'image_array';
  default?:     unknown;
  min?:         number;            // 'number' / 'integer' 용
  max?:         number;
  step?:        number;
  description:  string;             // 항상 채워져 있음 — UI 설명 라벨로 표시하세요
  required?:    boolean;
  options?:     Array<{ id: string; label: string }>;   // 'select' 용
  group?:       string;             // 선택적 UI 그룹화 힌트
}
```

6가지 `type` 값으로 현실적인 파라미터 UI를 모두 구성할 수 있어요: 숫자 범위(슬라이더), 불리언(토글), 자유 텍스트(입력창), 선택지(셀렉트 박스), 그리고 **이미지 배열**(img2img / 인페인팅 / 참조 이미지용 — 아래 설명 참고). `group?` 필드는 UI에서 관련 파라미터들을 제목("샘플러", "출력 크기", "ControlNet" 등) 아래로 묶어 주기 위한 힌트예요. 그룹 정보를 제공하는 프로바이더는 논리적으로 묶어 표시하고, 생략된 프로바이더는 평면적인 목록으로 렌더링하면 돼요.

## img2img와 인페인팅

이미지 입력을 지원하는 프로바이더는 `image_array` 타입의 파라미터를 선언해요. 사용 규칙: 해당 파라미터의 값으로 `imageId` 문자열 배열을 전달하세요. 호스트가 프로바이더에게 요청을 보내기 전에 저장소에서 각 `imageId`의 실제 이미지를 찾아 전달해 줘요.

```js
// 먼저 베이스 이미지를 생성해요.
const base = await api.imageGen.generate({
  prompt: 'A photo of a cat in a meadow',
});

// 그 이미지를 img2img 입력으로 다시 전달해요.
const variant = await api.imageGen.generate({
  prompt:     'The same cat, but wearing a wizard hat',
  parameters: {
    input_images: [base.imageId],   // 프로바이더별 파라미터 이름
    denoising_strength: 0.55,
  },
});

await api.chat.sendMessage(
  `<img src="${variant.imageDataUrl}">`,
  { role: 'assistant' },
);
```

파라미터 이름(이 예제의 `input_images`)은 프로바이더마다 달라요. 어떤 프로바이더가 어떤 이름을 쓰는지 확인하려면 `getProviders()`를 호출해 `capabilities.parameters` 안의 `image_array` 타입 항목을 확인하세요. 흔히 쓰이는 이름으로는 `input_images`, `init_images`, `reference_image`, `mask_image` 등이 있어요.

입력 이미지는 어떤 `imageId` 출처든 상관없어요 — 이전 `api.imageGen.generate` 결과, `api.images.upload` 호출(예: `api.utils.http`로 가져온 바이트 업로드), 또는 저장소에 이미 있는 기존 이미지(예: 캐릭터 아바타) 모두 가능해요. 호스트 입장에서는 똑같은 `imageId`일 뿐이에요.

<a id="integration-with-the-rest-of-the-api"></a>

## 다른 API와의 연동

`imageId`는 다른 기능들과 연결되는 핵심 접점이에요. 이미지 저장이 성공하면 동일한 핸들을 네 가지 네임스페이스에서 활용할 수 있어요:

```js
const result = await api.imageGen.generate({ prompt: '...' });
if (!result.imageId) return;   // 저장 실패 — 인라인 렌더링만 가능

// 1. 나중에 바이트 데이터를 다시 가져오기 (예: 다른 채팅 세션에서)
const info = await api.images.get(result.imageId);

// 2. 생성된 이미지에서 테마 색상 팔레트 추출하기
const palette = await api.theme.extractColors(result.imageId);
await api.theme.applyPalette({ accent: palette.dominantHsl });

// 3. 캐릭터의 아바타를 생성된 이미지로 설정하기. setAvatar는 imageId 대신
//    원시 바이트를 받으므로, 생성 시 반환된 데이터 URL을 디코딩해 전달해요
//    (dataUrlToBytes는 setAvatar가 요구하는 { data, mimeType } 형태를 반환해요).
const chat   = await api.chats.getActive();
const avatar = api.utils.image.dataUrlToBytes(result.imageDataUrl);
if (chat?.characterId && avatar) {
  await api.characters.setAvatar(chat.characterId, avatar);
}

// 4. 푸시 알림으로 이미지 전송 (imageId 대신 인증이 필요 없는 URL 사용)
//    pushNotification은 (title, body, options) 형태예요. options의 image 필드는
//    인증 없는 상대 URL을 받아요. push_notification 권한이 필요해요 (image_gen과 별개).
await api.ui.pushNotification(
  'Your generation is ready',
  'Tap to view the result.',
  { image: result.imageUrl },
);
```

각 기능은 `imageId`를 그대로 사용할 수 있어요. 별도의 변환이나 재업로드 단계가 필요 없으며, `generate`가 생성한 영구 저장 레코드가 그대로 사용돼요.

만약 이미지를 활용하기 전에 원시 바이트 수준에서 이미지 가공(자르기, 크기 조절, 포맷 변환 등)을 하고 싶다면 `api.images.*`의 영역이에요(`image_gen`과 별개인 `images` 권한 필요). 참고: `api.images.get(imageId)`가 반환하는 `ImageInfo`의 `url` 필드는 *인증이 필요한 상대 URL*이며, 원시 바이트 데이터 자체가 아니에요. 바이트 데이터를 얻으려면 `api.utils.http`를 사용해 해당 URL을 `responseType: 'arraybuffer'`로 요청하세요:

```js
const gen = await api.imageGen.generate({ prompt: '...' });
if (!gen.imageId) return;

// 바이트 데이터를 읽어와서 변환한 뒤 새 이미지로 재업로드
const info = await api.images.get(gen.imageId);
if (!info) return;

// info.url은 인증이 필요한 상대 URL이에요. HTTP 헬퍼를 통해 바이트를 가져와요
// (cors_proxy 권한과 allowDangerous 설정이 필요해요).
const response = await api.utils.http.get(info.url, { responseType: 'arraybuffer' });
const bytes = response.body;   // Uint8Array

// ... bytes 변환 작업 수행 ...

const transformed = await api.images.upload({
  data:     modifiedBytes,
  mimeType: 'image/png',
});
// transformed.id는 이제 변환된 새 바이트 데이터의 imageId가 돼요.
```

## 저장 소유권 관리

`generate`는 저장된 이미지 메타데이터로 전달되는 두 가지 소유권 태그를 받아요:

- **`ownerCharacterId`** — 이미지를 특정 캐릭터와 연결해요. Lumiverse UI에서 해당 캐릭터의 이미지 갤러리에 나타나요.
- **`ownerChatId`** — 이미지를 특정 채팅과 연결해요. "이 대화에서 생성된 이미지" 필터 등에 유용해요.

이 태그들은 권장 사항(advisory)일 뿐이에요. 태그를 지정하지 않아도 이미지는 호스트의 이미지 저장소에 온전히 저장돼요. 수명 주기가 아니라 분류에만 영향을 줘요. 사용자에게 특정 캐릭터/채팅 귀속을 보여 줄 필요가 없는 일회성 생성에는 비워 두고, 대화 장면의 일부(예: 캐릭터 초상화 스크립트에서 아바타 태깅)인 경우에는 채워 주세요.

## 오류 처리

`generate`는 다음과 같은 상황에서 오류를 발생시켜요:

- **권한 거부** — `Error: PERMISSION_DENIED:image_gen — grant this permission to use this API`. LumiScript 확장에 `image_gen` 권한이 부여되지 않은 경우예요.
- **알 수 없는 연결** — 지정한 `connectionId`를 찾을 수 없는 경우. 사용자 입력을 받을 때는 먼저 `listConnections()`로 확인하세요.
- **API 키 누락** — 클라우드 프로바이더인데 연결 프로필의 `hasApiKey: false`인 경우. Lumiverse 설정에서 API 키를 입력하라는 안내를 사용자에게 보여 주세요.
- **프로바이더 거부** — 업스트림 API가 오류(호출 빈도 초과, 콘텐츠 필터 차단, 잘못된 파라미터 등)를 반환한 경우. 오류 메시지에 가능한 경우 업스트림 프로바이더의 텍스트가 포함돼요.
- **네트워크 오류** — 클라우드 프로바이더 호출 시 발생. 일시적 오류로 취급하고 재시도를 제안하세요.

안정적인 예외 처리 패턴:

```js
try {
  const result = await api.imageGen.generate({ prompt });
  // ... 결과 활용 ...
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('PERMISSION_DENIED')) {
    api.ui.toast(
      'Image generation needs the image_gen permission — enable it in LumiScript settings.',
      'warning',
      { duration: 8000 },
    );
    return;
  }
  api.ui.toast(`Generation failed: ${msg}`, 'error');
  console.error('[my-script] imageGen failed:', err);
}
```

## `api.images.*`와의 용도 비교

서로 관련되어 있지만 역할이 다른 두 네임스페이스예요:

| 요구 사항 | 권장 기능 | 필요 권한 |
|---|---|---|
| 프롬프트로부터 **새로운** 이미지 생성 | `api.imageGen.generate` | `image_gen` |
| 이미 가지고 있는 바이트 업로드 (HTTP 다운로드, 외부 base64 등) | `api.images.upload` / `uploadFromDataUrl` | `images` |
| 저장소에 이미 있는 이미지 바이트 읽기 | `api.images.get` | `images` |
| 저장된 이미지 삭제 | `api.images.delete` | `images` |
| 사용 가능한 프로바이더 / 연결 / 모델 탐색 | `api.imageGen.getProviders` / `listConnections` / `getModels` | `image_gen` |

생성과 후처리를 모두 수행하는 스크립트는 일반적으로 두 권한이 모두 필요해요. 이미 저장된 이미지만 읽어 활용하는 스크립트(예: 기존 캐릭터 아바타로부터 테마 색상 추출)는 `images` 권한만 있으면 돼요.

## 버전 참고 사항

**v1.0.0-rc.5+**에서 구현되었어요. 5개 메서드는 rc.5 이후 안정적으로 유지되고 있어요. 기반이 되는 프로바이더 레지스트리(사용 가능한 프로바이더 종류)는 호스트 측에 있으므로 LumiScript 버전과 별개로 업데이트될 수 있어요. `getProviders()`는 호출 시점에 호스트가 인식하고 있는 최신 정보를 반영해요.
