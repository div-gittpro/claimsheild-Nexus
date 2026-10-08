import React, { useMemo, useState } from 'react';
import { CaseRecord } from '../../types';
import {
  whatsAppAlertService,
  caseToWhatsAppInput,
  WhatsAppAlert,
} from '../../services/whatsapp/WhatsAppAlertService';
import { addWhatsAppHistory } from '../../services/whatsapp/history';
import { MessageCircle, X, ExternalLink, CheckCircle2 } from 'lucide-react';

/**
 * Reusable WhatsApp alert action (Sections 3, 8, 10, 16).
 *
 * One component, one central service — used by the Case Workbench, SIU Queue
 * and Overview. Restrained green accent; opens a confirmation modal with a full
 * message preview; on confirm opens WhatsApp via the deep link and surfaces a
 * "prepared" (never "delivered") state.
 */

interface Props {
  caseRecord: CaseRecord;
  investigatorPhone?: string;
  variant?: 'button' | 'icon';
  className?: string;
}

const WA_GREEN = '#25D366';

export const WhatsAppAlertButton: React.FC<Props> = ({ caseRecord, investigatorPhone, variant = 'button', className = '' }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [prepared, setPrepared] = useState<WhatsAppAlert | null>(null);
  const [opened, setOpened] = useState(false);

  const input = useMemo(() => caseToWhatsAppInput(caseRecord, investigatorPhone), [caseRecord, investigatorPhone]);
  const eligibility = useMemo(() => whatsAppAlertService.checkEligibility(input), [input]);

  const openModal = () => {
    if (!eligibility.eligible) return;
    setPrepared(whatsAppAlertService.prepareAlert(input));
    setOpened(false);
    setModalOpen(true);
  };

  const handleOpenWhatsApp = () => {
    if (!prepared) return;
    whatsAppAlertService.open(prepared);
    addWhatsAppHistory({ caseId: prepared.caseId, recipientLabel: prepared.recipientLabel, preparedAt: prepared.preparedAt });
    setOpened(true);
  };

  const disabled = !eligibility.eligible;

  const trigger =
    variant === 'icon' ? (
      <button
        onClick={openModal}
        disabled={disabled}
        title={disabled ? eligibility.reason : 'Send WhatsApp alert'}
        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${
          disabled
            ? 'border-slate-200 text-slate-300 cursor-not-allowed'
            : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
        } ${className}`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
      </button>
    ) : (
      <button
        onClick={openModal}
        disabled={disabled}
        title={disabled ? eligibility.reason : 'Send WhatsApp alert'}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
          disabled
            ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
            : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
        } ${className}`}
      >
        <MessageCircle className="w-3.5 h-3.5" style={disabled ? undefined : { color: WA_GREEN }} />
        <span>Send WhatsApp Alert</span>
      </button>
    );

  return (
    <>
      {trigger}

      {modalOpen && prepared && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setModalOpen(false)} />
          <div className="relative cs-card w-full max-w-md shadow-2xl animate-cs-rise overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${WA_GREEN}1a` }}>
                  <MessageCircle className="w-4 h-4" style={{ color: WA_GREEN }} />
                </span>
                <h3 className="text-sm font-bold text-slate-900">{opened ? 'WhatsApp opened' : 'Send WhatsApp Alert?'}</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              {opened ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">WhatsApp alert prepared for {prepared.caseId}.</p>
                    <p className="text-[11px] text-emerald-700 mt-0.5">Message pre-filled in WhatsApp. Press Send there to notify the investigator.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-xs">
                    <span className="cs-section-label block mb-1">Recipient</span>
                    <span className="font-mono text-slate-800">{prepared.recipientLabel}</span>
                  </div>
                  <div className="text-xs">
                    <span className="cs-section-label block mb-1">Message</span>
                    <pre className="whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-64 overflow-y-auto">
{prepared.message}
                    </pre>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Contains investigation metadata only — no patient or clinical detail. You remain the sender.
                  </p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-100">
              {opened ? (
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors">
                  Done
                </button>
              ) : (
                <>
                  <button onClick={() => setModalOpen(false)} className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={handleOpenWhatsApp}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-xs font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: WA_GREEN }}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open WhatsApp
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
