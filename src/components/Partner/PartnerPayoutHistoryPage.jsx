import React, { useCallback, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '../../constants/socketEvents';
import { ADMIN_PATHS } from '../../routes/adminPaths';

const getApiBase = () => {
	return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
};

const formatMoney = (value) => {
	const n = Number(value);
	if (!Number.isFinite(n)) return '-';
	return `₹${Math.round(n)}`;
};

const getOriginalAmount = (row) => Number(row?.original_amount ?? row?.gross_amount ?? row?.final_amount_after_discount ?? row?.amount ?? 0);
const getCouponDiscount = (row) => Number(row?.coupon_discount ?? 0);
const getFinalPaidAmount = (row) => Number(row?.final_amount_after_discount ?? row?.amount ?? row?.original_amount ?? row?.gross_amount ?? 0);
const getPartnerNetAmount = (row) => Number(row?.partner_final_amount ?? row?.amount ?? 0);

const formatDateTime = (value) => {
	if (!value) return '-';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '-';
	return d.toLocaleString();
};

const toISODate = (d) => {
	if (!d) return '';
	const dt = new Date(d);
	if (Number.isNaN(dt.getTime())) return '';
	return dt.toISOString().slice(0, 10);
};

const toStartOfDay = (d) => {
	const dt = new Date(d);
	dt.setHours(0, 0, 0, 0);
	return dt;
};

const toEndOfDay = (d) => {
	const dt = new Date(d);
	dt.setHours(23, 59, 59, 999);
	return dt;
};

const buildRange = (preset) => {
	const now = new Date();
	if (preset === 'today') {
		return { from: toStartOfDay(now), to: toEndOfDay(now) };
	}
	if (preset === 'week') {
		const start = new Date(now);
		// Sunday as week start (simple + consistent)
		start.setDate(now.getDate() - now.getDay());
		return { from: toStartOfDay(start), to: toEndOfDay(now) };
	}
	if (preset === 'month') {
		const start = new Date(now.getFullYear(), now.getMonth(), 1);
		return { from: toStartOfDay(start), to: toEndOfDay(now) };
	}
	return { from: null, to: null };
};

const downloadBlob = (blob, filename) => {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => {
		try { URL.revokeObjectURL(url); } catch {}
	}, 2500);
};

const toCsv = (rows) => {
	const safe = Array.isArray(rows) ? rows : [];
	const header = [
		'Partner Name',
		'Partner ID',
		'Phone',
		'UPI ID',
		'Payout ID',
		'UTR',
		'Status',
		'Paid At',
		'Service Count',
		'Customer Paid',
		'Admin Commission',
		'Partner Paid',
		'Services'
	];

	const esc = (v) => {
		const s = String(v ?? '');
		if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
		return s;
	};

	const lines = [header.join(',')];
	for (const r of safe) {
		lines.push([
			esc(r?.partner_name || ''),
			esc(r?.partner_id || ''),
			esc(r?.partner_phone || ''),
			esc(r?.upi_id || ''),
			esc(r?.payout_id || ''),
			esc(r?.utr_number || ''),
			esc(r?.payout_status || ''),
			esc(r?.paid_at || ''),
			esc(r?.service_count ?? 0),
			esc(r?.total_customer_paid ?? 0),
			esc(r?.total_admin_commission ?? 0),
			esc(r?.total_partner_paid ?? r?.total_amount ?? 0),
			esc(r?.service_names || '')
		].join(','));
	}
	return lines.join('\n');
};

const getStatusBadge = (status) => {
	const s = String(status || '').toLowerCase();
	if (s === 'failed' || s === 'rejected' || s === 'cancelled') {
		return {
			label: 'failed',
			className: 'bg-red-50 text-red-700 border-red-200'
		};
	}

	if (s === 'processing' || s === 'queued' || s === 'initiated') {
		return {
			label: 'processing',
			className: 'bg-yellow-50 text-yellow-700 border-yellow-200'
		};
	}

	return {
		label: 'success',
		className: 'bg-green-50 text-green-700 border-green-200'
	};
};

