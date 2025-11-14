# Vercel 배포 가이드

## 1. Vercel 계정 생성 및 로그인

1. [vercel.com](https://vercel.com) 접속
2. **"Sign Up"** 클릭
3. **"Continue with GitHub"** 선택하여 GitHub 계정으로 가입

## 2. 프로젝트 Import

1. Vercel 대시보드에서 **"Add New..."** → **"Project"** 클릭
2. GitHub 저장소 목록에서 **`cu_workshop`** 찾기
3. **"Import"** 클릭

## 3. 프로젝트 설정

### Framework Preset
- **Framework Preset:** Next.js (자동 감지됨)
- **Root Directory:** `workshop-quiz` 선택 ⚠️ 중요!
- **Build Command:** `npm run build` (기본값)
- **Output Directory:** `.next` (기본값)

### 환경 변수 설정 ⚠️ 중요!

**"Environment Variables"** 섹션에서 다음 11개 변수를 추가하세요:

로컬의 `.env` 파일에서 값을 복사:
```bash
cat .env
```

#### Firebase 설정 (6개)
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID

#### 관리자 설정 (2개)
- NEXT_PUBLIC_ADMIN_UID
- NEXT_PUBLIC_ADMIN_EMAIL

#### Google 설정 (3개)
- NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID
- NEXT_PUBLIC_SHEET_TEMPLATE_ID
- NEXT_PUBLIC_GOOGLE_SHEETS_URL

## 4. 배포 시작

1. 모든 환경 변수 입력 완료 후 **"Deploy"** 클릭
2. 약 2-3분 대기 (빌드 진행)
3. 배포 완료! 🎉

## 5. 배포 완료 후

### 배포 URL 확인
- Vercel이 자동으로 생성한 URL (예: `https://cu-workshop-xxx.vercel.app`)

### QR 코드 테스트
1. 배포된 URL로 접속: `https://your-app.vercel.app/login`
2. Google 로그인
3. 퀴즈 생성
4. QR 코드 스캔
5. 스마트폰에서 정상 접근 확인!

## 6. Firebase 설정 업데이트 (중요!)

배포 URL을 Firebase에 등록:

1. [Firebase Console](https://console.firebase.google.com) 접속
2. 프로젝트 선택
3. **Authentication** → **Settings** → **Authorized domains**
4. 배포된 Vercel 도메인 추가: `your-app.vercel.app`

## 7. 자동 배포

이제 GitHub에 푸시하면 자동으로 Vercel에 배포됩니다!

---

배포가 완료되면 전 세계 어디서든 스마트폰으로 접속 가능! 🚀
