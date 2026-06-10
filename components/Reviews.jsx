'use client';

import { useState, useMemo } from 'react';
import '@/lib/chartSetup';
import { Bar } from 'react-chartjs-2';
import Table from './Table';
import { fmtN } from '@/lib/fmt';

const SOURCES = [
  { id: 'instore',    label: 'Google + Yelp' },
  { id: 'thirdparty', label: '3rd Party (UE / DD / GH)' },
];
const PERIODS = [
  { id: 'weekly', label: '7 Days' },
  { id: 'day30',  label: '30 Days' },
  { id: 'ninety', label: '90 Days' },
];

// Non-location rows to drop from the 3rd Party reviews tables (both periods).
const EXCLUDED_3PD = ['Trey', 'Rahul', 'Sahil', 'Didier', 'Olga'];

const STAR_LOCS = [
  { value: 'all', label: 'All Locations' },
  { value: 'Ballpark', label: 'Ballpark' },
  { value: 'MVT', label: 'MVT' },
  { value: 'NL', label: 'NL' },
  { value: 'Mosaic', label: 'Mosaic' },
  { value: 'Rockville', label: 'Rockville' },
];

// Thresholds mirror the conditional-formatting rules on the rating cells in the
// source XLSX (sheet 'Weekly in-store leadership metr', ranges D/J/L/R/X/Z):
//   >=4.7 → dxf7 green, 4.51-4.69 → dxf6 yellow, <=4.5 → dxf4 red.
// Applied to the Rating column as well as the per-platform rating columns.
function ratingBadge(v) {
  if (v == null || v === '-' || typeof v !== 'number' || isNaN(v)) {
    return <span className="badge neutral">NA</span>;
  }
  // Rating cells: >=4.7 green, 4.51-4.69 yellow, <=4.5 red
  const cls = v >= 4.7 ? 'green' : v > 4.5 ? 'amber' : 'red';
  return <span className={`badge ${cls}`}>{Number(v).toFixed(1)}</span>;
}
function errRateBadge(v) {
  // M10:M15 / AA10:AA15 — 3rd Party error rate:
  // <=1.54% green, 1.55-2.19% yellow, >=2.19% red
  const n = Number(v) || 0;
  const cls = n <= 0.0154 ? 'green' : n < 0.0219 ? 'amber' : 'red';
  return <span className={`badge ${cls}`}>{(n * 100).toFixed(1)}%</span>;
}

function computeTotal(rows, source) {
  const list = rows.filter(r => !/total/i.test(r.loc));
  if (!list.length) return null;
  const reviews = list.reduce((a, r) => a + (r.reviews || 0), 0);
  const s5 = list.reduce((a, r) => a + (r.s5 || 0), 0);
  const wRating = list.reduce((a, r) => a + (r.rating || 0) * (r.reviews || 0), 0);
  const rating = reviews ? wRating / reviews : (list.reduce((a, r) => a + (r.rating || 0), 0) / list.length);
  if (source === 'thirdparty') {
    const wErr = list.reduce((a, r) => a + (r.errRate || 0) * (r.reviews || 0), 0);
    const errRate = reviews ? wErr / reviews : (list.reduce((a, r) => a + (r.errRate || 0), 0) / list.length);
    return { loc: 'Total', reviews, rating, s5, errRate };
  }
  return { loc: 'Total', reviews, rating, s5 };
}

