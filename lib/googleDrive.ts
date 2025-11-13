// Google Drive 이미지 업로드 헬퍼 함수

/**
 * 폴더 찾기 또는 생성
 * @param folderName 폴더 이름
 * @param parentId 부모 폴더 ID (없으면 root)
 * @param accessToken Google OAuth 액세스 토큰
 * @returns 폴더 ID
 */
async function findOrCreateFolder(
  folderName: string,
  accessToken: string,
  parentId: string = 'root'
): Promise<string> {
  // 1. 기존 폴더 검색
  const searchResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const searchData = await searchResponse.json();

  // 2. 폴더가 이미 있으면 반환
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // 3. 없으면 새로 생성
  const createResponse = await fetch(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    }
  );

  const createData = await createResponse.json();
  return createData.id;
}

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
    // 1. "교육과정 워크숍" 폴더 찾기/생성
    const workshopFolderId = await findOrCreateFolder('교육과정 워크숍', accessToken);

    // 2. "이미지" 폴더 찾기/생성 (교육과정 워크숍 안에)
    const imageFolderId = await findOrCreateFolder('이미지', accessToken, workshopFolderId);

    // 3. 메타데이터 준비
    const metadata = {
      name: `quiz-image-${Date.now()}-${file.name}`,
      mimeType: file.type,
      parents: [imageFolderId], // 이미지 폴더에 저장
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
    // lh3.googleusercontent.com 형식은 img 태그에서 직접 표시 가능
    const imageUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
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

  // Drive API 스코프만 추가 (시트 생성은 Drive API로 가능)
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
 * 템플릿 시트를 복사하여 사용자 전용 시트 생성
 * @param templateFileId 원본 템플릿 시트 ID
 * @param userName 사용자 이름 (시트 제목용)
 * @param adminEmail 관리자 이메일 (편집 권한 부여용)
 * @param accessToken Google OAuth 액세스 토큰
 * @returns 복사된 시트 ID, URL, 웹 앱 URL
 */
export async function copyTemplateSheet(
  templateFileId: string,
  userName: string,
  adminEmail: string,
  accessToken: string
): Promise<{ id: string; url: string; webAppUrl: string | null }> {
  try {
    // 1. "교육과정 워크숍" 폴더 찾기/생성
    const workshopFolderId = await findOrCreateFolder('교육과정 워크숍', accessToken);

    // 2. 템플릿 시트 복사
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sheetTitle = `워크숍결과_${userName}_${today}`;

    const copyResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${templateFileId}/copy`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sheetTitle,
          parents: [workshopFolderId], // 교육과정 워크숍 폴더에 저장
        }),
      }
    );

    if (!copyResponse.ok) {
      const error = await copyResponse.text();
      throw new Error(`시트 복사 실패: ${error}`);
    }

    const copyData = await copyResponse.json();
    const sheetId = copyData.id;

    // 3. 관리자에게 편집 권한 부여 (웹 앱이 시트에 기록할 수 있도록)
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${sheetId}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'writer', // 편집 권한
          type: 'user',
          emailAddress: adminEmail,
        }),
      }
    );

    // 4. 시트 URL 생성
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;

    // 5. 웹 앱 URL은 관리자의 템플릿 웹 앱 URL을 사용
    // (환경 변수에서 가져오거나 별도 저장)
    const webAppUrl = null; // 나중에 설정

    return { id: sheetId, url: sheetUrl, webAppUrl };
  } catch (error) {
    console.error('시트 복사 실패:', error);
    throw error;
  }
}

/**
 * Google Sheets 생성 (빈 시트)
 * @param title 시트 제목
 * @param accessToken Google OAuth 액세스 토큰
 * @returns 시트 ID와 URL
 */
export async function createGoogleSheet(
  title: string,
  accessToken: string
): Promise<{ id: string; url: string }> {
  try {
    // 1. "교육과정 워크숍" 폴더 찾기/생성
    const workshopFolderId = await findOrCreateFolder('교육과정 워크숍', accessToken);

    // 2. Google Sheets 생성
    const createResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: title,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [workshopFolderId], // 교육과정 워크숍 폴더에 저장
        }),
      }
    );

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`시트 생성 실패: ${error}`);
    }

    const createData = await createResponse.json();
    const sheetId = createData.id;

    // 3. 시트를 공개로 설정 (선택사항 - 링크를 아는 사람만 볼 수 있도록)
    await fetch(
      `https://www.googleapis.com/drive/v3/files/${sheetId}/permissions`,
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

    // 4. 시트 URL 반환
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
    return { id: sheetId, url: sheetUrl };
  } catch (error) {
    console.error('Google Sheets 생성 실패:', error);
    throw error;
  }
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
