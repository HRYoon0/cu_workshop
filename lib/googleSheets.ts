/**
 * 구글 시트 연동 함수
 */

import { getUserSheet, getUserSurveySheet } from './firestore';

// 관리자 구글 시트 웹 앱 URL (환경 변수에서 가져오기)
const GOOGLE_SHEETS_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_URL;

/**
 * 퀴즈 결과를 구글 시트에 기록
 */
export async function saveQuizResultToSheet(
  data: {
    sessionId: string;
    quizTitle: string;
    participantName: string;
    answer: number;
    isCorrect: boolean;
    responseTime: number;
    timestamp: Date;
  },
  userId?: string
) {
  // 구글 시트 URL이 설정되지 않은 경우 건너뛰기
  if (!GOOGLE_SHEETS_URL) {
    console.log('구글 시트 URL이 설정되지 않았습니다. Firebase에만 저장됩니다.');
    return;
  }

  try {
    // 사용자별 시트 ID 가져오기
    let sheetId: string | undefined;
    if (userId) {
      const userSheet = await getUserSheet(userId);
      if (userSheet) {
        sheetId = userSheet.sheetId;
      }
    }

    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors', // CORS 우회
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'quiz',
        sheetId, // 사용자별 시트 ID 추가
        ...data,
      }),
    });

    // no-cors 모드에서는 응답을 읽을 수 없지만 요청은 전송됩니다
    console.log('퀴즈 결과를 구글 시트에 전송했습니다.');
  } catch (error) {
    console.error('구글 시트 저장 실패:', error);
    // 에러가 발생해도 계속 진행 (Firebase에는 저장됨)
  }
}

/**
 * 설문 결과를 구글 시트에 기록 (Google Sheets API 직접 사용)
 */
export async function saveSurveyResultToSheet(
  data: {
    sessionId: string;
    surveyTitle: string;
    participantName: string;
    scaleValue?: number;
    textValue?: string;
    timestamp: Date;
  },
  userId?: string,
  sheetUrl?: string,
  adminAccessToken?: string
) {
  try {
    // 사용자별 설문 전용 시트 ID 가져오기
    let sheetId: string | undefined;

    // 1순위: sheetUrl이 직접 전달된 경우 (주제별 시트)
    if (sheetUrl) {
      // Google Sheets URL에서 스프레드시트 ID 추출
      // 형식: https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit...
      const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        sheetId = match[1];
        console.log('주제별 시트 ID 추출:', sheetId);
      }
    }

    // 2순위: 사용자별 통합 시트 (레거시)
    if (!sheetId && userId) {
      const userSurveySheet = await getUserSurveySheet(userId);
      if (userSurveySheet) {
        sheetId = userSurveySheet.sheetId;
        console.log('사용자 통합 시트 ID 사용:', sheetId);
      } else {
        console.warn('설문 결과 시트가 설정되지 않았습니다.');
        return; // 시트 ID가 없으면 종료
      }
    }

    if (!sheetId) {
      console.warn('시트 ID를 찾을 수 없습니다.');
      return;
    }

    // 액세스 토큰 사용 (전달된 관리자 토큰 우선)
    let accessToken = adminAccessToken;
    if (!accessToken) {
      // 폴백: 현재 로그인된 사용자의 토큰 시도
      const { getGoogleAccessToken } = await import('./googleDrive');
      accessToken = await getGoogleAccessToken();
    }

    // Google Sheets API를 사용하여 데이터 추가
    const values = [[
      new Date().toLocaleString('ko-KR'),  // 타임스탬프
      data.sessionId,                       // 세션ID
      data.surveyTitle,                     // 설문제목
      data.participantName,                 // 참여자명
      data.scaleValue ?? '',                // 척도값
      data.textValue ?? ''                  // 서술형응답
    ]];

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A:F:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: values
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Google Sheets API 에러:', error);
      throw new Error(`시트 저장 실패: ${error}`);
    }

    console.log('✅ 설문 결과를 구글 시트에 저장했습니다. Sheet ID:', sheetId);
  } catch (error) {
    console.error('❌ 구글 시트 저장 실패:', error);
    // 에러가 발생해도 계속 진행 (Firebase에는 저장됨)
  }
}

/**
 * 구글 시트의 설문 결과 데이터 초기화 (기존 데이터 삭제)
 */
export async function clearSurveySheetData(
  sheetUrl: string,
  accessToken: string,
  sessionId?: string
): Promise<boolean> {
  try {
    // 시트 ID 추출
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      console.warn('시트 URL에서 ID를 추출할 수 없습니다.');
      return false;
    }
    const spreadsheetId = match[1];

    // 1. 시트 정보 가져오기
    const sheetInfoResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!sheetInfoResponse.ok) {
      throw new Error('시트 정보를 가져올 수 없습니다.');
    }

    const sheetInfo = await sheetInfoResponse.json();
    const firstSheetId = sheetInfo.sheets?.[0]?.properties?.sheetId || 0;

    // 2. 기존 차트 삭제
    const chartsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.charts`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (chartsResponse.ok) {
      const chartsData = await chartsResponse.json();
      const charts = chartsData.sheets?.[0]?.charts || [];

      if (charts.length > 0) {
        const deleteChartRequests = charts.map((chart: any) => ({
          deleteEmbeddedObject: {
            objectId: chart.chartId
          }
        }));

        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ requests: deleteChartRequests }),
          }
        );
        console.log(`✅ ${charts.length}개의 차트 삭제 완료`);
      }
    }

    // 3. 모든 데이터 삭제 (A:F 전체)
    const clearResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:F:clear`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!clearResponse.ok) {
      const error = await clearResponse.text();
      console.error('시트 데이터 삭제 실패:', error);
      return false;
    }

    // 4. A1에 세션 ID 작성
    if (sessionId) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [[`세션: ${sessionId}`]] }),
        }
      );
    }

    console.log('✅ 구글 시트 데이터 초기화 완료');
    return true;
  } catch (error) {
    console.error('❌ 구글 시트 초기화 실패:', error);
    return false;
  }
}

