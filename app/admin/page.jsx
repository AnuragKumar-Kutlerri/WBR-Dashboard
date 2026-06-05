'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchSheets, uploadWeek, deleteWeek, isAdmin } from '@/lib/api';
import { listPeriods, weeksInPeriod, labelFor } from '@/lib/fiscalCalendar';

const ROLES = [
  { key: 'wbr', label: 'Weekly Review (WBR)' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'catering', label: 'Catering' },
];

export default function AdminPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [period, setPeriod] = useState(listPeriods()[0]);
  const [week, setWeek] = useState(1);
  const [files, setFiles] = useState({ wbr: null, loyalty: null, catering: null });
  const [sheets, setSheets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadSheets = useCallback(() => {
    fetchSheets().then(setSheets).catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('wbr_token')) {
      router.replace('/login');
    } else if (!isAdmin()) {
      router.replace('/');
    } else {
      setAuthChecked(true);
      loadSheets();
    }
  }, [router, loadSheets]);

  const maxWeek = weeksInPeriod(period) || 4;
  const weekOptions = Array.from({ length: maxWeek }, (_, i) => i + 1);

  function handlePeriodChange(p) {
    setPeriod(p);
    if (week > (weeksInPeriod(p) || 4)) setWeek(1);
  }

  function setRoleFile(role, file) {
    setFiles(prev => ({ ...prev, [role]: file }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!files.wbr && !files.loyalty && !files.catering) {
      setError('Choose at least one spreadsheet to upload');
      return;
    }
    setBusy(true);
    try {
      const { written } = await uploadWeek(files, period, week);
      const label = labelFor(period, week);
      setSuccess(`Saved ${written.join(', ')} for ${label}. Users see it on next refresh.`);
      setFiles({ wbr: null, loyalty: null, catering: null });
      e.target.reset();
      loadSheets();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteFile(weekKey, role, label) {
    if (!window.confirm(`Delete the ${role} file for ${label}? You can re-upload it anytime.`)) return;
    setError(''); setSuccess('');
    try {
      await deleteWeek(weekKey, role);
      setSuccess(`Deleted ${role} for ${label}.`);
      loadSheets();
    } catch (err) { setError(err.message); }
  }

  async function handleDeleteWeek(weekKey, label) {
    if (!window.confirm(`Delete ALL files for ${label}? This removes it for all users and can't be undone.`)) return;
    setError(''); setSuccess('');
    try {
      await deleteWeek(weekKey);
      setSuccess(`Deleted ${label}.`);
      loadSheets();
    } catch (err) { setError(err.message); }
  }

  if (!authChecked) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <img src="/kutlerri-logo.png" alt="Kutlerri" className="login-logo" />
      <div className="login-card" style={{ maxWidth: 480 }}>
        <div className="login-title">Admin · Upload Week</div>
        <div className="login-sub" style={{ marginBottom: 18 }}>
          Pick a period and week, then upload one or more workbooks. Re-uploading a
          file replaces just that file.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="login-label">Period</label>
              <select
                className="week-selector"
                style={{ width: '100%' }}
                value={period}
                onChange={e => handlePeriodChange(parseInt(e.target.value, 10))}
              >
                {listPeriods().map(p => <option key={p} value={p}>P{p}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="login-label">Week</label>
              <select
                className="week-selector"
                style={{ width: '100%' }}
                value={week}
                onChange={e => setWeek(parseInt(e.target.value, 10))}
              >
                {weekOptions.map(w => <option key={w} value={w}>Week {w}</option>)}
              </select>
            </div>
          </div>

          <div style={{ fontSize: 12, color: 'var(--muted, #888)', margin: '10px 0 14px' }}>
            {labelFor(period, week) || '—'}
          </div>

          {ROLES.map(r => (
            <div key={r.key} style={{ marginBottom: 12 }}>
              <label className="login-label">{r.label} <span style={{ color: '#9ca3af' }}>(optional)</span></label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={e => setRoleFile(r.key, e.target.files?.[0] || null)}
              />
            </div>
          ))}

          <button className="login-btn" type="submit" disabled={busy}>
            {busy ? 'Uploading…' : 'Upload'}
          </button>
          {error && <div className="login-error">{error}</div>}
          {success && (
            <div className="login-error" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}>
              {success}
            </div>
          )}
        </form>

        {sheets.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Available weeks</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13 }}>
              {sheets.map(s => (
                <li key={s.week} style={{ padding: '8px 0', borderBottom: '1px solid #f1f1f4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{s.label}</span>
                    {s.deletable ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteWeek(s.week, s.label)}
                        style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                      >
                        Delete week
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>built-in</span>
                    )}
                  </div>
                  {s.deletable && s.files && (
                    <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                      {ROLES.map(r => (
                        <span key={r.key} style={{ fontSize: 12, color: s.files[r.key] ? '#374151' : '#cbd5e1' }}>
                          {r.key}
                          {s.files[r.key] && (
                            <button
                              type="button"
                              onClick={() => handleDeleteFile(s.week, r.key, s.label)}
                              title={`Delete ${r.key}`}
                              style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 11, marginLeft: 4 }}
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Link href="/" style={{ fontSize: 13, color: 'var(--accent, #7c3aed)' }}>← Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
