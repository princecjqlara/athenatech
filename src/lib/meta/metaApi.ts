/**
 * Meta (Facebook) Graph API Service
 * Handles OAuth, Ad Accounts, Pages, Ads, and Leads
 */

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface MetaAdAccount {
    id: string;
    account_id: string;
    name: string;
    currency: string;
    account_status: number;
    business_name?: string;
}

export interface MetaPage {
    id: string;
    name: string;
    access_token: string;
    category: string;
    picture?: { data: { url: string } };
}

export interface MetaCampaign {
    id: string;
    name: string;
    objective: string;
    status: string;
    daily_budget?: string;
    lifetime_budget?: string;
    created_time: string;
    updated_time: string;
}

export interface MetaAdSet {
    id: string;
    name: string;
    campaign_id: string;
    status: string;
    daily_budget?: string;
    lifetime_budget?: string;
    targeting?: object;
    created_time: string;
}

export interface MetaAd {
    id: string;
    name: string;
    adset_id: string;
    campaign_id: string;
    status: string;
    creative?: {
        id: string;
        thumbnail_url?: string;
        image_url?: string;
        video_id?: string;
        object_story_spec?: object;
    };
    created_time: string;
    insights?: MetaAdInsights;
}

export interface MetaAdInsights {
    spend: string;
    impressions: string;
    clicks: string;
    reach: string;
    ctr: string;
    cpc: string;
    cpm: string;
    actions?: { action_type: string; value: string }[];
    conversions?: { action_type: string; value: string }[];
    video_p25_watched_actions?: { action_type: string; value: string }[];
    video_p50_watched_actions?: { action_type: string; value: string }[];
    video_p75_watched_actions?: { action_type: string; value: string }[];
    video_p95_watched_actions?: { action_type: string; value: string }[];
    video_thruplay_watched_actions?: { action_type: string; value: string }[];
}

export interface MetaLead {
    id: string;
    created_time: string;
    field_data: { name: string; values: string[] }[];
    ad_id?: string;
    adset_id?: string;
    campaign_id?: string;
    form_id?: string;
}

export interface TokenExchangeResult {
    access_token: string;
    token_type: string;
    expires_in?: number;
}

export interface MetaApiError {
    error: {
        message: string;
        type: string;
        code: number;
        fbtrace_id: string;
    };
}

class MetaApiService {
    private appId: string;
    private appSecret: string;

    constructor() {
        this.appId = process.env.FB_APP_ID || '';
        this.appSecret = process.env.FB_APP_SECRET || '';
    }

    /**
     * Generate OAuth login URL
     */
    getLoginUrl(redirectUri: string, state?: string): string {
        const scopes = [
            'ads_read',
            'ads_management',
            'pages_show_list',
            'pages_read_engagement',
            'leads_retrieval',
            'pages_manage_metadata',
        ].join(',');

        const params = new URLSearchParams({
            client_id: this.appId,
            redirect_uri: redirectUri,
            scope: scopes,
            response_type: 'code',
            ...(state && { state }),
        });

        return `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
    }

    /**
     * Exchange OAuth code for access token
     */
    async exchangeCodeForToken(code: string, redirectUri: string): Promise<TokenExchangeResult> {
        const params = new URLSearchParams({
            client_id: this.appId,
            client_secret: this.appSecret,
            redirect_uri: redirectUri,
            code,
        });

        const response = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(`OAuth error: ${data.error.message}`);
        }

        return data;
    }

    /**
     * Exchange short-lived token for long-lived token (60 days)
     */
    async getLongLivedToken(shortLivedToken: string): Promise<TokenExchangeResult> {
        const params = new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: this.appId,
            client_secret: this.appSecret,
            fb_exchange_token: shortLivedToken,
        });

        const response = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(`Token exchange error: ${data.error.message}`);
        }

        return data;
    }

    /**
     * Get user's ad accounts
     */
    async getAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,account_id,name,currency,account_status,business_name',
        });

        const response = await fetch(`${GRAPH_API_BASE}/me/adaccounts?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(`Ad accounts error: ${data.error.message}`);
        }