/**
 * 구글 드라이브 URL을 구글 시트 IMAGE 함수용 URL로 변환
 * lh3.googleusercontent.com/d/{fileId} -> drive.google.com/uc?export=view&id={fileId}
 */
function convertToDriveImageUrl(url: string): string {
  if (!url) return url;

  let fileId = '';

  // 1. lh3.googleusercontent.com 형식인 경우
  const lh3Match = url.match(/lh3\.googleusercontent\.com\/d\/([^/?]+)/);
  if (lh3Match) {
    fileId = lh3Match[1];
  }

  // 2. drive.google.com 형식인 경우
  if (!fileId) {
    const driveMatch = url.match(/[?&]id=([^&]+)/);
    if (driveMatch) {
      fileId = driveMatch[1];
    }
  }

  // 3. /file/d/{fileId} 형식인 경우
  if (!fileId) {
    const fileMatch = url.match(/\/file\/d\/([^/?]+)/);
    if (fileMatch) {
      fileId = fileMatch[1];
    }
  }

  if (fileId) {
    // Google Sheets API가 가장 잘 인식하는 직접 다운로드/보기 링크 형식
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // 다른 형식인 경우 그대로 반환
  return url;
}

/**
 * 설문 완료 시 차트와 이미지를 구글 시트에 저장
 */
export async function saveSurveyChartToSheet(
  data: {
    sessionId: string;
    surveyTitle: string;
    statistics: { [key: string]: number }; // 옵션별 응답 수
    options: string[];
    totalResponses: number;
    parentResultImageUrl?: string;
    studentResultImageUrl?: string;
  },
  sheetUrl: string,
  accessToken: string
) {
  try {
    // 시트 ID 추출
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      console.warn('시트 URL에서 ID를 추출할 수 없습니다.');
      return;
    }
    const spreadsheetId = match[1];

    // 1. 먼저 시트 정보 가져오기
    const sheetInfoResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    if (!sheetInfoResponse.ok) {
      throw new Error('시트 정보를 가져올 수 없습니다.');
    }

    const sheetInfo = await sheetInfoResponse.json();
    const firstSheetId = sheetInfo.sheets?.[0]?.properties?.sheetId || 0;

    // 2. 데이터 준비 (차트용)
    const chartData: string[][] = [
      ['옵션', '응답 수', '비율(%)'],
    ];

    data.options.forEach(option => {
      const count = data.statistics[option] || 0;
      const percentage = data.totalResponses > 0 ? ((count / data.totalResponses) * 100).toFixed(1) : '0';
      chartData.push([option, count.toString(), percentage]);
    });

    // 3. 결과 저장할 시작 행 찾기 (기존 데이터 뒤에 추가)
    // A1에는 세션 ID가 있으므로 3행부터 시작
    // A:F 전체를 체크해야 빈 행도 포함됨
    const existingDataResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:F`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }
    );

    let startRow = 3; // 기본값: 3행부터 시작 (1행=세션ID, 2행=빈줄)
    if (existingDataResponse.ok) {
      const existingData = await existingDataResponse.json();
      const lastRow = existingData.values?.length || 0;
      console.log('🔍 기존 데이터 마지막 행:', lastRow);
      if (lastRow >= 2) {
        startRow = lastRow + 2; // 기존 데이터 뒤에 빈 행 하나 추가
        console.log('📍 다음 시작 행:', startRow);
      }
    }

    // 4. 데이터 저장 (새로운 레이아웃)
    // 각 설문 항목 블록:
    // 1행: 📊 설문 제목 | | | | 학부모 이미지 | 학생 이미지
    // 2행: 총 응답
    // 3행: 헤더 (옵션, 응답 수, 비율)
    // 4행~: 데이터 + 차트(D열)

    const allData: any[][] = [];
    const dataCount = chartData.length - 1; // 헤더 제외한 데이터 수

    // 1행: 설문 제목 (E, F열은 이미지가 들어갈 자리라 비워둠)
    const titleRow = [`📊 ${data.surveyTitle}`, '', '', '', '', ''];
    allData.push(titleRow);

    // 2행: 총 응답
    allData.push([`총 응답: ${data.totalResponses}명`, '', '', '', '', '']);

    // 3행: 헤더 (E, F열은 이미지가 들어갈 자리)
    const headerRow = ['옵션', '응답 수', '비율(%)', '', '', ''];
    allData.push(headerRow);

    // 4행~: 데이터
    for (let i = 1; i < chartData.length; i++) {
      const row = [chartData[i][0], chartData[i][1], chartData[i][2], '', '', ''];
      allData.push(row);
    }

    console.log('📊 데이터 행 추가 완료. 현재 allData 길이:', allData.length);

    // 차트를 위한 빈 행 추가 (10행)
    // Zero Width Space를 넣어서 Google Sheets API가 반드시 인식하도록 함
    for (let i = 0; i < 10; i++) {
      allData.push(['\u200B', '', '', '', '', '']);
    }

    console.log('✅ 빈 행 10개 추가 완료. 최종 allData 길이:', allData.length);
    console.log('📍 저장 범위:', `A${startRow}:F${startRow + allData.length - 1}`);

    // 데이터 저장
    const range = `A${startRow}:F${startRow + allData.length - 1}`;
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: allData }),
      }
    );

    // 5. 파이 차트 생성
    // 차트 데이터 범위: 3행(헤더) 다음부터 데이터
    const chartStartRow = startRow + 3; // 데이터 시작 행 (헤더 다음)
    const chartEndRow = startRow + 3 + dataCount; // 데이터 끝 행

    const chartRequest = {
      requests: [
        // 1. 파이 차트 (원그래프)
        {
          addChart: {
            chart: {
              spec: {
                title: `${data.surveyTitle} (원그래프)`,
                pieChart: {
                  legendPosition: 'RIGHT_LEGEND',
                  domain: {
                    sourceRange: {
                      sources: [{
                        sheetId: firstSheetId,
                        startRowIndex: chartStartRow - 1,
                        endRowIndex: chartEndRow,
                        startColumnIndex: 0,
                        endColumnIndex: 1
                      }]
                    }
                  },
                  series: {
                    sourceRange: {
                      sources: [{
                        sheetId: firstSheetId,
                        startRowIndex: chartStartRow - 1,
                        endRowIndex: chartEndRow,
                        startColumnIndex: 1,
                        endColumnIndex: 2
                      }]
                    }
                  }
                }
              },
              position: {
                overlayPosition: {
                  anchorCell: {
                    sheetId: firstSheetId,
                    rowIndex: startRow - 1,
                    columnIndex: 3 // D열
                  },
                  offsetXPixels: 0,
                  offsetYPixels: 0,
                  widthPixels: 400,
                  heightPixels: 300
                }
              }
            }
          }
        },
        // 2. 막대 차트 (세로)
        {
          addChart: {
            chart: {
              spec: {
                title: `${data.surveyTitle} (막대그래프)`,
                basicChart: {
                  chartType: 'COLUMN',
                  legendPosition: 'RIGHT_LEGEND',
                  axis: [
                    {
                      position: 'BOTTOM_AXIS',
                      title: '옵션'
                    },
                    {
                      position: 'LEFT_AXIS',
                      title: '응답 수'
                    }
                  ],
                  domains: [
                    {
                      domain: {
                        sourceRange: {
                          sources: [{
                            sheetId: firstSheetId,
                            startRowIndex: chartStartRow - 1,
                            endRowIndex: chartEndRow,
                            startColumnIndex: 0,
                            endColumnIndex: 1
                          }]
                        }
                      }
                    }
                  ],
                  series: [
                    {
                      series: {
                        sourceRange: {
                          sources: [{
                            sheetId: firstSheetId,
                            startRowIndex: chartStartRow - 1,
                            endRowIndex: chartEndRow,
                            startColumnIndex: 1,
                            endColumnIndex: 2
                          }]
                        }
                      },
                      targetAxis: 'LEFT_AXIS'
                    }
                  ]
                }
              },
              position: {
                overlayPosition: {
                  anchorCell: {
                    sheetId: firstSheetId,
                    rowIndex: startRow - 1,
                    columnIndex: 7 // H열 (파이 차트 오른쪽)
                  },
                  offsetXPixels: 0,
                  offsetYPixels: 0,
                  widthPixels: 400,
                  heightPixels: 300
                }
              }
            }
          }
        }
      ]
    };

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chartRequest),
      }
    );

    console.log('✅ 설문 차트를 구글 시트에 저장했습니다.');
  } catch (error) {
    console.error('❌ 설문 차트 저장 실패:', error);
  }
}

/**
 * 설문 비교 결과를 구글 시트에 저장 (교사/학생/학부모)
 */
export async function exportSurveyComparisonToSheets(
  data: {
    surveyTitle: string;
    surveyQuestion: string;
    teacherResults: {
      stronglyAgree: number;
      agree: number;
      neutral: number;
      disagree: number;
      stronglyDisagree: number;
      total: number;
    };
    studentResults?: {
      stronglyAgree: number;
      agree: number;
      neutral: number;
      disagree: number;
      stronglyDisagree: number;
      total: number;
    };
    parentResults?: {
      stronglyAgree: number;
      agree: number;
      neutral: number;
      disagree: number;
      stronglyDisagree: number;
      total: number;
    };
    timestamp: Date;
  },
  userId?: string
) {
  // 구글 시트 URL이 설정되지 않은 경우 건너뛰기
  if (!GOOGLE_SHEETS_URL) {
    console.log('구글 시트 URL이 설정되지 않았습니다.');
    throw new Error('구글 시트 URL이 설정되지 않았습니다.');
  }

  try {
    // 사용자별 설문 전용 시트 ID 가져오기
    let sheetId: string | undefined;
    if (userId) {
      const userSurveySheet = await getUserSurveySheet(userId);
      if (userSurveySheet) {
        sheetId = userSurveySheet.sheetId;
      }
    }

    const response = await fetch(GOOGLE_SHEETS_URL, {
      method: 'POST',
      mode: 'no-cors', // CORS 우회
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'surveyComparison',
        sheetId,
        ...data,
      }),
    });

    console.log('설문 비교 결과를 구글 시트에 전송했습니다.');
  } catch (error) {
    console.error('구글 시트 저장 실패:', error);
    throw error;
  }
}

/**
 * 구글 시트 연동이 활성화되어 있는지 확인
 */
export function isGoogleSheetsEnabled(): boolean {
  return !!GOOGLE_SHEETS_URL;
}

/**
 * Google Sheets의 특정 범위 값을 업데이트
 */
export async function updateSheetRange(
  spreadsheetId: string,
  range: string,
  values: any[][],
  accessToken: string,
  valueInputOption: 'RAW' | 'USER_ENTERED' = 'RAW'
) {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=${valueInputOption}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range,
          values,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google Sheets API 오류: ${JSON.stringify(error)}`);
    }

    return await response.json();
  } catch (error) {
    console.error('시트 범위 업데이트 실패:', error);
    throw error;
  }
}

