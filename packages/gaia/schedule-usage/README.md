---
description: "Host plugin that projects scheduled-task delivery usage and estimates token costs from OpenRouter rates."
kind: "package-reference"
---

# @deepseek-ai/dsh-gaia-schedule-usage

## Summary

Reads the Scheduler's retained delivery receipts, finds each delivered message's Session turn, and projects its provider-reported token usage and estimated USD cost. The Client dashboard is part of this package.

## Data and pricing

The Scheduler remains the only source of task and delivery history. This plugin stores no duplicate task, run, or Session data. It does not return saved task prompts or unrelated Session content. Deliveries targeting the same Session and sharing a message id are shown once as a shared batch, not copied onto each task's totals.

Model prices come from OpenRouter's public `https://openrouter.ai/api/v1/models` catalog. The Host caches a successful catalog for six hours and reports its timestamp. Costs use the current catalog, not historical rates. A model is matched by its exact OpenRouter id, then by `provider/model`, then, for a bare model name, by the one OpenRouter id whose model segment equals it; names that several vendors list at different prices stay unpriced. Missing rates leave costs unpriced; unavailable Session history leaves usage unknown. Token counts are provider-reported and disjoint: uncached input is billed at the prompt rate, cache reads and writes at OpenRouter's cache rates (the prompt rate when none is listed). Displayed token totals include cache reads and writes.

The dashboard Remote takes an inclusive delivery-time range (`from`, `to`, both required) and optional task ids; the page defaults to the last 30 local days and all tasks. The Host reads receipts of up to 50 tasks (up to 1,000 per task, newest first, stopping at the range start) so batches shared with unselected tasks stay shared, returns every catalog task as a filter option (up to 500), and reports at most 250 unique deliveries per refresh. Scheduler history retention remains authoritative. The UI indicates when history or response bounds omit entries. Token counts of turns that have ended are cached in memory (up to 2,000 deliveries), so later refreshes read only Sessions with new or still-running deliveries.

## Model Experience

This package adds no model-visible tools, prompt text, or Session events. It reads Scheduler receipts and durable Session usage for a user-facing dashboard only.

## Known Limitations and Deferred Work

Usage for a delivery is attributed to the turn containing its scheduled message. Costs use current OpenRouter prices and may differ from the actual provider invoice. Session compaction or deleted Session data may make a retained receipt's usage unavailable.
