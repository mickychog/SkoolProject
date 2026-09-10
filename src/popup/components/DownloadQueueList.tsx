import {
  Video,
  FileText,
  XCircle,
  AlertCircle,
  Clock,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { DownloadTask } from '@/types/queue';

interface Props {
  tasks: DownloadTask[];
  onCancelTask: (taskId: string) => void;
}

export default function DownloadQueueList({ tasks, onCancelTask }: Props) {
  if (tasks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', fontSize: '12px' }}>
        No hay descargas en cola actualmente.
      </div>
    );
  }

  const getStatusBadge = (task: DownloadTask) => {
    switch (task.status) {
      case 'completed':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#34d399', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
            <CheckCircle size={11} /> Listo
          </span>
        );
      case 'downloading':
      case 'processing':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#60a5fa', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
            <Loader2 size={11} className="animate-spin" /> {task.status}
          </span>
        );
      case 'failed':
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#f87171', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
            <AlertCircle size={11} /> Error
          </span>
        );
      default:
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#94a3b8', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase' }}>
            <Clock size={11} /> En cola
          </span>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
      {tasks.map((task) => (
        <div
          key={task.id}
          style={{
            padding: '10px',
            backgroundColor: '#111827',
            border: '1px solid #1e293b',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              {task.assetType === 'video' ? (
                <Video size={14} color="#60a5fa" />
              ) : (
                <FileText size={14} color="#34d399" />
              )}
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#f1f5f9',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  maxWidth: '220px',
                }}
              >
                {task.title}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {getStatusBadge(task)}
              {task.status !== 'completed' && (
                <button
                  onClick={() => onCancelTask(task.id)}
                  title="Cancelar descarga"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                  }}
                >
                  <XCircle size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Subtitle / Path */}
          <span style={{ fontSize: '10px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.targetFolder}{task.suggestedFileName}
          </span>

          {/* Progress Bar */}
          <div style={{ height: '4px', backgroundColor: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${task.progressPercent || (task.status === 'completed' ? 100 : 0)}%`,
                height: '100%',
                backgroundColor: task.status === 'completed' ? '#10b981' : task.status === 'failed' ? '#ef4444' : '#3b82f6',
                transition: 'width 0.3s ease',
              }}
            />
          </div>

          {task.error && (
            <span style={{ fontSize: '10px', color: '#f87171' }}>
              {task.error}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
