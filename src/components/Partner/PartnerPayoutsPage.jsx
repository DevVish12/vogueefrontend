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

const getFinalPaidAmount = (row) => Number(row?.final_amount_after_discount ?? row?.original_amount ?? row?.gross_amount ?? row?.amount ?? 0);
const getPartnerNetAmount = (row) => Number(row?.partner_final_amount ?? row?.amount ?? 0);
const getCouponDiscount = (row) => Number(row?.coupon_discount ?? 0);

const isSalonBooking = (value) => {
	const v = String(value || '').toLowerCase();
	return v === 'salon' || v === 'visit_salon';
};

const toBookingType = (value) => (isSalonBooking(value) ? 'salon' : 'home');

const handleAdminUnauthorized = () => {
	localStorage.removeItem('adminToken');
	if (sessionStorage.getItem('adminRedirecting') === '1') return;
	sessionStorage.setItem('adminRedirecting', '1');
	setTimeout(() => {
		sessionStorage.removeItem('adminRedirecting');
	}, 5000);
	window.location.href = ADMIN_PATHS.LOGIN;
};

export default function PartnerPayoutsPage() {
	const [partners, setPartners] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [payingPartnerId, setPayingPartnerId] = useState(null);
	const [selectedByPartner, setSelectedByPartner] = useState({});
	const [commissionSheet, setCommissionSheet] = useState({ open: false, partnerId: null, partnerName: '', groups: [], totals: null });

	const selectedByPartnerRef = React.useRef(selectedByPartner);
	React.useEffect(() => {
		selectedByPartnerRef.current = selectedByPartner;
	}, [selectedByPartner]);

	const skipNextFullFetchRef = React.useRef(false);
	const lastRealtimeUpdateRef = React.useRef(0);
	const latestSocketVersionRef = React.useRef(0);

	const apiBase = useMemo(() => getApiBase(), []);
	const backendOrigin = useMemo(() => String(apiBase || '').replace(/\/api\/?$/i, ''), [apiBase]);

	const fetchCompletedServices = useCallback(async () => {
		// If a recent optimistic payout update occurred, skip one immediate full fetch
		if (skipNextFullFetchRef.current) {
			skipNextFullFetchRef.current = false;
			console.log('[fetchCompletedServices] skipped due to optimistic update');
			return;
		}
		try {
			setLoading(true);
			setError('');

			const token = localStorage.getItem('adminToken');
			const response = await fetch(`${apiBase}/admin/completed-services`, {
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
				let msg = `Failed to fetch completed services (${response.status})`;
				try {
					const body = await response.json();
					if (body?.message) msg = body.message;
				} catch {
					// ignore
				}
				throw new Error(msg);
			}

			const data = await response.json();
			const list = Array.isArray(data) ? data : Array.isArray(data?.partners) ? data.partners : [];
			const now = Date.now();
			if (now - lastRealtimeUpdateRef.current < 1200) {
				console.log('[fetch delayed due to realtime update]');

				setTimeout(() => {
					fetchCompletedServices();
				}, 1300);

				return;
			}
			setPartners(list);
			setSelectedByPartner((prev) => {
				const next = {};
				for (const partner of list || []) {
					const partnerId = partner?.partner_id;
					const selected = Array.isArray(prev?.[partnerId]) ? prev[partnerId] : [];
					next[partnerId] = selected;
				}
				return next;
			});
		} catch (e) {
			setError(e?.message || 'Failed to fetch completed services');
			setPartners([]);
		} finally {
			setLoading(false);
		}
	}, [apiBase]);

	const payViaRazorpay = async ({ partnerId, selectedPaymentIds }) => {
		const token = localStorage.getItem('adminToken');
		const response = await fetch(`${apiBase}/admin/mark-paid`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {})
			},
			body: JSON.stringify({ partner_id: partnerId, selected_payment_ids: selectedPaymentIds })
		});

		if (response.status === 401) {
			handleAdminUnauthorized();
			throw new Error('Session expired');
		}

		if (!response.ok) {
			let msg = `Failed to mark paid (${response.status})`;
			try {
				const body = await response.json();
				if (body?.message) msg = body.message;
			} catch {
				// ignore
			}
			throw new Error(msg);
		}

		return response.json();
	};

	const getSelectedIds = useCallback(
		(partnerId) => {
			const ids = selectedByPartner?.[partnerId];
			return Array.isArray(ids) ? ids : [];
		},
		[selectedByPartner]
	);

	const toggleOne = (partnerId, paymentId) => {
		setSelectedByPartner((prev) => {
			const current = new Set(Array.isArray(prev?.[partnerId]) ? prev[partnerId] : []);
			if (current.has(paymentId)) current.delete(paymentId);
			else current.add(paymentId);
			return { ...prev, [partnerId]: Array.from(current) };
		});
	};

	const safeJson = (value) => {
		if (!value) return null;
		if (typeof value === 'object') return value;
		if (typeof value !== 'string') return null;
		try {
			return JSON.parse(value);
		} catch {
			return null;
		}
	};

	const buildCommissionSheet = (partner) => {
		const partnerId = partner?.partner_id;
		const services = Array.isArray(partner?.services) ? partner.services : [];
		const selectedIds = new Set(getSelectedIds(partnerId));
		const picked = services.filter((s) => selectedIds.has(s?.payment_id));

		const groupsMap = new Map();
		const totals = { gross: 0, commission: 0, net: 0, lines: 0 };

		for (const s of picked) {
			const bookingId = s?.booking_id || `payment-${s?.payment_id}`;
			if (!groupsMap.has(bookingId)) {
				groupsMap.set(bookingId, {
					booking_id: s?.booking_id || null,
					customer_name: s?.customer_name || null,
					slot_date: s?.slot_date || null,
					slot_time: s?.slot_time || null,
					items: []
				});
			}

			const g = groupsMap.get(bookingId);
			const breakdown = safeJson(s?.commission_breakdown);
			const lines = Array.isArray(breakdown) ? breakdown : null;

			if (lines && lines.length) {
				for (const line of lines) {
					console.log('[COMMISSION SHEET RAW]', {
						service: line?.service_name || s?.service_name,
						original_amount: line?.original_amount ?? s?.original_amount,
						coupon_discount: line?.coupon_discount ?? s?.coupon_discount,
						final_amount_after_discount: line?.final_amount_after_discount ?? s?.final_amount_after_discount,
						amount: line?.amount ?? s?.amount,
						partner_final_amount: line?.partner_final_amount ?? s?.partner_final_amount,
						admin_commission_amount: line?.admin_commission_amount ?? s?.admin_commission_amount
					});

					const originalAmount = Number(line?.original_amount || s?.original_amount || 0);
					const couponDiscount = Number(line?.coupon_discount || s?.coupon_discount || 0);
					const finalAmountAfterDiscount = Number(
						line?.final_amount_after_discount ||
						s?.final_amount_after_discount ||
						line?.amount ||
						s?.amount ||
						0
					);
					const gross = Number(line?.gross_amount || finalAmountAfterDiscount || 0);
					const commission = Number(line?.admin_commission_amount || 0);
					const net = Number(line?.partner_amount || 0);
					g.items.push({
						service_name: line?.service_name || s?.service_name || 'Service',
						original_amount: Number.isFinite(originalAmount) ? originalAmount : 0,
						coupon_discount: Number.isFinite(couponDiscount) ? couponDiscount : 0,
						final_amount_after_discount: Number.isFinite(finalAmountAfterDiscount) ? finalAmountAfterDiscount : 0,
						gross_amount: Number.isFinite(gross) ? gross : 0,
						admin_commission_amount: Number.isFinite(commission) ? commission : 0,
						partner_amount: Number.isFinite(net) ? net : 0,
						commission_type: line?.commission_type || null,
						commission_value: typeof line?.commission_value !== 'undefined' ? line?.commission_value : null,
						qty: line?.qty || 1,
						commission_enabled: typeof line?.commission_enabled === 'boolean' ? line.commission_enabled : null
					});

					totals.gross += Number.isFinite(finalAmountAfterDiscount) ? finalAmountAfterDiscount : 0;
					totals.commission += Number.isFinite(commission) ? commission : 0;
					totals.net += Number.isFinite(net) ? net : 0;
					totals.lines += 1;
				}
			} else {
					console.log('[COMMISSION SHEET RAW]', {
						service: s?.service_name,
						original_amount: s?.original_amount,
						coupon_discount: s?.coupon_discount,
						final_amount_after_discount: s?.final_amount_after_discount,
						amount: s?.amount,
						partner_final_amount: s?.partner_final_amount,
						admin_commission_amount: s?.admin_commission_amount
					});
					const originalAmount = Number(s?.original_amount || 0);
					const couponDiscount = Number(s?.coupon_discount || 0);
					const finalAmountAfterDiscount = Number(
						s?.final_amount_after_discount ||
						s?.amount ||
						0
					);
					const gross = getFinalPaidAmount(s);
				const commission = Number(s?.admin_commission_amount || 0);
					const net = getPartnerNetAmount(s);

				g.items.push({
					service_name: s?.service_name || 'Service',
					original_amount: Number.isFinite(originalAmount) ? originalAmount : 0,
					coupon_discount: Number.isFinite(couponDiscount) ? couponDiscount : 0,
					final_amount_after_discount: Number.isFinite(finalAmountAfterDiscount) ? finalAmountAfterDiscount : 0,
					gross_amount: Number.isFinite(gross) ? gross : 0,
					admin_commission_amount: Number.isFinite(commission) ? commission : 0,
					partner_amount: Number.isFinite(net) ? net : 0,
					commission_type: null,
					commission_value: null,
					qty: 1,
					commission_enabled: null
				});

				totals.gross += Number.isFinite(finalAmountAfterDiscount) ? finalAmountAfterDiscount : 0;
				totals.commission += Number.isFinite(commission) ? commission : 0;
				totals.net += Number.isFinite(net) ? net : 0;
				totals.lines += 1;
			}
		}

		return {
			open: true,
			partnerId,
			partnerName: partner?.partner_name || `Partner #${partnerId}`,
			groups: Array.from(groupsMap.values()),
			totals
		};
	};

	const openCommissionSheet = (partner) => {
		const partnerId = partner?.partner_id;
		if (!partnerId) return;
		const selected = getSelectedIds(partnerId);
		if (!selected.length) {
			window.alert('Select at least one service');
			return;
		}
		setCommissionSheet(buildCommissionSheet(partner));
	};

	const closeCommissionSheet = () => {
		setCommissionSheet({ open: false, partnerId: null, partnerName: '', groups: [], totals: null });
	};

	const selectAll = (partner) => {
		const partnerId = partner?.partner_id;
		const allIds = Array.isArray(partner?.services) ? partner.services.map((s) => s?.payment_id).filter(Boolean) : [];
		setSelectedByPartner((prev) => ({ ...prev, [partnerId]: Array.from(new Set(allIds)) }));
	};

	const isAllSelected = (partner) => {
		const services = Array.isArray(partner?.services) ? partner.services : [];
		if (!services.length) return false;
		const selectedIds = new Set(getSelectedIds(partner?.partner_id));
		return services.every((service) => selectedIds.has(service?.payment_id));
	};

	const clearAll = (partnerId) => {
		setSelectedByPartner((prev) => ({ ...prev, [partnerId]: [] }));
	};

	const calcSelectedTotal = (partner) => {
		const partnerId = partner?.partner_id;
		const selected = new Set(getSelectedIds(partnerId));
		return (partner?.services || []).reduce((sum, s) => {
			if (!selected.has(s?.payment_id)) return sum;
			const a = Number(s?.amount || 0);
			return sum + (Number.isFinite(a) ? a : 0);
		}, 0);
	};

	const handlePaySelected = async (partner) => {
		const partnerId = partner?.partner_id;
		if (!partnerId) {
			window.alert('Invalid partner');
			return;
		}

		const selectedPaymentIds = getSelectedIds(partnerId);
		if (!selectedPaymentIds.length) {
			window.alert('Select at least one service');
			return;
		}

		try {
			setPayingPartnerId(partnerId);
			const result = await payViaRazorpay({ partnerId, selectedPaymentIds });
			window.alert(result?.message || 'Selected payouts sent successfully');

			// Optimistic UI: remove paid services from the list.
			const optimisticTs = Date.now();
			lastRealtimeUpdateRef.current = optimisticTs;
			console.log('[optimistic payout applied]');
			setPartners((prev) =>
				(prev || [])
					.map((p) => {
						if (p?.partner_id !== partnerId) return p;
						const selected = new Set(selectedPaymentIds);
						const services = (p?.services || []).filter((s) => !selected.has(s?.payment_id));
						const total = services.reduce((sum, s) => {
							const a = Number(s?.amount || 0);
							return sum + (Number.isFinite(a) ? a : 0);
						}, 0);
						return { ...p, services, total_pending_amount: total };
					})
					.filter((p) => (p?.services || []).length > 0)
			);

			setSelectedByPartner((prev) => ({ ...prev, [partnerId]: [] }));
			// Avoid an immediate full refetch which can overwrite realtime-updated state.
			// We'll rely on the socket PAYOUT_UPDATED event to arrive and reconcile state.
			skipNextFullFetchRef.current = true;
		} catch (e) {
			window.alert(e?.message || 'Payment failed');
		} finally {
			setPayingPartnerId(null);
		}
	};

	React.useEffect(() => {
		fetchCompletedServices();
	}, [fetchCompletedServices]);

	React.useEffect(() => {
		const socket = io(backendOrigin, {
			transports: ['websocket', 'polling'],
			reconnection: true,
			autoConnect: true,
		});

		const token = localStorage.getItem('adminToken');
		const register = () => {
			if (!token) return;
			try {
				socket.emit('registerAdminDashboard', { token });
				console.log('[socket] registerAdminDashboard emitted');
			} catch (e) {
				// ignore
			}
		};

		const handleConnect = () => {
			console.log('[socket connected]', socket.id);
			register();
		};

		const handlePayoutUpdated = (payload) => {
			console.log('[socket payout received]', payload);
			const payloadUpdatedAt = Number(payload?.updatedAt || 0);
			if (payloadUpdatedAt && payloadUpdatedAt < latestSocketVersionRef.current) {
				console.log('[socket skipped] old payload');
				return;
			}
			if (payloadUpdatedAt) {
				latestSocketVersionRef.current = payloadUpdatedAt;
			}
			lastRealtimeUpdateRef.current = Date.now();

			const partnerId = Number(payload?.partnerId);
			const paymentIds = Array.isArray(payload?.paymentIds) ? payload.paymentIds.map((x) => Number(x)).filter((n) => Number.isFinite(n)) : [];
			if (!Number.isFinite(partnerId) || partnerId <= 0 || paymentIds.length === 0) {
				return;
			}

			const removed = new Set(paymentIds);
			let nextPartnerForSheet = null;

			setPartners((prev) =>
				(prev || [])
					.map((p) => {
						if (Number(p?.partner_id) !== partnerId) return p;
						const services = (p?.services || []).filter((s) => !removed.has(Number(s?.payment_id)));
						const total = services.reduce((sum, s) => {
							const a = Number(s?.amount || 0);
							return sum + (Number.isFinite(a) ? a : 0);
						}, 0);
						const updatedPartner = { ...p, services, total_pending_amount: total };
						nextPartnerForSheet = updatedPartner;
						return updatedPartner;
					})
					.filter((p) => (p?.services || []).length > 0)
			);

			setSelectedByPartner((prev) => {
				const current = Array.isArray(prev?.[partnerId]) ? prev[partnerId] : [];
				const nextSelected = current.filter((id) => !removed.has(Number(id)));
				return { ...prev, [partnerId]: nextSelected };
			});

			setCommissionSheet((prev) => {
				if (!prev?.open) return prev;
				if (Number(prev?.partnerId) !== partnerId) return prev;
				if (!nextPartnerForSheet) return prev;

				// Rebuild sheet from latest partner data + latest selection (minus removed ids)
				const latestSelectedByPartner = selectedByPartnerRef.current;
				const currentSelected = Array.isArray(latestSelectedByPartner?.[partnerId]) ? latestSelectedByPartner[partnerId] : [];
				const nextSelected = currentSelected.filter((id) => !removed.has(Number(id)));
				const selectedSet = new Set(nextSelected);
				const services = Array.isArray(nextPartnerForSheet?.services) ? nextPartnerForSheet.services : [];
				const picked = services.filter((s) => selectedSet.has(s?.payment_id));
				const patchedPartner = { ...nextPartnerForSheet, services: picked };
				return buildCommissionSheet(patchedPartner);
			});

			setTimeout(() => {
				console.log('[socket fallback refresh]');
				fetchCompletedServices();
			}, 800);
		};

		socket.off(SOCKET_EVENTS.PAYOUT_UPDATED);
		socket.on(SOCKET_EVENTS.PAYOUT_UPDATED, handlePayoutUpdated);

		socket.on('connect', handleConnect);
		// Call register only if socket already connected to avoid duplicate emits
		if (socket.connected) {
			handleConnect();
		}

		return () => {
			socket.off('connect', handleConnect);
			socket.off(SOCKET_EVENTS.PAYOUT_UPDATED, handlePayoutUpdated);
			socket.disconnect();
		};
	}, [backendOrigin, fetchCompletedServices]);

	return (
		<div className="flex-1 p-6">
			<div className="max-w-6xl mx-auto">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-2xl font-bold text-gray-900">Partner Payouts</h1>
					<button
						onClick={fetchCompletedServices}
						className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800"
						disabled={loading}
					>
						Refresh
					</button>
				</div>

				<div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
					<div className="p-4 sm:p-6">
						{loading ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-gray-500 font-medium">Loading payouts...</p>
							</div>
						) : error ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-red-600 font-medium">{error}</p>
							</div>
						) : partners.length === 0 ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-gray-500 font-medium">No pending partner payouts</p>
							</div>
						) : (
							<div className="space-y-4">
								{partners.map((partner) => {
									const partnerId = partner?.partner_id;
									const services = Array.isArray(partner?.services) ? partner.services : [];
									const selectedIds = getSelectedIds(partnerId);
									const selectedTotal = calcSelectedTotal(partner);
									const isPaying = payingPartnerId === partnerId;

									return (
										<div key={partnerId} className="bg-white border border-gray-200 rounded-2xl shadow-sm">
											<div className="p-4 sm:p-6">
												<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
													<div>
														<h2 className="text-lg font-bold text-gray-900">{partner?.partner_name || '-'}</h2>
														<p className="text-sm text-gray-600">
															{partner?.partner_phone ? `Phone: ${partner.partner_phone}` : 'Phone: -'}
														</p>
														<p className="text-sm text-gray-600">{partner?.partner_upi ? `UPI: ${partner.partner_upi}` : 'UPI: -'}</p>
													</div>

													<div className="flex flex-col sm:items-end gap-2">
														<p className="text-sm text-gray-700">
															Total Pending:{' '}
															<span className="font-semibold text-gray-900">{formatMoney(partner?.total_pending_amount)}</span>
														</p>
														<p className="text-sm text-gray-700">
															Selected Total: <span className="font-semibold text-gray-900">{formatMoney(selectedTotal)}</span>
														</p>
														<p className="text-sm text-gray-700">
															Selected Count: <span className="font-semibold text-gray-900">{selectedIds.length}</span>
														</p>
													</div>
												</div>

												<div className="mt-4 flex flex-wrap gap-2">
													<label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-900 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60">
														<input
															type="checkbox"
															checked={isAllSelected(partner)}
															onChange={() => selectAll(partner)}
															disabled={isPaying || services.length === 0}
															className="h-4 w-4"
														/>
														<span>Select All</span>
													</label>
													<button
														onClick={() => clearAll(partnerId)}
														disabled={isPaying || selectedIds.length === 0}
														className="px-3 py-2 rounded-lg bg-gray-100 text-gray-900 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
													>
														Clear
													</button>
													<button
														onClick={() => handlePaySelected(partner)}
														disabled={isPaying || selectedIds.length === 0}
														className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60"
													>
														{isPaying ? 'Paying…' : 'Pay Selected'}
													</button>
													<button
														onClick={() => openCommissionSheet(partner)}
														disabled={isPaying || selectedIds.length === 0}
														className="px-4 py-2 rounded-lg bg-gray-100 text-gray-900 text-sm font-semibold hover:bg-gray-200 disabled:opacity-60"
													>
														View Commission Sheet
													</button>
												</div>

												<div className="mt-4 space-y-3">
													{services.map((s) => {
														const paymentId = s?.payment_id;
														const checked = selectedIds.includes(paymentId);
														const gross = getFinalPaidAmount(s);
														const commission = Number(s?.admin_commission_amount);
														const hasCommissionInfo = Number.isFinite(gross) || Number.isFinite(commission);
														return (
															<div key={paymentId} className="border border-gray-200 rounded-xl p-3 sm:p-4">
																<div className="flex items-start gap-3">
																	<input
																		type="checkbox"
																		checked={checked}
																		onChange={() => toggleOne(partnerId, paymentId)}
																		disabled={isPaying}
																		className="mt-1 h-4 w-4"
																	/>

																<div className="flex-1 min-w-0">
																	<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
																		<p className="font-semibold text-gray-900 truncate">{s?.service_name || 'Service'}</p>
																		<div className="text-right">
																			<p className="text-gray-900 font-semibold">{formatMoney(getPartnerNetAmount(s))}</p>
																			<p className="text-xs text-gray-500">
																				Customer paid: {formatMoney(gross)}
																				{getCouponDiscount(s) > 0 ? `  |  Saved: ${formatMoney(getCouponDiscount(s))}` : ''}
																			</p>
																			{hasCommissionInfo ? (
																				<p className="text-xs text-gray-500">
																					Admin fee: {formatMoney(Number.isFinite(commission) ? commission : 0)}
																					{`  `}
																					| Partner net: {formatMoney(getPartnerNetAmount(s))}
																				</p>
																			) : null}
																		</div>
																	</div>

																	<div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm text-gray-700">
																		<p>
																			Customer: <span className="font-medium text-gray-900">{s?.customer_name || '-'}</span>
																		</p>
																		<p>
																			Phone: <span className="font-medium text-gray-900">{s?.customer_phone || '-'}</span>
																		</p>
																	</div>

																	<div className="mt-2">
																		{toBookingType(s?.normalized_booking_type || s?.booking_type) === 'salon' ? (
																			<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
																				SALON
																			</span>
																		) : (
																			<span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
																				HOME
																			</span>
																		)}
																	</div>

																	{toBookingType(s?.normalized_booking_type || s?.booking_type) === 'salon' ? (
																		<div className="mt-2 text-sm text-gray-700 space-y-1">
																			<p className="font-semibold text-gray-900">Salon Visit</p>
																			<p>
																				Salon Name: <span className="font-medium text-gray-900">{s?.salon_name || '-'}</span>
																			</p>
																			<p className="break-words">
																				Salon Address: <span className="font-medium text-gray-900">{s?.salon_address || '-'}</span>
																			</p>
																		</div>
																	) : (
																		<div className="mt-2 text-sm text-gray-700 space-y-1">
																			<p className="font-semibold text-gray-900">At Home Service</p>
																			<p className="break-words">
																				Customer Address: <span className="font-medium text-gray-900">{s?.customer_address || s?.address || '-'}</span>
																			</p>
																		</div>
																	)}

																	<div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm text-gray-700">
																		<p>
																			Partner: <span className="font-medium text-gray-900">{s?.partner_name || partner?.partner_name || '-'}</span>
																		</p>
																		<p>
																			Salon Owner: <span className="font-medium text-gray-900">{s?.salon_owner_name || '-'}</span>
																		</p>
																		<p>
																			Date: <span className="font-medium text-gray-900">{s?.slot_date || '-'}</span>
																		</p>
																		<p>
																			Time: <span className="font-medium text-gray-900">{s?.slot_time || '-'}</span>
																		</p>
																	</div>

																	<p className="mt-1 text-xs text-gray-500 break-all">
																			Payment ID: <span className="font-medium text-gray-700">{s?.transaction_id || s?.payment_transaction_id || '-'}</span>
																	</p>

																	<div className="mt-2 flex items-center gap-2">
																		{String(s?.booking_status || '').toLowerCase() === 'completed' ? (
																			<span className="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold bg-green-50 text-green-700 border-green-200">
																				Completed
																			</span>
																		) : (
																			<span className="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200">
																				{String(s?.booking_status || 'confirmed').toUpperCase()}
																			</span>
																		)}
																		<span className="inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold bg-yellow-50 text-yellow-700 border-yellow-200">
																			Unpaid
																		</span>
																	</div>
																</div>
															</div>
														</div>
													);
												})}
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>
			</div>

			{commissionSheet.open ? (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-5xl bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
						<div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
							<div>
								<p className="text-sm text-gray-500 font-semibold">Commission Sheet</p>
								<p className="text-lg font-bold text-gray-900">{commissionSheet.partnerName}</p>
							</div>
							<button
								onClick={closeCommissionSheet}
								className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
							>
								Close
							</button>
						</div>

						<div className="p-5">
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
								<div className="rounded-xl border border-gray-200 p-4">
									<p className="text-xs font-bold text-gray-500">CUSTOMER PAID</p>
									<p className="text-xl font-extrabold text-gray-900 mt-1">{formatMoney(commissionSheet?.totals?.gross)}</p>
								</div>
								<div className="rounded-xl border border-gray-200 p-4">
									<p className="text-xs font-bold text-gray-500">ADMIN COMMISSION</p>
									<p className="text-xl font-extrabold text-gray-900 mt-1">{formatMoney(commissionSheet?.totals?.commission)}</p>
								</div>
								<div className="rounded-xl border border-gray-200 p-4">
									<p className="text-xs font-bold text-gray-500">PARTNER PAYOUT</p>
									<p className="text-xl font-extrabold text-gray-900 mt-1">{formatMoney(commissionSheet?.totals?.net)}</p>
								</div>
							</div>

							<div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
								{(commissionSheet.groups || []).map((g, idx) => (
									<div key={`${g?.booking_id || 'booking'}-${idx}`} className="border border-gray-200 rounded-xl overflow-hidden">
										<div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
											<p className="text-sm font-bold text-gray-900">
												Booking: <span className="font-semibold">{g?.booking_id || '-'}</span>
											</p>
											<p className="text-xs text-gray-600 mt-0.5">
												{g?.customer_name ? `Customer: ${g.customer_name}` : 'Customer: -'}
												{g?.slot_date || g?.slot_time ? `  |  ${g?.slot_date || ''} ${g?.slot_time || ''}` : ''}
											</p>
										</div>

										<div className="overflow-x-auto">
											<table className="min-w-full text-sm">
												<thead>
													<tr className="text-left text-gray-600 border-b border-gray-100">
														<th className="py-2.5 px-4 font-semibold">Service</th>
														<th className="py-2.5 px-4 font-semibold">Original</th>
														<th className="py-2.5 px-4 font-semibold">Coupon</th>
														<th className="py-2.5 px-4 font-semibold">Final Paid</th>
														<th className="py-2.5 px-4 font-semibold">Commission</th>
														<th className="py-2.5 px-4 font-semibold">Partner</th>
													</tr>
												</thead>
												<tbody className="divide-y divide-gray-100">
													{(g.items || []).map((it, j) => (
														<tr key={`${it?.service_name || 'svc'}-${j}`}>
															<td className="py-2.5 px-4 text-gray-900 font-medium">{it?.service_name || 'Service'}</td>
															<td className="py-2.5 px-4 text-gray-900">{formatMoney(it?.original_amount ?? it?.gross_amount ?? 0)}</td>
															<td className="py-2.5 px-4 text-gray-900">{formatMoney(Number(it?.coupon_discount || 0))}</td>
															<td className="py-2.5 px-4 text-gray-900">{formatMoney(it?.final_amount_after_discount ?? it?.gross_amount ?? 0)}</td>
															<td className="py-2.5 px-4 text-gray-900">{formatMoney(it?.admin_commission_amount)}</td>
															<td className="py-2.5 px-4 text-gray-900">{formatMoney(it?.partner_amount)}</td>
														</tr>
													))}
												</tbody>
											</table>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
