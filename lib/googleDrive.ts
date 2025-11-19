// Google Drive 이미지 업로드 헬퍼 함수

/**
 * 저장된 학교 이름 가져오기
 * @returns 학교 이름 (없으면 기본값)
 */
function getSchoolName(): string {
  if (typeof window === 'undefined') return '2025학년도 경남초등학교 교육과정 워크숍';
  return localStorage.getItem('schoolName') || '2025학년도 경남초등학교 교육과정 워크숍';
}

/**
 * 폴더 찾기 또는 생성
 * @param folderName 폴더 이름
 * @param parentId 부모 폴더 ID (없으면 root)
 * @param accessToken Google OAuth 액세스 토큰
 * @returns 폴더 ID
 */
export async function findOrCreateFolder(
  folderName: string,
  accessToken: string,
  parentId: string = 'root'
): Promise<string> {
  try {
    console.log('🔍 폴더 검색 중:', folderName);

    // 1. 기존 폴더 검색
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false&fields=files(id,name)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log('검색 API 응답 상태:', searchResponse.status);

    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      console.error('❌ 폴더 검색 실패:', error);

      // 401 에러면 토큰 만료
      if (searchResponse.status === 401) {
        handleTokenExpired();
      }

      throw new Error(`폴더 검색 실패 (${searchResponse.status}): ${error}`);
    }

    const searchData = await searchResponse.json();

    // 2. 폴더가 이미 있으면 반환
    if (searchData.files && searchData.files.length > 0) {
      console.log('✅ 기존 폴더 발견:', searchData.files[0].id);
      return searchData.files[0].id;
    }

    // 3. 없으면 새로 생성
    console.log('📁 새 폴더 생성 중...');
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

    console.log('폴더 생성 API 응답 상태:', createResponse.status);

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('❌ 폴더 생성 실패:', error);

      // 401 에러면 토큰 만료
      if (createResponse.status === 401) {
        handleTokenExpired();
      }

      throw new Error(`폴더 생성 실패 (${createResponse.status}): ${error}`);
    }

    const createData = await createResponse.json();
    console.log('✅ 새 폴더 생성 완료:', createData.id);
    return createData.id;
  } catch (error) {
    console.error('❌ findOrCreateFolder 에러:', error);
    throw error;
  }
}

/**
 * 폴더 이름 변경
 * @param folderId 폴더 ID
 * @param newName 새 폴더 이름
 * @param accessToken Google OAuth 액세스 토큰
 */
async function renameFolder(
  folderId: string,
  newName: string,
  accessToken: string
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: newName,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`폴더 이름 변경 실패: ${error}`);
  }
}

/**
 * root에 있는 모든 폴더 목록 조회
 * @param accessToken Google OAuth 액세스 토큰
 * @returns 폴더 목록
 */
export async function listRootFolders(accessToken: string): Promise<any[]> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false&fields=files(id,name)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`폴더 목록 조회 실패: ${await response.text()}`);
    }

    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('폴더 목록 조회 실패:', error);
    throw error;
  }
}

/**
 * 학교 폴더 이름 변경 또는 생성
 * - 기존 폴더가 있으면 이름 변경
 * - 없으면 새로 생성
 * @param oldName 기존 폴더 이름
 * @param newName 새 폴더 이름
 * @param accessToken Google OAuth 액세스 토큰
 * @returns 작업 결과
 */
