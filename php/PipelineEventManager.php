<?php
/**
 * Pipeline Event Manager (Configurable Version)
 * 
 * Handles CRM pipeline stage changes with configurable templates:
 * - universal     (default)
 * - appointment   (no upfront payment)
 * - high_ticket   (long sales cycle)
 * - education     (enrollment-based)
 * - ecommerce     (human-assisted checkout)
 * 
 * Each template defines which stages trigger Meta events.
 */

declare(strict_types=1);

namespace Athena\MetaCapi;

require_once __DIR__ . '/MetaCapiService.php';
require_once __DIR__ . '/PipelineConfig.php';

class PipelineEventManager
{
    private MetaCapiService $capiService;
    private \PDO $db;
    private PipelineConfig $pipelineConfig;
    private string $defaultCurrency;

    public function __construct(
        MetaCapiService $capiService,
        \PDO $db,
        string $pipelineType = 'universal',
        string $defaultCurrency = 'PHP'
    ) {
        $this->capiService = $capiService;
        $this->db = $db;
        $this->pipelineConfig = new PipelineConfig($pipelineType);
        $this->defaultCurrency = $defaultCurrency;
    }

    /**
     * Get current pipeline configuration
     */
    public function getPipelineConfig(): PipelineConfig
    {
        return $this->pipelineConfig;
    }

    /**
     * Change pipeline type at runtime
     */
    public function setPipelineType(string $pipelineType): void
    {
        $this->pipelineConfig = new PipelineConfig($pipelineType);
    }

    /**
     * Handle stage change event
     * Uses configured pipeline template to determine which events to fire
     * 
     * @param string $leadId Unique lead identifier
     * @param string $newStage New pipeline stage
     * @param array $leadData Lead data including email, phone, first_name, last_name
     * @param int|null $eventTime Optional timestamp (defaults to now)
     * @return array Result with action taken
     */
    public function onStageChange(
        string $leadId,
        string $newStage,
        array $leadData,
        ?int $eventTime = null
    ): array {
        $stage = strtolower(trim($newStage));
        $eventTime = $eventTime ?? time();
        $leadData['lead_id'] = $leadId;

        // Get event type for this stage from config
        $eventName = $this->pipelineConfig->getEventForStage($stage);

        // No event configured for this stage
        if ($eventName === null) {
            return [
                'action' => 'none',
                'stage' => $stage,
                'pipeline_type' => $this->pipelineConfig->getType(),
                'reason' => 'Stage does not trigger Meta events',
            ];
        }

        // Handle based on event type
        switch ($eventName) {
            case 'Lead':
                return $this->handleLeadEvent($leadId, $leadData, $eventTime, $stage);

            case 'Purchase':
                return $this->handlePurchaseEvent($leadId, $leadData, $eventTime, $stage);

            case 'Schedule':
                return $this->handleScheduleEvent($leadId, $leadData, $eventTime, $stage);

            case 'CompleteRegistration':
                return $this->handleCompleteRegistrationEvent($leadId, $leadData, $eventTime, $stage);

            default:
                return $this->handleCustomEvent($eventName, $leadId, $leadData, $eventTime, $stage);
        }
    }

    /**
     * Handle Lead (QualifiedLead) event
     */
    private function handleLeadEvent(string $leadId, array $leadData, int $eventTime, string $stage): array
    {
        $eventType = 'Lead';
        $eventId = $this->capiService->generateEventId($leadId, $eventType);

        // Check idempotency
        if ($this->isEventAlreadySent($leadId, $eventType)) {
            return [
                'action' => 'skipped',
                'stage' => $stage,
                'event_type' => $eventType,
                'event_id' => $eventId,
                'reason' => 'Event already sent previously',
            ];
        }

        $this->createEventRecord($leadId, $eventType, $eventId, $eventTime);

        try {
            $result = $this->capiService->sendQualifiedLeadEvent($leadData, $eventTime);

            if ($result['success']) {
                $this->markEventSent($leadId, $eventType, $result['response']);
                return [
                    'action' => 'sent',
                    'stage' => $stage,
                    'event_type' => $eventType,
                    'event_id' => $eventId,
                    'meta_response' => $result['response'],
                ];
            } else {
                $this->markEventError($leadId, $eventType, $result['error']);
                return [
                    'action' => 'error',
                    'stage' => $stage,
                    'event_type' => $eventType,
                    'error' => $result['error'],
                ];
            }
        } catch (\Exception $e) {
            $this->markEventError($leadId, $eventType, $e->getMessage());
            return ['action' => 'error', 'event_type' => $eventType, 'error' => $e->getMessage()];
        }
    }

