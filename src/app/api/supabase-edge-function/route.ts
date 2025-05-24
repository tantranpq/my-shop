// app/api/supabase-edge-function/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const EDGE_FUNCTION_URL = 'https://ivbdbwtacfchvldxvzfq.supabase.co/functions/v1/place-order'; // <-- THAY THẾ BẰNG URL THỰC TẾ CỦA BẠN

    const body = await req.json();

    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('authorization') || '',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}