const handleAdminUnauthorized = () => {
	localStorage.removeItem('adminToken');
	if (sessionStorage.getItem('adminRedirecting') === '1') return;
	sessionStorage.setItem('adminRedirecting', '1');
	setTimeout(() => {
		sessionStorage.removeItem('adminRedirecting');
	}, 5000);
	window.location.href = ADMIN_PATHS.LOGIN;
};

export default function PartnerPayoutHistoryPage() {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	const [preset, setPreset] = useState('month'); // today | week | month | custom
	const [customFrom, setCustomFrom] = useState('');
	const [customTo, setCustomTo] = useState('');
	const [search, setSearch] = useState('');

	const [openKey, setOpenKey] = useState(null);
	const [detailsLoading, setDetailsLoading] = useState(false);
	const [detailsError, setDetailsError] = useState('');
	const [details, setDetails] = useState(null);

	const apiBase = useMemo(() => getApiBase(), []);
	const backendOrigin = useMemo(() => String(apiBase || '').replace(/\/api\/?$/i, ''), [apiBase]);

	const openKeyRef = React.useRef(openKey);
	React.useEffect(() => {
		openKeyRef.current = openKey;
	}, [openKey]);

	const fetchHistory = useCallback(async (overridePreset) => {
		try {
			setLoading(true);
			setError('');

			const activePreset = overridePreset || preset;
			let from = null;
			let to = null;
			if (activePreset === 'custom') {
				from = customFrom ? toStartOfDay(new Date(customFrom)) : null;
				to = customTo ? toEndOfDay(new Date(customTo)) : null;
			} else {
				({ from, to } = buildRange(activePreset));
			}

			const qs = new URLSearchParams();
			if (from) qs.set('from', from.toISOString());
			if (to) qs.set('to', to.toISOString());
			qs.set('limit', '500');

			const token = localStorage.getItem('adminToken');
			const response = await fetch(`${apiBase}/admin/payout-history?${qs.toString()}`, {
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {})
				}
			});

			if (response.status === 401) {
				handleAdminUnauthorized();
				throw new Error('Session expired');
			}

			if (!response.ok) {
				let msg = `Failed to fetch payout history (${response.status})`;
				try {
					const body = await response.json();
					if (body?.message) msg = body.message;
				} catch {
					// ignore
				}
				throw new Error(msg);
			}

			const data = await response.json();
			setRows(Array.isArray(data?.history) ? data.history : []);
		} catch (e) {
			setError(e?.message || 'Failed to fetch payout history');
			setRows([]);
		} finally {
			setLoading(false);
		}
	}, [apiBase, preset, customFrom, customTo]);

	React.useEffect(() => {
		fetchHistory();
	}, [fetchHistory]);

	const filteredRows = useMemo(() => {
		const q = String(search || '').trim().toLowerCase();
		if (!q) return rows;
		return (rows || []).filter((r) => {
			const hay = [
				r?.partner_name,
				r?.partner_id,
				r?.partner_phone,
				r?.upi_id,
				r?.payout_id,
				r?.utr_number,
				r?.service_names
			]
				.map((v) => String(v ?? '').toLowerCase())
				.join(' ');
			return hay.includes(q);
		});
	}, [rows, search]);

	const openDetails = useCallback(async (row) => {
		const key = row?.payout_id || row?.payout_batch_id;
		if (!key) return;

		setOpenKey(key);
		setDetails(null);
		setDetailsError('');
		setDetailsLoading(true);
		try {
			const token = localStorage.getItem('adminToken');
			const qs = new URLSearchParams();
			if (row?.partner_id) qs.set('partner_id', String(row.partner_id));
			if (row?.paid_at) qs.set('paid_at', String(row.paid_at));

			const resp = await fetch(`${apiBase}/admin/payout-history/${encodeURIComponent(key)}/details?${qs.toString()}`, {
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {})
				}
			});

			if (resp.status === 401) {
				handleAdminUnauthorized();
				throw new Error('Session expired');
			}

			if (!resp.ok) {
				let msg = `Failed to fetch payout details (${resp.status})`;
				try {
					const b = await resp.json();
					if (b?.message) msg = b.message;
				} catch {
					// ignore
				}
				throw new Error(msg);
			}

			const body = await resp.json();
			setDetails(body?.data || null);
		} catch (e) {
			setDetailsError(e?.message || 'Failed to fetch payout details');
			setDetails(null);
		} finally {
			setDetailsLoading(false);
		}
	}, [apiBase]);

	React.useEffect(() => {
		const socket = io(backendOrigin, {
			transports: ['websocket', 'polling'],
			reconnection: true,
			autoConnect: true,
		});

		const token = localStorage.getItem('adminToken');
		const register = () => {
			if (token) socket.emit('registerAdminDashboard', { token });
		};

		const upsertHistoryItem = (item) => {
			if (!item) return;
			const payoutKey = item?.payout_id || item?.payout_batch_id;
			if (!payoutKey) return;

			setRows((prev) => {
				const list = Array.isArray(prev) ? prev : [];
				const idx = list.findIndex((r) => String(r?.payout_id || r?.payout_batch_id || '') === String(payoutKey));
				if (idx === -1) return [item, ...list];
				const next = list.slice();
				next[idx] = { ...next[idx], ...item };
				// Keep sort order by paid_at desc when updating
				next.sort((a, b) => new Date(b?.paid_at || b?.created_at || 0).getTime() - new Date(a?.paid_at || a?.created_at || 0).getTime());
				return next;
			});

			// If details modal is open for this payout, refresh it once.
			if (String(openKeyRef.current || '') === String(payoutKey)) {
				openDetails(item);
			}
		};

		const handleHistoryUpdated = (payload) => {
			const item = payload?.item || null;
			if (item) upsertHistoryItem(item);
		};

		socket.on('connect', register);
		register();

		socket.on(SOCKET_EVENTS.PAYOUT_HISTORY_UPDATED, handleHistoryUpdated);

		return () => {
			socket.off('connect', register);
			socket.off(SOCKET_EVENTS.PAYOUT_HISTORY_UPDATED, handleHistoryUpdated);
			socket.disconnect();
		};
	}, [backendOrigin, openDetails]);

	const closeDetails = () => {
		setOpenKey(null);
		setDetails(null);
		setDetailsError('');
		setDetailsLoading(false);
	};

	const exportExcel = () => {
		const csv = toCsv(filteredRows);
		downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `payout-history-${toISODate(new Date())}.csv`);
	};

	const exportPdf = () => {
		// Lightweight “Export PDF” via browser print-to-PDF (no new libs).
		const html = `
			<html>
			<head>
				<title>Payout History</title>
				<meta charset="utf-8" />
				<style>
					body{font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; padding:16px;}
					table{width:100%; border-collapse:collapse; font-size:12px;}
					th,td{border:1px solid #e5e7eb; padding:8px; text-align:left; vertical-align:top;}
					th{background:#f9fafb;}
					.small{color:#6b7280; font-size:11px;}
				</style>
			</head>
			<body>
				<h2 style="margin:0 0 6px 0;">Payout History</h2>
				<div class="small">Exported: ${new Date().toLocaleString()}</div>
				<div class="small" style="margin-bottom:12px;">Rows: ${filteredRows.length}</div>
				<table>
					<thead>
						<tr>
							<th>Partner</th>
							<th>Phone</th>
							<th>Payout ID</th>
							<th>UTR</th>
							<th>Status</th>
							<th>Date</th>
							<th>Customer Paid</th>
							<th>Commission</th>
							<th>Partner Paid</th>
							<th>Services</th>
						</tr>
					</thead>
					<tbody>
						${filteredRows.map((r) => `
							<tr>
								<td>${String(r?.partner_name || '-')}</td>
								<td>${String(r?.partner_phone || '-')}</td>
								<td>${String(r?.payout_id || '-')}</td>
								<td>${String(r?.utr_number || '-')}</td>
								<td>${String(r?.payout_status || '-')}</td>
								<td>${String(r?.paid_at ? formatDateTime(r.paid_at) : '-')}</td>
								<td>${formatMoney(r?.total_customer_paid)}</td>
								<td>${formatMoney(r?.total_admin_commission)}</td>
								<td>${formatMoney(r?.total_partner_paid ?? r?.total_amount)}</td>
								<td>${String(r?.service_names || '-')}</td>
							</tr>
						`).join('')}
					</tbody>
				</table>
				<script>window.onload = () => { window.print(); };</script>
			</body>
			</html>
		`;
		const w = window.open('', '_blank');
		if (!w) return;
		w.document.open();
		w.document.write(html);
		w.document.close();
	};

	return (
		<div className="flex-1 p-6">
			<div className="max-w-6xl mx-auto">
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
					<div>
						<h1 className="text-2xl font-bold text-gray-900">Payout History</h1>
						<p className="text-sm text-gray-500 mt-1">Audit-friendly view of partner payouts and commissions.</p>
					</div>
					<div className="flex items-center gap-2">
						<button
							onClick={exportPdf}
							className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
							disabled={loading}
						>
							Export PDF
						</button>
						<button
							onClick={exportExcel}
							className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
							disabled={loading}
						>
							Export Excel
						</button>
						<button
							onClick={() => fetchHistory()}
							className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
							disabled={loading}
						>
							Refresh
						</button>
					</div>
				</div>

				<div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-4">
					<div className="p-4 sm:p-6">
						<div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
							<div className="flex flex-wrap gap-2">
								<button
									onClick={() => { setPreset('today'); fetchHistory('today'); }}
									className={`px-3 py-2 rounded-xl border text-sm font-semibold ${preset === 'today' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
								>
									Today
								</button>
								<button
									onClick={() => { setPreset('week'); fetchHistory('week'); }}
									className={`px-3 py-2 rounded-xl border text-sm font-semibold ${preset === 'week' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
								>
									This Week
								</button>
								<button
									onClick={() => { setPreset('month'); fetchHistory('month'); }}
									className={`px-3 py-2 rounded-xl border text-sm font-semibold ${preset === 'month' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
								>
									This Month
								</button>
								<button
									onClick={() => setPreset('custom')}
									className={`px-3 py-2 rounded-xl border text-sm font-semibold ${preset === 'custom' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
								>
									Custom Range
								</button>
							</div>

							<div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-end">
								<div className="w-full sm:w-72">
									<label className="block text-xs font-bold text-gray-600 mb-1">Search</label>
									<input
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										placeholder="Partner / phone / UTR / payout / service"
										className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
									/>
								</div>

								{preset === 'custom' ? (
									<div className="flex flex-col sm:flex-row gap-3">
										<div>
											<label className="block text-xs font-bold text-gray-600 mb-1">From</label>
											<input
												type="date"
												value={customFrom}
												onChange={(e) => setCustomFrom(e.target.value)}
												className="px-3 py-2.5 rounded-xl border border-gray-200"
											/>
										</div>
										<div>
											<label className="block text-xs font-bold text-gray-600 mb-1">To</label>
											<input
												type="date"
												value={customTo}
												onChange={(e) => setCustomTo(e.target.value)}
												className="px-3 py-2.5 rounded-xl border border-gray-200"
											/>
										</div>
										<button
											onClick={() => fetchHistory('custom')}
											className="px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
											disabled={loading}
										>
											Apply
										</button>
									</div>
								) : null}
							</div>
						</div>
					</div>
				</div>

				<div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
					<div className="p-4 sm:p-6">
						{loading ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-gray-500 font-medium">Loading history...</p>
							</div>
						) : error ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-red-600 font-medium">{error}</p>
							</div>
						) : filteredRows.length === 0 ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-gray-500 font-medium">No payout history</p>
							</div>
						) : (
							<>
								<div className="hidden md:block overflow-x-auto">
									<table className="min-w-full text-sm">
									<thead>
										<tr className="text-left text-gray-600 border-b border-gray-200">
											<th className="py-3 px-3 font-semibold">Partner</th>
											<th className="py-3 px-3 font-semibold">Service Count</th>
											<th className="py-3 px-3 font-semibold">Customer Paid</th>
											<th className="py-3 px-3 font-semibold">Commission</th>
											<th className="py-3 px-3 font-semibold">Partner Paid</th>
											<th className="py-3 px-3 font-semibold">Status</th>
											<th className="py-3 px-3 font-semibold">Date</th>
											<th className="py-3 px-3 font-semibold">UTR</th>
											<th className="py-3 px-3 font-semibold">Payout ID</th>
											<th className="py-3 px-3 font-semibold">Details</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100">
										{filteredRows.map((row, idx) => {
											const badge = getStatusBadge(row?.payout_status);
											return (
												<tr key={`${row?.payout_id || 'legacy'}-${row?.partner_id}-${idx}`} className="hover:bg-gray-50">
													<td className="py-3 px-3 font-medium text-gray-900">{row?.partner_name || '-'}</td>
													<td className="py-3 px-3 text-gray-700">{row?.service_count ?? 0}</td>
													<td className="py-3 px-3 text-gray-900 font-semibold">{formatMoney(row?.total_customer_paid)}</td>
													<td className="py-3 px-3 text-gray-900 font-semibold">{formatMoney(row?.total_admin_commission)}</td>
													<td className="py-3 px-3 text-gray-900 font-semibold">{formatMoney(row?.total_partner_paid ?? row?.total_amount)}</td>
													<td className="py-3 px-3">
														<span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${badge.className}`}>
															{badge.label}
														</span>
													</td>
													<td className="py-3 px-3 text-gray-700">{formatDateTime(row?.paid_at)}</td>
													<td className="py-3 px-3 text-gray-700">{row?.utr_number || '-'}</td>
													<td className="py-3 px-3 text-gray-700">{row?.payout_id || '-'}</td>
													<td className="py-3 px-3">
														<button
															onClick={() => openDetails(row)}
															className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50"
														>
															View Details
														</button>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>

								<div className="md:hidden space-y-3">
									{filteredRows.map((row, idx) => {
										const badge = getStatusBadge(row?.payout_status);
										return (
											<div key={`${row?.payout_id || 'legacy'}-${row?.partner_id}-${idx}`} className="bg-white border border-gray-200 rounded-2xl p-4">
											<div className="flex items-start justify-between gap-3">
												<div>
													<div className="text-sm font-extrabold text-gray-900">{row?.partner_name || '-'}</div>
													<div className="text-xs text-gray-500 mt-0.5">Payout: {row?.payout_id || '-'}</div>
												</div>
												<span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${badge.className}`}>
												{badge.label}
											</span>
										</div>

										<div className="mt-3 grid grid-cols-2 gap-2">
											<div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
												<div className="text-[11px] font-bold text-gray-600">Customer Paid</div>
												<div className="text-sm font-extrabold text-gray-900 mt-0.5">{formatMoney(row?.total_customer_paid)}</div>
											</div>
											<div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
												<div className="text-[11px] font-bold text-gray-600">Admin Earnings</div>
												<div className="text-sm font-extrabold text-gray-900 mt-0.5">{formatMoney(row?.total_admin_commission)}</div>
											</div>
											<div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
												<div className="text-[11px] font-bold text-gray-600">Partner Paid</div>
												<div className="text-sm font-extrabold text-gray-900 mt-0.5">{formatMoney(row?.total_partner_paid ?? row?.total_amount)}</div>
											</div>
											<div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2">
												<div className="text-[11px] font-bold text-gray-600">Date</div>
												<div className="text-sm font-semibold text-gray-900 mt-0.5">{formatDateTime(row?.paid_at)}</div>
											</div>
										</div>

										<div className="mt-3 flex items-center justify-between">
											<div className="text-xs text-gray-500">UTR: <span className="font-semibold text-gray-700">{row?.utr_number || '-'}</span></div>
											<button
												onClick={() => openDetails(row)}
												className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-extrabold hover:bg-gray-800"
											>
												View Details
											</button>
										</div>
									</div>
									);
									})}
								</div>
							</>
						)}
					</div>
				</div>
			</div>

			{openKey ? (
				<div className="fixed inset-0 z-50 bg-gray-900/55 backdrop-blur-[2px] flex items-center justify-center px-3 py-4 sm:px-4 sm:py-6 overflow-hidden">
					<div className="w-full max-w-5xl max-h-[88vh] overflow-hidden bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col transform transition-all duration-200 ease-out">
						<div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
							<div>
								<div className="text-lg font-extrabold text-gray-900">Payout Details</div>
								<div className="text-xs text-gray-500 mt-0.5">Payout: <span className="font-semibold text-gray-700">{openKey}</span></div>
							</div>
							<button
								onClick={closeDetails}
								className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all duration-200 ease-out"
								aria-label="Close payout details"
							>
								×
							</button>
						</div>

						<div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-slate-50/40">
							{detailsLoading ? (
								<div className="py-16 text-center text-gray-600 font-medium">Loading details…</div>
							) : detailsError ? (
								<div className="py-16 text-center text-red-600 font-medium">{detailsError}</div>
							) : !details ? (
								<div className="py-16 text-center text-gray-600 font-medium">No details available.</div>
							) : (
								<div className="space-y-4 text-sm">
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
											<div className="text-xs font-extrabold text-gray-600">Partner</div>
											<div className="text-base font-extrabold text-gray-900 mt-1">{details?.partner?.name || '-'}</div>
											<div className="text-sm text-gray-700 mt-2">Partner ID: <span className="font-semibold">{details?.partner?.id || '-'}</span></div>
											<div className="text-sm text-gray-700 mt-1">Phone: <span className="font-semibold">{details?.partner?.phone || '-'}</span></div>
											<div className="text-sm text-gray-700 mt-1">UPI: <span className="font-semibold">{details?.partner?.upi_id || '-'}</span></div>
										</div>

										<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
											<div className="text-xs font-extrabold text-gray-600">Payout Information</div>
											<div className="text-sm text-gray-700 mt-2">Payout ID: <span className="font-semibold">{details?.payout?.payout_id || '-'}</span></div>
											<div className="text-sm text-gray-700 mt-1">UTR: <span className="font-semibold">{details?.payout?.utr_number || '-'}</span></div>
											<div className="text-sm text-gray-700 mt-1">Status: <span className="font-semibold">{details?.payout?.status || '-'}</span></div>
											<div className="text-sm text-gray-700 mt-1">Paid Date: <span className="font-semibold">{formatDateTime(details?.payout?.paid_at)}</span></div>
											<div className="text-sm text-gray-700 mt-1">Processed By: <span className="font-semibold">{details?.payout?.processed_by_admin || '-'}</span></div>
										</div>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
										<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
											<div className="text-xs font-extrabold text-gray-600">Total Bookings</div>
											<div className="text-xl font-extrabold text-gray-900 mt-1">{details?.bookings?.total ?? 0}</div>
										</div>
										<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
											<div className="text-xs font-extrabold text-gray-600">Completed</div>
											<div className="text-xl font-extrabold text-gray-900 mt-1">{details?.bookings?.completed ?? 0}</div>
										</div>
										<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
											<div className="text-xs font-extrabold text-gray-600">Cancelled</div>
											<div className="text-xl font-extrabold text-gray-900 mt-1">{details?.bookings?.cancelled ?? 0}</div>
										</div>
									</div>

									<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
										<div className="text-xs font-extrabold text-gray-600 mb-3">Money Breakdown</div>
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
											<div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
												<div className="text-[11px] font-bold text-gray-600">Original Amount</div>
												<div className="text-sm font-extrabold text-gray-900 mt-0.5">{formatMoney((details?.services || []).reduce((sum, s) => sum + getOriginalAmount(s), 0))}</div>
											</div>
											<div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
												<div className="text-[11px] font-bold text-gray-600">Coupon Discount</div>
												<div className="text-sm font-extrabold text-gray-900 mt-0.5">{formatMoney((details?.services || []).reduce((sum, s) => sum + getCouponDiscount(s), 0))}</div>
											</div>
											<div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
												<div className="text-[11px] font-bold text-gray-600">Final Paid</div>
												<div className="text-sm font-extrabold text-gray-900 mt-0.5">{formatMoney((details?.services || []).reduce((sum, s) => sum + getFinalPaidAmount(s), 0))}</div>
											</div>
											<div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
												<div className="text-[11px] font-bold text-gray-600">Customer Paid Total</div>
												<div className="text-sm font-extrabold text-gray-900 mt-0.5">{formatMoney(details?.money?.customer_paid_total)}</div>
											</div>
											<div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
												<div className="text-[11px] font-bold text-gray-600">Admin Commission Total</div>
												<div className="text-sm font-extrabold text-gray-900 mt-0.5">{formatMoney(details?.money?.admin_commission_total)}</div>
											</div>
											<div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
												<div className="text-[11px] font-bold text-gray-600">Partner Earnings Total</div>
												<div className="text-sm font-extrabold text-gray-900 mt-0.5">{formatMoney(details?.money?.partner_earned_total)}</div>
											</div>
											<div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
												<div className="text-[11px] font-bold text-gray-600">Already Paid</div>
												<div className="text-sm font-extrabold text-gray-900 mt-0.5">{formatMoney(details?.money?.already_paid)}</div>
											</div>
											<div className="rounded-xl bg-orange-50 border border-orange-100 px-3 py-2 sm:col-span-2">
												<div className="text-[11px] font-bold text-orange-700">Remaining Amount</div>
												<div className="text-sm font-extrabold text-orange-900 mt-0.5">{formatMoney(details?.money?.remaining_amount)}</div>
											</div>
										</div>
									</div>

									<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
										<div className="text-xs font-extrabold text-gray-600 mb-3">Commission Breakdown</div>
										<div className="overflow-x-auto">
											<table className="min-w-full text-sm">
												<thead>
													<tr className="text-left text-gray-600 border-b border-gray-200">
														<th className="py-2 px-2 font-semibold">Service</th>
														<th className="py-2 px-2 font-semibold">Original</th>
														<th className="py-2 px-2 font-semibold">Coupon</th>
														<th className="py-2 px-2 font-semibold">Final Paid</th>
														<th className="py-2 px-2 font-semibold">Admin Commission</th>
														<th className="py-2 px-2 font-semibold">Partner Got</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-gray-100">
													{(details?.services || []).map((s, i) => (
														<tr key={`${s?.payment_id || 'p'}-${i}`}>
															<td className="py-2 px-2 font-medium text-gray-900">{s?.service_name || '-'}</td>
															<td className="py-2 px-2 text-gray-900 font-semibold">{formatMoney(s?.original_amount ?? s?.gross_amount)}</td>
															<td className="py-2 px-2 text-gray-900 font-semibold">{formatMoney(s?.coupon_discount ?? 0)}</td>
															<td className="py-2 px-2 text-gray-900 font-semibold">{formatMoney(s?.final_amount_after_discount ?? s?.amount ?? s?.gross_amount)}</td>
															<td className="py-2 px-2 text-gray-900 font-semibold">{formatMoney(s?.admin_commission_amount)}</td>
															<td className="py-2 px-2 text-gray-900 font-semibold">{formatMoney(s?.partner_final_amount)}</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
