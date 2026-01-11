# ATHENA Safety Rules

> **Version:** 1.0  
> **Last Updated:** 2026-01-11  
> **Status:** Enforced

This document defines forbidden patterns and semantic detectors that MUST NOT be added to ATHENA without explicit architecture review and approval.

---

## Core Principle

**System 1 (Structure) is purely mechanical.** It measures temporal and spatial properties of creatives:
- Motion timing (first movement timestamp)
- Cut density (scene changes per second)
- Text appearance timing
- Audio levels
- Aspect ratio

**It does NOT interpret meaning, quality, or effectiveness.**

---

## Forbidden Semantic Detectors

The following detectors are **EXPLICITLY FORBIDDEN** in System 1:

| Category | Forbidden Terms | Why Forbidden |
|----------|-----------------|---------------|
| **Emotion** | emotion, sentiment, mood, feeling, tone | Subjective interpretation |
| **Face/Person** | face_detection, facial_expression, person_recognition | Privacy + interpretation |
| **Object Semantics** | object_meaning, product_inference, scene_understanding | Requires interpretation |
| **Text Meaning** | OCR_content_analysis, text_sentiment, message_strength | Reading meaning, not position |
| **Quality Judgments** | hook_strength, engagement_score, persuasiveness | Predictive, not observable |
| **Trait Inference** | trait, personality, demographic_inference | Guessing user intent |
| **Aesthetic Scoring** | beauty_score, visual_appeal, design_quality | Subjective judgment |

---

## Allowed Mechanical Measurements

| Allowed | Description |
|---------|-------------|
| `motionStartMs` | Timestamp of first pixel motion |
| `textAppearanceMs` | Timestamp of first text frame |
| `cutCount` | Number of scene transitions |
| `audioLevelLufs` | Measured audio loudness |
| `aspectRatio` | Width/height ratio |
| `duration` | Total length in seconds |
| `hasAudio` | Boolean presence of audio track |
| `frameRate` | Measured FPS |

---

## System 2 (Narrative) Constraints

System 2 uses a **user-confirmed checklist** of observable presence/absence/position:

**Allowed Questions:**
- "Is there a CTA?" (presence)
- "Does the CTA contain an action verb?" (observable)
- "When does the offer appear?" (position)

**Forbidden Questions:**
- "Is the hook strong?" (quality judgment)
- "What emotion does this evoke?" (interpretation)
- "Why does this creative work?" (explanation)

---

## LLM Usage Policy

When using LLM to prefill System 2 checklist:

1. **Constrain to schema** - Output ONLY defined JSON fields
2. **Forbid extra keys** - Hard failure on undefined properties
3. **No quality language** - Prompt must forbid "strong", "effective", "persuasive"
4. **User confirmation required** - LLM output gets `llmAssisted=true, userConfirmed=false`
5. **Confidence penalty** - Unconfirmed LLM data caps confidence at `low`

---

## Approval Process

To add any new detector or measurement:

1. **Check this list** - Is it forbidden?
2. **Classify as mechanical or semantic** - Does it require interpretation?
3. **Architecture review** - Document why it's needed and how it avoids interpretation
4. **Update this file** - Add to allowed list with justification

**No semantic detector may be added without explicit approval from architecture lead.**

---

## Enforcement

This policy is enforced via:
- `src/lib/policy/safety.ts` - Runtime keyword check
- ESLint rules - Import boundary enforcement
- CI checks - Forbidden term scanning
- Code review - Manual verification

---

## Revision History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-11 | Initial policy |
