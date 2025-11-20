/**
 * Google Sheets 이미지 삽입 Apps Script (독립 실행형)
 *
 * ⚠️ 중요: 이 스크립트는 반드시 독립 실행형 프로젝트로 배포해야 합니다!
 * - 특정 시트에 바인딩하지 마세요
 * - script.google.com에서 새 프로젝트로 생성하세요
 *
 * 배포 방법:
 * 1. https://script.google.com 접속
 * 2. 새 프로젝트 클릭
 * 3. 이 코드를 복사하여 붙여넣기
 * 4. 프로젝트 이름: "이미지 삽입기" (선택사항)
 * 5. 저장 (Ctrl+S 또는 Cmd+S)
 * 6. 배포 > 새 배포 클릭
 * 7. 유형: 웹 앱 선택
 * 8. 다음 사용자로 실행: 나
 * 9. 액세스 권한: 모든 사용자 ⚠️ 중요!
 * 10. 배포 후 웹 앱 URL 복사
 *
 * 장점:
 * - 한 번 배포하면 모든 설문 시트에서 재사용 가능
 * - 시트를 삭제해도 Apps Script는 유지됨
 * - 관리자만 한 번 승인하면 끝
 */

function doPost(e) {
  try {
    // CORS 헤더 설정
    const output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);

    // POST 데이터 파싱
    const data = JSON.parse(e.postData.contents);
    const spreadsheetId = data.spreadsheetId;
    const images = data.images; // [{url, row, column, width, height}]

    // 스프레드시트 열기
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheets()[0]; // 첫 번째 시트

    // 각 이미지 삽입
    const results = [];
    images.forEach(img => {
      try {
        // URL에서 이미지 가져오기
        const response = UrlFetchApp.fetch(img.url);
        const blob = response.getBlob();

        // 이미지 삽입 (row, column은 1-based index)
        const insertedImage = sheet.insertImage(blob, img.column, img.row);

        // 이미지 크기 조정
        if (img.width && img.height) {
          insertedImage.setWidth(img.width);
          insertedImage.setHeight(img.height);
        }

        results.push({
          success: true,
          row: img.row,
          column: img.column
        });
      } catch (imgError) {
        results.push({
          success: false,
          row: img.row,
          column: img.column,
          error: imgError.toString()
        });
      }
    });

    return output.setContent(JSON.stringify({
      success: true,
      results: results
    }));

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GET 요청 처리 (테스트용)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      message: "이미지 삽입 Apps Script가 정상 작동 중입니다.",
      usage: "POST 요청으로 이미지를 삽입할 수 있습니다."
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