export async function renameSchoolFolder(
  oldName: string,
  newName: string,
  accessToken: string
): Promise<{ renamed: boolean; created: boolean; message: string }> {
  try {
    // 디버깅: root의 모든 폴더 확인
    const allFolders = await listRootFolders(accessToken);
    console.log('Drive root의 모든 폴더:', allFolders);

    // 1. 기존 폴더 검색 (root에서)
    console.log('기존 폴더 검색 중:', oldName);
    const searchResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=name='${oldName}' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false&fields=files(id,name)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!searchResponse.ok) {
      throw new Error(`폴더 검색 실패: ${await searchResponse.text()}`);
    }

    const searchData = await searchResponse.json();
    console.log('검색 결과:', searchData);

    // 2. 폴더가 있으면 이름 변경
    if (searchData.files && searchData.files.length > 0) {
      const folderId = searchData.files[0].id;
      await renameFolder(folderId, newName, accessToken);
      console.log(`폴더 이름 변경 완료: "${oldName}" → "${newName}"`);

      // 폴더 ID를 localStorage에 저장 (추후 빠른 접근용)
      if (typeof window !== 'undefined') {
        localStorage.setItem('schoolFolderId', folderId);
      }

      return {
        renamed: true,
        created: false,
        message: `Google Drive 폴더 이름이 변경되었습니다:\n"${oldName}" → "${newName}"`
      };
    } else {
      // 3. 폴더가 없으면 새로 생성
      console.log('기존 폴더를 찾을 수 없습니다. 새 폴더를 생성합니다:', newName);
      const newFolderId = await findOrCreateFolder(newName, accessToken, 'root');

      // 폴더 ID를 localStorage에 저장
      if (typeof window !== 'undefined') {
        localStorage.setItem('schoolFolderId', newFolderId);
      }

      const folderNames = allFolders.map(f => f.name).join(', ');
      let message = `"${oldName}" 폴더를 찾을 수 없어서 새로 생성했습니다.\n`;
      if (allFolders.length > 0) {
        message += `기존 폴더: ${folderNames}\n\n`;
      }
      message += `새 폴더: "${newName}"`;

      return {
        renamed: false,
        created: true,
        message: message
      };
    }
  } catch (error) {
    console.error('학교 폴더 작업 실패:', error);
    throw error;
  }
}

/**
 * Google Drive에 이미지 업로드
 * @param file 업로드할 파일
 * @param accessToken Google OAuth 액세스 토큰
 * @returns 공개 이미지 URL
 */
