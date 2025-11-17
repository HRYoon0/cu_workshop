/**
 * 구글 시트 연동 함수
 */

import { getUserSheet } from './firestore';

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
 * 설문 결과를 구글 시트에 기록
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
        type: 'survey',
        sheetId, // 사용자별 시트 ID 추가
        ...data,
      }),
    });

    console.log('설문 결과를 구글 시트에 전송했습니다.');
  } catch (error) {
    console.error('구글 시트 저장 실패:', error);
    // 에러가 발생해도 계속 진행 (Firebase에는 저장됨)
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
  accessToken: string
) {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
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

    // 각 탭의 A1:D2 범위에 학교명 업데이트
    const updatePromises = tabs.map(async (tab) => {
      const range = `${tab.title}!A1:D2`;
      // 2행 x 4열 배열 (병합된 셀이므로 첫 번째 셀에만 값 입력)
      const values = [
        [newSchoolName, '', '', ''],
        ['', '', '', '']
      ];

      try {
        await updateSheetRange(spreadsheetId, range, values, accessToken);
        return { tab: tab.title, success: true };
      } catch (error) {
        console.error(`${tab.title} 탭 업데이트 실패:`, error);
        return { tab: tab.title, success: false, error };
      }
    });

    const results = await Promise.all(updatePromises);
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
 * Google Sheets 시트 탭 복제
 */
export async function duplicateSheetTab(
  spreadsheetId: string,
  sourceSheetId: number,
  newTitle: string,
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
              duplicateSheet: {
                sourceSheetId: sourceSheetId,
                newSheetName: newTitle,
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

    // 8. "업무별" 시트를 복제하여 각 부서 시트 생성
    for (const topic of topicsToAdd) {
      try {
        // "업무별" 시트 복제
        const newSheetId = await duplicateSheetTab(spreadsheetId, templateSheet.sheetId, topic.name, accessToken);
        console.log(`탭 복제 완료: ${topic.name}`);

        // 복제된 시트 내에서 "업무별" 텍스트를 부서 이름으로 변경
        try {
          await replaceTextInSheet(spreadsheetId, newSheetId, '업무별', topic.name, accessToken);
          console.log(`시트 내 텍스트 변경 완료: 업무별 → ${topic.name}`);
        } catch (replaceError) {
          console.error(`텍스트 변경 실패 (${topic.name}):`, replaceError);
          // 텍스트 변경 실패는 치명적이지 않으므로 계속 진행
        }
      } catch (error) {
        console.error(`탭 복제 실패 (${topic.name}):`, error);
      }
    }

    // 9. 모든 탭에 초기 데이터 설정
    const finalTabs = await getSheetTabs(spreadsheetId, accessToken);
    for (const tab of finalTabs) {
      try {
        // A1:D2에 학교명
        await updateSheetRange(
          spreadsheetId,
          `${tab.title}!A1:D2`,
          [
            [schoolName, '', '', ''],
            ['', '', '', '']
          ],
          accessToken
        );

        // 학년/업무/부서 탭인 경우 E1:E2에 탭 이름
        if (!tab.title.includes('논의 및 결정사항')) {
          await updateSheetRange(
            spreadsheetId,
            `${tab.title}!E1:E2`,
            [
              [tab.title],
              ['']
            ],
            accessToken
          );
        }

        console.log(`초기 데이터 설정 완료: ${tab.title}`);
      } catch (error) {
        console.error(`초기 데이터 설정 실패 (${tab.title}):`, error);
      }
    }

    console.log('사용자 시트 초기화 완료');
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
  item: { topic: string; gradeOrDept: string; process: string; decision: string },
  accessToken: string
): Promise<void> {
  try {
    const tabName = '논의 및 결정사항';

    // 현재 데이터 읽기
    const items = await getDiscussionItems(spreadsheetId, accessToken);

    // 다음 빈 행 찾기
    const nextRow = items.length > 0 ? Math.max(...items.map(i => i.row)) + 1 : 4;

    // 새 데이터 추가
    const range = `${tabName}!A${nextRow}:D${nextRow}`;
    const values = [[item.topic, item.gradeOrDept, item.process, item.decision]];

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
  item: { topic: string; gradeOrDept: string; process: string; decision: string },
  accessToken: string
): Promise<void> {
  try {
    const tabName = '논의 및 결정사항';
    const range = `${tabName}!A${row}:D${row}`;
    const values = [[item.topic, item.gradeOrDept, item.process, item.decision]];

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
