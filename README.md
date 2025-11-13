# 교육과정 워크숍 - 실시간 퀴즈 & 설문 시스템

Kahoot 및 Blooket과 유사한 실시간 인터랙티브 퀴즈 및 설문 시스템입니다. 학년말 교육과정 워크숍에서 교사들이 실시간으로 퀴즈에 참여하고 의견을 공유할 수 있습니다.

## ✨ 주요 기능

### 관리자 기능
- 📝 **퀴즈 생성 및 관리**
  - 4지선다형 퀴즈 생성
  - 정답 설정 및 제한 시간 설정 (기본 10초)
  - 여러 퀴즈를 미리 준비 가능

- 📊 **설문 생성 및 관리**
  - 5점 척도 설문 (적극 찬성 +2 ~ 적극 반대 -2)
  - 서술형 기타 의견 수집
  - 제한 시간 설정 (기본 60초)

- 🎮 **실시간 세션 진행**
  - 세션 시작/종료 컨트롤
  - 실시간 참여자 현황 확인
  - 실시간 응답 수집 및 모니터링
  - 타이머 표시

- 📈 **실시간 결과 분석**
  - 퀴즈: 정답률, 답변 분포, 빠른 정답자 순위
  - 설문: 척도 분포 그래프, 평균 점수, 서술형 응답 목록

### 참여자 기능
- 👤 **닉네임 설정**
  - 자유로운 닉네임으로 참여
  - 익명성 보장

- ⚡ **빠른 퀴즈 응답**
  - 10초 제한 시간
  - 실시간 정답 확인
  - 빠른 정답자 순위 표시

- 💭 **의견 제출**
  - 5점 척도 선택
  - 기타 의견 서술형 작성
  - 관리자가 종료하기 전까지 제출 가능

- 📱 **모바일 최적화**
  - 깔끔하고 세련된 모바일 UI
  - 터치 친화적 인터페이스

## 🚀 시작하기

### 사전 요구사항

- Node.js 18.0 이상
- npm 또는 yarn
- Firebase 계정

### 1. 저장소 클론

\`\`\`bash
git clone <repository-url>
cd workshop-quiz
\`\`\`

### 2. 패키지 설치

\`\`\`bash
npm install
\`\`\`

### 3. Firebase 설정

#### 3-1. 프로젝트 생성
1. [Firebase Console](https://console.firebase.google.com/)에서 새 프로젝트 생성

#### 3-2. Firestore Database 활성화
1. Cloud Firestore → **데이터베이스 만들기** 클릭
2. **보안 규칙 선택** (두 가지 옵션):

   **옵션 A: 테스트 모드 (빠른 시작)**
   - 30일간 모든 읽기/쓰기 허용
   - ✅ 빠르게 테스트하고 싶을 때
   - ⚠️ 30일 후 자동으로 차단됨 (기한 내 규칙 수정 필요)

   **옵션 B: 프로덕션 모드 (권장)**
   - 기본적으로 모든 접근 거부
   - ✅ 영구적으로 사용 가능
   - 📝 아래 보안 규칙을 즉시 설정해야 함

3. **위치 선택**: asia-northeast3 (서울) 권장

#### 3-3. 보안 규칙 설정 (프로덕션 모드 선택시)
Firestore Database → **규칙** 탭에서 아래 코드 입력 후 **게시**:

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 퀴즈 컬렉션
    match /quizzes/{quizId} {
      allow read: if true;  // 누구나 읽기 가능
      allow write: if true; // 누구나 쓰기 가능
    }

    // 퀴즈 세션
    match /quizSessions/{sessionId} {
      allow read: if true;  // 실시간 업데이트
      allow write: if true; // 참여자 답변 제출
    }

    // 설문 컬렉션
    match /surveys/{surveyId} {
      allow read: if true;
      allow write: if true;
    }

    // 설문 세션
    match /surveySessions/{sessionId} {
      allow read: if true;
      allow write: if true;
    }
  }
}
\`\`\`

> 💡 **참고**: 위 규칙은 워크숍용 설정입니다. 링크를 아는 사람은 누구나 접근 가능하므로, 워크숍 링크는 참여자에게만 공유하세요.

#### 3-4. 웹 앱 추가 및 SDK 설정

1. **Firebase Console 상단 메뉴**에서:
   - 프로젝트 개요 옆 ⚙️ 아이콘 클릭
   - **"프로젝트 설정"** 선택

2. **"일반" 탭** 아래로 스크롤:
   - "내 앱" 섹션 찾기
   - **웹 아이콘 `</>`** 클릭 (앱 추가)

3. **앱 등록 화면**:
   - **앱 닉네임**: "워크숍 퀴즈" 입력
   - **"이 앱의 Firebase 호스팅도 설정합니다" 체크박스**: ❌ **체크하지 않음**
     > 💡 우리는 Vercel로 배포할 것이므로 Firebase 호스팅은 불필요합니다
   - **"앱 등록"** 버튼 클릭

4. **Firebase SDK 추가 화면**:
   - `firebaseConfig` 객체가 표시됩니다
   - 아래와 같은 형식으로 나타납니다:

   \`\`\`javascript
   const firebaseConfig = {
     apiKey: "AIzaSyD...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:..."
   };
   \`\`\`

5. **각 값을 복사**하여 메모장에 임시 저장:
   - `apiKey` 값
   - `authDomain` 값
   - `projectId` 값
   - `storageBucket` 값
   - `messagingSenderId` 값
   - `appId` 값

6. **"콘솔로 이동"** 버튼 클릭 (완료)

### 4. 환경 변수 설정

1. **프로젝트 폴더**에서 환경 변수 파일 생성:

\`\`\`bash
cp .env.example .env
\`\`\`

2. **\`.env\` 파일 열기** (텍스트 에디터 또는 VS Code)

3. **위에서 복사한 Firebase 값을 입력**:

\`\`\`env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyD...               # apiKey 값 붙여넣기
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com  # authDomain 값
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project          # projectId 값
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com   # storageBucket 값
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789    # messagingSenderId 값
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:...       # appId 값
\`\`\`

> ⚠️ **주의**:
> - 따옴표(`"`)는 제거하고 값만 입력하세요
> - `=` 앞뒤에 공백 없이 입력하세요
> - 실제 값으로 교체하세요 (예시 값 그대로 쓰면 안 됩니다!)

