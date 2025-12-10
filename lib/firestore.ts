import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Quiz, Survey, QuizSession, SurveySession, Participant, QuizAnswer, SurveyResponse, UserSheet, Department } from './types';

// ===== 퀴즈 관련 함수 =====

/**
 * 새 퀴즈 생성
 */
export async function createQuiz(quizData: Omit<Quiz, 'id' | 'createdAt'>, userId: string) {
  try {
    const docRef = await addDoc(collection(db, 'quizzes'), {
      ...quizData,
      userId,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('퀴즈 생성 실패:', error);
    throw error;
  }
}

/**
 * 퀴즈 업데이트
 */
export async function updateQuiz(quizId: string, quizData: Omit<Quiz, 'id' | 'createdAt' | 'userId'>) {
  try {
    const quizRef = doc(db, 'quizzes', quizId);
    await updateDoc(quizRef, {
      ...quizData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('퀴즈 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 퀴즈 가져오기 (단일)
 */
export async function getQuiz(quizId: string) {
  try {
    const quizRef = doc(db, 'quizzes', quizId);
    const quizDoc = await getDoc(quizRef);
    if (!quizDoc.exists()) {
      throw new Error('퀴즈를 찾을 수 없습니다.');
    }
    return {
      id: quizDoc.id,
      ...quizDoc.data(),
      createdAt: (quizDoc.data().createdAt as Timestamp)?.toDate() || new Date(),
    } as Quiz;
  } catch (error) {
    console.error('퀴즈 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 특정 사용자의 퀴즈 가져오기
 */
export async function getQuizzes(userId: string) {
  try {
    const q = query(collection(db, 'quizzes'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as Quiz[];
  } catch (error) {
    console.error('퀴즈 목록 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 퀴즈 세션 생성
 */
export async function createQuizSession(quizId: string) {
  try {
    const docRef = await addDoc(collection(db, 'quizSessions'), {
      quizId,
      status: 'waiting',
      participants: [],
      answers: [],
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('퀴즈 세션 생성 실패:', error);
    throw error;
  }
}

/**
 * 퀴즈 세션 상태 업데이트
 */
export async function updateQuizSessionStatus(
  sessionId: string,
  status: 'waiting' | 'active' | 'finished'
) {
  try {
    const sessionRef = doc(db, 'quizSessions', sessionId);
    const updateData: any = { status };

    if (status === 'active') {
      updateData.startTime = serverTimestamp();
      updateData.currentQuestionIndex = 0; // 퀴즈 시작 시 첫 번째 문제
    } else if (status === 'finished') {
      updateData.endTime = serverTimestamp();
    }

    await updateDoc(sessionRef, updateData);
  } catch (error) {
    console.error('세션 상태 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 퀴즈 세션 현재 문제 인덱스 업데이트
 */
export async function updateQuizSessionQuestion(
  sessionId: string,
  questionIndex: number
) {
  try {
    const sessionRef = doc(db, 'quizSessions', sessionId);
    await updateDoc(sessionRef, {
      currentQuestionIndex: questionIndex,
    });
    console.log('현재 문제 업데이트:', questionIndex + 1);
  } catch (error) {
    console.error('문제 인덱스 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 퀴즈 세션에 참여자 추가
 */
export async function addParticipantToQuizSession(sessionId: string, participant: Participant) {
  try {
    console.log('=== addParticipantToQuizSession 시작 ===');
    console.log('sessionId:', sessionId);
    console.log('participant:', participant);

    const sessionRef = doc(db, 'quizSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      console.error('❌ 세션을 찾을 수 없습니다:', sessionId);
      throw new Error('세션을 찾을 수 없습니다.');
    }

    const currentParticipants = sessionDoc.data().participants || [];
    console.log('현재 참가자 수:', currentParticipants.length);

    // Firestore 배열 안에서는 serverTimestamp() 사용 불가 -> Timestamp.now() 사용
    const now = Timestamp.now();
    const participantWithTimestamp = {
      ...participant,
      score: 0, // 초기 점수 0으로 명시적 설정
      joinedAt: now,
      lastActiveAt: now,
    };

    console.log('추가할 참가자 객체:', participantWithTimestamp);

    await updateDoc(sessionRef, {
      participants: [...currentParticipants, participantWithTimestamp],
    });

    console.log('✅ 참가자 추가 성공:', participant.nickname, participant.id, 'score: 0');
  } catch (error) {
    console.error('❌ 참여자 추가 실패:', error);
    throw error;
  }
}

/**
 * 퀴즈 세션에서 참여자 제거
 */
export async function removeParticipantFromQuizSession(sessionId: string, participantId: string) {
  try {
    const sessionRef = doc(db, 'quizSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      return; // 세션이 없으면 조용히 종료
    }

    const currentParticipants = sessionDoc.data().participants || [];
    const updatedParticipants = currentParticipants.filter(
      (p: Participant) => p.id !== participantId
    );

    await updateDoc(sessionRef, {
      participants: updatedParticipants,
    });
  } catch (error) {
    console.error('참여자 제거 실패:', error);
    // 에러를 throw하지 않음 (페이지 종료 시 에러가 발생해도 괜찮음)
  }
}

/**
 * 참가자 활동 시간 업데이트 (heartbeat)
 */
export async function updateParticipantHeartbeat(sessionId: string, participantId: string) {
  try {
    const sessionRef = doc(db, 'quizSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      console.log('Heartbeat: 세션을 찾을 수 없음', sessionId);
      return;
    }

    const currentParticipants = sessionDoc.data().participants || [];
    const participant = currentParticipants.find((p: Participant) => p.id === participantId);

    if (!participant) {
      console.log('Heartbeat: 참가자를 찾을 수 없음', participantId);
      return;
    }

    // Firestore 배열 안에서는 serverTimestamp() 사용 불가 -> Timestamp.now() 사용
    const now = Timestamp.now();
    const updatedParticipants = currentParticipants.map((p: Participant) => {
      if (p.id === participantId) {
        return {
          ...p,
          lastActiveAt: now,
        };
      }
      return p;
    });

    await updateDoc(sessionRef, {
      participants: updatedParticipants,
    });
    console.log('Heartbeat 전송 성공:', participant.nickname);
  } catch (error) {
    console.error('Heartbeat 업데이트 실패:', error);
  }
}

/**
 * 참가자 점수 업데이트
 */
export async function updateParticipantScore(
  sessionId: string,
  participantId: string,
  scoreToAdd: number
) {
  try {
    console.log('=== updateParticipantScore 시작 ===');
    console.log('sessionId:', sessionId);
    console.log('participantId:', participantId);
    console.log('scoreToAdd:', scoreToAdd);

    const sessionRef = doc(db, 'quizSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      console.error('❌ 세션을 찾을 수 없습니다:', sessionId);
      return;
    }

    const currentParticipants = sessionDoc.data().participants || [];
    const targetParticipant = currentParticipants.find((p: Participant) => p.id === participantId);

    if (!targetParticipant) {
      console.error('❌ 참가자를 찾을 수 없습니다:', participantId);
      return;
    }

    console.log('현재 점수:', targetParticipant.score ?? 0);

    const updatedParticipants = currentParticipants.map((p: Participant) => {
      if (p.id === participantId) {
        const oldScore = p.score ?? 0;
        const newScore = oldScore + scoreToAdd;
        console.log('점수 업데이트:', oldScore, '+', scoreToAdd, '=', newScore);
        return {
          ...p,
          score: newScore,
        };
      }
      return p;
    });

    await updateDoc(sessionRef, {
      participants: updatedParticipants,
    });
    console.log('✅ 점수 업데이트 성공:', targetParticipant.nickname, scoreToAdd, '점 획득');
  } catch (error) {
    console.error('❌ 점수 업데이트 실패:', error);
  }
}

/**
 * 퀴즈 답안 제출
 */
export async function submitQuizAnswer(
  sessionId: string,
  answer: QuizAnswer,
  quizTitle?: string,
  userId?: string
) {
  try {
    const sessionRef = doc(db, 'quizSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const currentAnswers = sessionDoc.data().answers || [];
      // Firestore 배열 안에서는 serverTimestamp() 사용 불가 -> Timestamp.now() 사용
      await updateDoc(sessionRef, {
        answers: [...currentAnswers, {
          ...answer,
          timestamp: Timestamp.now(),
        }],
      });

      console.log('답안 제출 성공:', answer.participantName, '문제', answer.questionIndex + 1);
    }
  } catch (error) {
    console.error('답안 제출 실패:', error);
    throw error;
  }
}

/**
 * 퀴즈 세션 실시간 구독
 */
export function subscribeToQuizSession(sessionId: string, callback: (session: QuizSession) => void) {
  const sessionRef = doc(db, 'quizSessions', sessionId);

  return onSnapshot(sessionRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      callback({
        id: doc.id,
        ...data,
        startTime: (data.startTime as Timestamp)?.toDate(),
        endTime: (data.endTime as Timestamp)?.toDate(),
      } as QuizSession);
    }
  });
}

// ===== 설문 관련 함수 =====

/**
 * 새 설문 생성
 */
export async function createSurvey(surveyData: Omit<Survey, 'id' | 'createdAt'>, userId: string) {
  try {
    const docRef = await addDoc(collection(db, 'surveys'), {
      ...surveyData,
      userId,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('설문 생성 실패:', error);
    throw error;
  }
}

/**
 * 설문 업데이트
 */
export async function updateSurvey(surveyId: string, surveyData: Omit<Survey, 'id' | 'createdAt' | 'userId'>) {
  try {
    const surveyRef = doc(db, 'surveys', surveyId);
    await updateDoc(surveyRef, {
      ...surveyData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('설문 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 설문 가져오기 (단일)
 */
export async function getSurvey(surveyId: string) {
  try {
    const surveyRef = doc(db, 'surveys', surveyId);
    const surveyDoc = await getDoc(surveyRef);
    if (!surveyDoc.exists()) {
      throw new Error('설문을 찾을 수 없습니다.');
    }
    return {
      id: surveyDoc.id,
      ...surveyDoc.data(),
      createdAt: (surveyDoc.data().createdAt as Timestamp)?.toDate() || new Date(),
    } as Survey;
  } catch (error) {
    console.error('설문 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 특정 사용자의 설문 가져오기
 */
export async function getSurveys(userId: string) {
  try {
    const q = query(collection(db, 'surveys'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as Survey[];
  } catch (error) {
    console.error('설문 목록 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 설문 세션 생성 (단일 설문 - 레거시)
 */
export async function createSurveySession(surveyId: string) {
  try {
    const docRef = await addDoc(collection(db, 'surveySessions'), {
      surveyId,
      status: 'waiting',
      participants: [],
      responseCount: 0,
      statistics: {},
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('설문 세션 생성 실패:', error);
    throw error;
  }
}

/**
 * 설문 세션 생성 (여러 설문 항목 - 퀴즈처럼 진행)
 * userId의 모든 설문 항목을 가져와서 세션 생성
 */
export async function createSurveyItemsSession(userId: string, topicId?: string) {
  try {
    // 주제 ID가 있으면 해당 주제의 항목만, 없으면 모든 항목 가져오기
    const surveyItems = topicId
      ? await getSurveyItems(topicId)
      : await getAllSurveyItemsByUser(userId);

    if (surveyItems.length === 0) {
      throw new Error('생성된 설문 항목이 없습니다.');
    }

    // 주제 정보 가져오기 (sheetUrl과 제목 포함)
    let topicInfo: any = null;
    if (topicId) {
      topicInfo = await getSurveyTopic(topicId);
    }

    // 관리자의 Google 액세스 토큰 가져오기 (구글 시트 저장용)
    let adminAccessToken: string | null = null;
    if (typeof window !== 'undefined') {
      adminAccessToken = localStorage.getItem('googleAccessToken');
    }

    // 세션 생성
    const docRef = await addDoc(collection(db, 'surveySessions'), {
      userId,
      ...(topicId && { topicId }), // topicId가 있으면 저장
      ...(topicInfo?.sheetUrl && { sheetUrl: topicInfo.sheetUrl }), // 주제의 시트 URL 저장
      ...(topicInfo?.title && { topicTitle: topicInfo.title }), // 주제 제목 저장
      ...(adminAccessToken && { adminAccessToken }), // 구글 시트 저장용 관리자 토큰
      surveyItems, // 설문 항목 저장
      currentItemIndex: 0, // 현재 진행 중인 설문 항목 인덱스
      status: 'waiting', // waiting, active, showing_result, finished
      participants: [],
      responseCount: 0, // 현재 항목의 응답 수
      statistics: {}, // 현재 항목의 통계 데이터
      allResponses: {}, // 모든 항목의 통계들 { itemId: { responseCount, statistics } }
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('설문 세션 생성 실패:', error);
    throw error;
  }
}

/**
 * 설문 세션 상태 업데이트
 */
export async function updateSurveySessionStatus(
  sessionId: string,
  status: 'waiting' | 'active' | 'showing_result' | 'finished'
) {
  try {
    const sessionRef = doc(db, 'surveySessions', sessionId);
    const updateData: any = { status };

    if (status === 'active') {
      updateData.startTime = serverTimestamp();
    } else if (status === 'finished') {
      updateData.endTime = serverTimestamp();

      // 설문 종료 시 통계 데이터만 삭제 (Firebase 용량 절약)
      // 구글 시트에는 이미 전체 내용이 저장되어 있음
      updateData.responseCount = 0;
      updateData.statistics = {};
      updateData.allResponses = {};

      console.log('✅ 설문 종료: 통계 데이터 삭제 완료 (메타 정보는 유지)');
    }

    await updateDoc(sessionRef, updateData);
  } catch (error) {
    console.error('설문 세션 상태 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 설문 세션의 현재 항목 인덱스 업데이트 (퀴즈의 updateQuizSessionQuestion과 유사)
 */
export async function updateSurveySessionItem(
  sessionId: string,
  itemIndex: number
) {
  try {
    const sessionRef = doc(db, 'surveySessions', sessionId);
    await updateDoc(sessionRef, {
      currentItemIndex: itemIndex,
      responseCount: 0, // 새 항목으로 이동 시 카운트 초기화
      statistics: {}, // 새 항목으로 이동 시 통계 초기화
      status: 'active' // 항목 시작 시 active 상태로
    });
  } catch (error) {
    console.error('설문 항목 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 현재 항목의 응답을 allResponses에 저장하고 다음 항목으로 이동
 */
export async function saveCurrentResponsesAndMoveNext(
  sessionId: string,
  currentItemId: string,
  currentItemIndex: number
) {
  try {
    const sessionRef = doc(db, 'surveySessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error('세션을 찾을 수 없습니다.');
    }

    const sessionData = sessionSnap.data();
    const currentStats = {
      responseCount: sessionData.responseCount || 0,
      statistics: sessionData.statistics || {}
    };
    const allResponses = sessionData.allResponses || {};

    // 현재 항목의 통계를 allResponses에 저장
    allResponses[currentItemId] = currentStats;

    await updateDoc(sessionRef, {
      allResponses,
      currentItemIndex: currentItemIndex + 1,
      responseCount: 0, // 다음 항목을 위해 카운트 초기화
      statistics: {}, // 다음 항목을 위해 통계 초기화
      status: 'active'
    });
  } catch (error) {
    console.error('응답 저장 및 다음 항목 이동 실패:', error);
    throw error;
  }
}

/**
 * 설문 응답 제출
 */
export async function submitSurveyResponse(
  sessionId: string,
  response: SurveyResponse,
  surveyTitle?: string,
  userId?: string
) {
  try {
    console.log('📝 설문 응답 제출 시작');
    console.log('응답 데이터:', response);

    const sessionRef = doc(db, 'surveySessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const data = sessionDoc.data();
      const currentCount = data.responseCount || 0;
      const currentStats = data.statistics || {};

      console.log('현재 응답 수:', currentCount);

      // 응답 타입에 따라 통계 업데이트
      let updatedStats = { ...currentStats };

      if (typeof response.answer === 'number') {
        // 선다형 응답
        const optionCounts = updatedStats.optionCounts || {};
        const optionKey = response.answer.toString();
        optionCounts[optionKey] = (optionCounts[optionKey] || 0) + 1;
        updatedStats.optionCounts = optionCounts;
        console.log('선다형 응답 업데이트:', optionKey);
      } else if (response.answer === 'other' && response.otherText) {
        // 기타 의견
        const otherTexts = updatedStats.otherTexts || [];
        otherTexts.push(response.otherText);
        updatedStats.otherTexts = otherTexts;
        console.log('기타 의견 추가:', response.otherText);
      } else if (typeof response.answer === 'string') {
        // 서술형 응답
        const textResponses = updatedStats.textResponses || [];
        textResponses.push(response.answer);
        updatedStats.textResponses = textResponses;
        console.log('서술형 응답 추가');
      }

      // Firebase에 통계만 저장 (용량 절약)
      console.log('Firebase에 통계 저장 중...');
      await updateDoc(sessionRef, {
        responseCount: currentCount + 1,
        statistics: updatedStats,
      });
      console.log('✅ Firebase 통계 저장 완료! 응답 수:', currentCount + 1);

      // 개별 응답은 구글 시트에 저장하지 않음
      // 차트 저장은 handleNextItem/handleEndSurvey에서 saveSurveyChartToSheet로 처리
      console.log('📊 개별 응답은 Firebase 통계에만 저장됩니다. 차트는 설문 완료 시 시트에 저장됩니다.');
    } else {
      console.error('❌ 세션을 찾을 수 없습니다');
    }
  } catch (error) {
    console.error('❌ 설문 응답 제출 실패:', error);
    throw error;
  }
}

/**
 * 설문 세션 가져오기 (일회성)
 */
export async function getSurveySession(sessionId: string) {
  try {
    const sessionRef = doc(db, 'surveySessions', sessionId);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error('세션을 찾을 수 없습니다.');
    }

    const data = sessionSnap.data();
    return {
      id: sessionSnap.id,
      ...data,
      startTime: (data.startTime as Timestamp)?.toDate(),
      endTime: (data.endTime as Timestamp)?.toDate(),
      createdAt: (data.createdAt as Timestamp)?.toDate(),
    };
  } catch (error) {
    console.error('설문 세션 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 설문 세션에 참가자 추가
 */
export async function addParticipantToSurveySession(
  sessionId: string,
  participant: { id: string; nickname: string }
) {
  try {
    console.log('📝 참가자 추가 함수 시작');
    console.log('세션 ID:', sessionId);
    console.log('참가자 정보:', participant);

    const sessionRef = doc(db, 'surveySessions', sessionId);
    console.log('세션 문서 조회 중...');

    const sessionSnap = await getDoc(sessionRef);
    console.log('세션 존재 여부:', sessionSnap.exists());

    if (!sessionSnap.exists()) {
      throw new Error('세션을 찾을 수 없습니다.');
    }

    const sessionData = sessionSnap.data();
    console.log('세션 데이터:', sessionData);

    const currentParticipants = sessionData.participants || [];
    console.log('현재 참가자 수:', currentParticipants.length);

    // 이미 참가한 경우 중복 방지
    const exists = currentParticipants.some((p: any) => p.id === participant.id);
    if (exists) {
      console.log('⚠️ 이미 참가한 참가자입니다.');
      return;
    }

    console.log('Firestore 업데이트 중...');
    const now = Timestamp.now();
    await updateDoc(sessionRef, {
      participants: [...currentParticipants, {
        ...participant,
        joinedAt: now,
        lastActiveAt: now
      }]
    });
    console.log('✅ 참가자 추가 완료!');
  } catch (error) {
    console.error('❌ 참가자 추가 실패:', error);
    throw error;
  }
}

/**
 * 설문 세션 실시간 구독
 */
export function subscribeToSurveySession(sessionId: string, callback: (session: SurveySession) => void) {
  const sessionRef = doc(db, 'surveySessions', sessionId);

  return onSnapshot(sessionRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      callback({
        id: doc.id,
        ...data,
        startTime: (data.startTime as Timestamp)?.toDate(),
        endTime: (data.endTime as Timestamp)?.toDate(),
      } as SurveySession);
    }
  });
}

/**
 * 퀴즈 삭제
 */
export async function deleteQuiz(quizId: string) {
  try {
    await deleteDoc(doc(db, 'quizzes', quizId));
  } catch (error) {
    console.error('퀴즈 삭제 실패:', error);
    throw error;
  }
}

/**
 * 설문 삭제
 */
export async function deleteSurvey(surveyId: string) {
  try {
    await deleteDoc(doc(db, 'surveys', surveyId));
  } catch (error) {
    console.error('설문 삭제 실패:', error);
    throw error;
  }
}

/**
 * 퀴즈 세션 삭제 (Firestore 용량 절약)
 */
export async function deleteQuizSession(sessionId: string) {
  try {
    await deleteDoc(doc(db, 'quizSessions', sessionId));
    console.log('퀴즈 세션이 삭제되었습니다:', sessionId);
  } catch (error) {
    console.error('퀴즈 세션 삭제 실패:', error);
    throw error;
  }
}

/**
 * 설문 세션 삭제 (Firestore 용량 절약)
 */
export async function deleteSurveySession(sessionId: string) {
  try {
    await deleteDoc(doc(db, 'surveySessions', sessionId));
    console.log('설문 세션이 삭제되었습니다:', sessionId);
  } catch (error) {
    console.error('설문 세션 삭제 실패:', error);
    throw error;
  }
}

// ===== 사용자 관리 함수 =====

/**
 * 승인 대기 사용자 추가
 */
export async function addPendingUser(uid: string, email: string, displayName: string | null, photoURL: string | null) {
  try {
    await addDoc(collection(db, 'pendingUsers'), {
      uid,
      email,
      displayName,
      photoURL,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('승인 대기 사용자 추가 실패:', error);
    throw error;
  }
}

/**
 * 승인된 사용자 확인
 */
export async function isApprovedUser(uid: string): Promise<boolean> {
  try {
    const q = query(collection(db, 'approvedUsers'), where('uid', '==', uid));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('승인된 사용자 확인 실패:', error);
    return false;
  }
}

/**
 * 승인 대기 중인 사용자 목록 가져오기
 */
export async function getPendingUsers() {
  try {
    const querySnapshot = await getDocs(collection(db, 'pendingUsers'));
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    }));
  } catch (error) {
    console.error('승인 대기 사용자 목록 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 사용자 승인
 */
export async function approveUser(pendingUserId: string, uid: string, email: string, displayName: string | null, photoURL: string | null, approvedBy: string) {
  try {
    // approvedUsers에 추가
    await addDoc(collection(db, 'approvedUsers'), {
      uid,
      email,
      displayName,
      photoURL,
      approvedAt: serverTimestamp(),
      approvedBy,
    });

    // pendingUsers에서 삭제
    await deleteDoc(doc(db, 'pendingUsers', pendingUserId));
  } catch (error) {
    console.error('사용자 승인 실패:', error);
    throw error;
  }
}

/**
 * 사용자 거절 (승인 대기 목록에서 삭제)
 */
export async function rejectUser(pendingUserId: string) {
  try {
    await deleteDoc(doc(db, 'pendingUsers', pendingUserId));
  } catch (error) {
    console.error('사용자 거절 실패:', error);
    throw error;
  }
}

// ===== 사용자 시트 관련 함수 =====

/**
 * 사용자 시트 정보 저장
 */
export async function saveUserSheet(userSheetData: Omit<UserSheet, 'createdAt'>) {
  try {
    // 매번 새 시트 문서 생성 (기존 시트는 history로 남김)
    const docRef = await addDoc(collection(db, 'userSheets'), {
      ...userSheetData,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('사용자 시트 저장 실패:', error);
    throw error;
  }
}

/**
 * 사용자 시트 정보 가져오기 (가장 최근 시트)
 */
export async function getUserSheet(userId: string): Promise<UserSheet | null> {
  try {
    // userId로 모든 시트 가져오기
    const q = query(
      collection(db, 'userSheets'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    // JavaScript에서 createdAt 기준으로 정렬하여 가장 최근 시트 선택
    const sheets = querySnapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    } as UserSheet));

    // createdAt 기준 내림차순 정렬
    sheets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return sheets[0];
  } catch (error) {
    console.error('사용자 시트 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 사용자 시트 웹 앱 URL 업데이트
 */
export async function updateUserSheetWebAppUrl(userId: string, webAppUrl: string) {
  try {
    const q = query(collection(db, 'userSheets'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docId = querySnapshot.docs[0].id;
      await updateDoc(doc(db, 'userSheets', docId), {
        webAppUrl,
      });
    }
  } catch (error) {
    console.error('웹 앱 URL 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 모든 사용자 시트 정보 가져오기
 */
export async function getAllUserSheets(): Promise<UserSheet[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'userSheets'));
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as UserSheet[];
  } catch (error) {
    console.error('모든 사용자 시트 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 오래된 사용자 시트 히스토리 정리 (최근 것만 유지)
 */
export async function cleanOldUserSheetHistory(userId: string) {
  try {
    const q = query(
      collection(db, 'userSheets'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.size <= 1) {
      console.log('히스토리가 1개 이하이므로 정리할 필요 없음');
      return;
    }

    // 날짜 기준 정렬
    const sheets = querySnapshot.docs.map(doc => ({
      id: doc.id,
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    }));

    sheets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 가장 최근 것 제외하고 나머지 삭제
    const deletePromises = sheets.slice(1).map(sheet =>
      deleteDoc(doc(db, 'userSheets', sheet.id))
    );

    await Promise.all(deletePromises);
    console.log(`${deletePromises.length}개의 오래된 시트 히스토리가 삭제되었습니다.`);
  } catch (error) {
    console.error('시트 히스토리 정리 실패:', error);
    throw error;
  }
}

// ===== 논의 자료 (업무) 관련 함수 =====

/**
 * 새 부서 생성
 */
export async function createDepartment(
  deptData: Omit<Department, 'id' | 'createdAt' | 'userId'>,
  userId: string
) {
  try {
    const docRef = await addDoc(collection(db, 'departments'), {
      ...deptData,
      userId,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('부서 생성 실패:', error);
    throw error;
  }
}

/**
 * 사용자의 모든 부서 가져오기
 */
export async function getDepartments(userId: string): Promise<Array<{ id: string; name: string; order: number; userId: string; createdAt: Date }>> {
  try {
    const q = query(
      collection(db, 'departments'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    const depts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as Array<{ id: string; name: string; order: number; userId: string; createdAt: Date }>;

    // JavaScript에서 order 기준으로 정렬
    depts.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));

    return depts;
  } catch (error) {
    console.error('부서 목록 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 부서 수정
 */
export async function updateDepartment(
  deptId: string,
  deptData: { name?: string; order?: number }
) {
  try {
    const deptRef = doc(db, 'departments', deptId);
    await updateDoc(deptRef, deptData);
  } catch (error) {
    console.error('부서 수정 실패:', error);
    throw error;
  }
}

/**
 * 부서 삭제
 */
export async function deleteDepartment(deptId: string) {
  try {
    await deleteDoc(doc(db, 'departments', deptId));
  } catch (error) {
    console.error('부서 삭제 실패:', error);
    throw error;
  }
}

// ===== 의견 수집 세션 관련 함수 =====

/**
 * 의견 수집 세션 생성
 */
export async function createOpinionSession(
  sessionData: {
    discussionItemId: string;
    discussionTopic: string;
    discussionRow: number;
    type: 'free' | 'scale';
    sheetId: string;
  },
  userId: string
) {
  try {
    console.log('🚀 createOpinionSession 시작');
    console.log('  - sessionData:', sessionData);
    console.log('  - userId:', userId);

    // 기존 활성 세션이 있으면 먼저 종료
    console.log('📌 기존 활성 세션 종료 시도...');
    await closeActiveOpinionSessionByUser(userId);

    console.log('📝 새 세션 문서 생성 중...');
    const newSessionData = {
      ...sessionData,
      userId,
      status: 'active',
      isActive: true, // 활성 세션 표시
      createdAt: serverTimestamp(),
    };
    console.log('  - 생성할 데이터:', newSessionData);

    const docRef = await addDoc(collection(db, 'opinionSessions'), newSessionData);
    console.log('✅ 세션 생성 완료! ID:', docRef.id);

    return docRef.id;
  } catch (error) {
    console.error('❌ 의견 수집 세션 생성 실패:', error);
    console.error('  - 에러 타입:', typeof error);
    console.error('  - 에러 객체:', error);
    throw error;
  }
}

/**
 * 의견 제출
 */
export async function submitOpinion(
  sessionId: string,
  opinionData: {
    type: 'free' | 'scale';
    content?: string; // 자유 의견의 경우
    value?: number; // 찬반형의 경우 (-2, -1, 0, 1, 2)
  }
) {
  try {
    const opinionRef = collection(db, 'opinionSessions', sessionId, 'opinions');
    await addDoc(opinionRef, {
      ...opinionData,
      submittedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('의견 제출 실패:', error);
    throw error;
  }
}

/**
 * 의견 수집 세션 상태 업데이트
 */
export async function updateOpinionSessionStatus(
  sessionId: string,
  status: 'active' | 'closed'
) {
  try {
    const sessionRef = doc(db, 'opinionSessions', sessionId);
    const updateData: any = { status };

    if (status === 'closed') {
      updateData.closedAt = serverTimestamp();
      updateData.isActive = false; // 비활성화
    }

    await updateDoc(sessionRef, updateData);
  } catch (error) {
    console.error('의견 수집 세션 상태 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 사용자의 활성 의견 수집 세션 가져오기 (고정 URL용)
 */
export async function getActiveOpinionSessionByUserId(userId: string) {
  try {
    const q = query(
      collection(db, 'opinionSessions'),
      where('userId', '==', userId),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
      closedAt: (doc.data().closedAt as Timestamp)?.toDate(),
    };
  } catch (error) {
    console.error('활성 세션 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 사용자의 활성 세션 종료 (새 세션 시작 전)
 */
export async function closeActiveOpinionSessionByUser(userId: string) {
  try {
    console.log('🔄 closeActiveOpinionSessionByUser 시작, userId:', userId);

    const q = query(
      collection(db, 'opinionSessions'),
      where('userId', '==', userId),
      where('isActive', '==', true)
    );

    console.log('🔍 활성 세션 검색 중...');
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('✅ 종료할 활성 세션이 없습니다.');
      return;
    }

    console.log(`📝 ${querySnapshot.size}개의 활성 세션 발견, 종료 중...`);

    // 모든 활성 세션 종료 (보통 1개만 있어야 함)
    const updatePromises = querySnapshot.docs.map(doc => {
      console.log('  - 세션 종료:', doc.id);
      return updateDoc(doc.ref, {
        status: 'closed',
        isActive: false,
        closedAt: serverTimestamp(),
      });
    });

    await Promise.all(updatePromises);
    console.log(`✅ ${querySnapshot.size}개의 활성 세션이 자동 종료되었습니다.`);
  } catch (error) {
    console.error('❌ 활성 세션 종료 실패:', error);
    throw error;
  }
}

/**
 * 의견 수집 세션 정보 가져오기
 */
export async function getOpinionSession(sessionId: string) {
  try {
    const sessionRef = doc(db, 'opinionSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      throw new Error('의견 수집 세션을 찾을 수 없습니다.');
    }

    return {
      id: sessionDoc.id,
      ...sessionDoc.data(),
      createdAt: (sessionDoc.data().createdAt as Timestamp)?.toDate() || new Date(),
      closedAt: (sessionDoc.data().closedAt as Timestamp)?.toDate(),
    };
  } catch (error) {
    console.error('의견 수집 세션 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 의견 수집 세션의 모든 의견 가져오기
 */
export async function getOpinions(sessionId: string) {
  try {
    const opinionsRef = collection(db, 'opinionSessions', sessionId, 'opinions');
    const querySnapshot = await getDocs(opinionsRef);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: (doc.data().submittedAt as Timestamp)?.toDate() || new Date(),
    }));
  } catch (error) {
    console.error('의견 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 의견 수집 세션 실시간 구독
 */
export function subscribeToOpinionSession(sessionId: string, callback: (session: any) => void) {
  const sessionRef = doc(db, 'opinionSessions', sessionId);

  return onSnapshot(sessionRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      callback({
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate(),
        closedAt: (data.closedAt as Timestamp)?.toDate(),
      });
    }
  });
}

/**
 * 의견 실시간 구독
 */
export function subscribeToOpinions(sessionId: string, callback: (opinions: any[]) => void) {
  const opinionsRef = collection(db, 'opinionSessions', sessionId, 'opinions');

  return onSnapshot(opinionsRef, (snapshot) => {
    const opinions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      submittedAt: (doc.data().submittedAt as Timestamp)?.toDate() || new Date(),
    }));
    callback(opinions);
  });
}

/**
 * 사용자의 활성 세션 실시간 구독 (고정 URL용)
 */
export function subscribeToActiveOpinionSessionByUserId(userId: string, callback: (session: any | null) => void) {
  const q = query(
    collection(db, 'opinionSessions'),
    where('userId', '==', userId),
    where('isActive', '==', true)
  );

  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null);
      return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    callback({
      id: doc.id,
      ...data,
      createdAt: (data.createdAt as Timestamp)?.toDate(),
      closedAt: (data.closedAt as Timestamp)?.toDate(),
    });
  });
}

/**
 * 활성화된 의견 수집 세션 가져오기 (특정 논의 항목)
 */
export async function getActiveOpinionSession(discussionItemId: string, userId: string) {
  try {
    const q = query(
      collection(db, 'opinionSessions'),
      where('discussionItemId', '==', discussionItemId),
      where('userId', '==', userId),
      where('status', '==', 'active')
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('활성화된 의견 수집 세션 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 의견 수집 세션의 모든 의견 삭제 (Firestore 용량 절약)
 */
export async function deleteAllOpinionsInSession(sessionId: string) {
  try {
    const opinionsRef = collection(db, 'opinionSessions', sessionId, 'opinions');
    const querySnapshot = await getDocs(opinionsRef);

    // 모든 의견 문서 삭제
    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    console.log(`${querySnapshot.docs.length}개의 의견이 삭제되었습니다.`);
  } catch (error) {
    console.error('의견 삭제 실패:', error);
    throw error;
  }
}

/**
 * 의견 수집 세션 삭제 (종료 후 정리)
 */
export async function deleteOpinionSession(sessionId: string) {
  try {
    // 먼저 모든 의견 삭제
    await deleteAllOpinionsInSession(sessionId);

    // 세션 문서 삭제
    await deleteDoc(doc(db, 'opinionSessions', sessionId));

    console.log('의견 수집 세션이 삭제되었습니다.');
  } catch (error) {
    console.error('세션 삭제 실패:', error);
    throw error;
  }
}

// ===== 설문 주제 및 항목 관련 함수 =====

/**
 * 새 설문 주제 생성
 */
export async function createSurveyTopic(title: string, userId: string, sheetUrl?: string) {
  try {
    const docRef = await addDoc(collection(db, 'surveyTopics'), {
      title,
      userId,
      ...(sheetUrl && { sheetUrl }), // sheetUrl이 있으면 저장
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('설문 주제 생성 실패:', error);
    throw error;
  }
}

/**
 * 특정 사용자의 설문 주제 가져오기
 */
export async function getSurveyTopics(userId: string) {
  try {
    // orderBy 제거 - 퀴즈처럼 구현 (인덱스 불필요)
    const q = query(
      collection(db, 'surveyTopics'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    const topics = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    }));

    // 클라이언트에서 정렬
    return topics.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('설문 주제 목록 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 단일 설문 주제 가져오기
 */
export async function getSurveyTopic(topicId: string) {
  try {
    const topicRef = doc(db, 'surveyTopics', topicId);
    const topicDoc = await getDoc(topicRef);
    if (!topicDoc.exists()) {
      throw new Error('설문 주제를 찾을 수 없습니다.');
    }
    return {
      id: topicDoc.id,
      ...topicDoc.data(),
      createdAt: (topicDoc.data().createdAt as Timestamp)?.toDate() || new Date(),
    };
  } catch (error) {
    console.error('설문 주제 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 설문 주제 수정
 */
export async function updateSurveyTopic(topicId: string, title: string) {
  try {
    const topicRef = doc(db, 'surveyTopics', topicId);
    await updateDoc(topicRef, {
      title,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('설문 주제 수정 실패:', error);
    throw error;
  }
}

/**
 * 설문 주제 삭제 (하위 항목도 함께 삭제)
 */
export async function deleteSurveyTopic(topicId: string) {
  try {
    // 먼저 하위 항목들 삭제
    const itemsQuery = query(collection(db, 'surveyItems'), where('topicId', '==', topicId));
    const itemsSnapshot = await getDocs(itemsQuery);
    const deletePromises = itemsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // 주제 삭제
    await deleteDoc(doc(db, 'surveyTopics', topicId));
  } catch (error) {
    console.error('설문 주제 삭제 실패:', error);
    throw error;
  }
}

/**
 * 새 설문 항목 생성
 */
export async function createSurveyItem(itemData: Omit<any, 'id' | 'createdAt'>) {
  try {
    const docRef = await addDoc(collection(db, 'surveyItems'), {
      ...itemData,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error('설문 항목 생성 실패:', error);
    throw error;
  }
}

/**
 * 특정 주제의 설문 항목들 가져오기
 */
export async function getSurveyItems(topicId: string) {
  try {
    // orderBy 제거 - 인덱스 불필요하도록
    const q = query(
      collection(db, 'surveyItems'),
      where('topicId', '==', topicId)
    );
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    }));

    // 클라이언트에서 order 기준으로 정렬
    return items.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  } catch (error) {
    console.error('설문 항목 목록 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 사용자의 모든 설문 항목들 가져오기 (주제 없이)
 */
export async function getAllSurveyItemsByUser(userId: string) {
  try {
    // orderBy 제거 - 인덱스 불필요하도록
    const q = query(
      collection(db, 'surveyItems'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    }));

    // 클라이언트에서 order 기준으로 정렬
    return items.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  } catch (error) {
    console.error('설문 항목 목록 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 설문 항목 수정
 */
export async function updateSurveyItem(itemId: string, itemData: any) {
  try {
    const itemRef = doc(db, 'surveyItems', itemId);
    await updateDoc(itemRef, {
      ...itemData,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('설문 항목 수정 실패:', error);
    throw error;
  }
}

/**
 * 설문 항목 삭제
 */
export async function deleteSurveyItem(itemId: string) {
  try {
    await deleteDoc(doc(db, 'surveyItems', itemId));
  } catch (error) {
    console.error('설문 항목 삭제 실패:', error);
    throw error;
  }
}

// ===== 사용자 설정 관련 함수 =====

/**
 * 사용자의 학교 이름 저장
 */
export async function saveUserSchoolName(userId: string, schoolName: string): Promise<void> {
  try {
    console.log('🔵 학교 이름 저장 시작 - userId:', userId, ', schoolName:', schoolName);
    const q = query(
      collection(db, 'userSettings'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // 기존 설정 업데이트
      const docRef = querySnapshot.docs[0].ref;
      console.log('🔵 기존 설정 업데이트 중... docId:', querySnapshot.docs[0].id);
      await updateDoc(docRef, {
        schoolName,
        updatedAt: serverTimestamp(),
      });
      console.log('✅ 기존 설정 업데이트 완료');
    } else {
      // 새 설정 생성
      console.log('🔵 새 설정 생성 중...');
      const docRef = await addDoc(collection(db, 'userSettings'), {
        userId,
        schoolName,
        createdAt: serverTimestamp(),
      });
      console.log('✅ 새 설정 생성 완료, docId:', docRef.id);
    }
    console.log('✅ 학교 이름 저장 완료:', schoolName);
  } catch (error) {
    console.error('❌ 학교 이름 저장 실패:', error);
    throw error;
  }
}

/**
 * 사용자의 학교 이름 가져오기
 */
export async function getUserSchoolName(userId: string): Promise<string | null> {
  try {
    console.log('🔍 학교 이름 조회 시작 - userId:', userId);
    const q = query(
      collection(db, 'userSettings'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('⚠️ 저장된 학교 이름 없음');
      return null;
    }

    const schoolName = querySnapshot.docs[0].data().schoolName || null;
    console.log('✅ 학교 이름 조회 완료:', schoolName);
    return schoolName;
  } catch (error) {
    console.error('❌ 학교 이름 가져오기 실패:', error);
    return null;
  }
}

// ===== 설문 시트 관련 함수 =====

/**
 * 사용자의 설문 결과 시트 정보 가져오기
 */
export async function getUserSurveySheet(userId: string): Promise<{ sheetId: string; sheetUrl: string } | null> {
  try {
    const q = query(
      collection(db, 'userSurveySheets'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      sheetId: doc.data().sheetId,
      sheetUrl: doc.data().sheetUrl,
    };
  } catch (error) {
    console.error('설문 시트 정보 가져오기 실패:', error);
    return null;
  }
}

/**
 * 사용자의 설문 결과 시트 정보 저장
 */
export async function setUserSurveySheet(
  userId: string,
  sheetId: string,
  sheetUrl: string
): Promise<void> {
  try {
    // 기존 설문 시트가 있는지 확인
    const existing = await getUserSurveySheet(userId);

    if (existing) {
      // 기존 문서 업데이트
      const q = query(
        collection(db, 'userSurveySheets'),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      const docRef = querySnapshot.docs[0].ref;

      await updateDoc(docRef, {
        sheetId,
        sheetUrl,
        updatedAt: serverTimestamp(),
      });
    } else {
      // 새 문서 생성
      await addDoc(collection(db, 'userSurveySheets'), {
        userId,
        sheetId,
        sheetUrl,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('설문 시트 정보 저장 실패:', error);
    throw error;
  }
}

/**
 * 사용자의 설문 결과 시트 정보 삭제
 */
export async function deleteUserSurveySheet(userId: string): Promise<void> {
  try {
    const q = query(
      collection(db, 'userSurveySheets'),
      where('userId', '==', userId)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docRef = querySnapshot.docs[0].ref;
      await deleteDoc(docRef);
      console.log('설문 시트 정보 삭제 완료');
    }
  } catch (error) {
    console.error('설문 시트 정보 삭제 실패:', error);
    throw error;
  }
}