// One reviews table (Google+Yelp or 3PD). Reused for the single per-source view
// and for the 30-day view that stacks both kinds.
function ReviewTable({ rows, kind, periodLabel }) {
  const filtered = (rows || []).filter(r => kind !== 'thirdparty' || !EXCLUDED_3PD.includes(String(r.loc).trim()));
  const found = filtered.find(r => /^total$/i.test(r.loc));
  const total = found || computeTotal(filtered, kind) || { loc: 'Total', reviews: 0, rating: 0, s5: 0, errRate: 0 };
  const dataRows = filtered.filter(r => !/^total$/i.test(r.loc));
  const tableRows = [...dataRows, { ...total, loc: 'Total' }];
  const title = kind === 'instore'
    ? `In-Store Reviews — Google + Yelp (${periodLabel})`
    : `3rd Party Reviews — UE / DD / GH (${periodLabel})`;
  const headers = [
    { label: 'Location' },
    { label: '# Reviews', cls: 'right' },
    { label: 'Rating', cls: 'right' },
    { label: '5★', cls: 'right' }, { label: '4★', cls: 'right' }, { label: '3★', cls: 'right' },
    { label: '2★', cls: 'right' }, { label: '1★', cls: 'right' },
    ...(kind === 'instore'
      ? [{ label: 'Yelp', cls: 'right' }, { label: 'Yelp #', cls: 'right' }, { label: 'Google', cls: 'right' }, { label: 'Google #', cls: 'right' }]
      : [{ label: 'UE', cls: 'right' }, { label: 'DD', cls: 'right' }, { label: 'GH', cls: 'right' }, { label: 'Error Rate', cls: 'right' }]),
  ];
  return (
    <div className="table-card">
      <div className="table-title">{title}</div>
      <Table
        headers={headers}
        rows={tableRows.map(r => ({
          _cls: /^total$/i.test(r.loc) ? 'total-row' : '',
          cells: [
            r.loc, fmtN(r.reviews), ratingBadge(r.rating),
            fmtN(r.s5), fmtN(r.s4), fmtN(r.s3), fmtN(r.s2), fmtN(r.s1),
            ...(kind === 'instore'
              ? [ratingBadge(r.yelp), fmtN(r.yelpN), ratingBadge(r.google), fmtN(r.gNum)]
              : [ratingBadge(r.ue), ratingBadge(r.dd), ratingBadge(r.gh), errRateBadge(r.errRate)]),
          ],
        }))}
      />
    </div>
  );
}

