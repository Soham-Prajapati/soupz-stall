import BuilderMode from '../components/builder/BuilderMode.jsx';
import './DashboardBuildPage.css';

export default function DashboardBuildPage({ daemon }) {
  return (
    <section className="dashboard-build-page">
      <div className="dashboard-build-page__header">
        <h2 className="dashboard-build-page__title">Build Workspace</h2>
        <p className="dashboard-build-page__subtitle">Prompt-driven feature construction with dedicated build flow and preview loop.</p>
      </div>
      <div className="dashboard-build-page__body">
        <BuilderMode daemon={daemon} />
      </div>
    </section>
  );
}
