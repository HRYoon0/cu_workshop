'use client';

import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { QuizStats, SurveyStats } from '@/lib/types';
import { getScaleLabel, getScoreColor, getAccuracyGrade } from '@/lib/stats';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

interface QuizResultChartProps {
  stats: QuizStats;
  options: string[];
  correctAnswer: number;
}

export function QuizResultChart({ stats, options, correctAnswer }: QuizResultChartProps) {
  // 차트 데이터 준비
  const chartData = options.map((option, index) => ({
    name: `${index + 1}. ${option.substring(0, 15)}${option.length > 15 ? '...' : ''}`,
    count: stats.answerDistribution[index] || 0,
    isCorrect: index === correctAnswer,
  }));

  const accuracy = stats.totalParticipants > 0
    ? (stats.correctAnswers / stats.totalParticipants) * 100
    : 0;

  const grade = getAccuracyGrade(accuracy);

  return (
    <div className="space-y-6">
      {/* 주요 지표 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{stats.totalParticipants}</div>
          <div className="text-sm text-gray-600 mt-1">총 참여자</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.correctAnswers}</div>
          <div className="text-sm text-gray-600 mt-1">정답자</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-4 text-center">
          <div className={`text-3xl font-bold ${grade.color}`}>
            {accuracy.toFixed(0)}% ({grade.grade})
          </div>
          <div className="text-sm text-gray-600 mt-1">정답률</div>
        </div>
      </div>

      {/* 답변 분포 바 차트 */}
      <div className="bg-white rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">답변 분포</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#3B82F6" name="응답 수">
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.isCorrect ? '#10B981' : '#3B82F6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 빠른 정답자 */}
      {stats.fastestResponse && (
        <div className="bg-yellow-50 rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">🏆 가장 빠른 정답자</h3>
          <div className="flex items-center justify-between bg-white rounded-lg p-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                <span className="text-2xl">👑</span>
              </div>
              <div>
                <div className="font-bold text-gray-800 text-lg">
                  {stats.fastestResponse.participantName}
                </div>
                <div className="text-sm text-gray-600">
                  응답 시간: {(stats.fastestResponse.responseTime / 1000).toFixed(2)}초
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 평균 응답 시간 */}
      <div className="bg-gray-50 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-gray-800">
          {(stats.averageResponseTime / 1000).toFixed(2)}초
        </div>
        <div className="text-sm text-gray-600 mt-1">평균 응답 시간</div>
      </div>
    </div>
  );
}

interface SurveyResultChartProps {
  stats: SurveyStats;
}

export function SurveyResultChart({ stats }: SurveyResultChartProps) {
  // 파이 차트 데이터
  const pieData = [
    { name: '적극 찬성', value: stats.scaleDistribution.stronglyAgree, score: 2 },
    { name: '찬성', value: stats.scaleDistribution.agree, score: 1 },
    { name: '보통', value: stats.scaleDistribution.neutral, score: 0 },
    { name: '반대', value: stats.scaleDistribution.disagree, score: -1 },
    { name: '적극 반대', value: stats.scaleDistribution.stronglyDisagree, score: -2 },
  ].filter(item => item.value > 0);

  const PIE_COLORS = ['#10B981', '#34D399', '#9CA3AF', '#FB923C', '#EF4444'];

  const scoreColor = getScoreColor(stats.averageScore);

  return (
    <div className="space-y-6">
      {/* 주요 지표 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{stats.totalResponses}</div>
          <div className="text-sm text-gray-600 mt-1">총 응답 수</div>
        </div>
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 text-center">
          <div className={`text-3xl font-bold ${scoreColor}`}>
            {stats.averageScore.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600 mt-1">평균 점수 (-2 ~ +2)</div>
        </div>
      </div>

      {/* 척도 분포 파이 차트 */}
      <div className="bg-white rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">척도 분포</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* 상세 척도 분포 */}
      <div className="bg-white rounded-xl p-6">
        <h3 className="text-lg font-bold text-gray-800 mb-4">상세 분포</h3>
        <div className="space-y-3">
          {[
            { label: '적극 찬성 (+2)', count: stats.scaleDistribution.stronglyAgree, color: 'bg-green-500' },
            { label: '찬성 (+1)', count: stats.scaleDistribution.agree, color: 'bg-green-400' },
            { label: '보통 (0)', count: stats.scaleDistribution.neutral, color: 'bg-gray-400' },
            { label: '반대 (-1)', count: stats.scaleDistribution.disagree, color: 'bg-orange-500' },
            { label: '적극 반대 (-2)', count: stats.scaleDistribution.stronglyDisagree, color: 'bg-red-500' },
          ].map((item, index) => {
            const percentage = stats.totalResponses > 0
              ? (item.count / stats.totalResponses) * 100
              : 0;

            return (
              <div key={index}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  <span className="text-sm font-bold text-gray-800">
                    {item.count}명 ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${item.color}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 서술형 응답 */}
      {stats.textResponses.length > 0 && (
        <div className="bg-white rounded-xl p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            기타 의견 ({stats.textResponses.length}개)
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {stats.textResponses.map((text, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{index + 1}</span>
                  </div>
                  <p className="text-gray-700 flex-1">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
