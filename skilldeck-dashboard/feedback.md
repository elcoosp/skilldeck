# Feedback Dashboard – Internal Design Document

## Purpose

The Feedback Dashboard is an internal tool to aggregate, analyze, and track user feedback from multiple sources. It enables the team to:

- See all feedback in one place (docs site, GitHub issues, Discord, etc.)
- Identify common themes and prioritize improvements
- Track the status of each feedback item (new, triaged, in progress, resolved)
- Measure documentation health over time
- Close the loop with users by showing them the impact of their feedback

## Data Sources

The dashboard will collect data from:

| Source | Method | Update Frequency |
|--------|--------|------------------|
| Docs site "Was this helpful?" buttons | Custom API endpoint (or Plausible events) | Real‑time |
| GitHub issues with label `documentation` | GitHub API | Daily |
| Discord `#docs-feedback` channel | Discord bot / webhook | Real‑time |
| User interviews / usability tests | Manual entry (CSV upload) | As needed |

## Core Features

### 1. Unified Feed

- Chronological list of all feedback items
- Each item shows: source, user (anonymized), timestamp, content, status
- Filterable by source, date, status, theme

### 2. Theme Analysis

- Automatic keyword extraction to suggest themes (e.g., "MCP", "installation")
- Manual tagging by team members
- Tag cloud to visualize most common topics

### 3. Status Tracking

- Statuses: `new`, `triaged`, `in progress`, `resolved`, `wontfix`
- Assignee can be set
- When resolved, link to the fix (e.g., PR or commit)

### 4. Metrics Dashboard

- Number of feedback items per week/month
- Top sources
- Average resolution time
- Sentiment score (if available from source)
- Content health score (based on recurring issues)

### 5. User Notifications

- When a user leaves feedback via the docs site, they can optionally provide email
- If status changes to `resolved`, send an automated email with link to the fix
- (Optional) Public status page where users can check the status of their feedback using a reference ID

## Technology Stack

| Component | Recommended Technology |
|-----------|------------------------|
| Backend API | Node.js + Express (or Python FastAPI) |
| Database | PostgreSQL (for structured data) + Redis (for caching) |
| Frontend | React (or Vue) – simple dashboard |
| Authentication | GitHub OAuth (only internal team) |
| GitHub Integration | Octokit (Node.js) |
| Discord Integration | Discord bot with message intent |
| Hosting | Vercel (frontend) + Render/Heroku (backend) |

## Database Schema (Simplified)

```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(50) NOT NULL, -- 'docs', 'github', 'discord', 'manual'
  source_id VARCHAR(255), -- e.g., GitHub issue number, Discord message ID
  user_email VARCHAR(255), -- optional, for follow-up
  user_name VARCHAR(255), -- anonymized if needed
  content TEXT NOT NULL,
  url TEXT, -- link to original source
  created_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'new',
  assigned_to VARCHAR(255),
  tags TEXT[],
  metadata JSONB -- additional source-specific data
);

CREATE TABLE feedback_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE,
  author VARCHAR(255),
  comment TEXT,
  created_at TIMESTAMP NOT NULL
);
```

## Implementation Phases

### Phase 1: Data Ingestion (MVP)

- Set up a simple API endpoint to receive feedback from docs site (POST /api/feedback)
- Write a script to fetch GitHub issues with `documentation` label daily
- Set up a Discord bot that listens to a specific channel and posts messages to the API
- Store everything in a database
- Build a basic read‑only feed (sorted by date) for the team

**Estimated effort:** 2 weeks (1 developer)

### Phase 2: Basic UI & Filtering

- Build a React frontend with authentication (GitHub OAuth)
- Display feed with filters (source, date, status)
- Allow manual tagging and status updates
- Add ability to view feedback details and add internal comments

**Estimated effort:** 2 weeks (1 frontend + 1 backend)

### Phase 3: Analytics & Notifications

- Add metrics dashboard with charts (feedback volume, top sources, etc.)
- Implement automatic email notifications when feedback is resolved
- Add theme extraction (simple keyword matching initially)
- Create a public status page (optional)

**Estimated effort:** 3 weeks (1 full‑stack)

### Phase 4: Advanced Features

- Sentiment analysis integration (e.g., using a local model)
- User feedback reference IDs and lookup page
- Integration with project management tools (e.g., Linear, Jira)
- Automated suggestions based on similar feedback

**Estimated effort:** 3 weeks (1 full‑stack + data scientist)

## Success Metrics

- Time from feedback to triage reduced by 50%
- Percentage of feedback items that receive a response (target 90%)
- Team satisfaction with the dashboard (measured by survey)
- Reduction in duplicate feedback (through better visibility)

## Next Steps

1. Create a private GitHub repository for the dashboard code.
2. Set up the database (PostgreSQL) on a free tier (e.g., Supabase, ElephantSQL).
3. Implement the feedback ingestion API endpoint and modify the docs site to POST to it (replace current Plausible events or add parallel).
4. Build a simple feed view and grant access to the core team.

---

*This document is for internal use only. Do not share publicly.*
