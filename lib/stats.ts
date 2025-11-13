import type { QuizAnswer, SurveyResponse, QuizStats, SurveyStats } from './types';

/**
 * 퀴즈 통계 계산
 */
export function calculateQuizStats(
  answers: QuizAnswer[],
  totalParticipants: number,
  correctAnswer: number
): QuizStats {
  const correctAnswers = answers.filter(a => a.isCorrect).length;
  const responseTimes = answers.map(a => a.responseTime);
  const averageResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  const fastestResponse = answers
    .filter(a => a.isCorrect)
    .sort((a, b) => a.responseTime - b.responseTime)[0] || null;

  // 답변 분포 계산
  const answerDistribution: { [key: number]: number } = {};
  answers.forEach(answer => {
    answerDistribution[answer.answer] = (answerDistribution[answer.answer] || 0) + 1;
  });

  return {
    totalParticipants,
    correctAnswers,
    averageResponseTime,
    fastestResponse,
    answerDistribution,
  };
}

/**
 * 설문 통계 계산
 */
export function calculateSurveyStats(responses: SurveyResponse[]): SurveyStats {
  const scaleDistribution = {
    stronglyAgree: 0,    // +2
    agree: 0,            // +1
    neutral: 0,          // 0
    disagree: 0,         // -1
    stronglyDisagree: 0, // -2
  };

  let totalScore = 0;
  const textResponses: string[] = [];

  responses.forEach(response => {
    if (response.scaleValue !== undefined) {
      totalScore += response.scaleValue;

      switch (response.scaleValue) {
        case 2:
          scaleDistribution.stronglyAgree++;
          break;
        case 1:
          scaleDistribution.agree++;
          break;
        case 0:
          scaleDistribution.neutral++;
          break;
        case -1:
          scaleDistribution.disagree++;
          break;
        case -2:
          scaleDistribution.stronglyDisagree++;
          break;
      }
    }

    if (response.textValue) {
      textResponses.push(response.textValue);
    }
  });

  const scaleResponseCount = Object.values(scaleDistribution).reduce((a, b) => a + b, 0);
  const averageScore = scaleResponseCount > 0 ? totalScore / scaleResponseCount : 0;

  return {
    totalResponses: responses.length,
    scaleDistribution,
    averageScore,
    textResponses,
  };
}

/**
 * 척도 값을 레이블로 변환
 */
export function getScaleLabel(value: number): string {
  switch (value) {
    case 2:
      return '적극 찬성';
    case 1:
      return '찬성';
    case 0:
      return '보통';
    case -1:
      return '반대';
    case -2:
      return '적극 반대';
    default:
      return '알 수 없음';
  }
}

/**
 * 점수 색상 가져오기
 */
export function getScoreColor(score: number): string {
  if (score >= 1.5) return 'text-green-600';
  if (score >= 0.5) return 'text-green-500';
  if (score >= -0.5) return 'text-gray-600';
  if (score >= -1.5) return 'text-orange-500';
  return 'text-red-600';
}

/**
 * 정답률 등급 가져오기
 */
export function getAccuracyGrade(percentage: number): { grade: string; color: string } {
  if (percentage >= 90) return { grade: 'A+', color: 'text-green-600' };
  if (percentage >= 80) return { grade: 'A', color: 'text-green-500' };
  if (percentage >= 70) return { grade: 'B', color: 'text-blue-500' };
  if (percentage >= 60) return { grade: 'C', color: 'text-yellow-600' };
  if (percentage >= 50) return { grade: 'D', color: 'text-orange-500' };
  return { grade: 'F', color: 'text-red-600' };
}
