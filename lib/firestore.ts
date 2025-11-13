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
 * 퀴즈 세션에 참여자 추가
 */
export async function addParticipantToQuizSession(sessionId: string, participant: Participant) {
  try {
    const sessionRef = doc(db, 'quizSessions', sessionId);
    const sessionDoc = await getDoc(sessionRef);

    if (sessionDoc.exists()) {
      const currentParticipants = sessionDoc.data().participants || [];
      await updateDoc(sessionRef, {
        participants: [...currentParticipants, {
          ...participant,
          joinedAt: serverTimestamp(),
        }],
      });
    }
  } catch (error) {
    console.error('참여자 추가 실패:', error);
    throw error;
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
      await updateDoc(sessionRef, {
        answers: [...currentAnswers, {
          ...answer,
          timestamp: serverTimestamp(),
        }],
      });

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
      await updateDoc(sessionRef, {
        responses: [...currentResponses, {
          ...response,
          timestamp: serverTimestamp(),
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
 * 특정 퀴즈 정보 가져오기
 */
export async function getQuiz(quizId: string) {
  try {
    const docRef = doc(db, 'quizzes', quizId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: (docSnap.data().createdAt as Timestamp)?.toDate() || new Date(),
      } as Quiz;
    }
    return null;
  } catch (error) {
    console.error('퀴즈 가져오기 실패:', error);
    throw error;
  }
}

/**
 * 특정 설문 정보 가져오기
 */
export async function getSurvey(surveyId: string) {
  try {
    const docRef = doc(db, 'surveys', surveyId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: (docSnap.data().createdAt as Timestamp)?.toDate() || new Date(),
      } as Survey;
    }
    return null;
  } catch (error) {
    console.error('설문 가져오기 실패:', error);
    throw error;
  }
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
