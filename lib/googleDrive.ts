// Google Drive 이미지 업로드 헬퍼 함수

/**
 * Google Drive에 이미지 업로드
 * @param file 업로드할 파일
 * @param accessToken Google OAuth 액세스 토큰
 * @returns 공개 이미지 URL
 */
export async function uploadImageToDrive(
  file: File,
  accessToken: string
): Promise<string> {
  try {
    // 1. 메타데이터 준비
    const metadata = {
      name: `quiz-image-${Date.now()}-${file.name}`,
      mimeType: file.type,
      parents: ['root'], // 루트 폴더에 저장 (또는 특정 폴더 ID 지정 가능)
    };

    // 2. FormData 생성
    const formData = new FormData();
    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    formData.append('file', file);

    // 3. Google Drive API로 업로드
    const uploadResponse = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      }
    );

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      throw new Error(`업로드 실패: ${error}`);
    }

    const uploadData = await uploadResponse.json();
    const fileId = uploadData.id;

    // 4. 파일을 공개로 설정
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      }
    );

    // 5. 공개 URL 반환 (직접 이미지 표시 가능한 형식)
    const imageUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    return imageUrl;
  } catch (error) {
    console.error('Google Drive 업로드 실패:', error);
    throw error;
  }
}

/**
 * Google OAuth 액세스 토큰 가져오기
 * Firebase Auth의 Google 크리덴셜에서 토큰 추출
 */
export async function getGoogleAccessToken(): Promise<string> {
  const { auth } = await import('./firebase');
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('로그인이 필요합니다.');
  }

  // Firebase Auth에서 Google 액세스 토큰 가져오기
  const credential = await currentUser.getIdTokenResult();

  // Google 프로바이더의 액세스 토큰이 필요합니다
  // 새로 로그인해야 할 수도 있습니다
  const { GoogleAuthProvider, getAuth } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();

  // Drive API 스코프 추가
  provider.addScope('https://www.googleapis.com/auth/drive.file');

  // 재인증하여 Drive 권한 요청
  const { signInWithPopup } = await import('firebase/auth');
  const result = await signInWithPopup(auth, provider);

  // @ts-ignore - Google 크리덴셜에서 액세스 토큰 가져오기
  const googleCredential = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = googleCredential?.accessToken;

  if (!accessToken) {
    throw new Error('Google 액세스 토큰을 가져올 수 없습니다.');
  }

  return accessToken;
}

/**
 * 이미지 최적화 (선택사항)
 * 큰 이미지를 리사이징하여 용량 절감
 */
export async function optimizeImage(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 비율 유지하면서 리사이징
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const optimizedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now(),
              });
              resolve(optimizedFile);
            } else {
              reject(new Error('이미지 최적화 실패'));
            }
          },
          file.type,
          quality
        );
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}
