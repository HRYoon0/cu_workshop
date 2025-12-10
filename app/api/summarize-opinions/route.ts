import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { opinions, discussionTopic } = await req.json();

    if (!opinions || opinions.length === 0) {
      return NextResponse.json(
        { error: '의견이 없습니다.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.');
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    console.log('=== OpenAI API 호출 시작 ===');
    console.log('논의 주제:', discussionTopic);
    console.log('의견 수:', opinions.length);

    // 의견 목록을 텍스트로 변환
    const opinionsText = opinions
      .map((op: any, idx: number) => `${idx + 1}. ${op.content}`)
      .join('\n');

    // OpenAI API 호출
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `당신은 교육과정 워크숍에서 수집된 선생님들의 의견을 정리하는 전문가입니다.
수집된 의견들을 분석하여 다음 내용을 포함한 요약을 작성해주세요:

1. **주요 의견 요약**: 어떤 내용이 가장 많이 나왔는지
2. **공통점과 차이점**: 의견들의 공통점과 차이점
3. **구체적인 제안**: 의견들을 어떻게 취합하여 적용하면 좋을지

응답은 한국어로 작성하고, 간결하고 명확하게 정리해주세요.`
          },
          {
            role: 'user',
            content: `논의 주제: ${discussionTopic}

수집된 의견:
${opinionsText}

위 의견들을 분석하여 정리해주세요.`
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ OpenAI API 오류:', errorData);
      return NextResponse.json(
        { error: 'OpenAI API 호출 실패', details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    console.log('✅ OpenAI API 응답 성공');
    console.log('요약 길이:', summary.length, '자');

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('❌ 의견 요약 API 오류:', error);
    return NextResponse.json(
      { error: '의견 요약 중 오류가 발생했습니다.', details: error.message },
      { status: 500 }
    );
  }
}
