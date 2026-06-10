import type { DocumentRecord, ProjectRecord, TaskRecord } from '../../../../packages/shared/types';

export class StarterFilesService {
  createStarterFiles(project: ProjectRecord, documents: DocumentRecord[], tasks: TaskRecord[]) {
    const docLookup = new Map(documents.map((document) => [document.type, document.content]));

    return [
      {
        relativePath: 'README.md',
        description: 'Create a demo README for the planned project',
        content: `# ${project.name}\n\n${project.description}\n\n## Planned Documents\n- PRD\n- Architecture\n- Tasks\n`,
      },
      {
        relativePath: 'docs/PRD.md',
        description: 'Create PRD markdown from generated workspace document',
        content: docLookup.get('PRD') ?? '# PRD\n\nPending generation.',
      },
      {
        relativePath: 'docs/ARCHITECTURE.md',
        description: 'Create architecture markdown from generated workspace document',
        content: docLookup.get('ARCHITECTURE') ?? '# Architecture\n\nPending generation.',
      },
      {
        relativePath: 'docs/TASKS.md',
        description: 'Create team task breakdown markdown',
        content:
          `# Tasks\n\n` +
          tasks.map((task) => `- [${task.status === 'DONE' ? 'x' : ' '}] (${task.team}) ${task.title}: ${task.description}`).join('\n'),
      },
      {
        relativePath: '.env.example',
        description: 'Create starter environment example',
        content: `GEMINI_API_KEY=\nGROQ_API_KEY=\nOLLAMA_BASE_URL=http://localhost:11434\n`,
      },
      {
        relativePath: 'src/main.ts',
        description: 'Create starter TypeScript entrypoint',
        content: `export const bootstrap = () => {\n  console.log('BuildOS AI demo starter for ${project.name}');\n};\n\nbootstrap();\n`,
      },
      {
        relativePath: 'src/services/approval.service.ts',
        description: 'Create starter approval service placeholder',
        content: `export class ApprovalService {\n  requestApproval(action: string) {\n    return { action, status: 'PENDING' as const };\n  }\n}\n`,
      },
    ];
  }
}
