# Feedback Admin Review PRD

## Summary
AutoBot now captures authenticated user submissions from the sidebar `Feedback` dialog and stores them in `public.feedback_submissions`. The future admin panel should give the team a fast way to review, triage, and act on those submissions without changing the capture flow.

## Current Implemented Inputs
- Submission types: `feedback`, `feature_request`
- Score: `1-10`
- Title
- Description
- Submitter snapshot: `user_email`, `user_name`
- Timestamps: `created_at`, `updated_at`

## Admin Panel Goals
- Let internal reviewers scan new submissions in reverse chronological order.
- Separate product sentiment from feature demand while keeping them in one review surface.
- Support lightweight triage before deeper product planning work begins.

## Recommended V1 Admin Surface
- Table view of `feedback_submissions`
- Filters for:
  - type
  - score range
  - date range
  - submitter email
- Default sort: newest first
- Row preview fields:
  - created date
  - type
  - score
  - title
  - submitter name/email
- Detail drawer or detail page showing full description and submission metadata

## Suggested Follow-On Schema Additions
- `status` for triage state such as `new`, `reviewing`, `planned`, `closed`
- `review_notes` for internal commentary
- `reviewed_by` and `reviewed_at`
- optional linkage fields for roadmap item, issue id, or project reference

## Acceptance Criteria For The Future Admin UI
- Reviewers can find all submissions without using SQL.
- Reviewers can isolate feature requests vs general feedback quickly.
- Reviewers can rank high-urgency or low-score items quickly using the existing score field.
- Reviewers can open a submission and read the full user context without leaving the admin panel.