/**
 * Google Sheets의 모든 시트(탭) 목록 가져오기
 */
export async function getSheetTabs(
  spreadsheetId: string,
  accessToken: string
): Promise<{ sheetId: number; title: string }[]> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google Sheets API 오류: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.sheets.map((sheet: any) => ({
      sheetId: sheet.properties.sheetId,
      title: sheet.properties.title,
    }));
  } catch (error) {
    console.error('시트 탭 목록 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 시트의 모든 탭에서 학교명 업데이트
 * 각 탭의 A1:D2 범위를 업데이트
 */
export async function updateSchoolNameInAllTabs(
  spreadsheetId: string,
  newSchoolName: string,
  accessToken: string
) {
  try {
    // 모든 시트 탭 가져오기
    const tabs = await getSheetTabs(spreadsheetId, accessToken);

    // Rate Limiting 방지를 위한 딜레이 함수
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // 각 탭의 A1:D2 범위에 학교명 업데이트 (순차 처리)
    const results = [];
    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i];
      const range = `${tab.title}!A1:D2`;
      // 2행 x 4열 배열 (병합된 셀이므로 첫 번째 셀에만 값 입력)
      const values = [
        [newSchoolName, '', '', ''],
        ['', '', '', '']
      ];

      try {
        await updateSheetRange(spreadsheetId, range, values, accessToken);
        console.log(`학교명 업데이트 완료 (${i + 1}/${tabs.length}): ${tab.title}`);
        results.push({ tab: tab.title, success: true });

        // 각 탭 업데이트 후 200ms 대기 (Rate Limiting 방지)
        if (i < tabs.length - 1) {
          await delay(200);
        }
      } catch (error) {
        console.error(`${tab.title} 탭 업데이트 실패:`, error);
        results.push({ tab: tab.title, success: false, error });
      }
    }

    const failedTabs = results.filter(r => !r.success);

    if (failedTabs.length > 0) {
      console.warn('일부 탭 업데이트 실패:', failedTabs);
    }

    return {
      totalTabs: tabs.length,
      successCount: results.filter(r => r.success).length,
      failedCount: failedTabs.length,
      failedTabs: failedTabs.map(f => f.tab),
    };
  } catch (error) {
    console.error('학교명 업데이트 실패:', error);
    throw error;
  }
}

