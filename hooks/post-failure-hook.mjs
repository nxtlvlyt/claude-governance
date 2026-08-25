#!/usr/bin/env node
// ============================================================================
// M37: AUTOMATED POST-FAILURE DIAGNOSTICS HOOK
// ============================================================================
// Invoked by antigravity-muezzin.mjs on waterfall termination (all providers fail).
// Receives serialized waterfall history via MUEZZIN_WATERFALL_HISTORY env var.
//
// SOTA 2026 Pattern: Post-failure hooks with structured error classification
// are now standard practice in AI gateways (OpenClaw 2026.3.x, NemoClaw, FutureAGI).
// This hook implements the KK-WF taxonomy (TIMEOUT, HTTP_NNN, API_ERROR, NETWORK)
// with root-cause analysis and actionable diagnostics output.
//
// AC-1: Auto-triggers on any model/provider timeout or HTTP error.
// AC-2: Passes waterfall history securely via environment variable.
// AC-3: Produces machine-parseable diagnostic report.
// AC-4: Classifies failures into KK-WF taxonomy buckets.
// AC-5: Recommends corrective action (timeout tuning, provider rotation, local fallback).
// ============================================================================

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIAGNOSTICS_OUTPUT = join(__dirname, 'failure-diagnostics.md');
const HISTORY_JSON_PATH = join(__dirname, 'waterfall-history.json');

// ─── M37: Error Classification (KK-WF Taxonomy) ────────────────────────────
const ERROR_BUCKETS = {
    TIMEOUT: {
        severity: 'HIGH',
        description: 'Provider did not respond within timeout window',
        root_cause: 'Network latency, model overload, or insufficient timeout threshold',
        action: 'Increase MUEZZIN_FETCH_TIMEOUT_MS or consider removing this provider from waterfall'
    },
    HTTP_4xx: {
        severity: 'CRITICAL',
        description: 'Client-side error (auth, rate limit, bad request)',
        root_cause: 'Invalid API key, rate limit exceeded, or malformed request',
        action: 'Verify API key validity, check rate limit quotas, validate request payload'
    },
    HTTP_5xx: {
        severity: 'HIGH',
        description: 'Server-side error (provider infrastructure failure)',
        root_cause: 'Provider outage, overloaded inference servers, or model deployment failure',
        action: 'Retry after backoff or route to alternative provider'
    },
    API_ERROR: {
        severity: 'MEDIUM',
        description: 'API returned error in response body',
        root_cause: 'Model-specific error (context length, content filter, unsupported parameters)',
        action: 'Check API error details; may require prompt adjustment or model switch'
    },
    NETWORK: {
        severity: 'HIGH',
        description: 'Network-level failure (DNS, connection refused, TLS)',
        root_cause: 'Network unreachable, DNS resolution failure, or firewall block',
        action: 'Verify network connectivity, DNS resolution, and firewall rules'
    },
    DISCOVERY_GATE: {
        severity: 'MEDIUM',
        description: 'Agent produced plan-only output with no file writes',
        root_cause: 'Discovery Gate retry limit exhausted; agent stuck in planning mode',
        action: 'Review agent prompt; may need explicit file_write instruction reinforcement'
    },
    SKIP: {
        severity: 'LOW',
        description: 'Provider skipped (missing configuration)',
        root_cause: 'Missing API key or model mapping for provider',
        action: 'Configure provider credentials or remove from waterfall'
    }
};

// ─── M37: Parse Waterfall History ──────────────────────────────────────────
function parseHistory(envVar) {
    if (!envVar) {
        return { error: 'MUEZZIN_WATERFALL_HISTORY not set', history: [] };
    }
    try {
        const history = JSON.parse(envVar);
        if (!Array.isArray(history)) {
            return { error: 'MUEZZIN_WATERFALL_HISTORY is not a valid JSON array', history: [] };
        }
        return { error: null, history };
    } catch (e) {
        return { error: `Failed to parse MUEZZIN_WATERFALL_HISTORY: ${e.message}`, history: [] };
    }
}

