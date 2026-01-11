-- Lead Meta Events Table
-- Stores sent events for deduplication and tracking

CREATE TABLE IF NOT EXISTS lead_meta_events (
    id SERIAL PRIMARY KEY,
    
    -- Lead identification
    lead_id VARCHAR(255) NOT NULL,
    
    -- Event type: 'QualifiedLead' or 'Purchase'
    event_type VARCHAR(50) NOT NULL,
    
    -- Deterministic event_id for Meta deduplication: {lead_id}_{event_type}
    event_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- When the event was actually sent to Meta (NULL = not sent yet)
    sent_at TIMESTAMP NULL,
    
    -- Business action timestamp (qualification time or value-confirmed time)
    event_time TIMESTAMP NOT NULL,
    
    -- Purchase value (only for Purchase events)
    value DECIMAL(10,2) NULL,
    
    -- Currency code (only for Purchase events)
    currency VARCHAR(3) NULL,
    
    -- Status: 'pending', 'sent', 'error', 'converted_pending_value'
    status VARCHAR(30) DEFAULT 'pending',
    
    -- Error message if status = 'error'
    error_message TEXT NULL,
    
    -- Meta API response (for debugging)
    api_response TEXT NULL,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one event type per lead
    CONSTRAINT unique_lead_event UNIQUE(lead_id, event_type)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_lead_meta_events_lead_id ON lead_meta_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_meta_events_status ON lead_meta_events(status);
CREATE INDEX IF NOT EXISTS idx_lead_meta_events_event_type ON lead_meta_events(event_type);