/**
 * Google Sheets에 새 시트 탭 추가
 */
export async function addSheetTab(
  spreadsheetId: string,
  tabTitle: string,
  accessToken: string
): Promise<number> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: tabTitle,
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 26,
                  },
                },
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google Sheets API 오류: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const newSheetId = data.replies[0].addSheet.properties.sheetId;
    return newSheetId;
  } catch (error) {
    console.error('시트 탭 추가 실패:', error);
    throw error;
  }
}

/**
 * Google Sheets에서 시트 탭 삭제
 */
export async function deleteSheetTab(
  spreadsheetId: string,
  sheetId: number,
  accessToken: string
): Promise<void> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              deleteSheet: {
                sheetId: sheetId,
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google Sheets API 오류: ${JSON.stringify(error)}`);
    }
  } catch (error) {
    console.error('시트 탭 삭제 실패:', error);
    throw error;
  }
}

/**
 * 시트의 특정 범위를 보호 (수정 불가능하게 설정)
 * @param spreadsheetId 스프레드시트 ID
 * @param sheetId 시트 ID
 * @param startColumnIndex 시작 열 인덱스 (0부터 시작)
 * @param endColumnIndex 끝 열 인덱스 (exclusive)
 * @param description 보호 설명
 * @param accessToken Google OAuth 액세스 토큰
 */
export async function protectSheetRange(
  spreadsheetId: string,
  sheetId: number,
  startColumnIndex: number,
  endColumnIndex: number,
  description: string,
  accessToken: string
): Promise<void> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              addProtectedRange: {
                protectedRange: {
                  range: {
                    sheetId: sheetId,
                    startColumnIndex: startColumnIndex,
                    endColumnIndex: endColumnIndex,
                  },
                  description: description,
                  warningOnly: true, // 경고만 표시 (완전 잠금 대신)
                },
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`시트 보호 설정 실패: ${JSON.stringify(error)}`);
    }

    console.log('시트 범위 보호 설정 완료');
  } catch (error) {
    console.error('시트 범위 보호 실패:', error);
    throw error;
  }
}

/**
 * Google Sheets 시트 탭 이름 변경
 */
export async function renameSheetTab(
  spreadsheetId: string,
  sheetId: number,
  newTitle: string,
  accessToken: string
): Promise<void> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: sheetId,
                  title: newTitle,
                },
                fields: 'title',
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google Sheets API 오류: ${JSON.stringify(error)}`);
    }
  } catch (error) {
    console.error('시트 탭 이름 변경 실패:', error);
    throw error;
  }
}

