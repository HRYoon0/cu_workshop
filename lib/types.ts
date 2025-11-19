// 퀴즈 관련 타입
export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  timeLimit: number; // 초 단위 (기본 10초)
  imageUrl?: string; // 이미지 URL (선택사항)
}

export interface Quiz {
  id: string;
  title: string;
  questions: QuizQuestion[]; // 여러 개의 질문
  createdAt: Date;
}

export interface QuizSession {
  id: string;
  quizId: string;
  status: 'waiting' | 'active' | 'finished';
  currentQuestionIndex?: number;
  startTime?: Date;
  endTime?: Date;
  participants: Participant[];
  answers: QuizAnswer[];
}

export interface QuizAnswer {
  participantId: string;
  participantName: string;
  questionIndex: number; // 문제 번호
  answer: number;
  isCorrect: boolean;
  timestamp: Date;
  responseTime: number; // 밀리초 단위
}

// 설문 관련 타입

// 설문 주제 (큰 제목)
export interface SurveyTopic {
  id: string;
  title: string; // 주제 제목 (예: "내년도 교육과정 방향성")
  userId: string;
  createdAt: Date;
}

// 개별 설문 항목
export interface SurveyItem {
  id: string;
  topicId: string; // 어떤 주제에 속하는지
  question: string; // 질문 내용
  type: 'multiple' | 'text'; // 선다형 또는 서술형
  options?: string[]; // 선다형인 경우 선택지들
  allowOther?: boolean; // 선다형에서 "기타" 단답형 허용 여부
  studentResultImageUrl?: string; // 학생 설문 결과 이미지 URL (선택사항)
  parentResultImageUrl?: string; // 학부모 설문 결과 이미지 URL (선택사항)
  order: number; // 정렬 순서
  createdAt: Date;
}

// 기존 Survey 타입 (하위 호환성 유지)
export interface Survey {
  id: string;
  title: string;
  question: string;
  type: 'scale' | 'text';
  timeLimit: number; // 초 단위 (기본 60초)
  imageUrl?: string; // 이미지 URL (선택사항)
  studentResultImageUrl?: string; // 학생 설문 결과 이미지 URL
  parentResultImageUrl?: string; // 학부모 설문 결과 이미지 URL
  studentResultData?: { // 학생 설문 결과 데이터
    stronglyAgree: number;
    agree: number;
    neutral: number;
    disagree: number;
    stronglyDisagree: number;
  };
  parentResultData?: { // 학부모 설문 결과 데이터
    stronglyAgree: number;
    agree: number;
    neutral: number;
    disagree: number;
    stronglyDisagree: number;
  };
  createdAt: Date;
}

export interface SurveySession {
  id: string;
  surveyId: string;
  status: 'waiting' | 'active' | 'finished';
  startTime?: Date;
  endTime?: Date;
  participants: Participant[];
  responses: SurveyResponse[]; // 레거시: 곧 제거 예정

  // Firebase 용량 절약을 위한 통계 데이터 (구글 시트에는 전체 내용 저장)
  responseCount?: number; // 총 응답 수
  statistics?: {
    optionCounts?: { [optionIndex: string]: number }; // 선다형: 선택지별 카운트
    otherTexts?: string[]; // 기타 의견들
    textResponses?: string[]; // 서술형 응답들
  };
}

export interface SurveyResponse {
  participantId: string;
  answer: number | string; // multiple: number (index), text: string, other: 'other'
  otherText?: string; // used when answer === 'other'
  timestamp?: Date;
  // Legacy fields for backward compatibility
  participantName?: string;
  scaleValue?: number; // -2 ~ +2
  textValue?: string;
}

// 참여자 타입
export interface Participant {
  id: string;
  nickname: string;
  score?: number;
  joinedAt: Date;
  lastActiveAt: Date;
}

// 세션 타입 (퀴즈 + 설문 통합)
export type Session = QuizSession | SurveySession;

// 통계 타입
export interface QuizStats {
  totalParticipants: number;
  correctAnswers: number;
  averageResponseTime: number;
  fastestResponse: QuizAnswer | null;
  answerDistribution: { [key: number]: number };
}

export interface SurveyStats {
  totalResponses: number;
  scaleDistribution: {
    stronglyAgree: number;    // +2
    agree: number;            // +1
    neutral: number;          // 0
    disagree: number;         // -1
    stronglyDisagree: number; // -2
  };
  averageScore: number;
  textResponses: string[];
}

// 사용자 관련 타입
export interface PendingUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Date;
}

export interface ApprovedUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  approvedAt: Date;
  approvedBy: string; // 승인한 관리자의 UID
}

// 사용자별 시트 정보
export interface UserSheet {
  userId: string;
  sheetId: string; // Google Sheets 파일 ID
  sheetUrl: string; // Google Sheets URL
  webAppUrl: string | null; // Apps Script 웹 앱 URL (배포 후)
  createdAt: Date;
  templateId: string; // 원본 템플릿 시트 ID
}

// 논의 자료 (업무) 관련 타입
export interface Department {
  id: string;
  name: string; // 부서 이름 (예: "교육과정", "생활지도", "방과후")
  order: number; // 정렬 순서
  createdAt: Date;
  userId: string; // 생성한 사용자 ID
}

// 논의 및 결정사항 데이터
export interface DiscussionItem {
  id?: string;
  topic: string; // 논의할 점
  gradeOrDept: string; // 학년, 업무
  process: string; // 논의 과정
  decision: string; // 결정 사항
  row?: number; // Google Sheets 행 번호
}
