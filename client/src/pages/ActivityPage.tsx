import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Clock, ShieldCheck, RefreshCw } from 'lucide-react';

export const ActivityPage: React.FC = () => {
  const logs = useLiveQuery(
    () => db.activityLog.orderBy('createdAt').reverse().toArray(),
    []
  ) || [];

  const outboxItems = useLiveQuery(
    () => db.outbox.orderBy('createdAt').reverse().toArray(),
    []
  ) || [];

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-28 space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-on-surface">Field Operations Activity & Outbox</h1>
        <p className="text-xs text-on-surface-variant mt-0.5">
          Real-time transaction log, synchronization queues, and local audit trail
        </p>
      </div>

      {/* Outbox Queue Section */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-secondary" />
            <span>Local Outbox Telemetry Queue</span>
          </h3>
          <span className="font-mono text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
            {outboxItems.length} in queue
          </span>
        </div>

        {outboxItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-on-surface-variant bg-surface-container-low/40 rounded-xl">
            <ShieldCheck className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
            <span>Outbox is completely clear. All field edits are synced with upstream hub.</span>
          </div>
        ) : (
          <div className="divide-y divide-surface-container">
            {outboxItems.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono font-bold text-on-surface uppercase text-[11px] bg-surface-container px-1.5 py-0.5 rounded mr-2">
                    {item.action}
                  </span>
                  <span className="text-on-surface-variant">Report ID: {item.reportId.slice(0, 8)}...</span>
                  <div className="text-[10px] text-on-surface-variant font-mono mt-0.5">
                    Idempotency Key: {item.idempotencyKey.slice(0, 13)}... • Attempts: {item.attempts || 0}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Logs Timeline */}
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
          <Clock className="w-4 h-4 text-secondary" />
          <span>Audit Log History</span>
        </h3>

        {logs.length === 0 ? (
          <p className="text-xs text-on-surface-variant">No activity logs recorded yet.</p>
        ) : (
          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container">
            {logs.map((log) => (
              <div key={log.id} className="relative text-xs">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-secondary ring-4 ring-white" />
                <div className="flex items-center justify-between">
                  <span className="font-bold text-on-surface">{log.actorName}</span>
                  <span className="text-[11px] text-on-surface-variant font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-on-surface-variant mt-0.5">{log.description}</p>
                {log.newValue && (
                  <span className="inline-block mt-1 font-mono text-[10px] bg-surface-container px-2 py-0.5 rounded text-on-surface">
                    new state: {log.newValue}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
