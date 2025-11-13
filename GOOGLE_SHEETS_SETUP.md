# 구글 시트 연동 설정 가이드

Firebase Firestore뿐만 아니라 구글 시트에도 실시간으로 퀴즈 및 설문 결과를 기록하는 방법입니다.

## 📌 중요: 사용자별 시트 방식

**이 가이드는 관리자가 한 번만 설정하는 템플릿 시트 가이드입니다.**

- **템플릿 시트**: 관리자가 한 번만 생성 (이 가이드 따라 설정)
- **사용자 시트**: 각 사용자 로그인 시 자동으로 복사됨 (SHEET_TEMPLATE_SETUP.md 참조)
- **웹 앱 URL**: 관리자의 웹 앱 URL을 모든 사용자가 공유
- **데이터 분리**: sheetId 파라미터로 각 사용자의 시트에 정확히 기록

자세한 내용은 `SHEET_TEMPLATE_SETUP.md` 파일을 참고하세요.

## ⚡ 빠른 시작 가이드 (5분)

1. **구글 시트 생성**: [sheets.google.com](https://sheets.google.com) → 빈 스프레드시트
2. **Apps Script 열기**: 확장 프로그램 → Apps Script
3. **코드 붙여넣기**: 아래 전체 코드 복사 → 붙여넣기 → 저장
4. **시트 생성**: 구글 시트로 돌아가서 → 새로고침 → 🎓 워크숍 설정 → 📊 시트 구조 자동 생성
5. **배포**: Apps Script로 돌아가서 → 배포 → 새 배포 → 웹 앱 URL 복사
6. **연동**: `.env` 파일에 `NEXT_PUBLIC_GOOGLE_SHEETS_URL=복사한URL` 추가

완료! 🎉

---

## 📊 구글 시트 준비

### 1. 새 구글 스프레드시트 생성

1. [Google Sheets](https://sheets.google.com) 접속
2. **빈 스프레드시트** 생성
3. 스프레드시트 이름: "교육과정 워크숍 결과"

### 2. 시트 구조 자동 생성 🎯

수동으로 만들 필요 없습니다! Apps Script로 자동 생성합니다.

다음 섹션의 Apps Script 코드를 붙여넣으면 **자동으로 시트가 생성**됩니다!

#### 생성될 시트 구조 (참고용)

**시트 1: 퀴즈결과**
| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| 타임스탬프 | 세션ID | 퀴즈제목 | 참여자명 | 선택답안 | 정답여부 | 응답시간(ms) | 제출시각 |

**시트 2: 설문결과**
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| 타임스탬프 | 세션ID | 설문제목 | 참여자명 | 척도값 | 서술형응답 |

## 🔧 Apps Script 설정

### 1. Apps Script 편집기 열기

1. 구글 시트 상단 메뉴: **확장 프로그램** → **Apps Script**
2. 새 탭에서 Apps Script 편집기가 열립니다

### 2. 코드 작성

기본 코드를 모두 삭제하고 아래 코드를 붙여넣으세요:

\`\`\`javascript
/**
 * 교육과정 워크숍 - 구글 시트 자동 기록 스크립트
 */

// ========================================
// 🎯 초기 설정: 시트 자동 생성
// ========================================

/**
 * 메뉴에 "워크숍 초기화" 추가
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎓 워크숍 설정')
    .addItem('📊 시트 구조 자동 생성', 'initializeSheets')
    .addItem('🧪 테스트 데이터 추가', 'addSampleData')
    .addToUi();
}

/**
 * 퀴즈결과, 설문결과 시트 자동 생성
 */
function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    // 퀴즈결과 시트 생성
    let quizSheet = ss.getSheetByName('퀴즈결과');
    if (!quizSheet) {
      quizSheet = ss.insertSheet('퀴즈결과');

      // 헤더 설정
      const quizHeaders = [
        '타임스탬프', '세션ID', '퀴즈제목', '참여자명',
        '선택답안', '정답여부', '응답시간(ms)', '제출시각'
      ];
      quizSheet.getRange(1, 1, 1, quizHeaders.length).setValues([quizHeaders]);

      // 헤더 스타일
      quizSheet.getRange(1, 1, 1, quizHeaders.length)
        .setBackground('#4285f4')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setHorizontalAlignment('center');

      // 열 너비 설정 (픽셀 단위)
      quizSheet.setColumnWidth(1, 180);  // 타임스탬프
      quizSheet.setColumnWidth(2, 120);  // 세션ID
      quizSheet.setColumnWidth(3, 200);  // 퀴즈제목
      quizSheet.setColumnWidth(4, 120);  // 참여자명
      quizSheet.setColumnWidth(5, 100);  // 선택답안
      quizSheet.setColumnWidth(6, 100);  // 정답여부
      quizSheet.setColumnWidth(7, 130);  // 응답시간(ms)
      quizSheet.setColumnWidth(8, 180);  // 제출시각

      // 고정 행
      quizSheet.setFrozenRows(1);
    }

    // 설문결과 시트 생성
    let surveySheet = ss.getSheetByName('설문결과');
    if (!surveySheet) {
      surveySheet = ss.insertSheet('설문결과');

      // 헤더 설정
      const surveyHeaders = [
        '타임스탬프', '세션ID', '설문제목', '참여자명',
        '척도값', '서술형응답'
      ];
      surveySheet.getRange(1, 1, 1, surveyHeaders.length).setValues([surveyHeaders]);

      // 헤더 스타일
      surveySheet.getRange(1, 1, 1, surveyHeaders.length)
        .setBackground('#34a853')
        .setFontColor('#ffffff')
        .setFontWeight('bold')
        .setHorizontalAlignment('center');

      // 열 너비 설정 (픽셀 단위)
      surveySheet.setColumnWidth(1, 180);  // 타임스탬프
      surveySheet.setColumnWidth(2, 120);  // 세션ID
      surveySheet.setColumnWidth(3, 200);  // 설문제목
      surveySheet.setColumnWidth(4, 120);  // 참여자명
      surveySheet.setColumnWidth(5, 100);  // 척도값
      surveySheet.setColumnWidth(6, 400);  // 서술형응답 (넓게)

      // 고정 행
      surveySheet.setFrozenRows(1);
    }

    // 기본 Sheet1 삭제 (있으면)
    const sheet1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('시트1');
    if (sheet1 && ss.getSheets().length > 2) {
      ss.deleteSheet(sheet1);
    }

    ui.alert('✅ 완료', '퀴즈결과, 설문결과 시트가 생성되었습니다!', ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ 오류', error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * 테스트 데이터 추가 (선택사항)
 */
function addSampleData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  try {
    // 퀴즈 샘플 데이터
    const quizSheet = ss.getSheetByName('퀴즈결과');
    if (quizSheet) {
      quizSheet.appendRow([
        new Date(),
        'session-001',
        '2024 교육과정 이해도',
        '김선생',
        2,
        'O',
        3500,
        new Date()
      ]);
      quizSheet.appendRow([
        new Date(),
        'session-001',
        '2024 교육과정 이해도',
        '이선생',
        1,
        'X',
        5200,
        new Date()
      ]);
    }

    // 설문 샘플 데이터
    const surveySheet = ss.getSheetByName('설문결과');
    if (surveySheet) {
      surveySheet.appendRow([
        new Date(),
        'survey-001',
        '프로젝트 학습 확대',
        '김선생',
        2,
        '프로젝트 학습이 학생들의 창의성 향상에 도움이 됩니다.'
      ]);
      surveySheet.appendRow([
        new Date(),
        'survey-001',
        '프로젝트 학습 확대',
        '박선생',
        1,
        ''
      ]);
    }

    ui.alert('✅ 완료', '테스트 데이터가 추가되었습니다!', ui.ButtonSet.OK);

  } catch (error) {
    ui.alert('❌ 오류', error.toString(), ui.ButtonSet.OK);
  }
}

// ========================================
// 📡 웹 앱 API
// ========================================

// POST 요청을 받아 시트에 기록
function doPost(e) {
  try {
    // JSON 데이터 파싱
    const data = JSON.parse(e.postData.contents);
    const type = data.type; // 'quiz' 또는 'survey'
    const sheetId = data.sheetId; // 사용자별 시트 ID

    // 스프레드시트 가져오기
    // sheetId가 있으면 해당 시트 열기 (사용자별 시트)
    // 없으면 현재 스프레드시트 사용 (템플릿)
    const ss = sheetId
      ? SpreadsheetApp.openById(sheetId)
      : SpreadsheetApp.getActiveSpreadsheet();

    if (type === 'quiz') {
      // 퀴즈 결과 기록
      recordQuizResult(ss, data);
    } else if (type === 'survey') {
      // 설문 결과 기록
      recordSurveyResult(ss, data);
    }

    return ContentService.createTextOutput(
      JSON.stringify({ success: true, message: '기록 완료' })
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// 퀴즈 결과 기록 함수
function recordQuizResult(ss, data) {
  const sheet = ss.getSheetByName('퀴즈결과');
  if (!sheet) {
    throw new Error('퀴즈결과 시트를 찾을 수 없습니다. 메뉴 > 워크숍 설정 > 시트 구조 자동 생성을 실행하세요.');
  }

  const row = [
    new Date(),                    // 타임스탬프
    data.sessionId || '',          // 세션ID
    data.quizTitle || '',          // 퀴즈제목
    data.participantName || '',    // 참여자명
    data.answer,                   // 선택답안 (0, 1, 2, 3)
    data.isCorrect ? 'O' : 'X',   // 정답여부
    data.responseTime || 0,        // 응답시간(ms)
    data.timestamp || new Date()   // 제출시각
  ];

  sheet.appendRow(row);
}

// 설문 결과 기록 함수
function recordSurveyResult(ss, data) {
  const sheet = ss.getSheetByName('설문결과');
  if (!sheet) {
    throw new Error('설문결과 시트를 찾을 수 없습니다. 메뉴 > 워크숍 설정 > 시트 구조 자동 생성을 실행하세요.');
  }

  const row = [
    new Date(),                    // 타임스탬프
    data.sessionId || '',          // 세션ID
    data.surveyTitle || '',        // 설문제목
    data.participantName || '',    // 참여자명
    data.scaleValue || '',         // 척도값 (-2 ~ +2)
    data.textValue || ''           // 서술형응답
  ];

  sheet.appendRow(row);
}

// GET 요청 테스트용
function doGet(e) {
  return ContentService.createTextOutput(
    '✅ 교육과정 워크숍 구글 시트 API가 정상 작동 중입니다.'
  );
}
\`\`\`

### 3. 저장 및 시트 생성

1. **저장**: 왼쪽 상단 💾 아이콘 클릭 또는 Ctrl+S
   - 프로젝트 이름: "워크숍 시트 기록" 입력

2. **구글 시트로 돌아가기**: 브라우저 탭 전환 (구글 시트)

3. **페이지 새로고침**: F5 또는 Cmd+R

4. **상단 메뉴에서 "🎓 워크숍 설정" 클릭**
   - 메뉴가 안 보이면 몇 초 기다렸다가 새로고침

5. **"📊 시트 구조 자동 생성" 클릭**
   - 권한 요청이 나오면 승인
   - "✅ 완료" 메시지 확인

6. **(선택) "🧪 테스트 데이터 추가" 클릭**
   - 샘플 데이터로 테스트해볼 수 있습니다

7. **시트 확인**
   - 하단 탭에 "퀴즈결과", "설문결과" 생성됨
   - 파란색, 초록색 헤더 확인

### 4. 웹 앱 배포

이제 시트 구조가 완성되었으니 API를 배포합니다.

1. **Apps Script 탭으로 다시 전환**

2. **배포** 클릭:
   - 상단 오른쪽 **배포** → **새 배포** 클릭
   - **유형 선택** 옆 ⚙️ 아이콘 클릭
   - **웹 앱** 선택

3. **배포 설정**:
   - **설명**: "워크숍 결과 기록 v1"
   - **다음 계정으로 실행**: **나**
   - **액세스 권한**: **모든 사용자** 선택 ⚠️ 중요!

4. **배포** 버튼 클릭

5. **권한 승인**:
   - "액세스 권한 부여" 클릭
   - Google 계정 선택
   - "고급" 클릭
   - "안전하지 않은 페이지로 이동" 클릭
   - "허용" 클릭

6. **웹 앱 URL 복사**:
   - 배포 완료 후 **웹 앱 URL**이 표시됩니다
   - 예: `https://script.google.com/macros/s/AKfycby.../exec`
   - 이 URL을 **복사**하세요 📋

## 🔗 프로젝트에 연동

### 1. 환경 변수 추가

`.env` 파일을 열고 다음 줄을 추가:

\`\`\`env
NEXT_PUBLIC_GOOGLE_SHEETS_URL=https://script.google.com/macros/s/AKfycby.../exec
\`\`\`

위에서 복사한 웹 앱 URL로 교체하세요!

### 2. 개발 서버 재시작

\`\`\`bash
# 현재 실행 중인 서버 종료 (Ctrl+C)
# 다시 시작
npm run dev
\`\`\`

## 🧪 테스트

### 1. 웹 앱 URL이 작동하는지 확인

브라우저에서 웹 앱 URL을 직접 열어보세요:
```
https://script.google.com/macros/s/AKfycby.../exec
```

"교육과정 워크숍 구글 시트 API가 정상 작동 중입니다." 메시지가 보이면 성공!

### 2. 실제 퀴즈/설문 테스트

1. 관리자 페이지에서 퀴즈 생성
2. 참여자로 퀴즈 응답
3. 구글 시트의 "퀴즈결과" 탭 확인
4. 실시간으로 데이터가 추가되는지 확인!

## 📊 데이터 분석 팁

### 퀴즈 통계

구글 시트에서 바로 분석 가능:

\`\`\`
=COUNTIF(F:F,"O")  // 정답자 수
=AVERAGE(G:G)      // 평균 응답 시간
\`\`\`

### 설문 통계

\`\`\`
=AVERAGE(E:E)      // 평균 척도 점수
=COUNTIF(E:E,2)    // 적극 찬성 수
\`\`\`

## ⚠️ 주의사항

1. **웹 앱 URL 보안**
   - 링크를 아는 사람은 누구나 데이터를 보낼 수 있습니다
   - 워크숍 참여자에게만 공유하세요
   - 워크숍 종료 후 배포를 중지할 수 있습니다

2. **구글 시트 용량**
   - 무료 계정: 시트당 5백만 셀
   - 참여자 100명 × 20문제 = 2,000행 (충분!)

3. **배포 업데이트**
   - 코드 수정 시: 배포 → 배포 관리 → 편집 → 새 버전

## 🔄 Firebase와 구글 시트 비교

| 기능 | Firebase Firestore | 구글 시트 |
|------|-------------------|----------|
| 실시간 업데이트 | ✅ 자동 | ❌ 수동 새로고침 |
| 데이터 분석 | 복잡 | ✅ 쉬움 (엑셀) |
| 공유 | 어려움 | ✅ 쉬움 |
| 백업 | 별도 필요 | ✅ 자동 |
| 비용 | 무료 (한도 있음) | ✅ 완전 무료 |

두 곳 모두 저장되므로 장점을 모두 활용할 수 있습니다! 🎉

## 🆘 문제 해결

### "권한 거부" 오류
- 배포 시 "액세스 권한"을 **모든 사용자**로 설정했는지 확인

### "시트를 찾을 수 없습니다" 오류
- 시트 이름이 정확히 "퀴즈결과", "설문결과"인지 확인 (띄어쓰기 없음)

### 데이터가 기록되지 않음
- `.env` 파일의 URL이 올바른지 확인
- 개발 서버를 재시작했는지 확인
- 브라우저 콘솔(F12)에서 에러 메시지 확인
