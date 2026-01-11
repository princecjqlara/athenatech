#!/usr/bin/env npx ts-node
/**
 * ATHENA Safety Checklist Runner
 * 
 * Validates all architecture safety requirements.
 * Run with: npx ts-node scripts/runSafetyChecklist.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Colors for output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

interface CheckResult {
    name: string;
    passed: boolean;
    details?: string;
}

const results: CheckResult[] = [];

function check(name: string, condition: boolean, details?: string): void {
    results.push({ name, passed: condition, details });
}

function fileExists(relativePath: string): boolean {
    const fullPath = path.join(process.cwd(), relativePath);
    return fs.existsSync(fullPath);
}

function fileContains(relativePath: string, searchTerm: string): boolean {
    const fullPath = path.join(process.cwd(), relativePath);
    if (!fs.existsSync(fullPath)) return false;
    const content = fs.readFileSync(fullPath, 'utf-8');
    return content.includes(searchTerm);
}

function searchForForbiddenTerms(): string[] {
    const forbiddenTerms = [
        'hookStrength',
        'emotionalAppeal',
        'sentiment_score',
        'face_detection',
        'persuasiveness_score',
    ];

    const violations: string[] = [];
    const srcDir = path.join(process.cwd(), 'src/lib');

    function searchDir(dir: string): void {
        if (!fs.existsSync(dir)) return;

        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.includes('__tests__')) {
                searchDir(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.ts')) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                for (const term of forbiddenTerms) {
                    if (content.toLowerCase().includes(term.toLowerCase())) {
                        violations.push(`${fullPath}: contains "${term}"`);
                    }
                }
            }
        }
    }

    searchDir(srcDir);
    return violations;
}

async function runChecks(): Promise<void> {
    console.log('\n' + '='.repeat(50));
    console.log('ATHENA Architecture Safety Checklist');
    console.log('='.repeat(50) + '\n');

    // 1. SAFETY_RULES.md exists
    check(
        'SAFETY_RULES.md exists',
        fileExists('docs/SAFETY_RULES.md'),
        'Safety policy document with forbidden patterns'
    );

    // 2. safety.ts exists
    check(
        'Safety policy module exists',
        fileExists('src/lib/policy/safety.ts'),
        'Runtime safety enforcement'
    );

    // 3. No forbidden terms in codebase
    const violations = searchForForbiddenTerms();
    check(
        'No forbidden semantic terms in src/lib',
        violations.length === 0,
        violations.length > 0 ? `Found: ${violations.slice(0, 3).join(', ')}` : undefined
    );

    // 4. Narrative eligibility requires conversions
    check(
        'Narrative eligibility checks conversions',
        fileContains('src/lib/narrativeChecklist.ts', 'NARRATIVE_MIN_CONVERSIONS'),
        'System 2 requires ≥30 conversions'
    );

    // 5. LLM prompt is constrained
    check(
        'LLM prompt constrained',
        fileContains('src/lib/narrative/llmPrompt.ts', 'FORBIDDEN'),
        'LLM prompt forbids quality judgments'
    );

    // 6. LLM validator exists
    check(
        'LLM output validator exists',
        fileContains('src/lib/policy/safety.ts', 'validateLlmOutput'),
        'Hard failure on extra keys'
    );

    // 7. Confidence penalty for LLM
    check(
        'LLM confidence penalty implemented',
        fileContains('src/lib/narrativeChecklist.ts', 'llmAssisted && !checklist.userConfirmed'),
        'Unconfirmed LLM data gets low confidence'
    );

    // 8. Conservative defaults for missing data
    check(
        'Conservative iOS default',
        fileContains('src/lib/gates/scoringGates.ts', 'iosTrafficPercent === undefined'),
        'Missing iOS data triggers conservative estimate'
    );

    // 9. Audit logging exists
    check(
        'Audit logging module exists',
        fileExists('src/lib/gates/auditLogger.ts'),
        'Gate decisions are logged with trace_id'
    );

    // 10. Versioning exists
    check(
        'Version tracking exists',
        fileExists('src/lib/config/versions.ts'),
        'Schema and model versions tracked'
    );

    // 11. Baseline builder exists
    check(
        'Baseline builder exists',
        fileExists('src/lib/baseline/baselineBuilder.ts'),
        'Conversion type separation implemented'
    );

    // 12. Integration tests exist
    check(
        '4-quadrant tests exist',
        fileExists('src/__tests__/integration/systemOrchestration.test.ts'),
        'System orchestration integration tests'
    );

    // 13. Boundary isolation tests exist
    check(
        'Boundary isolation tests exist',
        fileExists('src/__tests__/integration/boundaryIsolation.test.ts'),
        'System boundary enforcement tests'
    );

    // Print results
    console.log('Results:\n');

    let passed = 0;
    let failed = 0;

    for (const result of results) {
        const status = result.passed
            ? `${GREEN}[✓]${RESET}`
            : `${RED}[✗]${RESET}`;

        console.log(`${status} ${result.name}`);
        if (result.details) {
            console.log(`    ${YELLOW}→ ${result.details}${RESET}`);
        }

        if (result.passed) passed++;
        else failed++;
    }

    console.log('\n' + '-'.repeat(50));
    console.log(`Total: ${passed} passed, ${failed} failed`);

    if (failed === 0) {
        console.log(`${GREEN}✅ All safety checks passed!${RESET}\n`);
    } else {
        console.log(`${RED}❌ Some safety checks failed. Review before deployment.${RESET}\n`);
        process.exit(1);
    }
}

runChecks().catch(console.error);
