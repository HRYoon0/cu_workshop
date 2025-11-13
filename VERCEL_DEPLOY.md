# Vercel 배포 가이드

이 가이드를 따라 교육과정 워크숍 퀴즈를 Vercel에 배포하세요.

## 사전 준비사항

✅ GitHub 계정
✅ Vercel 계정 (https://vercel.com)
✅ Firebase 설정 완료
✅ Google Drive API 설정 완료

## 1단계: GitHub에 코드 푸시

### 1.1 Git 초기화 (아직 안 했다면)

```bash
git init
git add .
git commit -m "Initial commit"
```

### 1.2 GitHub 저장소 생성

1. GitHub (https://github.com) 접속
2. 우측 상단 `+` → `New repository`
3. Repository name: `workshop-quiz` (또는 원하는 이름)
4. Private 선택 (권장)
5. `Create repository` 클릭

### 1.3 GitHub에 푸시

```bash
git remote add origin https://github.com/본인아이디/workshop-quiz.git
git branch -M main
git push -u origin main
```

## 2단계: Vercel에 배포

### 2.1 Vercel 프로젝트 생성

1. **Vercel 접속**: https://vercel.com
2. **Sign Up / Login**: GitHub 계정으로 로그인
3. **New Project** 클릭
4. **Import Git Repository**: 방금 만든 저장소 선택
5. **Import** 클릭

### 2.2 환경 변수 설정

**Environment Variables** 섹션에서 아래 변수들을 **모두** 추가:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD63A3kJp0oKottnMwSZxRT43vGIlBOUnk
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cu-workshop-158c0.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=cu-workshop-158c0
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=cu-workshop-158c0.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=431031733539
NEXT_PUBLIC_FIREBASE_APP_ID=1:431031733539:web:727fac5a0328db69db5096
NEXT_PUBLIC_ADMIN_UID=2SrzZEKfTvT0u3EEB8uOSqrnTvY2
NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID=431031733539-trk7r1sj4gs47a8qqqietr3vspp8dpng.apps.googleusercontent.com
```

**중요**: 각 환경 변수를 하나씩 추가하세요!

### 2.3 배포 시작

1. **Deploy** 버튼 클릭
2. 배포 완료 대기 (약 2-3분)
3. 배포 완료 후 **Visit** 클릭하여 확인

## 3단계: 배포 후 설정

배포가 완료되면 Vercel이 제공하는 URL이 생성됩니다.
예: `https://workshop-quiz-xxxxx.vercel.app`

### 3.1 Firebase Authentication 도메인 추가

1. **Firebase Console** 접속
2. `Authentication` → `Settings` → `Authorized domains`
3. Vercel URL 추가: `workshop-quiz-xxxxx.vercel.app`
4. `Add domain` 클릭

### 3.2 Google Cloud Console OAuth 설정 업데이트

1. **Google Cloud Console** 접속
2. `API 및 서비스` → `사용자 인증 정보`
3. 생성한 OAuth 2.0 클라이언트 ID 클릭
4. **승인된 JavaScript 원본**에 추가:
   ```
   https://workshop-quiz-xxxxx.vercel.app
   ```
5. **승인된 리디렉션 URI**에 추가:
   ```
   https://workshop-quiz-xxxxx.vercel.app
   ```
6. `저장` 클릭

## 4단계: 커스텀 도메인 설정 (선택사항)

### 4.1 Vercel에서 도메인 연결

1. Vercel 프로젝트 → `Settings` → `Domains`
2. 도메인 입력 (예: `quiz.example.com`)
3. DNS 설정 안내에 따라 도메인 연동

### 4.2 Firebase 및 Google Cloud에 새 도메인 추가

위 3.1, 3.2 단계를 커스텀 도메인으로 반복

## 5단계: 자동 배포 설정

✅ GitHub에 푸시하면 자동으로 Vercel에 배포됨!

```bash
# 코드 수정 후
git add .
git commit -m "Update: 기능 추가"
git push
# → 자동으로 Vercel 배포 시작!
```

## 문제 해결

### 배포는 성공했는데 로그인이 안 돼요
→ Firebase Authentication 도메인 추가를 확인하세요 (3.1 단계)

### 이미지 업로드가 안 돼요
→ Google Cloud Console OAuth 설정 확인 (3.2 단계)

### 환경 변수가 적용이 안 돼요
→ Vercel → Settings → Environment Variables에서 모든 변수가 추가되었는지 확인
→ 변수 추가 후 `Deployments` → `Redeploy` 클릭

### 404 에러가 나요
→ Next.js App Router를 사용하므로 정상입니다
→ `/admin`, `/login`, `/participant` 경로로 접속하세요

## 완료! 🎉

이제 배포된 URL로 접속하여 테스트하세요!

**배포 URL 공유 시 주의사항:**
- `/admin` - 관리자만 접근 (승인된 사용자)
- `/login` - 로그인 페이지
- `/participant?quiz=퀴즈ID` - 참여자용 (QR 코드로 접속)
