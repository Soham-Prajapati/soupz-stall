import SimpleMode from '../components/simple/SimpleMode.jsx';
import './DashboardChatPage.css';

export default function DashboardChatPage({ daemon, filePaths = [] }) {
  return (
    <section className="dashboard-chat-page">
      <div className="dashboard-chat-page__header">
        <h2 className="dashboard-chat-page__title">Chat Workspace</h2>
        <p className="dashboard-chat-page__subtitle">Conversational workflow with optional live preview and task orchestration.</p>
      </div>
      <div className="dashboard-chat-page__body">
        <SimpleMode daemon={daemon} filePaths={filePaths} />
      </div>
    </section>
  );
}
