import React, { useState } from 'react';
import { Play, Power, Calendar, User, DollarSign, ShieldAlert } from 'lucide-react';
import type { Session } from '../../types';

interface SessionControlProps {
  token: string | null;
  activeSession: Session | null;
  onSessionOpened: (session: Session) => void;
  onSessionClosed: () => void;
  userName: string;
}

export const SessionControl: React.FC<SessionControlProps> = ({
  token,
  activeSession,
  onSessionOpened,
  onSessionClosed,
  userName
}) => {
  const [loading, setLoading] = useState(false);
  const [closingInput, setClosingInput] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Trigger Open Session API
  const handleOpenSession = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sessions/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (response.ok) {
        onSessionOpened(data);
        alert('POS checkout session opened successfully!');
      } else {
        alert(data.error || 'Failed to open session.');
      }
    } catch (err) {
      console.error('Error opening session:', err);
      alert('Error connecting to the backend API.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger Close Session API
  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    setLoading(true);

    const closingAmount = closingInput ? parseFloat(closingInput) : undefined;

    try {
      const response = await fetch(`/api/sessions/${activeSession.id}/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ closing_amount: closingAmount })
      });
      const data = await response.json();
      if (response.ok) {
        onSessionClosed();
        setShowCloseModal(false);
        setClosingInput('');
        alert(`Session closed successfully. Final cash balance: ₹${(data.closing_sale_amount || 0).toFixed(2)}`);
      } else {
        alert(data.error || 'Failed to close session.');
      }
    } catch (err) {
      console.error('Error closing session:', err);
      alert('Error connecting to the backend.');
    } finally {
      setLoading(false);
    }
  };

  if (!activeSession) {
    return (
      <div className="bg-white border border-red-100 p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-500">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">POS checkout session is Closed</h3>
            <p className="text-xs text-slate-400 mt-0.5">You must open a session before you can process payments or send orders to the kitchen.</p>
          </div>
        </div>
        <button
          onClick={handleOpenSession}
          disabled={loading}
          className="w-full sm:w-auto px-5 py-2.5 bg-slate-850 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          <Play className="w-4 h-4 fill-white" />
          {loading ? 'Opening...' : 'Open POS Session'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-50 border border-green-100 text-green-600 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-green-600">POS Session Open</span>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">Session ID: #{activeSession.id}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <User className="w-4 h-4 text-slate-400" />
          <span>Opened By:</span>
          <span className="text-slate-800 font-bold">{activeSession.employee_name || userName}</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <DollarSign className="w-4 h-4 text-slate-400" />
          <span>Opened on:</span>
          <span className="text-slate-800 font-bold">
            {new Date(activeSession.opening_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      <button
        onClick={() => setShowCloseModal(true)}
        className="w-full sm:w-auto px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
      >
        <Power className="w-4 h-4" />
        Close Session
      </button>

      {/* CLOSE SESSION MODAL DIAGALOG BOX */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-base font-extrabold text-slate-800">Close POS Session</h3>
              <p className="text-xs text-slate-400">Please enter the closing cash drawer balance to reconcile sales.</p>
            </div>

            <form onSubmit={handleCloseSession} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Closing Sale Amount (₹)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-xs">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Auto-calculated if blank"
                    value={closingInput}
                    onChange={(e) => setClosingInput(e.target.value)}
                    className="w-full text-xs pl-7 pr-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500 text-slate-850"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
                >
                  {loading ? 'Closing...' : 'Close Session'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCloseModal(false); setClosingInput(''); }}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
