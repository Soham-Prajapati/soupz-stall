import SimpleMode from '../components/simple/SimpleMode.jsx';
import './DashboardPages.css';

export default function DashboardChatPage({ daemon, filePaths = [] }) {
  return (
    <section className="dashboard-page dashboard-page--chat">
      <div className="dashboard-page__header">
        <h2 className="dashboard-page__title">Chat Workspace</h2>
        <p className="dashboard-page__subtitle">Conversational workflow with optional live preview and task orchestration.</p>
      </div>
      <div className="dashboard-page__body">
        <SimpleMode daemon={daemon} filePaths={filePaths} />
      </div>
    </section>
  );
}
