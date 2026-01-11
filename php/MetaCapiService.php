<?php
/**
 * Meta Conversions API Service
 * 
 * Handles sending Offline Events to Meta CAPI with:
 * - QualifiedLead events
 * - Purchase events (with value validation)
 * - Deterministic event_id for deduplication
 * - Proper action_source for offline/CRM events
 */

declare(strict_types=1);

namespace Athena\MetaCapi;

class MetaCapiService
{
    private string $pixelId;
    private string $accessToken;
    private string $offlineEventSetId;
    private string $apiVersion;
    private string $apiBaseUrl;
    private bool $debug;

    public function __construct(array $config)
    {
        $this->pixelId = $config['pixel_id'];
        $this->accessToken = $config['access_token'];
        $this->offlineEventSetId = $config['offline_event_set_id'];
        $this->apiVersion = $config['api_version'] ?? 'v18.0';
        $this->apiBaseUrl = $config['api_base_url'] ?? 'https://graph.facebook.com';
        $this->debug = $config['debug'] ?? false;
    }

    /**
     * Send QualifiedLead event to Meta CAPI
     * 
     * @param array $leadData Must contain: lead_id, email (optional), phone (optional)
     * @param int $eventTime Unix timestamp when lead was qualified
     * @param array $customData Optional custom attribution data
     * @return array Response with success status and event_id
     */
    public function sendQualifiedLeadEvent(array $leadData, int $eventTime, array $customData = []): array
    {
        $eventId = $this->generateEventId($leadData['lead_id'], 'QualifiedLead');

        $eventData = [
            'event_name' => 'Lead', // Standard Meta event name for qualified leads
            'event_time' => $eventTime,
            'event_id' => $eventId,
            'action_source' => 'system_generated', // CRM/offline source
            'user_data' => $this->buildUserData($leadData),
            'custom_data' => array_merge([
                'lead_event_type' => 'QualifiedLead',
                'pipeline_stage' => 'Qualified',
                'lead_id' => $leadData['lead_id'],
            ], $customData),
        ];

        return $this->sendEvent($eventData, $eventId);
    }

    /**
     * Send Purchase event to Meta CAPI
     * 
     * CRITICAL: Only call this when value > 0 is confirmed
     * Never send with 0, null, or placeholder values
     * 
     * @param array $leadData Must contain: lead_id, email (optional), phone (optional)
     * @param float $value Conversion value (must be > 0)
     * @param string $currency ISO 4217 currency code (e.g., 'PHP', 'USD')
     * @param int $eventTime Unix timestamp when value was confirmed
     * @param array $customData Optional custom attribution data
     * @return array Response with success status and event_id
     * @throws \InvalidArgumentException If value is not positive
     */
    public function sendPurchaseEvent(
        array $leadData,
        float $value,
        string $currency,
        int $eventTime,
        array $customData = []
    ): array {
        // STRICT VALIDATION: Never send Purchase with invalid value
        if ($value <= 0) {
            throw new \InvalidArgumentException(
                "Purchase event value must be greater than 0. Got: {$value}"
            );
        }

        if (empty($currency) || strlen($currency) !== 3) {
            throw new \InvalidArgumentException(
                "Purchase event currency must be a valid 3-letter ISO code. Got: {$currency}"
            );
        }

        $eventId = $this->generateEventId($leadData['lead_id'], 'Purchase');

        $eventData = [
            'event_name' => 'Purchase', // Standard Meta event name
            'event_time' => $eventTime,
            'event_id' => $eventId,
            'action_source' => 'system_generated', // CRM/offline source
            'user_data' => $this->buildUserData($leadData),
            'custom_data' => array_merge([
                'value' => $value,
                'currency' => strtoupper($currency),
                'pipeline_stage' => 'Converted',
                'lead_id' => $leadData['lead_id'],
            ], $customData),
        ];

        return $this->sendEvent($eventData, $eventId);
    }

    /**
     * Generate deterministic event_id for deduplication
     * Format: {lead_id}_{event_type_lowercase}
     */
    public function generateEventId(string $leadId, string $eventType): string
    {
        return $leadId . '_' . strtolower($eventType);
    }

    /**
     * Send custom event to Meta CAPI
     * Supports: Schedule, CompleteRegistration, and any custom event names
     * 
     * @param string $eventName Event name (Schedule, CompleteRegistration, etc.)
     * @param array $leadData Lead data for user matching
     * @param int $eventTime Unix timestamp
     * @param array $customData Optional additional data
     * @return array Response
     */
    public function sendCustomEvent(
        string $eventName,
        array $leadData,
        int $eventTime,
        array $customData = []
    ): array {
        $eventId = $this->generateEventId($leadData['lead_id'], $eventName);

        $eventData = [
            'event_name' => $eventName,
            'event_time' => $eventTime,
            'event_id' => $eventId,
            'action_source' => 'system_generated',
            'user_data' => $this->buildUserData($leadData),
            'custom_data' => array_merge([
                'lead_id' => $leadData['lead_id'],
            ], $customData),
        ];

        return $this->sendEvent($eventData, $eventId);
    }

    /**
     * Build user_data object with hashed PII for matching
     */
    private function buildUserData(array $leadData): array
    {
        $userData = [];

        // Hash email (lowercase, trimmed)
        if (!empty($leadData['email'])) {
            $userData['em'] = [hash('sha256', strtolower(trim($leadData['email'])))];
        }

        // Hash phone (digits only, with country code)
        if (!empty($leadData['phone'])) {
            $phone = preg_replace('/[^0-9]/', '', $leadData['phone']);
            $userData['ph'] = [hash('sha256', $phone)];
        }

        // Optional: external_id for cross-device matching
        if (!empty($leadData['lead_id'])) {
            $userData['external_id'] = [hash('sha256', $leadData['lead_id'])];
        }

        // Optional: first name
        if (!empty($leadData['first_name'])) {
            $userData['fn'] = [hash('sha256', strtolower(trim($leadData['first_name'])))];
        }

        // Optional: last name
        if (!empty($leadData['last_name'])) {
            $userData['ln'] = [hash('sha256', strtolower(trim($leadData['last_name'])))];
        }

        return $userData;
    }

    /**
     * Send event to Meta Graph API
     */
    private function sendEvent(array $eventData, string $eventId): array
    {
        $url = sprintf(
            '%s/%s/%s/events',
            $this->apiBaseUrl,
            $this->apiVersion,
            $this->offlineEventSetId
        );

        $payload = [
            'data' => [json_encode([$eventData])],
            'access_token' => $this->accessToken,
        ];

        if ($this->debug) {
            error_log("[MetaCAPI] Sending event: " . json_encode($eventData));
        }

        // Send HTTP request
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            return [
                'success' => false,
                'event_id' => $eventId,
                'error' => "cURL error: {$error}",
                'http_code' => 0,
            ];
        }

        $responseData = json_decode($response, true);

        if ($this->debug) {
            error_log("[MetaCAPI] Response ({$httpCode}): {$response}");
        }

        $success = $httpCode >= 200 && $httpCode < 300;

        return [
            'success' => $success,
            'event_id' => $eventId,
            'http_code' => $httpCode,
            'response' => $responseData,
            'error' => $success ? null : ($responseData['error']['message'] ?? 'Unknown error'),
        ];
    }
}
