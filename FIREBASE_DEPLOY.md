# Firebase Hosting 배포 가이드

이 가이드를 따라 교육과정 워크숍 퀴즈를 Firebase Hosting에 배포하세요.

## 사전 준비사항

✅ Firebase 프로젝트 생성 완료 (cu-workshop-158c0)
✅ Firebase CLI 설치 완료
✅ Google Drive API 설정 완료

## 1단계: Firebase 로그인

터미널에서 다음 명령어를 실행하여 Firebase에 로그인하세요:

```bash
firebase login
```

- 브라우저가 자동으로 열립니다
- Google 계정으로 로그인하세요
- 권한 허용을 클릭하세요
- 로그인 성공 메시지를 확인하세요

## 2단계: Next.js 빌드

프로젝트를 정적 파일로 빌드합니다:

```bash
npm run build
```

- `out` 폴더에 정적 HTML 파일들이 생성됩니다
- 빌드 완료까지 약 1-2분 소요됩니다

## 3단계: Firebase에 배포

빌드가 완료되면 Firebase Hosting에 배포합니다:

```bash
firebase deploy --only hosting
```

- 배포 완료까지 약 1-2분 소요됩니다
- 배포 완료 후 Hosting URL이 표시됩니다
- 예: `https://cu-workshop-158c0.web.app`

## 4단계: 배포 후 설정

### 4.1 Firebase Authentication 도메인 추가

1. **Firebase Console** 접속: https://console.firebase.google.com
2. 프로젝트 선택: `cu-workshop-158c0`
3. `Authentication` → `Settings` → `Authorized domains`
4. Firebase Hosting URL 추가:
   - `cu-workshop-158c0.web.app`
   - `cu-workshop-158c0.firebaseapp.com` (자동 추가됨)
5. `Add domain` 클릭

### 4.2 Google Cloud Console OAuth 설정 업데이트

1. **Google Cloud Console** 접속: https://console.cloud.google.com
2. 프로젝트 선택: `cu-workshop-158c0`
3. `API 및 서비스` → `사용자 인증 정보`
4. OAuth 2.0 클라이언트 ID 클릭
5. **승인된 JavaScript 원본**에 추가:
   ```
   https://cu-workshop-158c0.web.app
   https://cu-workshop-158c0.firebaseapp.com
   ```
6. **승인된 리디렉션 URI**에 추가:
   ```
   https://cu-workshop-158c0.web.app
   https://cu-workshop-158c0.firebaseapp.com
   ```
7. `저장` 클릭

## 5단계: 커스텀 도메인 설정 (선택사항)

### 5.1 Firebase에서 도메인 연결

1. Firebase Console → `Hosting` 탭
2. `Add custom domain` 클릭
3. 도메인 입력 (예: `quiz.example.com`)
4. DNS 설정 안내에 따라 도메인 연동
5. SSL 인증서 자동 발급 (약 24시간 소요)

### 5.2 커스텀 도메인을 Firebase 및 OAuth에 추가

위 4.1, 4.2 단계를 커스텀 도메인으로 반복

## 배포 명령어 요약

```bash
# 1. 로그인 (최초 1회만)
firebase login

# 2. 빌드 + 배포
npm run build
firebase deploy --only hosting

# 또는 한번에:
npm run build && firebase deploy --only hosting
```

## 업데이트 배포

코드를 수정한 후 다시 배포하려면:

```bash
npm run build
firebase deploy --only hosting
```

Git 커밋도 함께 하려면:

```bash
npm run build
firebase deploy --only hosting
git add .
git commit -m "Update: 기능 수정"
git push
```

## 문제 해결

### 배포는 성공했는데 로그인이 안 돼요
→ Firebase Authentication 도메인 추가를 확인하세요 (4.1 단계)

### 이미지 업로드가 안 돼요
→ Google Cloud Console OAuth 설정 확인 (4.2 단계)

### 빌드 에러가 발생해요
→ `rm -rf .next out` 후 다시 빌드 시도
→ `npm install` 후 다시 시도

### 배포 후 404 에러가 나요
→ Firebase Hosting의 rewrite 규칙이 올바르게 설정되었는지 확인
→ `firebase.json` 파일 확인

### 이전 배포를 롤백하고 싶어요
```bash
# 배포 히스토리 확인
firebase hosting:clone

# 특정 버전으로 롤백
firebase hosting:clone SOURCE_SITE_ID:SOURCE_VERSION DEST_SITE_ID
```

## Firebase Console 주요 링크

- **Hosting 대시보드**: https://console.firebase.google.com/project/cu-workshop-158c0/hosting
- **Authentication**: https://console.firebase.google.com/project/cu-workshop-158c0/authentication
- **Firestore**: https://console.firebase.google.com/project/cu-workshop-158c0/firestore

## 완료! 🎉

이제 배포된 URL로 접속하여 테스트하세요!

**배포 URL**:
- https://cu-workshop-158c0.web.app
- https://cu-workshop-158c0.firebaseapp.com

**주요 경로:**
- `/admin` - 관리자만 접근 (승인된 사용자)
- `/login` - 로그인 페이지
- `/participant?quiz=퀴즈ID` - 참여자용 (QR 코드로 접속)
