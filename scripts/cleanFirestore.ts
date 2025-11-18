/**
 * Firestore 데이터 정리 스크립트
 *
 * 이 스크립트는 한 번만 실행하여 기존 Firestore 데이터를 정리합니다.
 * - quizSessions 모두 삭제
 * - surveySessions 모두 삭제
 * - opinionSessions 모두 삭제 (이미 종료된 것들)
 * - 오래된 userSheets 히스토리 정리 (최근 것만 유지)
 *
 * 실행 방법:
 * npx ts-node scripts/cleanFirestore.ts
 */

import * as dotenv from 'dotenv';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';

// 환경 변수 로드
dotenv.config({ path: '.env.local' });

// Firebase 설정 (환경 변수에서 가져오기)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanQuizSessions() {
  console.log('📊 퀴즈 세션 정리 시작...');
  const querySnapshot = await getDocs(collection(db, 'quizSessions'));

  const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);

  console.log(`✅ ${querySnapshot.size}개의 퀴즈 세션이 삭제되었습니다.`);
}

async function cleanSurveySessions() {
  console.log('📊 설문 세션 정리 시작...');
  const querySnapshot = await getDocs(collection(db, 'surveySessions'));

  const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);

  console.log(`✅ ${querySnapshot.size}개의 설문 세션이 삭제되었습니다.`);
}

async function cleanOpinionSessions() {
  console.log('💬 의견 수집 세션 정리 시작...');
  const querySnapshot = await getDocs(collection(db, 'opinionSessions'));

  let deletedCount = 0;
  for (const sessionDoc of querySnapshot.docs) {
    // 각 세션의 opinions 서브컬렉션도 삭제
    const opinionsSnapshot = await getDocs(collection(db, 'opinionSessions', sessionDoc.id, 'opinions'));
    const opinionDeletePromises = opinionsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(opinionDeletePromises);

    // 세션 문서 삭제
    await deleteDoc(sessionDoc.ref);
    deletedCount++;
  }

  console.log(`✅ ${deletedCount}개의 의견 수집 세션이 삭제되었습니다.`);
}

async function cleanUserSheetHistory() {
  console.log('📄 사용자 시트 히스토리 정리 시작...');
  const querySnapshot = await getDocs(collection(db, 'userSheets'));

  // userId별로 그룹화
  const sheetsByUser: { [userId: string]: Array<{ id: string; createdAt: Date }> } = {};

  querySnapshot.docs.forEach(doc => {
    const data = doc.data();
    const userId = data.userId;
    const createdAt = (data.createdAt as Timestamp)?.toDate() || new Date();

    if (!sheetsByUser[userId]) {
      sheetsByUser[userId] = [];
    }

    sheetsByUser[userId].push({ id: doc.id, createdAt });
  });

  // 각 사용자별로 최근 것만 남기고 삭제
  let totalDeleted = 0;
  for (const userId in sheetsByUser) {
    const sheets = sheetsByUser[userId];

    if (sheets.length <= 1) continue;

    // 날짜 기준 정렬
    sheets.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // 가장 최근 것 제외하고 나머지 삭제
    const deletePromises = sheets.slice(1).map(sheet =>
      deleteDoc(doc(db, 'userSheets', sheet.id))
    );

    await Promise.all(deletePromises);
    totalDeleted += deletePromises.length;
  }

  console.log(`✅ ${totalDeleted}개의 오래된 시트 히스토리가 삭제되었습니다.`);
}

async function main() {
  console.log('🧹 Firestore 데이터 정리 시작...\n');

  try {
    await cleanQuizSessions();
    await cleanSurveySessions();
    await cleanOpinionSessions();
    await cleanUserSheetHistory();

    console.log('\n✨ 모든 정리 작업이 완료되었습니다!');
    console.log('💾 Firestore 용량이 크게 절약되었습니다.');
  } catch (error) {
    console.error('❌ 정리 작업 중 오류 발생:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