export async function uploadImageToDrive(
  file: File,
  accessToken: string,
  subfolder: string = '이미지' // 기본값은 '이미지'
): Promise<string> {
  try {
    // 1. 학교 이름 폴더 찾기/생성
    const schoolName = getSchoolName();
    const workshopFolderId = await findOrCreateFolder(schoolName, accessToken);

    // 2. 지정된 서브폴더 찾기/생성 (학교 폴더 안에)
    const imageFolderId = await findOrCreateFolder(subfolder, accessToken, workshopFolderId);

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

      // 401 에러면 토큰 만료
      if (uploadResponse.status === 401) {
        handleTokenExpired();
      }

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
 * 자동 재인증 시도
 * @returns 성공하면 true, 실패하면 false
 */
async function attemptAutoReauth(): Promise<boolean> {
  try {
    console.log('🔄 자동 재인증 시도 중...');

    const { auth, googleProvider } = await import('./firebase');
    const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');

    // 팝업으로 재로그인
    const result = await signInWithPopup(auth, googleProvider);

    // 새 액세스 토큰 저장
    const googleCredential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = googleCredential?.accessToken;

    if (accessToken) {
      localStorage.setItem('googleAccessToken', accessToken);
      console.log('✅ 자동 재인증 성공! 새 토큰 저장 완료');
      return true;
    } else {
      console.error('❌ 재인증 성공했지만 토큰을 가져올 수 없습니다.');
      return false;
    }
  } catch (error) {
    console.error('❌ 자동 재인증 실패:', error);
    return false;
  }
}

/**
 * 토큰 만료 처리 (완전 자동)
 */
async function handleTokenExpired(): Promise<void> {
  console.error('🔐 Google OAuth 토큰이 만료되었습니다.');

  // 만료된 토큰 삭제
  if (typeof window !== 'undefined') {
    localStorage.removeItem('googleAccessToken');

    // 즉시 자동 재인증 시도 (confirm 없이)
    console.log('🔄 자동으로 재로그인을 시도합니다...');

    const success = await attemptAutoReauth();

    if (success) {
      // 재인증 성공 - 조용히 페이지 새로고침으로 작업 계속
      console.log('✅ 자동 재로그인 성공! 페이지를 새로고침합니다.');
      window.location.reload();
    } else {
      // 재인증 실패 - 사용자에게 알림 후 로그인 페이지로
      alert('Google 로그인이 만료되어 자동 재로그인을 시도했으나 실패했습니다.\n\n로그인 페이지로 이동합니다.');
      window.location.href = '/login';
    }
  }
}

/**
 * 토큰 유효성 체크
 * Google Drive API의 가벼운 요청으로 토큰이 유효한지 확인
 * @returns 토큰이 유효하면 true, 만료되었으면 false
 */
export async function checkTokenValidity(): Promise<boolean> {
  try {
    const accessToken = localStorage.getItem('googleAccessToken');

    if (!accessToken) {
      console.warn('⚠️ 저장된 토큰이 없습니다.');
      return false;
    }

    // Drive API의 가벼운 엔드포인트로 토큰 유효성 확인
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/about?fields=user',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('❌ 토큰 유효성 체크 실패:', response.status);

      // 401이면 토큰 만료
      if (response.status === 401) {
        await handleTokenExpired();
        return false;
      }
    }

    console.log('✅ 토큰 유효함');
    return true;
  } catch (error) {
    console.error('토큰 체크 중 에러:', error);
    return false;
  }
}

/**
 * Google OAuth 액세스 토큰 가져오기
 * Firebase Auth의 Google 크리덴셜에서 토큰 추출
 */
export async function getGoogleAccessToken(): Promise<string> {
  const { auth } = await import('./firebase');
  const currentUser = auth.currentUser;

  console.log('🔍 Google 액세스 토큰 확인 중...');
  console.log('현재 사용자:', currentUser?.email);

  if (!currentUser) {
    throw new Error('로그인이 필요합니다.');
  }

  // localStorage에서 저장된 토큰 확인
  const storedToken = localStorage.getItem('googleAccessToken');

  console.log('저장된 토큰:', storedToken ? '✅ 있음' : '❌ 없음');

  if (!storedToken) {
    throw new Error('Google 액세스 토큰이 없습니다. 다시 로그인해주세요.');
  }

  return storedToken;
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
    // 1. 학교 이름 폴더 찾기/생성
    const schoolName = getSchoolName();
    const workshopFolderId = await findOrCreateFolder(schoolName, accessToken);

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
          parents: [workshopFolderId], // 학교 폴더에 저장
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
    // 1. 학교 이름 폴더 찾기/생성
    const schoolName = getSchoolName();
    const workshopFolderId = await findOrCreateFolder(schoolName, accessToken);

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
          parents: [workshopFolderId], // 학교 폴더에 저장
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
 * 설문 결과 전용 시트 생성
 * @param sheetTitle 시트 제목
 * @param accessToken Google OAuth 액세스 토큰
 * @returns 시트 ID와 URL
 */
export async function createSurveyResultSheet(
  sheetTitle: string,
  accessToken: string
): Promise<{ id: string; url: string }> {
  try {
    console.log('📊 설문 결과 시트 생성 시작:', sheetTitle);

    // 1. 학교 이름 폴더 찾기/생성
    const schoolName = getSchoolName();
    console.log('학교 이름:', schoolName);

    console.log('📁 폴더 찾기/생성 중...');
    const workshopFolderId = await findOrCreateFolder(schoolName, accessToken);
    console.log('폴더 ID:', workshopFolderId);

    console.log('📄 시트 생성 API 호출 중...');
    const createResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: sheetTitle,
          mimeType: 'application/vnd.google-apps.spreadsheet',
          parents: [workshopFolderId], // 학교 폴더에 저장
        }),
      }
    );

    console.log('API 응답 상태:', createResponse.status, createResponse.statusText);

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('❌ API 에러 응답:', error);
      throw new Error(`설문 결과 시트 생성 실패 (${createResponse.status}): ${error}`);
    }

    const createData = await createResponse.json();
    const sheetId = createData.id;

    // 3. 시트를 공개로 설정 (링크를 아는 사람만 편집 가능)
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
          type: 'anyone',
        }),
      }
    );

    // 4. 시트에 초기 헤더 설정 (Google Sheets API 사용)
    const headerResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:F1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [['세션 ID', '설문 제목', '참여자 이름', '척도 값', '텍스트 응답', '응답 시간']],
        }),
      }
    );

    if (!headerResponse.ok) {
      console.warn('헤더 설정 실패 (시트는 생성됨):', await headerResponse.text());
    }

    // 5. 시트 URL 반환
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
    return { id: sheetId, url: sheetUrl };
  } catch (error) {
    console.error('설문 결과 시트 생성 실패:', error);
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
