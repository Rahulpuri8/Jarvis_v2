import { useState } from 'react';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { useBuildOS } from './hooks/useBuildOS';

const App = () => {
  const { state, createProject, selectProject, selectFolder, openFile, sendMessage, generateStarterFiles, approveAction, rejectAction, proposeCommand, saveSettings } = useBuildOS();
  const [route, setRoute] = useState<'home' | 'workspace' | 'settings'>('home');

  if (route === 'settings') {
    return <SettingsPage settings={state.settings} onSave={saveSettings} onBack={() => setRoute(state.activeProject ? 'workspace' : 'home')} />;
  }

  if (!state.activeProject || route === 'home') {
    return (
      <HomePage
        projects={state.projects}
        error={state.error}
        onCreateProject={async (payload) => {
          const project = await createProject(payload);
          await selectProject(project);
          setRoute('workspace');
        }}
        onOpenProject={async (project) => {
          await selectProject(project);
          setRoute('workspace');
        }}
      />
    );
  }

  return (
    <WorkspacePage
      project={state.activeProject}
      fileTree={state.fileTree}
      selectedFilePath={state.selectedFilePath}
      selectedFileContent={state.selectedFileContent}
      messages={state.messages}
      documents={state.documents}
      tasks={state.tasks}
      pendingActions={state.pendingActions}
      commandRuns={state.commandRuns}
      logs={state.logs}
      onSelectFolder={selectFolder}
      onOpenFile={openFile}
      onSendMessage={sendMessage}
      onGenerateStarterFiles={generateStarterFiles}
      onApproveAction={approveAction}
      onRejectAction={rejectAction}
      onProposeCommand={proposeCommand}
      onOpenSettings={() => setRoute('settings')}
    />
  );
};

export default App;
