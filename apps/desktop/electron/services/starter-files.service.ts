import type { DocumentRecord, ProjectRecord, TaskRecord } from '../../../../packages/shared/types';

export type TemplateType = 'default' | 'react-express' | 'fastapi-react' | 'nextjs' | 'vite-tailwind';

export class StarterFilesService {
  createStarterFiles(
    project: ProjectRecord,
    documents: DocumentRecord[],
    tasks: TaskRecord[],
    template: TemplateType = 'default',
  ) {
    const docLookup = new Map(documents.map((document) => [document.type, document.content]));

    if (template === 'fastapi-react') {
      return [
        {
          relativePath: 'README.md',
          description: 'FastAPI + React starter README',
          content: `# ${project.name}\n\nFastAPI Python backend with React frontend.\n`,
        },
        {
          relativePath: 'backend/main.py',
          description: 'FastAPI application entrypoint',
          content: `from fastapi import FastAPI\n\napp = FastAPI(title="${project.name}")\n\n@app.get("/health")\ndef health():\n    return {"status": "ok", "project": "${project.name}"}\n`,
        },
        {
          relativePath: 'backend/requirements.txt',
          description: 'Python backend dependencies',
          content: `fastapi>=0.110.0\nuvicorn[standard]>=0.28.0\npydantic>=2.6.0\n`,
        },
        {
          relativePath: 'frontend/src/App.tsx',
          description: 'React frontend App component',
          content: `export default function App() {\n  return <div><h1>${project.name}</h1></div>;\n}\n`,
        },
      ];
    }

    if (template === 'nextjs') {
      return [
        {
          relativePath: 'README.md',
          description: 'Next.js App Router starter README',
          content: `# ${project.name}\n\nNext.js 15 App Router template.\n`,
        },
        {
          relativePath: 'app/page.tsx',
          description: 'Next.js root page',
          content: `export default function Home() {\n  return <main><h1>${project.name}</h1></main>;\n}\n`,
        },
        {
          relativePath: 'package.json',
          description: 'Next.js package manifest',
          content: `{\n  "name": "${project.name.toLowerCase().replace(/\s+/g, '-')}",\n  "version": "0.1.0",\n  "scripts": {\n    "dev": "next dev",\n    "build": "next build"\n  }\n}\n`,
        },
      ];
    }

    if (template === 'vite-tailwind') {
      return [
        {
          relativePath: 'README.md',
          description: 'Vite + Tailwind CSS starter README',
          content: `# ${project.name}\n\nVite React + Tailwind CSS app.\n`,
        },
        {
          relativePath: 'src/App.tsx',
          description: 'Vite React main component',
          content: `export default function App() {\n  return <div className="p-8 text-2xl font-bold">${project.name}</div>;\n}\n`,
        },
        {
          relativePath: 'index.html',
          description: 'Vite entry HTML',
          content: `<!DOCTYPE html>\n<html><head><title>${project.name}</title></head><body><div id="root"></div></body></html>\n`,
        },
      ];
    }

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
    ];
  }
}