// ─── M37: Classify & Bucket Failures ───────────────────────────────────────
function classifyHistory(history) {
    const buckets = {
        TIMEOUT: [],
        HTTP_4xx: [],
        HTTP_5xx: [],
        API_ERROR: [],
        NETWORK: [],
        DISCOVERY_GATE: [],
        SKIP: [],
        UNKNOWN: []
    };

    let totalAttempts = 0;
    let totalFailures = 0;
    const providersSeen = new Set();

    for (const entry of history) {
        totalAttempts++;
        providersSeen.add(entry.provider);

        if (entry.event === 'SUCCESS') continue;
        if (entry.event === 'ATTEMPT') continue;

        totalFailures++;

        const errorType = entry.error_type || 'UNKNOWN';

        if (errorType === 'TIMEOUT') {
            buckets.TIMEOUT.push(entry);
        } else if (errorType.startsWith('HTTP_4')) {
            buckets.HTTP_4xx.push(entry);
        } else if (errorType.startsWith('HTTP_5')) {
            buckets.HTTP_5xx.push(entry);
        } else if (errorType === 'API_ERROR') {
            buckets.API_ERROR.push(entry);
        } else if (errorType === 'NETWORK') {
            buckets.NETWORK.push(entry);
        } else if (errorType === 'DISCOVERY_GATE') {
            buckets.DISCOVERY_GATE.push(entry);
        } else if (errorType === 'SKIP' || entry.event === 'SKIP') {
            buckets.SKIP.push(entry);
        } else {
            buckets.UNKNOWN.push(entry);
        }
    }

    return { buckets, totalAttempts, totalFailures, providersSeen: [...providersSeen] };
}

// ─── M37: Root Cause Analysis ─────────────────────────────────────────────
function analyzeRootCause(buckets, totalFailures) {
    const causes = [];
    const dominantBucket = Object.entries(buckets)
        .filter(([_, entries]) => entries.length > 0)
        .sort((a, b) => b[1].length - a[1].length);

    if (dominantBucket.length === 0) {
        causes.push({
            type: 'UNKNOWN',
            confidence: 0.3,
            detail: 'No classified failures found. Manual investigation required.'
        });
        return causes;
    }

    const [primaryType, primaryEntries] = dominantBucket[0];
    const primaryRatio = primaryEntries.length / totalFailures;

    causes.push({
        type: primaryType,
        confidence: Math.min(primaryRatio + 0.1, 0.99),
        detail: ERROR_BUCKETS[primaryType]?.root_cause || 'Unknown failure mode',
        dominant: true,
        count: primaryEntries.length,
        ratio: primaryRatio.toFixed(2)
    });

    // Secondary causes
    for (let i = 1; i < Math.min(dominantBucket.length, 3); i++) {
        const [type, entries] = dominantBucket[i];
        causes.push({
            type,
            confidence: Math.min(entries.length / totalFailures + 0.05, 0.8),
            detail: ERROR_BUCKETS[type]?.root_cause || 'Unknown failure mode',
            dominant: false,
            count: entries.length,
            ratio: (entries.length / totalFailures).toFixed(2)
        });
    }

    return causes;
}