        return data.data || [];
    }

    /**
     * Get user's Facebook pages
     */
    async getPages(accessToken: string): Promise<MetaPage[]> {
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,name,access_token,category,picture',
        });

        const response = await fetch(`${GRAPH_API_BASE}/me/accounts?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(`Pages error: ${data.error.message}`);
        }

        return data.data || [];
    }

    /**
     * Get all campaigns from an ad account
     */
    async getCampaigns(accessToken: string, adAccountId: string): Promise<MetaCampaign[]> {
        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,name,objective,status,daily_budget,lifetime_budget,created_time,updated_time',
            limit: '500',
        });

        const response = await fetch(`${GRAPH_API_BASE}/${accountId}/campaigns?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(`Campaigns error: ${data.error.message}`);
        }

        return data.data || [];
    }

    /**
     * Get all ad sets from an ad account
     */
    async getAdSets(accessToken: string, adAccountId: string): Promise<MetaAdSet[]> {
        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,name,campaign_id,status,daily_budget,lifetime_budget,targeting,created_time',
            limit: '500',
        });

        const response = await fetch(`${GRAPH_API_BASE}/${accountId}/adsets?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(`Ad sets error: ${data.error.message}`);
        }

        return data.data || [];
    }

    /**
     * Get all ads from an ad account with insights
     */
    async getAds(accessToken: string, adAccountId: string, datePreset: string = 'last_14d'): Promise<MetaAd[]> {
        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,name,adset_id,campaign_id,status,creative{id,thumbnail_url,image_url,video_id,object_story_spec},created_time',
            limit: '500',
        });

        const response = await fetch(`${GRAPH_API_BASE}/${accountId}/ads?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(`Ads error: ${data.error.message}`);
        }

        // Fetch insights for each ad
        const ads = data.data || [];
        const adsWithInsights = await Promise.all(
            ads.map(async (ad: MetaAd) => {
                try {
                    const insights = await this.getAdInsights(accessToken, ad.id, datePreset);
                    return { ...ad, insights: insights[0] };
                } catch {
                    return ad;
                }
            })
        );

        return adsWithInsights;
    }

    /**
     * Get insights for a specific ad
     */
    async getAdInsights(accessToken: string, adId: string, datePreset: string = 'last_14d'): Promise<MetaAdInsights[]> {
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'spend,impressions,clicks,reach,ctr,cpc,cpm,actions,conversions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p95_watched_actions,video_thruplay_watched_actions',
            date_preset: datePreset,
        });

        const response = await fetch(`${GRAPH_API_BASE}/${adId}/insights?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(`Insights error: ${data.error.message}`);
        }

        return data.data || [];
    }

    /**
     * Get lead details from a lead form submission
     */
    async getLeadDetails(accessToken: string, leadId: string): Promise<MetaLead> {
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,created_time,field_data,ad_id,adset_id,campaign_id,form_id',
        });

        const response = await fetch(`${GRAPH_API_BASE}/${leadId}?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            throw new Error(`Lead error: ${data.error.message}`);
        }

        return data;
    }

    /**
     * Subscribe page to webhook for lead notifications
     */
    async subscribePageToLeadgen(pageAccessToken: string, pageId: string): Promise<boolean> {
        const params = new URLSearchParams({
            access_token: pageAccessToken,
            subscribed_fields: 'leadgen',
        });

        const response = await fetch(`${GRAPH_API_BASE}/${pageId}/subscribed_apps?${params.toString()}`, {
            method: 'POST',
        });
        const data = await response.json();

        if (data.error) {
            throw new Error(`Subscription error: ${data.error.message}`);
        }

        return data.success === true;
    }

    /**
     * Get all lead forms for a page
     */
    async getLeadForms(accessToken: string, pageId: string): Promise<{ id: string; name: string; status: string }[]> {
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,name,status',
            limit: '100',
        });

        const url = `${GRAPH_API_BASE}/${pageId}/leadgen_forms?${params.toString()}`;
        console.log('[Meta API] Fetching lead forms from:', pageId);

        const response = await fetch(url);
        const data = await response.json();

        console.log('[Meta API] Lead forms response:', JSON.stringify(data).substring(0, 500));

        if (data.error) {
            console.warn(`[Meta API] Lead forms error for page ${pageId}:`, data.error);
            return [];
        }

        return data.data || [];
    }

    /**
     * Get leads from a lead form
     */
    async getFormLeads(accessToken: string, formId: string, limit: number = 100): Promise<MetaLead[]> {
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,created_time,field_data,ad_id,adset_id,campaign_id,form_id',
            limit: String(limit),
        });

        const response = await fetch(`${GRAPH_API_BASE}/${formId}/leads?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            console.warn(`[Meta API] Leads error for form ${formId}:`, data.error.message);
            return [];
        }

        return data.data || [];
    }

    /**
     * Get conversations from a page (Messenger contacts from ads)
     */
    async getPageConversations(accessToken: string, pageId: string, limit: number = 100): Promise<any[]> {
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,participants,updated_time,message_count,unread_count',
            limit: String(limit),
        });

        const url = `${GRAPH_API_BASE}/${pageId}/conversations?${params.toString()}`;
        console.log('[Meta API] Fetching page conversations from:', pageId);

        const response = await fetch(url);
        const data = await response.json();

        console.log('[Meta API] Conversations response:', JSON.stringify(data).substring(0, 500));

        if (data.error) {
            console.warn(`[Meta API] Conversations error for page ${pageId}:`, data.error);
            return [];
        }

        return data.data || [];
    }

    /**
     * Get participant details from a conversation
     */
    async getConversationMessages(accessToken: string, conversationId: string, limit: number = 20): Promise<any[]> {
        const params = new URLSearchParams({
            access_token: accessToken,
            fields: 'id,created_time,from,message,attachments',
            limit: String(limit),
        });

        const response = await fetch(`${GRAPH_API_BASE}/${conversationId}/messages?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            console.warn(`[Meta API] Messages error:`, data.error);
            return [];
        }

        return data.data || [];
    }

    /**
     * Validate access token
     */
    async validateToken(accessToken: string): Promise<{ valid: boolean; expiresAt?: number }> {
        const params = new URLSearchParams({
            input_token: accessToken,
            access_token: `${this.appId}|${this.appSecret}`,
        });

        const response = await fetch(`${GRAPH_API_BASE}/debug_token?${params.toString()}`);
        const data = await response.json();

        if (data.error) {
            return { valid: false };
        }

        return {
            valid: data.data?.is_valid === true,
            expiresAt: data.data?.expires_at,
        };
    }
}

// Export singleton instance
export const metaApi = new MetaApiService();
