# Apps Script 이미지 삽입 설정 가이드

Google Sheets에 이미지를 자동으로 삽입하기 위한 Apps Script 설정 방법입니다.

**중요:** 이 Apps Script는 **독립 실행형 프로젝트**로 생성해야 합니다. 특정 시트에 바인딩하면 시트 삭제 시 Apps Script도 사라집니다!

## 1단계: 독립 실행형 Apps Script 프로젝트 생성

### 방법 1: script.google.com 사용 (권장)

1. 브라우저에서 **https://script.google.com** 접속
2. 좌측 상단 **새 프로젝트** 클릭
3. 새 Apps Script 프로젝트가 열립니다

### 방법 2: Google Drive 사용

1. **Google Drive** (https://drive.google.com) 접속
2. 좌측 상단 **새로 만들기** 클릭
3. **더보기 > Google Apps Script** 선택
4. 새 Apps Script 프로젝트가 열립니다

## 2단계: Apps Script 코드 복사

1. `apps-script-image-inserter.js` 파일의 전체 내용을 복사합니다
2. Apps Script 에디터의 기존 코드를 모두 지우고 복사한 코드를 붙여넣습니다
3. 프로젝트 이름을 "이미지 삽입기" 등으로 변경 (선택사항)
4. **저장 아이콘** 클릭 (Ctrl+S 또는 Cmd+S)

## 3단계: 웹 앱으로 배포

1. Apps Script 에디터 우측 상단의 **배포 > 새 배포** 클릭
2. **유형 선택** 옆의 톱니바퀴 아이콘 클릭
3. **웹 앱** 선택
4. 다음 설정을 입력:
   - **설명**: "이미지 삽입 웹 앱" (선택사항)
   - **다음 사용자로 실행**: **나** 선택
   - **액세스 권한**: **모든 사용자** 선택 ⚠️ 중요!
5. **배포** 버튼 클릭
6. 권한 부여 필요 시:
   - **액세스 권한 부여** 클릭
   - Google 계정 선택
   - **고급** 클릭
   - **{프로젝트 이름} (안전하지 않음) (으)로 이동** 클릭
   - **허용** 클릭
7. 배포가 완료되면 **웹 앱 URL**이 표시됩니다 (예: `https://script.google.com/macros/s/AKfycby.../exec`)
8. 이 URL을 **복사**합니다

## 4단계: 환경 변수에 웹 앱 URL 추가

1. 프로젝트 루트의 `.env` 파일을 엽니다
2. `NEXT_PUBLIC_IMAGE_INSERTER_URL=` 뒤에 복사한 웹 앱 URL을 붙여넣습니다:
   ```
   NEXT_PUBLIC_IMAGE_INSERTER_URL=https://script.google.com/macros/s/AKfycby.../exec
   ```
3. 파일을 저장합니다
4. 개발 서버를 재시작합니다 (Ctrl+C 후 `npm run dev`)

## 5단계: Vercel 환경 변수 설정 (중요!)

로컬 `.env` 파일에만 설정하면 Vercel 배포 시 적용되지 않습니다!

1. **Vercel 대시보드** (https://vercel.com) 접속
2. 프로젝트 선택
3. **Settings > Environment Variables** 클릭
4. 새 환경 변수 추가:
   - **Key**: `NEXT_PUBLIC_IMAGE_INSERTER_URL`
   - **Value**: 복사한 웹 앱 URL
   - **Environments**: Production, Preview, Development 모두 체크
5. **Save** 클릭
6. 프로젝트를 **Redeploy** (Settings > Deployments > 최신 배포 > ... > Redeploy)

## 6단계: 테스트

1. Vercel 재배포 완료 대기
2. 설문 세션을 새로 시작합니다
3. 설문을 완료하여 결과를 저장합니다
4. Google Sheets를 확인하면:
   - ✅ 차트가 문항 사이에 충분한 간격으로 표시됨
   - ✅ E, F 열에 학부모/학생 이미지가 자동으로 삽입됨
   - ✅ "액세스 허용" 없이 이미지가 바로 표시됨

## 중요: 독립 실행형 프로젝트의 장점

- ✅ 한 번 배포하면 **모든 설문 시트**에서 사용 가능
- ✅ 시트를 삭제해도 Apps Script는 유지됨
- ✅ 다른 사용자가 만든 설문 시트에도 자동 적용
- ✅ 관리자만 한 번 승인하면 끝

## 문제 해결

### 웹 앱 URL을 찾을 수 없는 경우
1. Apps Script 에디터에서 **배포 > 배포 관리** 클릭
2. 활성 배포 목록에서 **웹 앱 URL** 확인

### 이미지가 삽입되지 않는 경우
1. 브라우저 콘솔에서 에러 메시지 확인
2. Apps Script 로그 확인:
   - Apps Script 에디터 > 실행 > 실행 로그
3. 웹 앱 URL이 `.env` 파일에 정확히 입력되었는지 확인
4. 개발 서버를 재시작했는지 확인

### 권한 에러가 발생하는 경우
1. Apps Script 배포 설정에서 **액세스 권한**이 **모든 사용자**로 설정되었는지 확인
2. 필요 시 **배포 관리 > 편집 > 액세스 권한 변경 > 모든 사용자**로 설정

## 참고사항

- Apps Script는 **한 번만 배포하면** 모든 설문 세션에서 자동으로 작동합니다
- 다른 사용자들은 별도 승인 없이 이미지가 자동 삽입됩니다
- 코드를 수정한 경우 **새 배포**를 만들거나 기존 배포를 **수정**해야 합니다