    /**
     * Handle Purchase event
     */
    private function handlePurchaseEvent(string $leadId, array $leadData, int $eventTime, string $stage): array
    {
        $eventType = 'Purchase';
        $eventId = $this->capiService->generateEventId($leadId, $eventType);

        // Check idempotency
        if ($this->isEventAlreadySent($leadId, $eventType)) {
            return [
                'action' => 'skipped',
                'stage' => $stage,
                'event_type' => $eventType,
                'reason' => 'Purchase event already sent previously',
            ];
        }

        // Extract value
        $value = $leadData['value'] ?? $leadData['conversion_value'] ?? null;
        $currency = $leadData['currency'] ?? $this->defaultCurrency;

        // Check if value required
        if ($this->pipelineConfig->requiresValueForConverted()) {
            if ($value === null || $value <= 0) {
                $this->createEventRecord($leadId, $eventType, $eventId, $eventTime, null, null, 'converted_pending_value');
                return [
                    'action' => 'deferred',
                    'stage' => $stage,
                    'event_type' => $eventType,
                    'reason' => 'Waiting for conversion value',
                    'status' => 'converted_pending_value',
                ];
            }
        }

        return $this->sendPurchaseEvent($leadId, $leadData, (float) $value, $currency, $eventTime);
    }

    /**
     * Handle Schedule event (appointment-based pipelines)
     */
    private function handleScheduleEvent(string $leadId, array $leadData, int $eventTime, string $stage): array
    {
        $eventType = 'Schedule';
        $eventId = $this->capiService->generateEventId($leadId, $eventType);

        if ($this->isEventAlreadySent($leadId, $eventType)) {
            return ['action' => 'skipped', 'stage' => $stage, 'event_type' => $eventType, 'reason' => 'Already sent'];
        }

        $this->createEventRecord($leadId, $eventType, $eventId, $eventTime);

        try {
            $result = $this->capiService->sendCustomEvent('Schedule', $leadData, $eventTime);
            if ($result['success']) {
                $this->markEventSent($leadId, $eventType, $result['response']);
                return ['action' => 'sent', 'stage' => $stage, 'event_type' => $eventType];
            }
            $this->markEventError($leadId, $eventType, $result['error'] ?? 'Unknown error');
            return ['action' => 'error', 'event_type' => $eventType, 'error' => $result['error']];
        } catch (\Exception $e) {
            $this->markEventError($leadId, $eventType, $e->getMessage());
            return ['action' => 'error', 'error' => $e->getMessage()];
        }
    }

    /**
     * Handle CompleteRegistration event (education pipelines)
     */
    private function handleCompleteRegistrationEvent(string $leadId, array $leadData, int $eventTime, string $stage): array
    {
        $eventType = 'CompleteRegistration';
        $eventId = $this->capiService->generateEventId($leadId, $eventType);

        if ($this->isEventAlreadySent($leadId, $eventType)) {
            return ['action' => 'skipped', 'stage' => $stage, 'event_type' => $eventType, 'reason' => 'Already sent'];
        }

        $this->createEventRecord($leadId, $eventType, $eventId, $eventTime);

        try {
            $result = $this->capiService->sendCustomEvent('CompleteRegistration', $leadData, $eventTime);
            if ($result['success']) {
                $this->markEventSent($leadId, $eventType, $result['response']);
                return ['action' => 'sent', 'stage' => $stage, 'event_type' => $eventType];
            }
            $this->markEventError($leadId, $eventType, $result['error'] ?? 'Unknown error');
            return ['action' => 'error', 'event_type' => $eventType, 'error' => $result['error']];
        } catch (\Exception $e) {
            $this->markEventError($leadId, $eventType, $e->getMessage());
            return ['action' => 'error', 'error' => $e->getMessage()];
        }
    }

    /**
     * Handle custom events
     */
    private function handleCustomEvent(string $eventName, string $leadId, array $leadData, int $eventTime, string $stage): array
    {
        $eventId = $this->capiService->generateEventId($leadId, $eventName);

        if ($this->isEventAlreadySent($leadId, $eventName)) {
            return ['action' => 'skipped', 'stage' => $stage, 'event_type' => $eventName, 'reason' => 'Already sent'];
        }

        $this->createEventRecord($leadId, $eventName, $eventId, $eventTime);

        try {
            $result = $this->capiService->sendCustomEvent($eventName, $leadData, $eventTime);
            if ($result['success']) {
                $this->markEventSent($leadId, $eventName, $result['response']);
                return ['action' => 'sent', 'stage' => $stage, 'event_type' => $eventName];
            }
            return ['action' => 'error', 'event_type' => $eventName, 'error' => $result['error']];
        } catch (\Exception $e) {
            return ['action' => 'error', 'error' => $e->getMessage()];
        }
    }

