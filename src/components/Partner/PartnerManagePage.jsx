import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const formatDate = (value) => {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleDateString();
};

const getApiBase = () => {
	return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
};

const getBackendOrigin = (apiBase) => {
	return apiBase.endsWith('/api') ? apiBase.slice(0, -'/api'.length) : apiBase;
};

const normalizeKycStatus = (value) => {
	const v = String(value || '').trim().toLowerCase();
	if (v === 'verified' || v === 'rejected' || v === 'pending') return v;
	return 'pending';
};

const kycBadge = (value) => {
	const v = normalizeKycStatus(value);
	if (v === 'verified') {
		return { label: 'Verified', cls: 'bg-emerald-50 text-emerald-700' };
	}
	if (v === 'rejected') {
		return { label: 'Rejected', cls: 'bg-rose-50 text-rose-700' };
	}
	return { label: 'Pending', cls: 'bg-amber-50 text-amber-700' };
};

const getDisplayName = (partner) => {
	return (
		partner?.name ||
		partner?.full_name ||
		partner?.partner_name ||
		partner?.owner_name ||
		partner?.salon_name ||
		'N/A'
	);
};

export default function PartnerManagePage() {
	const [partners, setPartners] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const apiBase = useMemo(() => getApiBase(), []);
	const backendOrigin = useMemo(() => getBackendOrigin(apiBase), [apiBase]);

	const fetchPartners = useCallback(async () => {
		try {
			setLoading(true);
			setError('');

			const token = localStorage.getItem('adminToken');
			const response = await fetch(`${apiBase}/admin/partners`, {
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {})
				}
			});

			if (!response.ok) {
				let msg = `Failed to fetch partners (${response.status})`;
				try {
					const body = await response.json();
					if (body?.message) msg = body.message;
				} catch {
					// ignore
				}
				throw new Error(msg);
			}

			const data = await response.json();
			console.log('PARTNER API:', data);
			setPartners(Array.isArray(data?.partners) ? data.partners : []);
		} catch (e) {
			setError(e?.message || 'Failed to fetch partners');
			setPartners([]);
		} finally {
			setLoading(false);
		}
	}, [apiBase]);

	useEffect(() => {
		fetchPartners();
	}, [fetchPartners]);

	useEffect(() => {
		// Live updates: prepend a new partner when created from partner app.
		const socket = io(backendOrigin, {
			transports: ['websocket', 'polling'],
			reconnection: true,
			autoConnect: true
		});

		const handleNewPartner = (partner) => {
			if (!partner || !partner.id) {
				// If payload is unexpected, fallback to refresh.
				fetchPartners();
				return;
			}

			setPartners((prev) => {
				const list = Array.isArray(prev) ? prev : [];
				if (list.some((p) => p?.id === partner.id)) return list;
				return [partner, ...list];
			});
		};

		socket.on('partner:new', handleNewPartner);

		return () => {
			socket.off('partner:new', handleNewPartner);
			socket.disconnect();
		};
	}, [backendOrigin, fetchPartners]);

	return (
		<div className="px-6 py-6 admin-crm-surface">
			<div className="mx-auto max-w-7xl space-y-6">
				<div className="crm-toolbar">
					<div>
						<h1 className="crm-toolbar-title">Partner Manage</h1>
						<p className="crm-toolbar-subtitle">Review partner profiles, KYC state, and account activity in one CRM view.</p>
					</div>

					<div className="crm-toolbar-actions">
						<div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
							<input
								type="text"
								placeholder="Search partners"
								className="min-w-56 border-0 p-0 shadow-none focus:ring-0"
								aria-label="Search partners"
							/>
						</div>
						<select aria-label="Filter partners" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm">
							<option>All statuses</option>
							<option>Verified</option>
							<option>Pending</option>
							<option>Rejected</option>
						</select>
						<button type="button" onClick={fetchPartners} className="crm-action-secondary">
							Refresh
						</button>
					</div>
				</div>

				<div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
					<div className="overflow-x-auto">
						{loading ? (
							<div className="crm-loading-card">Loading partners...</div>
						) : error ? (
							<div className="crm-empty-state">
								<p className="text-base font-semibold text-slate-900">Unable to load partners</p>
								<p className="mt-2 text-sm text-slate-500">{error}</p>
							</div>
						) : partners.length === 0 ? (
							<div className="crm-empty-state">
								<p className="text-base font-semibold text-slate-900">No partners found</p>
								<p className="mt-2 text-sm text-slate-500">New partner accounts will appear here as they are created.</p>
							</div>
						) : (
							<table className="min-w-full text-sm">
								<thead>
									<tr>
										<th className="py-3 px-3 font-semibold">ID</th>
										<th className="py-3 px-3 font-semibold">Name</th>
										<th className="py-3 px-3 font-semibold">Mobile</th>
										<th className="py-3 px-3 font-semibold">KYC Status</th>
										<th className="py-3 px-3 font-semibold">Created At</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{partners.map((p) => (
										<tr key={p.id}>
											<td className="py-3 px-3 whitespace-nowrap">{p.id}</td>
											<td className="py-3 px-3 whitespace-nowrap font-medium text-slate-900">{getDisplayName(p)}</td>
											<td className="py-3 px-3 whitespace-nowrap">{p.mobile || '-'}</td>
											<td className="py-3 px-3 whitespace-nowrap">
												<span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${kycBadge(p.kyc_status).cls}`}>
													{kycBadge(p.kyc_status).label}
												</span>
											</td>
											<td className="py-3 px-3 whitespace-nowrap">{formatDate(p.created_at)}</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