4. **파일 저장** (Ctrl+S 또는 Cmd+S)

### 5. 개발 서버 실행

\`\`\`bash
npm run dev
\`\`\`

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

### 6. 구글 시트 연동 (선택사항) 📊

퀴즈와 설문 결과를 구글 시트에도 실시간으로 기록하고 싶다면:

1. **[GOOGLE_SHEETS_SETUP.md](./GOOGLE_SHEETS_SETUP.md)** 파일을 열어서 상세 가이드를 따라하세요

2. **요약**:
   - 구글 스프레드시트 생성 (퀴즈결과, 설문결과 시트)
   - Apps Script로 웹 앱 배포
   - 웹 앱 URL을 `.env` 파일에 추가

3. **장점**:
   - ✅ 엑셀처럼 쉽게 데이터 분석
   - ✅ 실시간 자동 기록
   - ✅ 완전 무료
   - ✅ 동료와 쉽게 공유

> 💡 **선택사항입니다!** 구글 시트 연동 없이도 Firebase에서 모든 데이터를 확인할 수 있습니다.

## 📱 사용 방법

### 관리자 모드

1. 홈 화면에서 **"관리자"** 선택
2. **퀴즈 관리** 또는 **설문 관리** 탭 선택
3. **"+ 새 퀴즈/설문 만들기"** 버튼 클릭
4. 내용 작성 후 **"생성"** 클릭
5. 생성된 항목의 **"시작"** 버튼 클릭하여 세션 시작
6. 세션 컨트롤 페이지에서:
   - **"🚀 세션 시작"** 클릭하여 참여자에게 공개
   - 실시간으로 응답 현황 확인
   - **"⏹ 세션 종료"** 클릭하여 마감
   - 결과 통계 확인

### 참여자 모드

1. 홈 화면에서 **"참여자"** 선택
2. 닉네임 입력 후 **"참여하기"** 클릭
3. 관리자가 세션을 시작할 때까지 대기
4. 퀴즈/설문이 시작되면:
   - **퀴즈**: 10초 안에 정답 선택 및 제출
   - **설문**: 60초 안에 의견 선택 및 서술형 의견 작성
5. 결과 확인 및 다음 문제 대기

## 🛠 기술 스택

- **프론트엔드**
  - Next.js 16 (React 19)
  - TypeScript
  - Tailwind CSS
  - Recharts (그래프)

- **백엔드**
  - Firebase Firestore (실시간 데이터베이스)

- **배포**
  - Vercel (권장)

## 🌐 배포하기

### Vercel 배포 (권장)

1. [Vercel](https://vercel.com) 계정 생성
2. GitHub 저장소 연결
3. 프로젝트 import
4. 환경 변수 설정:
   - Settings → Environment Variables
   - `.env` 파일의 모든 변수 추가
5. Deploy 클릭

배포 후 자동으로 도메인이 생성됩니다.

## 📊 데이터베이스 구조

### Firestore Collections

#### `quizzes`
\`\`\`typescript
{
  id: string,
  title: string,
  question: string,
  options: string[],
  correctAnswer: number,
  timeLimit: number,
  createdAt: Timestamp
}
\`\`\`

#### `quizSessions`
\`\`\`typescript
{
  id: string,
  quizId: string,
  status: 'waiting' | 'active' | 'finished',
  startTime?: Timestamp,
  endTime?: Timestamp,
  participants: Participant[],
  answers: QuizAnswer[]
}
\`\`\`

#### `surveys`
\`\`\`typescript
{
  id: string,
  title: string,
  question: string,
  type: 'scale' | 'text',
  timeLimit: number,
  createdAt: Timestamp
}
\`\`\`

#### `surveySessions`
\`\`\`typescript
{
  id: string,
  surveyId: string,
  status: 'waiting' | 'active' | 'finished',
  startTime?: Timestamp,
  endTime?: Timestamp,
  participants: Participant[],
  responses: SurveyResponse[]
}
\`\`\`

## 🔒 보안 및 요금제

### Firestore 무료 요금제 (Spark Plan)

**✅ 워크숍에서 무료로 사용 가능합니다!**

- 📖 읽기: 하루 50,000건
- ✍️ 쓰기: 하루 20,000건
- 💾 저장: 1GB
- 🌐 네트워크: 월 10GB

**예상 사용량 (참여자 30명, 퀴즈 10개, 설문 5개):**
- 읽기: 약 2,000건 ✅
- 쓰기: 약 580건 ✅
- 저장: 약 6MB ✅

### 보안 규칙 옵션

#### 기본 설정 (워크숍용)
위의 **3-3. 보안 규칙 설정** 참조 - 링크를 아는 사람만 접근 가능

#### 고급 설정 (관리자 인증 추가)
더 강력한 보안이 필요한 경우:

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // 퀴즈/설문은 관리자만 생성 가능
    match /quizzes/{quizId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null
        && request.auth.token.admin == true;
    }

    match /surveys/{surveyId} {
      allow read: if true;
      allow create, update, delete: if request.auth != null
        && request.auth.token.admin == true;
    }

    // 세션은 모두 접근 가능 (참여자 응답 제출)
    match /quizSessions/{sessionId} {
      allow read, write: if true;
    }

    match /surveySessions/{sessionId} {
      allow read, write: if true;
    }
  }
}
\`\`\`

> 💡 **참고**: 관리자 인증을 사용하려면 Firebase Authentication 설정이 추가로 필요합니다.

## 🎨 커스터마이징

### 색상 변경

`tailwind.config.ts` 파일에서 색상을 변경할 수 있습니다:

\`\`\`typescript
theme: {
  extend: {
    colors: {
      primary: {
        // 원하는 색상으로 변경
      },
    },
  },
},
\`\`\`

### 제한 시간 기본값 변경

`lib/types.ts` 파일에서 기본 제한 시간을 변경할 수 있습니다.

## 🤝 기여하기

이 프로젝트는 교육 목적으로 만들어졌습니다. 개선 사항이나 버그가 있으면 이슈를 등록해주세요.

## 📝 라이선스

MIT License

## 💡 팁

- 워크숍 전에 미리 퀴즈와 설문을 생성해두세요
- 참여자들에게 QR 코드로 링크를 공유하면 편리합니다
- 모바일에서 전체 화면으로 사용하는 것을 권장합니다
- 네트워크 상태가 좋은 환경에서 진행하세요

## 📞 지원

문제가 발생하면 GitHub Issues에 등록해주세요.

---

**만든 사람**: 연구부
**목적**: 교육과정 워크숍 2024
**버전**: 1.0.0
