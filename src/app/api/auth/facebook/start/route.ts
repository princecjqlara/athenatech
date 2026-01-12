import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const userId = request.nextUrl.searchParams.get('user_id');

    if (!userId) {
        return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const appId = process.env.FB_APP_ID;
    if (!appId) {
        return NextResponse.json({ error: 'Facebook App ID not configured' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_NGROK_URL || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const redirectUri = `${baseUrl}/api/auth/facebook/callback`;

    const scopes = [
        'ads_read',
        'ads_management',
        'pages_show_list',
        'pages_read_engagement',
        'leads_retrieval',
        'pages_manage_metadata',
        'pages_messaging',
        'pages_read_user_content',
    ].join(',');

    const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${userId}`;

    return NextResponse.redirect(oauthUrl);
}
