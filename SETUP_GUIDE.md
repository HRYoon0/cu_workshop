# 📚 전체 설정 가이드

교육과정 워크숍 퀴즈 시스템의 전체 설정 과정을 단계별로 안내합니다.

## 📋 목차

1. [Firebase 프로젝트 설정](#1-firebase-프로젝트-설정)
2. [Google Cloud Console 설정](#2-google-cloud-console-설정)
3. [구글 시트 템플릿 설정](#3-구글-시트-템플릿-설정)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [배포 및 테스트](#5-배포-및-테스트)

---

## 1. Firebase 프로젝트 설정

### 1-1. Firebase 프로젝트 생성

1. **Firebase Console 접속**
   - https://console.firebase.google.com/ 접속
   - Google 계정으로 로그인

2. **새 프로젝트 생성**
   - "프로젝트 추가" 클릭
   - 프로젝트 이름: `교육과정-워크숍` (원하는 이름으로 변경 가능)
   - Google Analytics: 선택사항 (추천: 사용 설정)
   - "프로젝트 만들기" 클릭

### 1-2. Firebase Authentication 설정

1. **Authentication 활성화**
   - 왼쪽 메뉴: **Authentication** 클릭
   - "시작하기" 클릭

2. **Google 로그인 활성화**
   - **Sign-in method** 탭 클릭
   - **Google** 찾아서 클릭
   - 사용 설정 토글 ON
   - 프로젝트 지원 이메일 선택 (본인 이메일)
   - "저장" 클릭

3. **승인된 도메인 추가** (배포 후)
   - Sign-in method → 승인된 도메인
   - localhost는 기본으로 포함됨
   - 나중에 Vercel 도메인 추가 필요 (예: `your-app.vercel.app`)

### 1-3. Firestore Database 설정

1. **Firestore 생성**
   - 왼쪽 메뉴: **Firestore Database** 클릭
   - "데이터베이스 만들기" 클릭

2. **보안 규칙 모드 선택**
   - **프로덕션 모드에서 시작** 선택 (권장)
   - "다음" 클릭

3. **위치 선택**
   - **asia-northeast3 (서울)** 선택
   - "사용 설정" 클릭
   - 데이터베이스 생성 완료 대기 (1-2분)

4. **보안 규칙 설정**
   - **규칙** 탭 클릭
   - 아래 규칙으로 교체:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 모든 사용자가 읽기 가능
    match /{document=**} {
      allow read: if true;
    }

    // 인증된 사용자만 쓰기 가능
    match /quizzes/{quizId} {
      allow create, update, delete: if request.auth != null;
    }

    match /surveys/{surveyId} {
      allow create, update, delete: if request.auth != null;
    }

    match /quizSessions/{sessionId} {
      allow create, update: if true; // 참여자도 답안 제출 가능
    }

    match /surveySessions/{sessionId} {
      allow create, update: if true; // 참여자도 응답 제출 가능
    }

    // 사용자 승인 관련 (관리자만)
    match /pendingUsers/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow delete: if request.auth != null; // 관리자 확인은 앱에서 처리
    }

    match /approvedUsers/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }

    // 사용자 시트 정보
    match /userSheets/{sheetId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

   - "게시" 클릭

### 1-4. Firebase 설정 정보 가져오기

1. **프로젝트 설정 열기**
   - 왼쪽 상단 ⚙️ (톱니바퀴) → **프로젝트 설정** 클릭

2. **웹 앱 추가**
   - **일반** 탭에서 아래로 스크롤
   - **내 앱** 섹션에서 **웹 앱 추가** (</> 아이콘) 클릭
   - 앱 닉네임: `워크숍 퀴즈 앱`
   - Firebase Hosting 설정: 체크 해제
   - "앱 등록" 클릭

3. **Firebase 구성 정보 복사**
   - SDK 설정 및 구성에서 **구성** 선택
   - 아래 형식의 코드가 표시됨:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

   - 이 값들을 메모장에 복사해두기 (나중에 .env 파일에 사용)

4. **관리자 UID 확인**
   - 왼쪽 메뉴: **Authentication** 클릭
   - 먼저 Google 로그인을 한 번 해야 합니다
   - 앱을 로컬에서 실행 → Google 로그인
   - Authentication → Users 탭에서 본인 계정의 **UID** 복사
   - 이 UID를 메모장에 저장 (관리자 UID로 사용)

---

## 2. Google Cloud Console 설정

### 2-1. Google Cloud Console 접속

1. **Google Cloud Console 열기**
   - https://console.cloud.google.com/ 접속
   - Firebase에서 생성한 프로젝트가 자동으로 연결되어 있음
   - 상단에서 프로젝트 이름 확인

### 2-2. API 활성화

1. **API 및 서비스 → 라이브러리 이동**
   - 왼쪽 메뉴: **API 및 서비스** → **라이브러리** 클릭

2. **Google Drive API 활성화**
   - 검색창에 "Google Drive API" 입력
   - **Google Drive API** 클릭
   - "사용 설정" 클릭

3. **Google Sheets API 활성화** (선택사항, Apps Script 사용 시 불필요)
   - 검색창에 "Google Sheets API" 입력
   - **Google Sheets API** 클릭
   - "사용 설정" 클릭

### 2-3. OAuth 2.0 클라이언트 ID 생성

1. **사용자 인증 정보 페이지 이동**
   - 왼쪽 메뉴: **API 및 서비스** → **사용자 인증 정보** 클릭

2. **OAuth 동의 화면 구성**
   - 상단 **OAuth 동의 화면** 탭 클릭
   - User Type: **외부** 선택 (개인 계정)
   - "만들기" 클릭

3. **앱 정보 입력**
   - 앱 이름: `교육과정 워크숍 퀴즈`
   - 사용자 지원 이메일: 본인 이메일 선택
   - 앱 로고: 선택사항
   - 앱 도메인: 비워두기
   - 개발자 연락처 정보: 본인 이메일 입력
   - "저장 후 계속" 클릭

4. **범위 설정**
   - "범위 추가 또는 삭제" 클릭
   - 아래 범위 추가:
     - `.../auth/drive.file` (사용자가 열거나 만든 특정 Drive 파일만 액세스)
   - "업데이트" → "저장 후 계속" 클릭

5. **테스트 사용자 추가** (선택사항)
   - 개발 단계에서는 "테스트 사용자" 추가
   - 본인 이메일 및 테스트할 사용자 이메일 입력
   - "저장 후 계속" 클릭
   - "대시보드로 돌아가기" 클릭

6. **OAuth 클라이언트 ID 생성**
   - **사용자 인증 정보** 탭으로 돌아가기
   - 상단 **+ 사용자 인증 정보 만들기** 클릭
   - **OAuth 클라이언트 ID** 선택

7. **애플리케이션 유형 선택**
   - 애플리케이션 유형: **웹 애플리케이션** 선택
   - 이름: `워크숍 퀴즈 웹 클라이언트`

8. **승인된 리디렉션 URI 추가**
   - "승인된 JavaScript 원본" 섹션:
     - `http://localhost:3000` 추가
     - 나중에 Vercel URL도 추가 (예: `https://your-app.vercel.app`)
   - "승인된 리디렉션 URI" 섹션:
     - `http://localhost:3000` 추가
     - 나중에 Vercel URL도 추가
   - "만들기" 클릭

9. **클라이언트 ID 복사**
   - 생성된 팝업에서 **클라이언트 ID** 복사
   - 형식: `123456789-abcdefg.apps.googleusercontent.com`
   - 메모장에 저장

---

## 3. 구글 시트 템플릿 설정

### 3-1. 템플릿 시트 생성

1. **새 구글 스프레드시트 생성**
   - https://sheets.google.com 접속
   - **빈 스프레드시트** 클릭
   - 이름: `워크숍 결과 템플릿`

### 3-2. Apps Script 코드 추가

1. **Apps Script 편집기 열기**
   - 메뉴: **확장 프로그램** → **Apps Script** 클릭

2. **코드 붙여넣기**
   - `GOOGLE_SHEETS_SETUP.md` 파일에서 전체 Apps Script 코드 복사
   - Apps Script 편집기에 붙여넣기 (기존 코드 삭제)
   - 상단 💾 **저장** 클릭
   - 프로젝트 이름: `워크숍 자동 기록` (자동 저장됨)

3. **구글 시트로 돌아가기**
   - Apps Script 탭 닫기
   - 구글 시트 페이지 **새로고침** (F5)
   - 상단 메뉴에 **🎓 워크숍 설정** 메뉴가 생김

4. **시트 구조 자동 생성**
   - 메뉴: **🎓 워크숍 설정** → **📊 시트 구조 자동 생성** 클릭
   - 권한 요청 팝업:
     - "권한 검토" 클릭
     - 본인 Google 계정 선택
     - "고급" 클릭 → "워크숍 자동 기록(안전하지 않음)으로 이동" 클릭
     - "허용" 클릭
   - ✅ "시트가 생성되었습니다!" 메시지 확인
   - **퀴즈결과**, **설문결과** 시트 생성 확인

### 3-3. 웹 앱 배포

1. **Apps Script 다시 열기**
   - 메뉴: **확장 프로그램** → **Apps Script**

2. **새 배포 만들기**
   - 우측 상단 **배포** 클릭 → **새 배포** 클릭

3. **배포 설정**
   - 유형 선택 옆 ⚙️ (톱니바퀴) 클릭
   - **웹 앱** 선택
   - 설명: `워크숍 자동 기록 v1`
   - 다음 사용자로 실행: **나**
   - 액세스 권한: **모든 사용자**
   - "배포" 클릭

4. **권한 부여**
   - "액세스 권한 부여" 클릭
   - 본인 Google 계정 선택
   - "고급" → "워크숍 자동 기록(안전하지 않음)으로 이동" 클릭
   - "허용" 클릭

5. **웹 앱 URL 복사**
   - **웹 앱 URL** 복사 (형식: `https://script.google.com/macros/s/.../exec`)
   - 메모장에 저장

### 3-4. 템플릿 시트 ID 확인

1. **구글 시트 URL에서 ID 복사**
   - 구글 시트 탭으로 돌아가기
   - 주소창의 URL 확인:
   ```
   https://docs.google.com/spreadsheets/d/[여기가_시트_ID]/edit
   ```
   - `[여기가_시트_ID]` 부분 복사 (예: `1a2B3c4D5e6F7g8H9i0J`)
   - 메모장에 저장

---

## 4. 환경 변수 설정

### 4-1. .env.local 파일 생성

1. **프로젝트 루트에 .env.local 파일 생성**
   ```bash
   # 프로젝트 폴더에서
   cp .env.example .env.local
   ```

2. **환경 변수 입력**
   - 앞서 복사해둔 값들을 입력:

```bash
# Firebase 설정 (1-4단계에서 복사한 값)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# 관리자 UID (1-4단계에서 복사한 값)
NEXT_PUBLIC_ADMIN_UID=abcdefghijklmnopqrst

# 관리자 이메일 (본인 Google 계정 이메일)
NEXT_PUBLIC_ADMIN_EMAIL=your-email@gmail.com

# Google Drive API (2-3단계에서 복사한 클라이언트 ID)
NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com

# 구글 시트 템플릿 ID (3-4단계에서 복사한 시트 ID)
NEXT_PUBLIC_SHEET_TEMPLATE_ID=1a2B3c4D5e6F7g8H9i0J

# 구글 시트 웹 앱 URL (3-3단계에서 복사한 웹 앱 URL)
NEXT_PUBLIC_GOOGLE_SHEETS_URL=https://script.google.com/macros/s/.../exec
```

### 4-2. .env.local 파일 확인

- `.env.local` 파일이 `.gitignore`에 포함되어 있는지 확인 (보안)
- 모든 값이 올바르게 입력되었는지 확인

---

## 5. 배포 및 테스트

### 5-1. 로컬 테스트

1. **개발 서버 실행**
   ```bash
   npm install
   npm run dev
   ```

2. **브라우저 접속**
   - http://localhost:3000 접속

3. **로그인 테스트**
   - Google 로그인 클릭
   - 본인 계정으로 로그인
   - 관리자 페이지 접근 확인

4. **기능 테스트**
   - 퀴즈 생성 → 세션 시작 → 참여자 링크 복사
   - 시크릿 창에서 참여자로 퀴즈 참여
   - Firebase에 데이터 저장 확인
   - 구글 시트에 데이터 기록 확인

### 5-2. Vercel 배포

1. **Vercel 계정 생성**
   - https://vercel.com 접속
   - GitHub 계정으로 가입

2. **프로젝트 배포**
   - "New Project" 클릭
   - GitHub 저장소 연결
   - 프로젝트 Import

3. **환경 변수 설정**
   - Settings → Environment Variables
   - `.env.local`의 모든 변수 추가 (복사 붙여넣기)
   - "Save" 클릭

4. **배포 완료**
   - 자동으로 빌드 및 배포 진행
   - 배포 완료 후 URL 확인 (예: `your-app.vercel.app`)

### 5-3. 배포 후 추가 설정

1. **Firebase 승인된 도메인 추가**
   - Firebase Console → Authentication → Settings → Authorized domains
   - Vercel 도메인 추가 (예: `your-app.vercel.app`)

2. **Google Cloud Console 리디렉션 URI 추가**
   - Google Cloud Console → API 및 서비스 → 사용자 인증 정보
   - OAuth 클라이언트 ID 수정
   - 승인된 JavaScript 원본: `https://your-app.vercel.app` 추가
   - 승인된 리디렉션 URI: `https://your-app.vercel.app` 추가

---

## 🔧 문제 해결

### Firebase 관련

**문제**: "Firebase: Error (auth/unauthorized-domain)"
- **해결**: Firebase Console → Authentication → 승인된 도메인에 현재 도메인 추가

**문제**: Firestore 읽기/쓰기 권한 오류
- **해결**: Firestore → 규칙 탭에서 위의 보안 규칙 다시 적용

### Google Drive/Sheets 관련

**문제**: "Access not granted or expired"
- **해결**: Google Cloud Console → OAuth 동의 화면 → 게시 상태 확인
- 테스트 모드인 경우 테스트 사용자 추가 필요

**문제**: 시트에 데이터가 기록되지 않음
- **해결**:
  1. Apps Script 웹 앱 배포 확인
  2. 웹 앱 URL이 .env에 올바르게 설정되었는지 확인
  3. 브라우저 개발자 도구 → Network 탭에서 요청 확인

**문제**: "브랜딩이 게시되지 않았습니다" 경고
- **해결**: 정상입니다. `drive.file` 스코프만 사용하므로 검증 불필요
- 사용자가 100명 이하면 테스트 모드로 운영 가능

### 환경 변수 관련

**문제**: 환경 변수가 적용되지 않음
- **해결**:
  1. .env.local 파일명 확인 (철자 정확히)
  2. 개발 서버 재시작 (npm run dev 다시 실행)
  3. Vercel 배포 시 환경 변수 재확인

---

## 📚 추가 참고 자료

- [Firebase 공식 문서](https://firebase.google.com/docs)
- [Google Drive API 가이드](https://developers.google.com/drive/api/guides/about-sdk)
- [Apps Script 가이드](https://developers.google.com/apps-script)
- [Next.js 환경 변수](https://nextjs.org/docs/basic-features/environment-variables)

---

## ✅ 설정 체크리스트

- [ ] Firebase 프로젝트 생성 완료
- [ ] Firebase Authentication (Google) 활성화
- [ ] Firestore Database 생성 및 보안 규칙 설정
- [ ] Firebase 설정 정보 복사
- [ ] 관리자 UID 확인
- [ ] Google Cloud Console 프로젝트 확인
- [ ] Google Drive API 활성화
- [ ] OAuth 2.0 클라이언트 ID 생성
- [ ] 구글 시트 템플릿 생성
- [ ] Apps Script 코드 추가
- [ ] 시트 구조 자동 생성 실행
- [ ] Apps Script 웹 앱 배포
- [ ] 템플릿 시트 ID 복사
- [ ] .env.local 파일 생성 및 모든 환경 변수 입력
- [ ] 로컬 테스트 완료
- [ ] Vercel 배포 완료
- [ ] 배포 후 도메인 추가 설정 완료

모든 항목을 체크하면 설정 완료입니다! 🎉
