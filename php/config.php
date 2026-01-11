<?php
/**
 * Meta Conversions API Configuration
 * 
 * Configure your Meta API credentials here.
 * Get these from Meta Business Manager → Events Manager → Settings
 */

return [
    // Meta Pixel ID (used for offline events identification)
    'pixel_id' => getenv('META_PIXEL_ID') ?: 'YOUR_PIXEL_ID',
    
    // System User Access Token with ads_management permission
    'access_token' => getenv('META_ACCESS_TOKEN') ?: 'YOUR_ACCESS_TOKEN',
    
    // Offline Event Set ID (create in Events Manager → Offline Events)
    'offline_event_set_id' => getenv('META_OFFLINE_EVENT_SET_ID') ?: 'YOUR_OFFLINE_EVENT_SET_ID',
    
    // Graph API version
    'api_version' => 'v18.0',
    
    // API Base URL
    'api_base_url' => 'https://graph.facebook.com',
    
    // Database configuration
    'database' => [
        'host' => getenv('DB_HOST') ?: 'localhost',
        'name' => getenv('DB_NAME') ?: 'athena',
        'user' => getenv('DB_USER') ?: 'root',
        'password' => getenv('DB_PASSWORD') ?: '',
    ],
    
    // Default currency for your region
    'default_currency' => 'PHP',
    
    // Enable debug mode (logs API requests/responses)
    'debug' => getenv('META_DEBUG') === 'true',
];
