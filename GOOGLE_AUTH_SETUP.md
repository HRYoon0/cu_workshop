# 구글 로그인 설정 가이드

이 가이드를 따라 Firebase Authentication을 활성화하고 구글 로그인을 설정하세요.

## 1단계: Firebase Console에서 Authentication 활성화

1. **Firebase 콘솔 접속**
   - https://console.firebase.google.com/ 접속
   - 프로젝트 선택 (`cu-workshop-158c0`)

2. **Authentication 메뉴 선택**
   - 왼쪽 메뉴에서 `빌드` → `Authentication` 클릭
   - `시작하기` 버튼 클릭 (처음이라면)

3. **Google 로그인 활성화**
   - `Sign-in method` 탭 클릭
   - `Google` 찾아서 클릭
   - `사용 설정` 토글을 켜기
   - **프로젝트 공개용 이름**: `교육과정 워크숍 퀴즈` (또는 원하는 이름)
   - **프로젝트 지원 이메일**: 본인의 이메일 선택
   - `저장` 클릭

## 2단계: Firestore 보안 규칙 업데이트

1. **Firestore Database 메뉴**
   - 왼쪽 메뉴에서 `빌드` → `Firestore Database` 클릭
   - `규칙` 탭 클릭

2. **아래 규칙을 복사해서 붙여넣기**

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // 사용자 인증 확인
    function isAuthenticated() {
      return request.auth != null;
    }

    // 본인의 데이터인지 확인
    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // 승인 대기 사용자 - 로그인한 사용자가 자신의 정보 추가 가능
    match /pendingUsers/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow delete: if isAuthenticated();
    }

    // 승인된 사용자 - 모든 인증된 사용자가 읽기 가능
    match /approvedUsers/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow delete: if isAuthenticated();
    }

    // 퀴즈 - 본인이 만든 것만 읽기/수정/삭제 가능
    match /quizzes/{quizId} {
      allow read: if isAuthenticated() && isOwner(resource.data.userId);
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && isOwner(resource.data.userId);
    }

    // 설문 - 본인이 만든 것만 읽기/수정/삭제 가능
    match /surveys/{surveyId} {
      allow read: if isAuthenticated() && isOwner(resource.data.userId);
      allow create: if isAuthenticated();
      allow update, delete: if isAuthenticated() && isOwner(resource.data.userId);
    }

    // 퀴즈 세션 - 모두가 읽을 수 있음 (참여자용)
    match /quizSessions/{sessionId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // 설문 세션 - 모두가 읽을 수 있음 (참여자용)
    match /surveySessions/{sessionId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }
  }
}
```

3. **게시** 버튼 클릭

## 완료!

설정이 완료되면 코드 작업을 시작할 수 있습니다.

## 주의사항

- 보안 규칙 변경 후 약 1분 정도 적용 시간이 필요합니다
- 규칙을 잘못 설정하면 접근이 안 될 수 있으니 정확히 복사해주세요
- 문제가 생기면 언제든 물어보세요!
