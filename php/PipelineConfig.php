<?php
/**
 * Pipeline Configuration Templates
 * 
 * Defines different pipeline types for various industries with:
 * - Custom stages
 * - Event rules per stage
 * - Industry-specific settings
 * 
 * SUPPORTED PIPELINE TYPES:
 * 1. universal     - Default for most businesses
 * 2. appointment   - Doctors, clinics, test drives, consultations
 * 3. high_ticket   - Real estate, solar, B2B services
 * 4. education     - Courses, universities, bootcamps
 * 5. ecommerce     - WhatsApp checkout, manual invoicing
 */

declare(strict_types=1);

namespace Athena\MetaCapi;

class PipelineConfig
{
    /**
     * All available pipeline templates
     */
    public const TEMPLATES = [
        'universal' => [
            'name' => 'Universal Default',
            'description' => 'Standard pipeline for most industries',
            'stages' => ['new_lead', 'contacted', 'qualified', 'converted', 'lost'],
            'events' => [
                'new_lead' => null,                    // ❌ No event
                'contacted' => null,                    // ❌ No event
                'qualified' => 'Lead',                  // ✅ QualifiedLead
                'converted' => 'Purchase',              // ✅ Purchase (when value known)
                'lost' => null,                    // ❌ No event
            ],
            'require_value_for_converted' => true,       // Only send Purchase if value > 0
        ],

        'appointment' => [
            'name' => 'Appointment-Only Business',
            'description' => 'Doctors, clinics, test drives, consultations - no upfront payment',
            'stages' => ['new_lead', 'contacted', 'qualified', 'appointment_set', 'converted', 'lost'],
            'events' => [
                'new_lead' => null,               // ❌ No event
                'contacted' => null,               // ❌ No event
                'qualified' => 'Lead',             // ✅ QualifiedLead
                'appointment_set' => 'Schedule',         // ⚠️ Optional Schedule
                'converted' => null,               // ❌ No event (no revenue)
                'lost' => null,               // ❌ No event
            ],
            'require_value_for_converted' => false,      // No Purchase needed
            'optimize_for' => 'Lead',                    // Recommend optimizing for QualifiedLead
        ],

        'high_ticket' => [
            'name' => 'High-Ticket / Long Sales Cycle',
            'description' => 'Real estate, solar, B2B services - deal may close weeks later',
            'stages' => ['new_lead', 'contacted', 'qualified', 'proposal_sent', 'converted', 'lost'],
            'events' => [
                'new_lead' => null,                 // ❌ No event
                'contacted' => null,                 // ❌ No event
                'qualified' => 'Lead',               // ✅ QualifiedLead
                'proposal_sent' => null,                 // ❌ No event (internal tracking)
                'converted' => 'Purchase',           // ✅ Purchase (when value known)
                'lost' => null,                 // ❌ No event
            ],
            'require_value_for_converted' => true,
            'allow_backdated' => true,                   // Purchase may come weeks later
        ],

        'education' => [
            'name' => 'Education / Coaching / Enrollment',
            'description' => 'Courses, universities, bootcamps',
            'stages' => ['new_lead', 'contacted', 'qualified', 'enrolled', 'converted', 'lost'],
            'events' => [
                'new_lead' => null,                    // ❌ No event
                'contacted' => null,                    // ❌ No event
                'qualified' => 'Lead',                  // ✅ QualifiedLead
                'enrolled' => 'CompleteRegistration',  // ⚠️ Optional CompleteRegistration
                'converted' => 'Purchase',              // ✅ Purchase (when paid)
                'lost' => null,                    // ❌ No event
            ],
            'require_value_for_converted' => true,
        ],

        'ecommerce' => [
            'name' => 'Ecommerce-like (Human Assisted)',
            'description' => 'WhatsApp checkout, manual invoicing',
            'stages' => ['new_lead', 'qualified', 'payment_pending', 'converted', 'lost'],
            'events' => [
                'new_lead' => null,               // ❌ No event
                'qualified' => 'Lead',             // ✅ QualifiedLead
                'payment_pending' => null,               // ❌ No event
                'converted' => 'Purchase',         // ✅ Purchase
                'lost' => null,               // ❌ No event
            ],
            'require_value_for_converted' => true,
        ],
    ];

    private string $type;
    private array $config;

    public function __construct(string $pipelineType = 'universal')
    {
        if (!isset(self::TEMPLATES[$pipelineType])) {
            throw new \InvalidArgumentException(
                "Unknown pipeline type: {$pipelineType}. Available: " . implode(', ', array_keys(self::TEMPLATES))
            );
        }

        $this->type = $pipelineType;
        $this->config = self::TEMPLATES[$pipelineType];
    }

    /**
     * Get pipeline type
     */
    public function getType(): string
    {
        return $this->type;
    }

    /**
     * Get pipeline name
     */
    public function getName(): string
    {
        return $this->config['name'];
    }

    /**
     * Get pipeline description
     */
    public function getDescription(): string
    {
        return $this->config['description'];
    }

    /**
     * Get all stages for this pipeline
     */
    public function getStages(): array
    {
        return $this->config['stages'];
    }

    /**
     * Get Meta event name for a stage (null = no event)
     */
    public function getEventForStage(string $stage): ?string
    {
        $stage = strtolower(trim($stage));
        return $this->config['events'][$stage] ?? null;
    }

    /**
     * Check if a stage exists in this pipeline
     */
    public function hasStage(string $stage): bool
    {
        return in_array(strtolower(trim($stage)), $this->config['stages'], true);
    }

    /**
     * Check if converted stage requires value > 0 to fire Purchase
     */
    public function requiresValueForConverted(): bool
    {
        return $this->config['require_value_for_converted'] ?? true;
    }

    /**
     * Check if this pipeline allows backdated events
     */
    public function allowsBackdated(): bool
    {
        return $this->config['allow_backdated'] ?? true;
    }

    /**
     * Get recommended optimization event
     */
    public function getOptimizeFor(): string
    {
        return $this->config['optimize_for'] ?? 'Purchase';
    }

    /**
     * Get all available pipeline types
     */
    public static function getAvailableTypes(): array
    {
        $types = [];
        foreach (self::TEMPLATES as $key => $template) {
            $types[$key] = [
                'name' => $template['name'],
                'description' => $template['description'],
                'stages' => $template['stages'],
            ];
        }
        return $types;
    }

    /**
     * Get event summary table for display
     */
    public function getEventSummary(): array
    {
        $summary = [];
        foreach ($this->config['stages'] as $stage) {
            $event = $this->config['events'][$stage] ?? null;
            $summary[$stage] = [
                'stage' => ucwords(str_replace('_', ' ', $stage)),
                'event' => $event,
                'fires' => $event !== null,
                'note' => $this->getStageNote($stage),
            ];
        }
        return $summary;
    }

    private function getStageNote(string $stage): string
    {
        $event = $this->config['events'][$stage] ?? null;

        if ($event === null) {
            return 'No Meta event';
        }

        if ($stage === 'converted' && $this->requiresValueForConverted()) {
            return 'Only when value > 0 confirmed';
        }

        if (in_array($event, ['Schedule', 'CompleteRegistration'])) {
            return 'Optional event';
        }

        return 'Fires once per lead';
    }
}
