<?php
/**
 * Usage Example: Configurable Pipeline Templates
 * 
 * Demonstrates how to use different pipeline types for various industries.
 */

require_once __DIR__ . '/MetaCapiService.php';
require_once __DIR__ . '/PipelineConfig.php';
require_once __DIR__ . '/PipelineEventManager.php';

use Athena\MetaCapi\MetaCapiService;
use Athena\MetaCapi\PipelineConfig;
use Athena\MetaCapi\PipelineEventManager;

// Load configuration
$config = require __DIR__ . '/config.php';

// Initialize database connection
try {
    $db = new PDO(
        sprintf('pgsql:host=%s;dbname=%s', $config['database']['host'], $config['database']['name']),
        $config['database']['user'],
        $config['database']['password'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    die("Database connection failed: " . $e->getMessage());
}

$capiService = new MetaCapiService($config);

// ============================================================
// SHOW ALL AVAILABLE PIPELINE TYPES
// ============================================================
echo "=== Available Pipeline Types ===\n\n";

foreach (PipelineConfig::getAvailableTypes() as $key => $info) {
    echo "📋 {$key}: {$info['name']}\n";
    echo "   {$info['description']}\n";
    echo "   Stages: " . implode(' → ', array_map('ucwords', str_replace('_', ' ', $info['stages']))) . "\n\n";
}

// ============================================================
// EXAMPLE 1: UNIVERSAL DEFAULT
// ============================================================
echo "\n=== Example 1: Universal Default ===\n";

$universalManager = new PipelineEventManager($capiService, $db, 'universal', 'PHP');

// Show event summary
echo "Event configuration:\n";
foreach ($universalManager->getPipelineConfig()->getEventSummary() as $stage => $info) {
    $status = $info['fires'] ? "✅ {$info['event']}" : "❌ None";
    echo "  {$info['stage']}: $status\n";
}

// Test stages
echo "\nNew Lead → ";
print_r($universalManager->onStageChange('lead_001', 'new_lead', ['email' => 'test@test.com']));

echo "Qualified → ";
print_r($universalManager->onStageChange('lead_001', 'qualified', ['email' => 'test@test.com']));

echo "Converted with value → ";
print_r($universalManager->onStageChange('lead_001', 'converted', ['email' => 'test@test.com', 'value' => 5000]));

// ============================================================
// EXAMPLE 2: APPOINTMENT-BASED BUSINESS
// ============================================================
echo "\n=== Example 2: Appointment Business ===\n";

$appointmentManager = new PipelineEventManager($capiService, $db, 'appointment', 'PHP');

echo "Event configuration:\n";
foreach ($appointmentManager->getPipelineConfig()->getEventSummary() as $stage => $info) {
    $status = $info['fires'] ? "✅ {$info['event']}" : "❌ None";
    echo "  {$info['stage']}: $status\n";
}

echo "\nQualified → ";
print_r($appointmentManager->onStageChange('lead_002', 'qualified', ['email' => 'clinic@test.com']));

echo "Appointment Set → ";
print_r($appointmentManager->onStageChange('lead_002', 'appointment_set', ['email' => 'clinic@test.com']));

echo "Converted (no value needed) → ";
print_r($appointmentManager->onStageChange('lead_002', 'converted', ['email' => 'clinic@test.com']));

// ============================================================
// EXAMPLE 3: EDUCATION / ENROLLMENT
// ============================================================
echo "\n=== Example 3: Education Business ===\n";

$educationManager = new PipelineEventManager($capiService, $db, 'education', 'PHP');

echo "Event configuration:\n";
foreach ($educationManager->getPipelineConfig()->getEventSummary() as $stage => $info) {
    $status = $info['fires'] ? "✅ {$info['event']}" : "❌ None";
    echo "  {$info['stage']}: $status\n";
}

echo "\nEnrolled → ";
print_r($educationManager->onStageChange('lead_003', 'enrolled', ['email' => 'student@uni.edu']));

// ============================================================
// EXAMPLE 4: HIGH-TICKET / LONG SALES CYCLE
// ============================================================
echo "\n=== Example 4: High-Ticket Business ===\n";

$highTicketManager = new PipelineEventManager($capiService, $db, 'high_ticket', 'PHP');

echo "Event configuration:\n";
foreach ($highTicketManager->getPipelineConfig()->getEventSummary() as $stage => $info) {
    $status = $info['fires'] ? "✅ {$info['event']}" : "❌ None";
    echo "  {$info['stage']}: $status\n";
}

// Simulate long sales cycle
echo "\nProposal sent (no event) → ";
print_r($highTicketManager->onStageChange('lead_004', 'proposal_sent', ['email' => 'bigdeal@corp.com']));

echo "Converted deferred (waiting for value) → ";
print_r($highTicketManager->onStageChange('lead_004', 'converted', ['email' => 'bigdeal@corp.com']));

// Weeks later...
echo "Value confirmed → ";
print_r($highTicketManager->onValueConfirmed('lead_004', 250000.00, 'PHP', ['email' => 'bigdeal@corp.com']));

// ============================================================
// EXAMPLE 5: SWITCHING PIPELINE TYPE AT RUNTIME
// ============================================================
echo "\n=== Example 5: Switch Pipeline at Runtime ===\n";

$manager = new PipelineEventManager($capiService, $db, 'universal');
echo "Current: " . $manager->getPipelineConfig()->getName() . "\n";

$manager->setPipelineType('ecommerce');
echo "Switched to: " . $manager->getPipelineConfig()->getName() . "\n";

echo "\n=== All examples complete ===\n";
