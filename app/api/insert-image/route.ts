/**
 * Apps Script 이미지 삽입 API (CORS 우회용)
 * 클라이언트 → Next.js API Route → Apps Script
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spreadsheetId, images } = body;

    const imageInserterUrl = process.env.NEXT_PUBLIC_IMAGE_INSERTER_URL;
    if (!imageInserterUrl) {
      return NextResponse.json(
        { success: false, error: 'IMAGE_INSERTER_URL이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // Apps Script로 요청 전달 (서버 사이드에서는 CORS 제한 없음)
    const response = await fetch(imageInserterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spreadsheetId,
        images,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Apps Script 에러:', errorText);
      return NextResponse.json(
        { success: false, error: errorText },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ API Route 에러:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
