# Project Plan

## Problem & Goal
- **Problem**: Sprint poker during refinements is slowed down by tools that require accounts or heavy setup. The team needs a fast, low-friction way to estimate together.
- **Goal (Outcome)**: Enable any team member to create a session, share a link, and run simple Fibonacci-based poker rounds with real-time reveal, without accounts or logins.
- **Why now**: The team wants a lightweight, hostable web app for upcoming refinements and wants to avoid the overhead of existing tools.

## Users & Jobs-to-be-Done
- **Primary Persona**: Agile team members (PO, engineers, QA) participating in refinement sessions.
- **JTBD**: "Help me estimate stories quickly with my team so that we align on effort and reduce refinement time."
- **Pain Points**:
  - Account creation or invitations slow down sessions.
  - Complex UIs distract from the estimation flow.
  - Hard to get everyone into the same session quickly.

## Scope
### In Scope
- Create a new session from the landing page.
- Shareable session link.
- Join session by entering a display name (no auth).
- Fibonacci card selection per participant.
- Card selection hidden until reveal.
- Reveal button (any participant can trigger).
- Start a new round / reset votes.
- Show participant list and who has voted.
- Show a simple summary after reveal (average of numeric cards).
- Expire sessions after 3 hours of inactivity.
- Simple, clean, lightly styled UI (minimalist but pleasant).

### Out of Scope / Non-goals
- Accounts, passwords, or user profiles.
- Backlog/story management or integrations (Jira, Azure DevOps, etc.).
- Advanced roles/permissions (e.g., host-only actions).
- Team management, analytics dashboards, or admin panels.
- Video/audio or chat features.

## Requirements
### User Stories
- As a participant, I want to create a session and receive a link, so that I can invite my team.
- As a participant, I want to join a session by typing my name, so that I can participate without logging in.
- As a participant, I want to pick a Fibonacci card, so that I can submit my estimate.
- As a participant, I want to change my card before reveal, so that I can adjust my estimate.
- As a participant, I want to reveal all cards at once, so that we can discuss the estimates.
- As a participant, I want to start a new round, so that we can estimate the next story.
- As a participant, I want to see who has voted, so that we know when everyone is ready.
- As a participant, I want to see the average after reveal, so that we can align on a final estimate.

### Acceptance Criteria
- **Create session**: Given I am on the landing page, when I click "Create session", then a new session is created and I am shown a shareable link.
- **Join session**: Given I have a session link, when I enter a name and submit, then I join the session and appear in the participant list.
- **Select card**: Given I am in a session, when I select a card, then my selection is stored and shown as "voted" but not revealed.
- **Reveal**: Given at least one participant has voted, when any participant clicks "Reveal", then all selected cards are shown to everyone.
- **New round**: Given cards are revealed, when any participant clicks "New round", then all selections are cleared and cards are hidden again.
- **Summary**: Given cards are revealed, when the reveal occurs, then the average of numeric cards is shown to everyone.
- **Session expiry**: Given a session has no activity for 3 hours, when a user returns, then the session is closed and a new session must be created.

## Success Metrics
- **Primary metric**: % of refinement sessions completed using the tool without setup friction.
- **Leading indicators**: Time-to-start (landing page to all participants joined), reveal actions per session.
- **Measurement window**: 2-4 weeks after first internal rollout.
- **Baseline (if known)**: Not available yet.

## Constraints & Assumptions
- **Constraints**:
  - No login or account system.
  - Everyone has the same permissions (anyone can reveal/reset).
  - Must be easy to host online.
  - UI should remain minimalistic and readable.
- **Assumptions**:
  - Typical session size is small (<= 15 participants).
  - Default card deck is Fibonacci: 0,1,2,3,5,8,13,21,34,55,89 plus "?" and "coffee".
  - Real-time updates are required for the session.
  - Sessions expire after 3 hours of inactivity.

## Risks
- Real-time synchronization reliability (disconnects, reconnections).
- Name collisions (two users with the same name).
- Session persistence and cleanup (stale sessions).

## Prioritization
1. Core flow: create session, join by name, choose card, reveal, new round.
2. Summary after reveal (average of numeric cards).
3. UX polish: participant list, vote status, lightweight styling.
4. Session expiry after inactivity (3 hours).

## Smart Tweak
- **Original scope**: Full sprint poker experience with extras like roles, story lists, and integrations.
- **Smart tweak**: Focus only on the live estimation loop (join, vote, reveal, reset) with a simple deck.
- **Why it preserves value**: The team still gets fast alignment on estimates without any setup burden.
