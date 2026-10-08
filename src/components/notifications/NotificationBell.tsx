import React, { useEffect, useRef, useState } from 'react';
import { useNexus } from '../../store/useNexusStore';
import { Bell, Check, AlertTriangle, TrendingUp, Share2, FolderPlus, MessageCircle } from 'lucide-react';

const typeIcon: Record<string, React.ReactNode> = {
  HIGH_SEVERITY_ANOMALY: <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />,
  SIU_CASE_CREATED: <FolderPlus className="w-3.5 h-3.5 text-blue-600" />,
  RISK_ESCALATED: <TrendingUp className="w-3.5 h-3.5 text-amber-600" />,
  NETWORK_RISK_ESCALATED: <Share2 className="w-3.5 h-3.5 text-purple-600" />,
};

const statusTone: Record<string, string> = {
  QUEUED: 'text-slate-500',
  SENDING: 'text-blue-600',
  SENT: 'text-blue-600',
  DELIVERED: 'text-emerald-600',
  READ: 'text-emerald-700',
  FAILED: 'text-rose-600',
  RETRYING: 'text-amber-600',
  DEAD_LETTER: 'text-rose-700',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const NotificationBell: React.FC = () => {
  const { notifications, unreadNotifications, refreshNotifications, markNotificationsRead, openCaseByExternalId, whatsappMode } = useNexus();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) refreshNotifications();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        title="Investigator notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadNotifications > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadNotifications > 9 ? '9+' : unreadNotifications}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 cs-card shadow-xl z-50 overflow-hidden animate-cs-rise">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Notifications</span>
              {whatsappMode && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${whatsappMode === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  WA {whatsappMode}
                </span>
              )}
            </div>
            {unreadNotifications > 0 && (
              <button onClick={() => markNotificationsRead()} className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-slate-400">No investigator alerts yet.</div>
            )}
            {notifications.map((n) => (
              <button
                key={n.notificationId}
                onClick={() => {
                  markNotificationsRead([n.notificationId]);
                  if (n.caseId.startsWith('CASE')) openCaseByExternalId(n.caseId);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex gap-2.5 ${n.read ? '' : 'bg-blue-50/40'}`}
              >
                <span className="mt-0.5 shrink-0">{typeIcon[n.notificationType] || <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {n.notificationType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (ch) => ch.toUpperCase())}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{relativeTime(n.createdAt)}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 truncate">
                    {n.caseId} · {n.providerId || n.networkId || '—'}
                    {n.unassigned && <span className="text-amber-600"> · routed to duty officer</span>}
                  </p>
                  <span className={`text-[10px] font-semibold ${statusTone[n.status] || 'text-slate-500'}`}>
                    {n.status === 'READ' ? '✓✓ Read' : n.status === 'DELIVERED' ? '✓✓ Delivered' : n.status === 'SENT' ? '✓ Sent' : n.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
