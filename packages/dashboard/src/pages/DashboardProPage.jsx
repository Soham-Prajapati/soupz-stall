import ProMode from '../components/pro/ProMode.jsx';
import './DashboardPages.css';

export default function DashboardProPage({ daemon, fileTree, changedPaths, onEditorStateChange, theme, onOpenCommandPalette }) {
  return (
    <section className="dashboard-page dashboard-page--pro">
      <div className="dashboard-page__header">
        <h2 className="dashboard-page__title">Code Workspace</h2>
        <p className="dashboard-page__subtitle">File explorer, editor, git tools, terminal, and agent chat in IDE mode.</p>
      </div>
      <div className="dashboard-page__body">
        <ProMode
          daemon={daemon}
          fileTree={fileTree}
          changedPaths={changedPaths}
          onEditorStateChange={onEditorStateChange}
          theme={theme}
          onOpenCommandPalette={onOpenCommandPalette}
        />
      </div>
    </section>
  );
}