    /**
     * Complete deferred Purchase when value confirmed
     */
    public function onValueConfirmed(string $leadId, float $value, ?string $currency = null, array $leadData = []): array
    {
        if ($value <= 0) {
            return ['action' => 'rejected', 'reason' => 'Value must be greater than 0'];
        }

        if ($this->isEventAlreadySent($leadId, 'Purchase')) {
            return ['action' => 'skipped', 'reason' => 'Purchase already sent'];
        }

        $leadData['lead_id'] = $leadId;
        return $this->sendPurchaseEvent($leadId, $leadData, $value, $currency ?? $this->defaultCurrency, time());
    }

    /**
     * Send Purchase event
     */
    private function sendPurchaseEvent(string $leadId, array $leadData, float $value, string $currency, int $eventTime): array
    {
        $eventType = 'Purchase';
        $eventId = $this->capiService->generateEventId($leadId, $eventType);

        $record = $this->getEventRecord($leadId, $eventType);
        if (!$record) {
            $this->createEventRecord($leadId, $eventType, $eventId, $eventTime, $value, $currency);
        } else {
            $this->updateEventValue($leadId, $eventType, $value, $currency);
        }

        try {
            $result = $this->capiService->sendPurchaseEvent($leadData, $value, $currency, $eventTime);
            if ($result['success']) {
                $this->markEventSent($leadId, $eventType, $result['response']);
                return [
                    'action' => 'sent',
                    'event_type' => $eventType,
                    'event_id' => $eventId,
                    'value' => $value,
                    'currency' => $currency,
                ];
            }
            $this->markEventError($leadId, $eventType, $result['error']);
            return ['action' => 'error', 'event_type' => $eventType, 'error' => $result['error']];
        } catch (\Exception $e) {
            $this->markEventError($leadId, $eventType, $e->getMessage());
            return ['action' => 'error', 'error' => $e->getMessage()];
        }
    }

    // =====================
    // Database Operations
    // =====================

    private function isEventAlreadySent(string $leadId, string $eventType): bool
    {
        $stmt = $this->db->prepare('SELECT status FROM lead_meta_events WHERE lead_id = ? AND event_type = ?');
        $stmt->execute([$leadId, $eventType]);
        $record = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $record && $record['status'] === 'sent';
    }

    private function getEventRecord(string $leadId, string $eventType): ?array
    {
        $stmt = $this->db->prepare('SELECT * FROM lead_meta_events WHERE lead_id = ? AND event_type = ?');
        $stmt->execute([$leadId, $eventType]);
        return $stmt->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    private function createEventRecord(string $leadId, string $eventType, string $eventId, int $eventTime, ?float $value = null, ?string $currency = null, string $status = 'pending'): void
    {
        $stmt = $this->db->prepare('INSERT INTO lead_meta_events (lead_id, event_type, event_id, event_time, value, currency, status) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (lead_id, event_type) DO NOTHING');
        $stmt->execute([$leadId, $eventType, $eventId, date('Y-m-d H:i:s', $eventTime), $value, $currency, $status]);
    }

    private function updateEventValue(string $leadId, string $eventType, float $value, string $currency): void
    {
        $stmt = $this->db->prepare('UPDATE lead_meta_events SET value = ?, currency = ?, updated_at = NOW() WHERE lead_id = ? AND event_type = ? AND status != ?');
        $stmt->execute([$value, $currency, $leadId, $eventType, 'sent']);
    }

    private function markEventSent(string $leadId, string $eventType, $response): void
    {
        $stmt = $this->db->prepare('UPDATE lead_meta_events SET status = ?, sent_at = NOW(), api_response = ?, updated_at = NOW() WHERE lead_id = ? AND event_type = ?');
        $stmt->execute(['sent', json_encode($response), $leadId, $eventType]);
    }

    private function markEventError(string $leadId, string $eventType, string $error): void
    {
        $stmt = $this->db->prepare('UPDATE lead_meta_events SET status = ?, error_message = ?, updated_at = NOW() WHERE lead_id = ? AND event_type = ?');
        $stmt->execute(['error', $error, $leadId, $eventType]);
    }
}
