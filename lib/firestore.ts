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
import type { Quiz, Survey, QuizSession, SurveySession, Participant, QuizAnswer, SurveyResponse, UserSheet } from './types';
import { saveQuizResultToSheet, saveSurveyResultToSheet } from './googleSheets';

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
    const sessionRef = doc(db, 'quizSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      throw new Error('세션을 찾을 수 없습니다.');
    }

    const currentParticipants = sessionDoc.data().participants || [];

    // Firestore 배열 안에서는 serverTimestamp() 사용 불가 -> Timestamp.now() 사용
    const now = Timestamp.now();
    const participantWithTimestamp = {
      ...participant,
      joinedAt: now,
      lastActiveAt: now,
    };

    await updateDoc(sessionRef, {
      participants: [...currentParticipants, participantWithTimestamp],
    });

    console.log('참가자 추가 성공:', participant.nickname, participant.id);
  } catch (error) {
    console.error('참여자 추가 실패:', error);
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
    const sessionRef = doc(db, 'quizSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (!sessionDoc.exists()) {
      return;
    }

    const currentParticipants = sessionDoc.data().participants || [];
    const updatedParticipants = currentParticipants.map((p: Participant) => {
      if (p.id === participantId) {
        return {
          ...p,
          score: (p.score || 0) + scoreToAdd,
        };
      }
      return p;
    });

    await updateDoc(sessionRef, {
      participants: updatedParticipants,
    });
    console.log('점수 업데이트 성공:', participantId, '+', scoreToAdd, '점');
  } catch (error) {
    console.error('점수 업데이트 실패:', error);
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

      // 구글 시트에도 저장 (비동기, 에러 무시)
      if (quizTitle) {
        saveQuizResultToSheet({
          sessionId,
          quizTitle,
          participantName: answer.participantName,
          answer: answer.answer,
          isCorrect: answer.isCorrect,
          responseTime: answer.responseTime,
          timestamp: answer.timestamp || new Date(),
        }, userId).catch(err => console.log('구글 시트 저장 생략:', err));
      }
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
 * 설문 세션 생성
 */
export async function createSurveySession(surveyId: string) {
  try {
    const docRef = await addDoc(collection(db, 'surveySessions'), {
      surveyId,
      status: 'waiting',
      participants: [],
      responses: [],
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
  status: 'waiting' | 'active' | 'finished'
) {
  try {
    const sessionRef = doc(db, 'surveySessions', sessionId);
    const updateData: any = { status };

    if (status === 'active') {
      updateData.startTime = serverTimestamp();
    } else if (status === 'finished') {
      updateData.endTime = serverTimestamp();
    }

    await updateDoc(sessionRef, updateData);
  } catch (error) {
    console.error('설문 세션 상태 업데이트 실패:', error);
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
    const sessionRef = doc(db, 'surveySessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const currentResponses = sessionDoc.data().responses || [];
      // Firestore 배열 안에서는 serverTimestamp() 사용 불가 -> Timestamp.now() 사용
      await updateDoc(sessionRef, {
        responses: [...currentResponses, {
          ...response,
          timestamp: Timestamp.now(),
        }],
      });

      // 구글 시트에도 저장 (비동기, 에러 무시)
      if (surveyTitle) {
        saveSurveyResultToSheet({
          sessionId,
          surveyTitle,
          participantName: response.participantName,
          scaleValue: response.scaleValue,
          textValue: response.textValue,
          timestamp: response.timestamp || new Date(),
        }, userId).catch(err => console.log('구글 시트 저장 생략:', err));
      }
    }
  } catch (error) {
    console.error('설문 응답 제출 실패:', error);
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
    // 기존 시트 확인 (userId로)
    const q = query(collection(db, 'userSheets'), where('userId', '==', userSheetData.userId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // 이미 시트가 있으면 업데이트
      const docId = querySnapshot.docs[0].id;
      await updateDoc(doc(db, 'userSheets', docId), {
        sheetId: userSheetData.sheetId,
        sheetUrl: userSheetData.sheetUrl,
        webAppUrl: userSheetData.webAppUrl,
        templateId: userSheetData.templateId,
      });
      return docId;
    } else {
      // 없으면 새로 생성
      const docRef = await addDoc(collection(db, 'userSheets'), {
        ...userSheetData,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    }
  } catch (error) {
    console.error('사용자 시트 저장 실패:', error);
    throw error;
  }
}

/**
 * 사용자 시트 정보 가져오기
 */
export async function getUserSheet(userId: string): Promise<UserSheet | null> {
  try {
    const q = query(collection(db, 'userSheets'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    } as UserSheet;
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