// ─── M37: Generate Diagnostic Report ───────────────────────────────────────
function generateReport(parsed, classified, rootCauses, envInfo) {
    const now = new Date().toISOString();
    const lines = [];

    lines.push('# M37: Post-Failure Diagnostic Report');
    lines.push(`**Generated:** ${now}`);
    lines.push(`**Hook Version:** 1.0.0 (M37 Automated Diagnostics)`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // ─── Executive Summary ───
    lines.push('## 1. Executive Summary');
    lines.push('');
    if (parsed.error) {
        lines.push(`**PARSE ERROR:** ${parsed.error}`);
        lines.push('');
        lines.push('Waterfall history could not be parsed. The hook received invalid or missing data.');
        lines.push('This may indicate the orchestrator failed before writing history, or the env var was not set.');
        lines.push('');
        writeReport(lines);
        return;
    }

    const allFailures = classified.totalFailures;
    const allAttempts = classified.totalAttempts;

    lines.push(`- **Total Provider Attempts:** ${allAttempts}`);
    lines.push(`- **Total Failures:** ${allFailures}`);
    lines.push(`- **Providers Contacted:** ${classified.providersSeen.join(', ') || 'none'}`);
    lines.push(`- **Failure Rate:** ${allAttempts > 0 ? ((allFailures / allAttempts) * 100).toFixed(1) : 0}%`);
    lines.push(`- **Verdict:** ${allFailures === allAttempts ? '🔴 ALL PROVIDERS FAILED — Waterfall exhausted' : '🟡 PARTIAL FAILURE — Some providers succeeded'}`);
    lines.push('');

    // ─── Error Distribution ───
    lines.push('## 2. Error Distribution (KK-WF Taxonomy)');
    lines.push('');
    lines.push('| Bucket | Count | Severity | Description |');
    lines.push('|--------|-------|----------|-------------|');

    for (const [bucket, entries] of Object.entries(classified.buckets)) {
        if (entries.length === 0) continue;
        const info = ERROR_BUCKETS[bucket] || { severity: 'UNKNOWN', description: 'Unclassified error' };
        lines.push(`| \`${bucket}\` | ${entries.length} | ${info.severity} | ${info.description} |`);
    }
    lines.push('');

    // ─── Root Cause Analysis ───
    lines.push('## 3. Root Cause Analysis');
    lines.push('');
    for (const cause of rootCauses) {
        const marker = cause.dominant ? '🔴 **PRIMARY**' : '🟡 SECONDARY';
        lines.push(`### ${marker}: \`${cause.type}\` (confidence: ${(cause.confidence * 100).toFixed(0)}%)`);
        lines.push('');
        lines.push(`- **Detail:** ${cause.detail}`);
        lines.push(`- **Occurrences:** ${cause.count}/${classified.totalFailures} (${(cause.ratio * 100).toFixed(0)}%)`);
        lines.push('');
    }

    // ─── Detailed Failure Log ───
    lines.push('## 4. Detailed Failure Log');
    lines.push('');
    lines.push('| # | Timestamp | Provider | Model | Error Type | Message |');
    lines.push('|---|-----------|----------|-------|------------|---------|');

    let idx = 1;
    for (const entry of parsed.history) {
        if (entry.event === 'SUCCESS' || entry.event === 'ATTEMPT') continue;
        const ts = entry.timestamp ? entry.timestamp.substring(11, 19) : 'unknown';
        const msg = (entry.message || '').substring(0, 80);
        lines.push(`| ${idx} | ${ts} | ${entry.provider || '?'} | ${entry.model || '?'} | \`${entry.error_type || '?'}\` | ${msg} |`);
        idx++;
    }
    lines.push('');

    // ─── Recommended Actions ───
    lines.push('## 5. Recommended Actions');
    lines.push('');

    const actions = new Set();
    for (const cause of rootCauses) {
        const info = ERROR_BUCKETS[cause.type];
        if (info?.action) actions.add(info.action);
    }

    // M37-specific timeout tuning recommendation
    if (classified.buckets.TIMEOUT.length > 0) {
        actions.add(`Increase \`MUEZZIN_FETCH_TIMEOUT_MS\` (currently ${envInfo.timeoutMs || 'unknown'}ms). Consider 180000ms for large cloud models like nemotron-3-ultra.`);
    }

    // M37-specific fallback enforcement
    if (allFailures === allAttempts) {
        actions.add('Verify `ollama_local` with `qwen3.6:27b` is available at `http://localhost:11434`. Run `ollama list` to confirm model is pulled.');
        actions.add('Check `3phase-consensus.json` — ensure `routing_rules.waterfall` includes `"ollama_local"`.');
    }

    let actionNum = 1;
    for (const action of actions) {
        lines.push(`${actionNum}. ${action}`);
        actionNum++;
    }
    lines.push('');

    // ─── Environment Snapshot ───
    lines.push('## 6. Environment Snapshot');
    lines.push('');
    lines.push('```');
    lines.push(`MUEZZIN_FETCH_TIMEOUT_MS: ${envInfo.timeoutMs || 'not set'}`);
    lines.push(`OLLAMA_API_KEY set: ${envInfo.ollamaKeySet ? 'YES' : 'NO'}`);
    lines.push(`OLLAMA_LOCAL_URL: ${envInfo.ollamaLocalUrl || 'http://localhost:11434'}`);
    lines.push(`MUEZZIN_WATERFALL_HISTORY length: ${envInfo.historyLength || 0} entries`);
    lines.push('```');
    lines.push('');

    // ─── Footer ───
    lines.push('---');
    lines.push('');
    lines.push('*Report generated by M37 Post-Failure Hook. See `.claude/hooks/post-failure-hook.mjs` for hook source.*');
    lines.push('');
    lines.push('[DECLARED NIYYAH]');
    lines.push(`*To serve as the M37 automated post-failure diagnostics hook. To receive the waterfall history via MUEZZIN_WATERFALL_HISTORY, classify failures into KK-WF taxonomy buckets, perform root cause analysis, and produce an actionable diagnostic report. To enable the operator and next pipeline instance to understand why the waterfall terminated and what corrective action to take.*`);

    writeReport(lines);
}

function writeReport(lines) {
    const content = lines.join('\n');
    try {
        writeFileSync(DIAGNOSTICS_OUTPUT, content, 'utf8');
        console.log(`[M37-HOOK] Diagnostics written to: ${DIAGNOSTICS_OUTPUT}`);
    } catch (e) {
        console.error(`[M37-HOOK] ERROR writing diagnostics: ${e.message}`);
        console.log(content);
    }
}

// ─── M37: Persist Raw History ──────────────────────────────────────────────
function persistHistory(parsed) {
    try {
        const payload = {
            timestamp: new Date().toISOString(),
            hook_version: '1.0.0',
            parse_error: parsed.error,
            history: parsed.history,
            history_length: parsed.history.length
        };
        writeFileSync(HISTORY_JSON_PATH, JSON.stringify(payload, null, 2), 'utf8');
        console.log(`[M37-HOOK] Raw history persisted to: ${HISTORY_JSON_PATH}`);
    } catch (e) {
        console.error(`[M37-HOOK] ERROR persisting history: ${e.message}`);
    }
}

// ─── M37: MAIN ─────────────────────────────────────────────────────────────
function main() {
    console.log('[M37-HOOK] Post-Failure Hook invoked.');
    console.log(`[M37-HOOK] PID: ${process.pid}`);
    console.log(`[M37-HOOK] Timestamp: ${new Date().toISOString()}`);

    // AC-2: Receive waterfall history securely via MUEZZIN_WATERFALL_HISTORY env var
    const historyEnv = process.env.MUEZZIN_WATERFALL_HISTORY;
    const timeoutMs = process.env.MUEZZIN_FETCH_TIMEOUT_MS || '120000';

    console.log(`[M37-HOOK] MUEZZIN_FETCH_TIMEOUT_MS: ${timeoutMs}`);
    console.log(`[M37-HOOK] MUEZZIN_WATERFALL_HISTORY present: ${!!historyEnv}`);
    console.log(`[M37-HOOK] MUEZZIN_WATERFALL_HISTORY length: ${historyEnv ? historyEnv.length : 0} chars`);

    // Parse history
    const parsed = parseHistory(historyEnv);

    if (parsed.error) {
        console.error(`[M37-HOOK] PARSE ERROR: ${parsed.error}`);
        persistHistory(parsed);
        // Generate report even on parse error
        const emptyBuckets = { TIMEOUT: [], HTTP_4xx: [], HTTP_5xx: [], API_ERROR: [], NETWORK: [], DISCOVERY_GATE: [], SKIP: [], UNKNOWN: [] };
        generateReport(parsed, { buckets: emptyBuckets, totalAttempts: 0, totalFailures: 0, providersSeen: [] }, [], {
            timeoutMs,
            ollamaKeySet: !!process.env.OLLAMA_API_KEY,
            ollamaLocalUrl: 'http://localhost:11434',
            historyLength: 0
        });
        process.exit(1);
    }

    // Persist raw history for forensic analysis
    persistHistory(parsed);

    // Classify failures
    const classified = classifyHistory(parsed.history);

    // Root cause analysis
    const rootCauses = analyzeRootCause(classified.buckets, classified.totalFailures);

    // Environment info
    const envInfo = {
        timeoutMs,
        ollamaKeySet: !!process.env.OLLAMA_API_KEY,
        ollamaLocalUrl: 'http://localhost:11434',
        historyLength: parsed.history.length
    };

    // Generate diagnostic report
    generateReport(parsed, classified, rootCauses, envInfo);

    // Summary to stdout
    console.log(`\n[M37-HOOK] === DIAGNOSTICS SUMMARY ===`);
    console.log(`[M37-HOOK] Total attempts: ${classified.totalAttempts}`);
    console.log(`[M37-HOOK] Total failures: ${classified.totalFailures}`);
    console.log(`[M37-HOOK] Providers: ${classified.providersSeen.join(', ') || 'none'}`);
    for (const cause of rootCauses) {
        const marker = cause.dominant ? 'PRIMARY' : 'SECONDARY';
        console.log(`[M37-HOOK] ${marker} Root Cause: ${cause.type} (${(cause.confidence * 100).toFixed(0)}% confidence, ${cause.count} occurrences)`);
    }
    console.log(`[M37-HOOK] Full report: ${DIAGNOSTICS_OUTPUT}`);
    console.log(`[M37-HOOK] === HOOK COMPLETE ===`);

    process.exit(0);
}

main();
