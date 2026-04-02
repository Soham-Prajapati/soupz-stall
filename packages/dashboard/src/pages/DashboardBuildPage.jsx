import BuilderMode from '../components/builder/BuilderMode.jsx';
import './DashboardPages.css';

export default function DashboardBuildPage({ daemon }) {
  return (
    <section className="dashboard-page dashboard-page--build">
      <div className="dashboard-page__header">
        <h2 className="dashboard-page__title">Build Workspace</h2>
        <p className="dashboard-page__subtitle">Prompt-driven feature construction with dedicated build flow and preview loop.</p>
      </div>
      <div className="dashboard-page__body">
        <BuilderMode daemon={daemon} />
      </div>
    </section>
  );
}
