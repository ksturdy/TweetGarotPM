import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudIcon from '@mui/icons-material/Cloud';
import GrainIcon from '@mui/icons-material/Grain';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import DescriptionIcon from '@mui/icons-material/Description';
import { dailyReportsApi, DailyReport } from '../../../services/dailyReports';

const weatherIcon = (weather: string) => {
  const iconStyle = { fontSize: 18, color: '#6b7280' };
  switch (weather?.toLowerCase()) {
    case 'sunny':
      return <WbSunnyIcon style={{ ...iconStyle, color: '#f59e0b' }} />;
    case 'cloudy':
    case 'partly cloudy':
      return <CloudIcon style={iconStyle} />;
    case 'rainy':
      return <GrainIcon style={{ ...iconStyle, color: '#3b82f6' }} />;
    case 'snowy':
      return <AcUnitIcon style={{ ...iconStyle, color: '#93c5fd' }} />;
    default:
      return <WbSunnyIcon style={iconStyle} />;
  }
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const truncate = (text: string, maxLength: number): string => {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
};

const FieldDailyReportList: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['field-daily-reports', projectId],
    queryFn: async () => {
      const res = await dailyReportsApi.getByProject(Number(projectId));
      return res.data;
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return <div className="field-loading">Loading daily reports...</div>;
  }

  return (
    <div>
      <h1 className="field-page-title">Daily Reports</h1>
      <p className="field-page-subtitle">Field activity logs for this project</p>

      {reports.length === 0 ? (
        <div className="field-empty">
          <DescriptionIcon />
          <div className="field-empty-title">No daily reports yet</div>
          <div className="field-empty-text">
            Tap the + button to create your first daily report
          </div>
        </div>
      ) : (
        reports.map((report: DailyReport) => (
          <div
            key={report.id}
            className="field-card"
            onClick={() =>
              navigate(
                `/field/projects/${projectId}/daily-reports/${report.id}`
              )
            }
          >
            <div className="field-card-header">
              <div>
                <div className="field-card-number">
                  {formatDate(report.report_date)}
                </div>
                <div className="field-card-title">
                  {weatherIcon(report.weather)}{' '}
                  {report.weather}
                  {report.temperature ? ` - ${report.temperature}` : ''}
                </div>
              </div>
              <span
                className={`field-status field-status-${report.status}`}
              >
                {report.status}
              </span>
            </div>
            {report.work_performed && (
              <div className="field-card-subtitle">
                {truncate(report.work_performed, 120)}
              </div>
            )}
            <div className="field-card-meta">
              By {report.created_by_name}
            </div>
          </div>
        ))
      )}

      <button
        className="field-fab"
        onClick={() =>
          navigate(`/field/projects/${projectId}/daily-reports/new`)
        }
        aria-label="Create daily report"
      >
        <AddIcon />
      </button>
    </div>
  );
};

export default FieldDailyReportList;
