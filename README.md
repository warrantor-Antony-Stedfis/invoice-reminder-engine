# Invoice Reminder Engine

A small reference implementation of a configurable and idempotent invoice reminder workflow.

This repository is being built incrementally to demonstrate domain modelling, payment-aware reminder decisions, duplicate-delivery protection and automated tests.

## Status

The project includes financial domain models, configurable reminder decisions, batch processing, delivery orchestration and runnable in-memory adapters.

## Run locally

```bash
npm install
npm run check
npm run example
```

## Example

The example uses in-memory adapters. It does not send real email or connect to a database.

It runs the same batch twice to demonstrate reminder history and deterministic idempotency keys.