/**
 * Google Sheets 시트 탭 순서 변경
 * @param spreadsheetId 스프레드시트 ID
 * @param sheetId 이동할 시트의 ID
 * @param newIndex 새로운 인덱스 위치 (0부터 시작)
 * @param accessToken Google OAuth 액세스 토큰
 */
export async function moveSheetTab(
  spreadsheetId: string,
  sheetId: number,
  newIndex: number,
  accessToken: string
): Promise<void> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: sheetId,
                  index: newIndex,
                },
                fields: 'index',
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`시트 순서 변경 실패: ${JSON.stringify(error)}`);
    }
  } catch (error) {
    console.error('시트 탭 순서 변경 실패:', error);
    throw error;
  }
}

/**
 * Google Sheets 시트 탭 복제
 * @param spreadsheetId 스프레드시트 ID
 * @param sourceSheetId 원본 시트 ID
 * @param newTitle 새 시트 이름
 * @param accessToken Google OAuth 액세스 토큰
 * @param insertSheetIndex 삽입할 위치 (선택, 기본값은 맨 뒤)
 */
export async function duplicateSheetTab(
  spreadsheetId: string,
  sourceSheetId: number,
  newTitle: string,
  accessToken: string,
  insertSheetIndex?: number
): Promise<number> {
  try {
    const duplicateRequest: any = {
      sourceSheetId: sourceSheetId,
      newSheetName: newTitle,
    };

    // 삽입 위치가 지정된 경우에만 추가
    if (insertSheetIndex !== undefined) {
      duplicateRequest.insertSheetIndex = insertSheetIndex;
    }

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              duplicateSheet: duplicateRequest,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google Sheets API 오류: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const newSheetId = data.replies[0].duplicateSheet.properties.sheetId;
    return newSheetId;
  } catch (error) {
    console.error('시트 탭 복제 실패:', error);
    throw error;
  }
}

/**
 * 특정 시트 내에서 텍스트를 찾아서 바꾸기
 * @param spreadsheetId 스프레드시트 ID
 * @param sheetId 대상 시트의 ID (탭 ID)
 * @param findText 찾을 텍스트
 * @param replaceText 바꿀 텍스트
 * @param accessToken Google OAuth 액세스 토큰
 */
