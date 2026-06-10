import type { AIProvider } from '../ai/providers/ai-provider.interface';
import type { AgentOutput } from '../shared/types';
import { BaseAgent } from './base';

interface PRDAgentInput {
  projectName: string;
  requirementsSummary: string;
}

export class PRDAgent extends BaseAgent<PRDAgentInput, string> {
  constructor(provider: AIProvider | null) {
    super(provider, 'PRD Agent');
  }

  async run(input: PRDAgentInput): Promise<AgentOutput<string>> {
    const content = `# Product Requirements Document

## Product Vision
${input.projectName} should help a solo founder or builder move from idea to execution inside one safe desktop workspace. The product should feel like a practical AI Tech Lead that can clarify scope, produce technical plans, and propose project scaffolding without taking unsafe actions automatically.

## Problem
Builders often lose momentum switching between notes, architecture docs, task managers, terminal sessions, and code editors. They need one focused workspace that can turn ambiguous product intent into concrete engineering plans while keeping local project access and risky actions under control.

## Target Users
- Solo founders building new products
- Small software teams exploring a new codebase
- Technical product leads creating initial specs and execution plans

## Goals
- Turn a build request into requirements questions, planning documents, and team tasks
- Keep all file and command actions approval-gated
- Make project context persistent through local SQLite memory
- Support both cloud and local AI provider modes

## Non-Goals
- No full computer control
- No automatic deployment
- No direct secret harvesting or unrestricted file access
- No sending real emails or automating external apps in V1

## MVP Scope
- Project creation and local folder selection
- Safe file tree browsing with protected-file blocking
- Requirement clarification in chat
- PRD, architecture, stack recommendation, and task generation
- Approval queue for file writes and command execution
- Action logs and local project memory

## User Flow
1. User creates a project and selects a local folder.
2. User asks BuildOS AI to build or review something.
3. The app classifies the request and asks for missing requirements when needed.
4. Planning agents generate documents and tasks in app memory.
5. The user reviews proposed starter files and commands in the approval queue.
6. Approved actions execute inside the selected folder only.

## Functional Requirements
- The system must classify build, review, documentation, and command requests.
- The system must ask clarifying questions before generating implementation artifacts for new projects.
- The system must persist documents, messages, tasks, and approvals locally.
- The system must show diffs or previews before writing files.
- The system must require approval before any command is run.

## Risks
- Overly broad access to local files could reduce trust.
- Weak command filtering could allow unsafe execution.
- Cloud AI configuration failures could break orchestration unless local fallbacks exist.

## Success Criteria
- A user can go from one initial idea prompt to a PRD, architecture, and team task board in one session.
- The user can approve starter files and commands with clear risk labeling.
- The workspace remains scoped to one selected project folder.

## Current Requirements Summary
${input.requirementsSummary}`;

    return {
      agentName: 'PRD Agent',
      summary: 'Generated an initial PRD draft.',
      data: content,
    };
  }
}
