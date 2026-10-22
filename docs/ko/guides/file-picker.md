# 디스크에서 파일 선택하기

`api.ui.pickFile()`은 브라우저의 네이티브 파일 선택기 창을 열고 사용자가 선택한 파일을 바이트 데이터 형태로 스크립트에 전달해 줘요. JSON 설정 파일, 캐릭터 카드, 이미지 또는 기타 사용자 데이터를 스크립트로 가져올 때 사용하세요. 사용자가 직접 파일을 선택하는 행위 자체가 승인 역할을 하므로 별도의 권한이 필요하지 않아요.

```js
const [file] = await api.ui.pickFile({ accept: ['.json'], maxSizeBytes: 1_000_000 });
if (file) {
  const config = JSON.parse(new TextDecoder().decode(file.bytes));
  // …config 사용
}
```

## 메서드 시그니처

```ts
pickFile(options?: {
  accept?: string[];        // 확장자 또는 MIME 타입, 예: ['.json', 'application/json']
  multiple?: boolean;       // 다중 선택 허용 여부 (기본값 false)
  maxSizeBytes?: number;    // 파일당 크기 제한
}): Promise<PickedFile[]>
```

`multiple: false`인 경우에도 **항상 배열을 반환**해요(파일 1개가 든 배열이거나, 취소 시 빈 배열). 반환되는 `PickedFile` 객체의 구조는 다음과 같아요:

```ts
{ name: string; mimeType: string; sizeBytes: number; bytes: Uint8Array }
```

`bytes`는 파일의 원시 내용을 담은 `Uint8Array`예요. (참고: 브라우저가 판별하기 어려운 확장자(예: `.md`)의 경우 `mimeType`이 `"application/octet-stream"`으로 대체될 수 있으니, 파일 포맷을 판별할 때는 MIME 타입에만 의존하지 말고 파일 확장자를 확인하거나 `bytes`의 내용을 직접 검사하세요.)

## 두 가지 결과 처리

- **취소** → 빈 배열 `[]`을 반환해요. 사용자가 파일을 선택하지 않고 창을 닫은 경우예요.
- **용량 초과** → **Promise가 거부(reject)돼요**. 선택한 파일의 크기가 `maxSizeBytes`를 초과하면 호스트에서 오류를 던져요(`ctx.uploads.pickFile`의 동작을 따름). 용량 제한을 설정한 경우 try/catch로 감싸서 처리하세요:

```js
try {
  const files = await api.ui.pickFile({ multiple: true, maxSizeBytes: 50_000 });
  console.log(`Picked ${files.length}: ${files.map((f) => f.name).join(', ')}`);
} catch (err) {
  api.ui.toast(`Too big: ${err.message}`, 'error');
}
```

## 가져온 바이트 데이터 활용하기

`bytes`는 `Uint8Array` 형식이므로 다른 API에 바로 전달할 수 있어요:

```js
const [file] = await api.ui.pickFile({ accept: ['image/*'] });
if (file) {
  // → Lumiverse 이미지 저장소 (images 권한 필요)
  const info = await api.images.upload({ data: file.bytes, mimeType: file.mimeType, filename: file.name });

  // → 실행 간 처리를 위한 임시 저장소 (allowDangerous + ephemeral_storage 필요)
  await api.files.tempWriteBinary(`import/${file.name}`, file.bytes, { ttlMs: 600_000 });

  // → 텍스트, JSON / CSV / 설정용
  const text = new TextDecoder().decode(file.bytes);
}
```

파일 저장소 등급에 대한 자세한 내용은 [저장소 모델](../concepts/storage-model.md)을, `api.images.*`에 대해서는 앱 내 **레퍼런스 탭**을 참고하세요.

## 동작 방식과 권한이 필요 없는 이유

`pickFile`은 프런트엔드와의 통신 왕복으로 동작해요. 스크립트가 프런트엔드에 `ctx.uploads.pickFile` 호출을 요청하면 사용자가 파일을 선택하고, 선택된 바이트 데이터가 스크립트로 전달돼요(메시지 버스를 통해 base64로 전달된 뒤 Promise가 완료되기 전에 `Uint8Array`로 디코딩되므로 인코딩 과정을 직접 신경 쓸 필요가 없어요). OS의 네이티브 파일 대화상자는 사용자의 명시적인 선택을 필수적으로 요구하므로, 스크립트가 임의로 사용자 파일을 몰래 빼낼 위험이 없어요. 따라서 `api.ui.prompt`, `confirm`, `showContextMenu`와 마찬가지로 별도의 보안 권한이 필요하지 않아요.

## 참고 사항

- **사용자의 명시적 동작(버튼 클릭, 명령 실행 등)에 반응하여 호출하세요.** 타이머 등으로 갑자기 창을 띄우는 것은 사용자 경험을 해치며, 일부 브라우저는 사용자 제스처 핸들러 내부가 아닌 곳에서 호출된 `pickFile`을 차단해요.
- 사용자가 파일을 선택하거나 취소할 때까지 Promise는 대기 상태를 유지해요 (별도의 시간 제한이 없어요).
- `PickFileOptions` 및 `PickedFile`의 전체 필드 목록은 앱 내 **레퍼런스 탭**을 확인하세요.