export async function replaceTextInSheet(
  spreadsheetId: string,
  sheetId: number,
  findText: string,
  replaceText: string,
  accessToken: string
): Promise<void> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              findReplace: {
                find: findText,
                replacement: replaceText,
                sheetId: sheetId,
                matchEntireCell: false,
                matchCase: true,
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`텍스트 바꾸기 실패: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const replaceCount = data.replies?.[0]?.findReplace?.occurrencesChanged || 0;
    console.log(`'${findText}' → '${replaceText}' 변경: ${replaceCount}건`);
  } catch (error) {
    console.error('텍스트 바꾸기 실패:', error);
    throw error;
  }
}

/**
 * 시트 탭에 초기 데이터 설정 (학교명, 업무명 등)
 */
export async function setupSheetTabData(
  spreadsheetId: string,
  tabTitle: string,
  schoolName: string,
  topicName: string,
  accessToken: string
): Promise<void> {
  try {
    // A1:D2에 학교명 입력
    await updateSheetRange(
      spreadsheetId,
      `${tabTitle}!A1:D2`,
      [
        [schoolName, '', '', ''],
        ['', '', '', '']
      ],
      accessToken
    );

    // E1:E2에 업무명 입력 (병합된 셀)
    await updateSheetRange(
      spreadsheetId,
      `${tabTitle}!E1:E2`,
      [
        [topicName],
        ['']
      ],
      accessToken
    );
  } catch (error) {
    console.error('시트 탭 초기 데이터 설정 실패:', error);
    throw error;
  }
}

/**
 * 사용자 시트 초기화
 * 템플릿의 탭 구조를 현재 업무 목록에 맞게 조정하고 초기 데이터 설정
 * @param spreadsheetId 사용자 시트 ID
 * @param topics 현재 업무 목록 (이름 배열)
 * @param schoolName 학교 이름
 * @param accessToken Google OAuth 액세스 토큰
 */
export async function initializeUserSheet(
  spreadsheetId: string,
  topics: { name: string }[],
  schoolName: string,
  accessToken: string
): Promise<void> {
  try {
    // 1. 현재 시트의 모든 탭 가져오기
    const currentTabs = await getSheetTabs(spreadsheetId, accessToken);

    // 2. "업무별" 템플릿 시트 찾기
    const templateSheet = currentTabs.find(tab => tab.title === '업무별');
    if (!templateSheet) {
      throw new Error('템플릿 시트 "업무별"을 찾을 수 없습니다.');
    }

    // 3. 기본 탭 ("논의 및 결정사항", "1학년"~"6학년", "업무별") 제외하고 기존 부서 탭 찾기
    const protectedTabNames = ['논의 및 결정사항', '1학년', '2학년', '3학년', '4학년', '5학년', '6학년', '업무별'];
    const existingTopicTabs = currentTabs.filter(tab => !protectedTabNames.includes(tab.title));

    // 4. 필요한 부서 탭 목록
    const requiredTopicNames = topics.map(t => t.name);

    // 5. 삭제할 탭 찾기 (존재하지만 필요 없는 탭)
    const tabsToDelete = existingTopicTabs.filter(
      tab => !requiredTopicNames.includes(tab.title)
    );

    // 6. 추가할 탭 찾기 (필요하지만 존재하지 않는 탭)
    const existingTopicNames = existingTopicTabs.map(t => t.title);
    const topicsToAdd = topics.filter(
      topic => !existingTopicNames.includes(topic.name) && !protectedTabNames.includes(topic.name)
    );

    // 7. 불필요한 탭 삭제
    for (const tab of tabsToDelete) {
      try {
        await deleteSheetTab(spreadsheetId, tab.sheetId, accessToken);
        console.log(`탭 삭제됨: ${tab.title}`);
      } catch (error) {
        console.error(`탭 삭제 실패 (${tab.title}):`, error);
      }
    }

    // 8. "업무별" 시트를 복제하여 각 부서 시트 생성 (맨 뒤에 순서대로)
    const newDepartmentSheetIds: { name: string; sheetId: number }[] = [];

    // 현재 탭 수 계산 (복제 시 맨 뒤에 배치하기 위해)
    const currentTabCount = currentTabs.length;

    // Rate Limiting 방지를 위한 딜레이 함수
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < topicsToAdd.length; i++) {
      const topic = topicsToAdd[i];
      try {
        // "업무별" 시트 복제 (맨 뒤에 순서대로 배치)
        const insertIndex = currentTabCount + i;
        const newSheetId = await duplicateSheetTab(spreadsheetId, templateSheet.sheetId, topic.name, accessToken, insertIndex);
        console.log(`탭 복제 완료: ${topic.name} (index: ${insertIndex})`);
        newDepartmentSheetIds.push({ name: topic.name, sheetId: newSheetId });

        // 복제된 시트 내에서 "업무별" 텍스트를 부서 이름으로 변경
        try {
          await replaceTextInSheet(spreadsheetId, newSheetId, '업무별', topic.name, accessToken);
          console.log(`시트 내 텍스트 변경 완료: 업무별 → ${topic.name}`);
        } catch (replaceError) {
          console.error(`텍스트 변경 실패 (${topic.name}):`, replaceError);
          // 텍스트 변경 실패는 치명적이지 않으므로 계속 진행
        }

        // Rate Limiting 방지를 위해 500ms 대기
        if (i < topicsToAdd.length - 1) {
          await delay(500);
        }
      } catch (error) {
        console.error(`탭 복제 실패 (${topic.name}):`, error);
      }
    }

    // 9. "업무별" 템플릿 시트 삭제
    try {
      await deleteSheetTab(spreadsheetId, templateSheet.sheetId, accessToken);
      console.log('업무별 템플릿 시트 삭제 완료');
    } catch (error) {
      console.error('업무별 템플릿 시트 삭제 실패:', error);
      // 삭제 실패해도 계속 진행
    }

    // 10. 모든 부서 시트를 6학년 다음 순서대로 재배치
    // 기본 순서: 논의 및 결정사항(0), 1학년(1), 2학년(2), 3학년(3), 4학년(4), 5학년(5), 6학년(6)
    // 부서는 index 7부터 시작
    const updatedTabs = await getSheetTabs(spreadsheetId, accessToken);

    // topics 배열의 순서대로 부서 시트 정렬 (모든 부서, 기존+새로 추가된 것 모두)
    for (let i = 0; i < topics.length; i++) {
      const topicName = topics[i].name;
      const targetTab = updatedTabs.find(tab => tab.title === topicName);

      if (targetTab) {
        try {
          // 6학년 다음부터 순서대로 배치 (index 7, 8, 9...)
          await moveSheetTab(spreadsheetId, targetTab.sheetId, 7 + i, accessToken);
          console.log(`시트 순서 변경: ${topicName} → index ${7 + i}`);
        } catch (error) {
          console.error(`시트 순서 변경 실패 (${topicName}):`, error);
        }
      }
    }

    // 11. 모든 탭(학년+부서+논의)에 초기 데이터 설정
    const finalTabs = await getSheetTabs(spreadsheetId, accessToken);

    // 논의 및 결정사항을 제외한 모든 탭 처리
    const tabsToProcess = finalTabs.filter(tab => tab.title !== '논의 및 결정사항');
    // 논의 및 결정사항은 마지막에 처리
    const discussionTab = finalTabs.find(tab => tab.title === '논의 및 결정사항');
    if (discussionTab) {
      tabsToProcess.push(discussionTab);
    }

    console.log(`\n🔥 모든 탭 초기 데이터 설정 시작 (총 ${tabsToProcess.length}개)\n`);

    for (let i = 0; i < tabsToProcess.length; i++) {
      const tab = tabsToProcess[i];
      console.log(`\n[${i + 1}/${tabsToProcess.length}] 🔵 ${tab.title} 탭 처리 시작`);

      try {
        // 배치 업데이트 준비 (한 번의 API 호출로 모든 작업 처리)
        const data = [];

        // 1. A1:D2에 학교명
        data.push({
          range: `${tab.title}!A1:D2`,
          values: [
            [schoolName, '', '', ''],
            ['', '', '', '']
          ]
        });

        // 학년/부서 탭인 경우만 추가 작업
        if (!tab.title.includes('논의 및 결정사항')) {
          // 2. C4 헤더
          data.push({
            range: `${tab.title}!C4`,
            values: [['개선할 점\n및\n아쉬운 점']]
          });

          // 3. E1:E2에 탭 이름
          data.push({
            range: `${tab.title}!E1:E2`,
            values: [[tab.title], ['']]
          });
        }

        // 배치 업데이트 실행 (일반 값)
        console.log(`  - 배치 업데이트 실행 중... (${data.length}개 범위)`);
        const batchResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              valueInputOption: 'RAW',
              data: data
            })
          }
        );

        if (!batchResponse.ok) {
          throw new Error(`배치 업데이트 실패: ${batchResponse.status}`);
        }

        console.log(`  ✅ 배치 업데이트 완료`);

        // 수식은 별도로 처리 (USER_ENTERED 필요)
        if (!tab.title.includes('논의 및 결정사항')) {
          await delay(500);
          console.log(`  - E5 수식 설정 중...`);
          const labelFormula = `=ARRAYFORMULA(IF(D5:D50<>"", "${tab.title}", ""))`;
          await updateSheetRange(
            spreadsheetId,
            `${tab.title}!E5`,
            [[labelFormula]],
            accessToken,
            'USER_ENTERED'
          );
          console.log(`  ✅ E5 수식 설정 완료`);
        }

        console.log(`✅ ${tab.title} 탭 처리 완료\n`);

      } catch (error) {
        console.error(`❌ ${tab.title} 탭 처리 실패:`, error);
        console.error(`에러 상세:`, error);
      }

      // 각 탭 업데이트 후 2초 대기 (Rate Limiting 완벽 방지)
      if (i < tabsToProcess.length - 1) {
        console.log(`⏳ 2초 대기 중... (Rate Limiting 방지)\n`);
        await delay(2000);
      }
    }

    console.log('학년 탭 및 논의 탭 처리 완료');

    // 12. "논의 및 결정사항" 시트에 자동 집계 수식 추가
    // 각 시트의 D5에서 논의할 점을 가져와서 A4부터 자동으로 채움
    // FILTER 배열 수식을 사용하여 빈 값은 자동으로 제외
    try {
      // 모든 시트에서 D5를 가져오는 수식 생성
      // 시트 이름 목록 (논의 및 결정사항 제외)
      const sourceSheets = finalTabs
        .filter(tab => tab.title !== '논의 및 결정사항')
        .map(tab => tab.title);

      if (sourceSheets.length > 0) {
        // FILTER 배열 수식 사용 - 빈 값은 자동으로 제외됨
        // A열: 모든 시트의 D5:D50 중 비어있지 않은 것만
        // B열: 해당하는 시트의 E5:E50 (자동 라벨)

        // 모든 시트의 D5:D50을 세로로 쌓기
        const topicsArray = sourceSheets.map(sheetName => {
          const escapedSheetName = sheetName.replace(/'/g, "''");
          return `'${escapedSheetName}'!D5:D50`;
        }).join(';');

        // 모든 시트의 E5:E50 (라벨) 배열
        const namesArray = sourceSheets.map(sheetName => {
          const escapedSheetName = sheetName.replace(/'/g, "''");
          return `'${escapedSheetName}'!E5:E50`;
        }).join(';');

        // A4에 FILTER 배열 수식 (논의할 점 - 빈 값 제외)
        // IFERROR로 감싸서 필터 결과가 없을 때 #N/A 대신 빈 값 표시
        const formulaA = `=IFERROR(FILTER({${topicsArray}},{${topicsArray}}<>""),"")`;

        // B4에 FILTER 배열 수식 (시트 이름 - 동일한 조건으로 필터링)
        const formulaB = `=IFERROR(FILTER({${namesArray}},{${topicsArray}}<>""),"")`;

        // A4:B4에 수식 입력
        await updateSheetRange(
          spreadsheetId,
          `논의 및 결정사항!A4`,
          [[formulaA]],
          accessToken,
          'USER_ENTERED'
        );

        await updateSheetRange(
          spreadsheetId,
          `논의 및 결정사항!B4`,
          [[formulaB]],
          accessToken,
          'USER_ENTERED'
        );

        console.log(`논의 및 결정사항 자동 집계 수식 추가 완료 (${sourceSheets.length}개 시트, D5:D50 범위)`);

        // 13. "논의 및 결정사항" 시트의 A열과 B열을 보호 (수식 보호)
        try {
          const discussionTab = finalTabs.find(tab => tab.title === '논의 및 결정사항');
          if (discussionTab) {
            await protectSheetRange(
              spreadsheetId,
              discussionTab.sheetId,
              0, // A열 (index 0)
              2, // B열까지 (index 2는 exclusive, 즉 A와 B만)
              '자동 집계 수식이 있는 영역입니다. 수정하지 마세요.',
              accessToken
            );
            console.log('논의 및 결정사항 A, B열 보호 설정 완료');
          }
        } catch (protectError) {
          console.error('시트 보호 설정 실패:', protectError);
          // 보호 실패는 치명적이지 않으므로 계속 진행
        }
      }
    } catch (error) {
      console.error('자동 집계 수식 추가 실패:', error);
      // 수식 추가 실패는 치명적이지 않으므로 계속 진행
    }

    console.log('✅ 사용자 시트 초기화 완료');
  } catch (error) {
    console.error('사용자 시트 초기화 실패:', error);
    throw error;
  }
}

/**
 * 논의 및 결정사항 탭에서 데이터 읽기
 * @param spreadsheetId 스프레드시트 ID
 * @param accessToken Google OAuth 액세스 토큰
 * @returns 논의 항목 배열
 */
export async function getDiscussionItems(
  spreadsheetId: string,
  accessToken: string
): Promise<Array<{ id: string; topic: string; gradeOrDept: string; process: string; decision: string; row: number }>> {
  try {
    const tabName = '논의 및 결정사항';
    // A4:D (4행부터 끝까지, A~D 컬럼)
    const range = `${tabName}!A4:D`;

    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Google Sheets API 오류: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const rows = data.values || [];

    // 각 행을 객체로 변환 (빈 행은 제외)
    return rows
      .map((row: string[], index: number) => ({
        id: `row-${index + 4}`, // 4행부터 시작하므로
        topic: row[0] || '',
        gradeOrDept: row[1] || '',
        process: row[2] || '',
        decision: row[3] || '',
        row: index + 4, // 실제 시트의 행 번호
      }))
      .filter((item: any) => item.topic || item.gradeOrDept || item.process || item.decision); // 완전히 빈 행 제외
  } catch (error) {
    console.error('논의 및 결정사항 데이터 읽기 실패:', error);
    throw error;
  }
}

/**
 * 논의 및 결정사항 탭에 새로운 항목 추가
 * @param spreadsheetId 스프레드시트 ID
 * @param item 추가할 논의 항목
 * @param accessToken Google OAuth 액세스 토큰
 */
export async function addDiscussionItem(
  spreadsheetId: string,
  item: { topic: string; gradeOrDept: string },
  accessToken: string
): Promise<void> {
  try {
    const tabName = '논의 및 결정사항';

    // 현재 데이터 읽기
    const items = await getDiscussionItems(spreadsheetId, accessToken);

    // 다음 빈 행 찾기
    const nextRow = items.length > 0 ? Math.max(...items.map(i => i.row)) + 1 : 4;

    // 새 데이터 추가 (논의할 점, 학년/업무만, C,D는 빈칸)
    const range = `${tabName}!A${nextRow}:D${nextRow}`;
    const values = [[item.topic, item.gradeOrDept, '', '']];

    await updateSheetRange(spreadsheetId, range, values, accessToken);

    console.log('논의 및 결정사항 항목 추가 완료');
  } catch (error) {
    console.error('논의 및 결정사항 항목 추가 실패:', error);
    throw error;
  }
}

/**
 * 논의 및 결정사항 탭의 항목 업데이트
 * @param spreadsheetId 스프레드시트 ID
 * @param row 업데이트할 행 번호
 * @param item 업데이트할 데이터
 * @param accessToken Google OAuth 액세스 토큰
 */
export async function updateDiscussionItem(
  spreadsheetId: string,
  row: number,
  item: { process: string; decision: string },
  accessToken: string
): Promise<void> {
  try {
    const tabName = '논의 및 결정사항';
    // C, D 컬럼만 업데이트 (논의 과정, 결정 사항)
    // A, B 컬럼은 자동 집계 수식이므로 건드리지 않음
    const range = `${tabName}!C${row}:D${row}`;
    const values = [[item.process, item.decision]];

    await updateSheetRange(spreadsheetId, range, values, accessToken);

    console.log('논의 및 결정사항 항목 업데이트 완료');
  } catch (error) {
    console.error('논의 및 결정사항 항목 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 논의 및 결정사항 탭의 항목 삭제
 * @param spreadsheetId 스프레드시트 ID
 * @param row 삭제할 행 번호
 * @param accessToken Google OAuth 액세스 토큰
 */
export async function deleteDiscussionItem(
  spreadsheetId: string,
  row: number,
  accessToken: string
): Promise<void> {
  try {
    const tabName = '논의 및 결정사항';

    // 행을 빈 값으로 업데이트 (실제 삭제 대신)
    const range = `${tabName}!A${row}:D${row}`;
    const values = [['', '', '', '']];

    await updateSheetRange(spreadsheetId, range, values, accessToken);

    console.log('논의 및 결정사항 항목 삭제 완료');
  } catch (error) {
    console.error('논의 및 결정사항 항목 삭제 실패:', error);
    throw error;
  }
}
