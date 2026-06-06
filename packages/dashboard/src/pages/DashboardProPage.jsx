import ProMode from '../components/pro/ProMode.jsx';
import './DashboardProPage.css';

export default function DashboardProPage({ daemon, fileTree, changedPaths, onEditorStateChange, theme, onOpenCommandPalette }) {
  return (
    <section className="dashboard-pro-page">
      <div className="dashboard-pro-page__header">
        <h2 className="dashboard-pro-page__title">Code Workspace</h2>
        <p className="dashboard-pro-page__subtitle">File explorer, editor, git tools, terminal, and agent chat in IDE mode.</p>
      </div>
      <div className="dashboard-pro-page__body">
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