export default function Reviews({ data }) {
  const [source, setSource] = useState('instore');
  const [period, setPeriod] = useState('weekly');
  const [starLoc, setStarLoc] = useState('all');

  // The 30-day tables only ship from Jun 2026 onward; hide the filter otherwise.
  const has30 = !!(data?.reviews?.instore?.day30?.length || data?.reviews?.thirdparty?.day30?.length);
  const periods = has30 ? PERIODS : PERIODS.filter(p => p.id !== 'day30');

  const rowsRaw = ((data?.reviews?.[source]?.[period]) || [])
    .filter(r => source !== 'thirdparty' || !EXCLUDED_3PD.includes(String(r.loc).trim()));
  const periodLabel = period === 'weekly' ? '7 Days' : period === 'day30' ? '30 Days' : '90 Days';

  const total = useMemo(() => {
    const found = rowsRaw.find(r => /^total$/i.test(r.loc));
    return found || computeTotal(rowsRaw, source) || { reviews: 0, rating: 0, s5: 0, errRate: 0 };
  }, [rowsRaw, source]);

  const dataRows = rowsRaw.filter(r => !/^total$/i.test(r.loc));

  const starData = useMemo(() => {
    let s5 = 0, s4 = 0, s3 = 0, s2 = 0, s1 = 0, label;
    if (starLoc === 'all') {
      dataRows.forEach(r => { s5 += r.s5||0; s4 += r.s4||0; s3 += r.s3||0; s2 += r.s2||0; s1 += r.s1||0; });
      label = 'All Locations';
    } else {
      const row = dataRows.find(r => r.loc === starLoc);
      if (row) { s5 = row.s5||0; s4 = row.s4||0; s3 = row.s3||0; s2 = row.s2||0; s1 = row.s1||0; }
      label = starLoc;
    }
    return {
      labels: ['5 Star', '4 Star', '3 Star', '2 Star', '1 Star'],
      datasets: [{
        label,
        data: [s5, s4, s3, s2, s1],
        backgroundColor: ['#9f7cef', '#c3a8f5', '#b99af3', '#d6c3f8', 'rgba(220,38,38,0.75)'],
        borderRadius: 4,
      }],
    };
  }, [dataRows, starLoc]);

  const ratingChart = useMemo(() => {
    if (source === 'instore') {
      return {
        labels: dataRows.map(r => r.loc),
        datasets: [
          { label: 'Google Rating', data: dataRows.map(r => typeof r.google === 'number' ? r.google : null), backgroundColor: '#9f7cef', borderRadius: 4 },
          { label: 'Yelp Rating',   data: dataRows.map(r => typeof r.yelp   === 'number' ? r.yelp   : null), backgroundColor: '#93c5fd', borderRadius: 4 },
        ],
      };
    }
    return {
      labels: dataRows.map(r => r.loc),
      datasets: [
        { label: 'Uber Eats', data: dataRows.map(r => typeof r.ue === 'number' ? r.ue : null), backgroundColor: '#9f7cef', borderRadius: 4 },
        { label: 'DoorDash',  data: dataRows.map(r => typeof r.dd === 'number' ? r.dd : null), backgroundColor: '#7c3aed', borderRadius: 4 },
        { label: 'Grubhub',   data: dataRows.map(r => typeof r.gh === 'number' ? r.gh : null), backgroundColor: '#93c5fd', borderRadius: 4 },
      ],
    };
  }, [dataRows, source]);

  const chart1Title = source === 'instore'
    ? `Avg Rating by Location (${periodLabel})`
    : `Avg Rating by Location — 3rd Party (${periodLabel})`;
  const chart2Title = source === 'instore'
    ? `Star Distribution — In-Store (${periodLabel})`
    : `Star Distribution — 3rd Party (${periodLabel})`;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reviews</span>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="toggle-group">
            {SOURCES.map(s => (
              <button key={s.id} className={`toggle-btn${source === s.id ? ' active' : ''}`} onClick={() => setSource(s.id)}>{s.label}</button>
            ))}
          </div>
          <div className="toggle-group">
            {periods.map(p => (
              <button key={p.id} className={`toggle-btn${period === p.id ? ' active' : ''}`} onClick={() => setPeriod(p.id)}>{p.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="kpi-row">
        {source === 'instore' ? (
          <>
            <div className="kpi-card">
              <div className="kpi-label">In-Store Reviews</div>
              <div className="kpi-value">{fmtN(total.reviews)}</div>
              <div className="kpi-change neu">Google + Yelp</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Avg Rating</div>
              <div className="kpi-value">{(total.rating || 0).toFixed(1)}</div>
              <div className="kpi-change neu">Google + Yelp</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">5 Star Reviews</div>
              <div className="kpi-value">{fmtN(total.s5)}</div>
              <div className="kpi-change neu">Google + Yelp</div>
            </div>
          </>
        ) : (
          <>
            <div className="kpi-card">
              <div className="kpi-label">3PD Reviews</div>
              <div className="kpi-value">{fmtN(total.reviews)}</div>
              <div className="kpi-change neu">UE / DD / GH</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Avg Rating</div>
              <div className="kpi-value">{(total.rating || 0).toFixed(1)}</div>
              <div className="kpi-change neu">UE / DD / GH avg</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">5 Star Reviews</div>
              <div className="kpi-value">{fmtN(total.s5)}</div>
              <div className="kpi-change neu">UE / DD / GH</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Overall Error Rate</div>
              <div className="kpi-value">{((total.errRate || 0) * 100).toFixed(1)}%</div>
              <div className={`kpi-change ${(total.errRate || 0) < 0.02 ? 'pos' : (total.errRate === 0.02 ? 'neu' : 'neg')}`}>UE + DD + GH</div>
            </div>
          </>
        )}
      </div>

      <ReviewTable rows={rowsRaw} kind={source} periodLabel={periodLabel} />

      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-title">{chart1Title}</div>
          <Bar
            data={ratingChart}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { min: source === 'instore' ? 1.0 : 0, max: 5.0, ticks: { stepSize: 1 } } },
            }}
          />
        </div>
        <div className="chart-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div className="chart-title" style={{ marginBottom: 0 }}>{chart2Title}</div>
            <select
              value={starLoc}
              onChange={e => setStarLoc(e.target.value)}
              style={{ background: '#f3f4f6', border: '1.5px solid var(--border)', color: '#1a1f2e', padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: "'Montserrat', sans-serif" }}
            >
              {STAR_LOCS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Bar
            data={starData}
            options={{
              responsive: true,
              plugins: { legend: { position: 'bottom' } },
              scales: { y: { ticks: { stepSize: 1, callback: v => Number.isInteger(v) ? v : null } } },
            }}
          />
        </div>
      </div>
    </>
  );
}
