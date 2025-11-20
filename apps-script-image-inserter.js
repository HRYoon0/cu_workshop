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
  const log = []; // 로그 수집용

  try {
    log.push("1. Request received");

    // POST 데이터 파싱
    const data = JSON.parse(e.postData.contents);
    const spreadsheetId = data.spreadsheetId;
    const images = data.images; // [{url, row, column, width, height}]

    log.push(`2. Spreadsheet ID: ${spreadsheetId}, Image count: ${images.length}`);

    // 스프레드시트 열기
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheets()[0]; // 첫 번째 시트
    log.push(`3. Sheet opened: ${sheet.getName()}`);

    // 0. 시트 컬럼 확장 (이미지가 잘리지 않도록)
    // 가장 오른쪽 이미지가 위치할 컬럼(L열=12) + 여유분(5)까지 확보
    const requiredColumns = 20; // T열까지 확보
    if (sheet.getMaxColumns() < requiredColumns) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredColumns - sheet.getMaxColumns());
    }
    log.push(`4. Max Columns after check: ${sheet.getMaxColumns()}`);


    // 각 이미지 삽입
    const results = [];
    images.forEach((img, index) => {
      const imgLog = [`Image ${index + 1}:`];
      try {
        let blob;
        let method = "";

        // URL에서 파일 ID 추출
        const lh3Match = img.url.match(/lh3\.googleusercontent\.com\/d\/([^/?]+)/);
        const driveMatch = img.url.match(/[?&]id=([^&]+)/);
        const fileId = lh3Match ? lh3Match[1] : (driveMatch ? driveMatch[1] : null);

        imgLog.push(`URL: ${img.url}, FileID: ${fileId}`);

        // 1. DriveApp 시도 (권한이 있는 경우)
        if (fileId) {
          try {
            const file = DriveApp.getFileById(fileId);
            // 2MB/1MP 제한을 피하기 위해 썸네일(w800)을 가져오고 싶지만, 
            // DriveApp은 원본 Blob만 줍니다. 일단 시도해보고 실패하면 아래 UrlFetch로 넘어갑니다.
            blob = file.getBlob();
            method = "DriveApp";
            imgLog.push("DriveApp success");
          } catch (driveError) {
            imgLog.push(`DriveApp failed: ${driveError.toString()}`);
          }
        }

        // 2. UrlFetchApp 시도 (DriveApp 실패하거나 Blob이 없을 때)
        // 여기서 핵심: 원본 대신 '리사이징된 버전'을 가져와야 용량 제한(2MB)을 피할 수 있음!
        if (!blob && fileId) {
          try {
            // sz=w800: 너비 800px로 리사이징 (용량/픽셀 제한 해결)
            const resizeUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
            imgLog.push(`Trying resized URL: ${resizeUrl}`);

            const response = UrlFetchApp.fetch(resizeUrl, { muteHttpExceptions: true });
            const contentType = response.getHeaders()['Content-Type'] || "";

            if (contentType.includes('image')) {
              blob = response.getBlob();
              method = "UrlFetchApp (Resized)";
              imgLog.push("Resized fetch success");
            } else {
              imgLog.push(`Resized fetch returned ${contentType}, trying original`);
            }
          } catch (resizeError) {
            imgLog.push(`Resized fetch failed: ${resizeError.toString()}`);
          }
        }

        // 3. 여전히 Blob이 없으면 원본 URL 시도
        if (!blob) {
          try {
            const response = UrlFetchApp.fetch(img.url, { muteHttpExceptions: true });
            const contentType = response.getHeaders()['Content-Type'] || "";

            if (contentType.includes('image')) {
              blob = response.getBlob();
              method = "UrlFetchApp (Original)";
            }
          } catch (fetchError) {
            imgLog.push(`Original fetch failed: ${fetchError.toString()}`);
          }
        }

        // 3. 이미지 삽입 (Range 기반으로 정확한 위치 지정)
        if (blob) {
          // Range를 사용하여 정확한 셀에 앵커링
          const range = sheet.getRange(img.row, img.column);
          const insertedImage = range.insertImage(blob);

          if (img.width && img.height) {
            insertedImage.setWidth(img.width);
            insertedImage.setHeight(img.height);
          }

          imgLog.push(`Inserted via ${method} at R${img.row}C${img.column}`);
          results.push({ success: true, log: imgLog.join(" | ") });
        } else {
          // 4. Blob 실패 시 URL로 직접 삽입 시도 (최후의 수단)
          imgLog.push("Blob failed, trying insertImage(url)");
          const range = sheet.getRange(img.row, img.column);
          const insertedImage = range.insertImage(img.url);

          if (img.width && img.height) {
            insertedImage.setWidth(img.width);
            insertedImage.setHeight(img.height);
          }

          results.push({ success: true, method: "DirectURL", log: imgLog.join(" | ") });
        }

      } catch (imgError) {
        imgLog.push(`Fatal error: ${imgError.toString()}`);
        console.error(imgLog.join("\n")); // Apps Script 로그에 남기기
        results.push({
          success: false,
          error: imgError.toString(),
          log: imgLog.join(" | ")
        });
      }
    });

    log.push("4. All processed");
    console.log(log.join("\n")); // 전체 로그 출력

    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        results: results,
        serverLog: log
      }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("Main Error: " + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString(),
        serverLog: log
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// OPTIONS 요청 처리 (CORS preflight)
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
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
