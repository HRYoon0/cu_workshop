/**
 * Google Sheets 이미지 삽입 Apps Script
 *
 * 배포 방법:
 * 1. Google Sheets를 열고 확장 프로그램 > Apps Script 클릭
 * 2. 이 코드를 복사하여 붙여넣기
 * 3. 배포 > 새 배포 클릭
 * 4. 유형: 웹 앱 선택
 * 5. 다음 사용자로 실행: 나
 * 6. 액세스 권한: 모든 사용자
 * 7. 배포 후 웹 앱 URL 복사
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
