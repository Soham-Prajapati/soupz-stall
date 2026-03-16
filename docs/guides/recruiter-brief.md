# Soupz Stall Recruiter Brief

Date: 2026-03-16
Audience: recruiters, hiring managers, or anyone who needs a strong product and engineering summary without reading the codebase.

## One-Line Summary

Soupz Stall is a web-first multi-agent orchestration system that lets a user submit a software task, route it to the right specialist agent, monitor execution in a live dashboard, and inspect outputs, status, and file changes end-to-end.

## What It Does

Soupz Stall turns agent execution into an operational workflow instead of a black-box prompt.

The product combines:

- a task submission interface
- automatic routing across different agent modes
- live order tracking and execution history
- optional persistence through Supabase
- a local-first runtime architecture for safety and control

## Why It Is Interesting

Most agent tools stop at “send prompt, receive answer.”

Soupz Stall focuses on operational visibility:

- what task was sent
- which agent handled it
- what model policy was used
- what output streamed back
- what changed in the repo
- whether the task completed or failed

That makes it closer to a real control plane for AI-assisted engineering work.

## Technical Highlights

### Frontend
- React + Vite dashboard
- live polling-based task timeline and queue
- prompt composer, output stream, metrics, and diff inspection UI

### Backend
- Node.js remote bridge with Express + WebSocket support
- OTP pairing and token-based session auth
- order lifecycle APIs
- optional Supabase-backed persistence

### Runtime
- local-first orchestration model
- agent routing and execution pipeline
- compatibility with multiple agent/persona modes

## Architecture Shape

The system is intentionally split into two layers:

1. Dashboard layer
   A web interface for operators to submit and inspect work.

2. Runtime bridge layer
   A long-running backend that can execute tasks, manage sessions, and stream results.

This split makes the product easier to reason about and easier to extend toward cloud-hosted execution later.

## Product Direction

Current product direction emphasizes:

- web-first orchestration
- cost-aware model routing
- agent specialization
- transparent execution state
- better operational UX for AI coding workflows

## Current Deployment Status

- Frontend is ready to be hosted on Vercel.
- Backend currently works best as a long-running Node service on a host such as Railway or Render.
- Supabase is already connected for persistence/migrations.

## Why This Matters Professionally

This project demonstrates strength across multiple layers at once:

- product thinking
- developer tooling
- full-stack implementation
- systems design
- operational UX
- AI workflow design

It is not just a UI mockup or a prompt wrapper. It is a working orchestration product with an opinionated runtime model and a deployment path.

## Short Pitch Version

Soupz Stall is a control room for AI-assisted software execution: you submit a task, the system routes it to the right specialist agent, tracks the full lifecycle in a live dashboard, and preserves the operational context needed to inspect outcomes instead of treating AI like a black box.