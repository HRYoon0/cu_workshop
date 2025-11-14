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
export interface Survey {
  id: string;
  title: string;
  question: string;
  type: 'scale' | 'text';
  timeLimit: number; // 초 단위 (기본 60초)
  imageUrl?: string; // 이미지 URL (선택사항)
  createdAt: Date;
}

export interface SurveySession {
  id: string;
  surveyId: string;
  status: 'waiting' | 'active' | 'finished';
  startTime?: Date;
  endTime?: Date;
  participants: Participant[];
  responses: SurveyResponse[];
}

export interface SurveyResponse {
  participantId: string;
  participantName: string;
  scaleValue?: number; // -2 ~ +2
  textValue?: string;
  timestamp: Date;
}

// 참여자 타입
export interface Participant {
  id: string;
  nickname: string;
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
