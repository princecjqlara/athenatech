import { NextRequest, NextResponse } from 'next/server';
import { metaApi } from '@/lib/meta/metaApi';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Facebook OAuth callback handler
 * This endpoint is called after user authorizes the app on Facebook
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // Contains user_id
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
        console.error('[Facebook OAuth] Error:', error, errorDescription);
        return NextResponse.redirect(
            new URL(`/settings?error=${encodeURIComponent(errorDescription || error)}`, request.url)
        );
    }

    // Validate required parameters
    if (!code) {
        return NextResponse.redirect(
            new URL('/settings?error=Missing%20authorization%20code', request.url)
        );
    }

    if (!state) {
        return NextResponse.redirect(
            new URL('/settings?error=Missing%20state%20parameter', request.url)
        );
    }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;
        const redirectUri = `${baseUrl}/api/auth/facebook/callback`;

        // Exchange code for access token
        const tokenResult = await metaApi.exchangeCodeForToken(code, redirectUri);
        console.log('[Facebook OAuth] Token obtained');

        // Exchange for long-lived token (60 days)
        const longLivedToken = await metaApi.getLongLivedToken(tokenResult.access_token);
        console.log('[Facebook OAuth] Long-lived token obtained');

        // Fetch ad accounts and pages
        const [adAccounts, pages] = await Promise.all([
            metaApi.getAdAccounts(longLivedToken.access_token),
            metaApi.getPages(longLivedToken.access_token),
        ]);

        console.log('[Facebook OAuth] Fetched', adAccounts.length, 'ad accounts and', pages.length, 'pages');

        // Store token temporarily in URL params for the selection modal
        // In production, you might want to store this in a secure session
        const selectionParams = new URLSearchParams({
            token: longLivedToken.access_token,
            expires_in: String(longLivedToken.expires_in || 5184000), // 60 days default
            user_id: state,
            ad_accounts: JSON.stringify(adAccounts.map(acc => ({
                id: acc.id,
                account_id: acc.account_id,
                name: acc.name,
                currency: acc.currency,
                business_name: acc.business_name,
            }))),
            pages: JSON.stringify(pages.map(page => ({
                id: page.id,
                name: page.name,
                access_token: page.access_token,
                category: page.category,
                picture: page.picture?.data?.url,
            }))),
        });

        // Redirect to settings page with selection modal open
        return NextResponse.redirect(
            new URL(`/settings?meta_connect=true&${selectionParams.toString()}`, request.url)
        );

    } catch (error) {
        console.error('[Facebook OAuth] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to connect';
        return NextResponse.redirect(
            new URL(`/settings?error=${encodeURIComponent(errorMessage)}`, request.url)
        );
    }
}

/**
 * POST handler to save selected ad account and page
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            user_id,
            access_token,
            token_expires_at,
            ad_account_id,
            ad_account_name,
            page_id,
            page_name,
            page_access_token,
        } = body;

        if (!user_id || !access_token || !ad_account_id) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Initialize Supabase client with service role
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Calculate token expiration
        const expiresAt = token_expires_at
            ? new Date(Date.now() + parseInt(token_expires_at) * 1000)
            : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days default

        // Upsert integration record
        const { data, error } = await supabase
            .from('meta_integrations')
            .upsert({
                user_id,
                access_token,
                token_expires_at: expiresAt.toISOString(),
                ad_account_id,
                page_id: page_id || null,
                is_active: true,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id',
            })
            .select()
            .single();

        if (error) {
            console.error('[Facebook OAuth] Database error:', error);
            return NextResponse.json(
                { error: 'Failed to save integration' },
                { status: 500 }
            );
        }

        // Subscribe page to leadgen webhook if page is selected
        if (page_id && page_access_token) {
            try {
                await metaApi.subscribePageToLeadgen(page_access_token, page_id);
                console.log('[Facebook OAuth] Page subscribed to leadgen webhook');
            } catch (subError) {
                console.warn('[Facebook OAuth] Failed to subscribe to leadgen:', subError);
                // Don't fail the whole request, just log the warning
            }
        }

        // Trigger initial ads import
        try {
            const importResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/meta/import-ads`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id }),
            });
            console.log('[Facebook OAuth] Initial import triggered:', importResponse.status);
        } catch (importError) {
            console.warn('[Facebook OAuth] Failed to trigger initial import:', importError);
        }

        return NextResponse.json({
            success: true,
            integration: {
                id: data.id,
                ad_account_id,
                ad_account_name,
                page_id,
                page_name,
                connected_at: data.updated_at,
            },
        });

    } catch (error) {
        console.error('[Facebook OAuth] Error saving integration:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
