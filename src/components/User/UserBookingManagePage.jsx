import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { ADMIN_PATHS } from '../../routes/adminPaths';

const formatDateTime = (value) => {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleString();
};

const formatMoney = (value) => {
	const n = Number(value);
	if (!Number.isFinite(n)) return '-';
		return `INR ${Math.round(n)}`;
};

const getDisplayedAmount = (row) => {
	if (!row) return null;
	// Prefer final discounted amount, then partner-specific final amount, then legacy amount
	return (
		(row.final_amount_after_discount ?? row.partner_final_amount ?? row.amount ?? row.finalAmountAfterDiscount ?? row.partnerFinalAmount) ?? null
	);
};

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

const bookingTypeBadge = (value) => {
	const type = toBookingType(value);
	return type === 'salon'
		? 'bg-purple-50 text-purple-700'
		: 'bg-blue-50 text-blue-700';
};

	const formatServiceName = (value) => {
		if (value == null) return '-';
		const s = String(value).trim();
		if (!s) return '-';
		// If older rows stored only a count like "2 services", still show text.
		return s;
	};

const getApiBase = () => {
	return import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
};

const getBackendOrigin = (apiBase) => {
	return apiBase.endsWith('/api') ? apiBase.slice(0, -'/api'.length) : apiBase;
};

export default function UserBookingManagePage() {
	const [rows, setRows] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selected, setSelected] = useState(null);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailError, setDetailError] = useState('');

	const apiBase = useMemo(() => getApiBase(), []);
	const backendOrigin = useMemo(() => getBackendOrigin(apiBase), [apiBase]);

	const fetchBookings = useCallback(async () => {
		try {
			setLoading(true);
			setError('');

			const token = localStorage.getItem('adminToken');
			const response = await fetch(`${apiBase}/admin/bookings`, {
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
				let msg = `Failed to fetch bookings (${response.status})`;
				try {
					const body = await response.json();
					if (body?.message) msg = body.message;
				} catch {
					// ignore
				}
				throw new Error(msg);
			}

			const data = await response.json();
			setRows(Array.isArray(data?.bookings) ? data.bookings : []);
		} catch (e) {
			setError(e?.message || 'Failed to fetch bookings');
			setRows([]);
		} finally {
			setLoading(false);
		}
	}, [apiBase]);

	useEffect(() => {
		fetchBookings();
	}, [fetchBookings]);

	useEffect(() => {
		// Live updates from backend when a payment/booking is created.
		const socket = io(backendOrigin, {
			transports: ['websocket', 'polling'],
			reconnection: true,
			autoConnect: true
		});

		const handleRefresh = () => {
			fetchBookings();
		};

		socket.on('bookingCreated', handleRefresh);

		return () => {
			socket.off('bookingCreated', handleRefresh);
			socket.disconnect();
		};
	}, [backendOrigin, fetchBookings]);

	const openModal = async (row) => {
		setIsModalOpen(true);
		setSelected(null);
		setDetailError('');
		setDetailLoading(true);

		try {
			const token = localStorage.getItem('adminToken');
			const res = await fetch(`${apiBase}/admin/bookings/${row.id}`, {
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {})
				}
			});

			if (res.status === 401) {
				handleAdminUnauthorized();
				throw new Error('Session expired');
			}

			if (!res.ok) {
				let msg = `Failed to fetch booking (${res.status})`;
				try {
					const body = await res.json();
					if (body?.message) msg = body.message;
				} catch {
					// ignore
				}
				throw new Error(msg);
			}

			const body = await res.json();
			setSelected(body?.booking || null);
		} catch (e) {
			setDetailError(e?.message || 'Failed to load booking details');
		} finally {
			setDetailLoading(false);
		}
	};

	const closeModal = () => {
		setIsModalOpen(false);
		setTimeout(() => setSelected(null), 150);
	};

	return (
		<div className="flex-1 p-6">
			<div className="max-w-6xl mx-auto">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-2xl font-bold text-gray-900">User Booking Manage</h1>
				</div>

				<div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
					<div className="p-4 sm:p-6">
						{loading ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-gray-500 font-medium">Loading bookings...</p>
							</div>
						) : error ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-red-600 font-medium">{error}</p>
							</div>
						) : rows.length === 0 ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-gray-500 font-medium">No bookings found</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="min-w-full text-sm">
									<thead>
										<tr className="text-left text-gray-600 border-b border-gray-200">
											<th className="py-3 px-3 font-semibold">Booking ID</th>
											<th className="py-3 px-3 font-semibold">User</th>
											<th className="py-3 px-3 font-semibold">Mobile</th>
											<th className="py-3 px-3 font-semibold">Service</th>
											<th className="py-3 px-3 font-semibold">Booking Type</th>
											<th className="py-3 px-3 font-semibold">Partner</th>
											<th className="py-3 px-3 font-semibold">Salon</th>
											<th className="py-3 px-3 font-semibold">Amount</th>
											<th className="py-3 px-3 font-semibold">Status</th>
											<th className="py-3 px-3 font-semibold">Paid At</th>
											<th className="py-3 px-3 font-semibold">Action</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100">
										{rows.map((r) => (
											<tr key={r.id} className="text-gray-800">
												<td className="py-3 px-3 whitespace-nowrap">{r.booking_id || '-'}</td>
												<td className="py-3 px-3 whitespace-nowrap">{r.user_name || '-'}</td>
												<td className="py-3 px-3 whitespace-nowrap">{r.user_mobile || '-'}</td>
												<td
													className="py-3 px-3 max-w-[320px] break-words"
													title={formatServiceName(r.service_name)}
												>
													{formatServiceName(r.service_name)}
												</td>
												<td className="py-3 px-3 whitespace-nowrap">
													<span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${bookingTypeBadge(r.booking_type)}`}>
														{toBookingType(r.booking_type) === 'salon' ? 'SALON' : 'HOME'}
													</span>
												</td>
												<td className="py-3 px-3 whitespace-nowrap">{r.partner_name || '-'}</td>
												<td className="py-3 px-3 whitespace-nowrap">{toBookingType(r.booking_type) === 'salon' ? (r.salon_name || '-') : '-'}</td>
												<td className="py-3 px-3 whitespace-nowrap">{formatMoney(getDisplayedAmount(r))}</td>
												<td className="py-3 px-3 whitespace-nowrap">
													<span
														className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
															String(r.status || '').toLowerCase() === 'success'
																	? 'bg-green-50 text-green-700'
																	: 'bg-gray-100 text-gray-700'
														}`}
													>
														{r.status || '-'}
													</span>
												</td>
												<td className="py-3 px-3 whitespace-nowrap">{formatDateTime(r.created_at)}</td>
												<td className="py-3 px-3 whitespace-nowrap">
													<button
														onClick={() => openModal(r)}
														className="px-3 py-1.5 rounded-lg text-primary-700 bg-primary-50 hover:bg-primary-100 font-semibold transition-colors"
													>
														View More
													</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Modal */}
			<div className={`fixed inset-0 z-50 ${isModalOpen ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!isModalOpen}>
				<div
					onClick={closeModal}
					className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ease-out ${
						isModalOpen ? 'opacity-100' : 'opacity-0'
					}`}
				/>

				<div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
					<div
						role="dialog"
						aria-modal="true"
						onClick={(e) => e.stopPropagation()}
						className={`w-full max-w-4xl max-h-[88vh] overflow-hidden bg-white rounded-3xl shadow-2xl border border-gray-200 transform transition-all duration-200 ease-out flex flex-col ${
							isModalOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
						}`}
					>
						<div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
							<div>
								<h2 className="text-lg font-bold text-gray-900">Booking Details</h2>
								<p className="text-xs text-gray-500 mt-1">Review all booking information in one place</p>
							</div>
							<button
								onClick={closeModal}
								className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center justify-center transition-colors"
								aria-label="Close"
							>
								×
							</button>
						</div>

						<div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 bg-slate-50/40">
							{detailLoading ? (
								<div className="py-10 flex items-center justify-center">
									<p className="text-gray-500 font-medium">Loading details...</p>
								</div>
							) : detailError ? (
								<div className="py-10 flex items-center justify-center">
									<p className="text-red-600 font-medium">{detailError}</p>
								</div>
							) : selected ? (
								<div className="space-y-4 text-sm">
									<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
										<p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">User Details</p>
										<div className="mt-2 space-y-1 text-gray-700">
											<p><span className="font-semibold text-gray-900">User:</span> {selected.user_name || '-'}</p>
											<p><span className="font-semibold text-gray-900">Phone:</span> {selected.user_mobile || '-'}</p>
											<p><span className="font-semibold text-gray-900">Email:</span> {selected.user_email || '-'}</p>
										</div>
									</div>

									<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
										<p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Booking Details</p>
										<div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-700">
											<p className="break-words"><span className="font-semibold text-gray-900">Service:</span> {formatServiceName(selected.service_name)}</p>
											<p><span className="font-semibold text-gray-900">Amount:</span> {formatMoney(getDisplayedAmount(selected))}</p>
											{(selected.original_amount != null || selected.coupon_discount != null || selected.final_amount_after_discount != null) && (
												<div className="sm:col-span-2 mt-1 rounded-xl bg-gray-50 border border-gray-100 p-3 text-sm text-gray-700 space-y-1">
													<p><span className="font-semibold text-gray-900">Original Price:</span> {formatMoney(selected.original_amount ?? selected.amount)}</p>
													<p><span className="font-semibold text-gray-900">Coupon Discount:</span> {formatMoney(selected.coupon_discount ?? 0)}</p>
													<p><span className="font-semibold text-gray-900">Final Paid:</span> {formatMoney(selected.final_amount_after_discount ?? getDisplayedAmount(selected))}</p>
												</div>
											)}
											<p>
												<span className="font-semibold text-gray-900">Booking Type:</span>{' '}
												<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${bookingTypeBadge(selected.booking_type)}`}>
													{toBookingType(selected.booking_type) === 'salon' ? 'SALON' : 'HOME'}
												</span>
											</p>
											<p><span className="font-semibold text-gray-900">Status:</span> {selected.status || '-'}</p>
											<p><span className="font-semibold text-gray-900">Booking ID:</span> {selected.booking_id || '-'}</p>
										</div>
									</div>

									<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
										<p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Partner Details</p>
										<div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-700">
											<p><span className="font-semibold text-gray-900">Partner Name:</span> {selected.partner_name || '-'}</p>
											<p><span className="font-semibold text-gray-900">Partner Phone:</span> {selected.partner_phone || '-'}</p>
											{toBookingType(selected.booking_type) === 'salon' ? (
												<>
													<p><span className="font-semibold text-gray-900">Salon Name:</span> {selected.salon_name || '-'}</p>
													<p><span className="font-semibold text-gray-900">Salon Open Time:</span> {selected.salon_open_time || '-'}</p>
													<p><span className="font-semibold text-gray-900">Salon Close Time:</span> {selected.salon_close_time || '-'}</p>
													<p className="sm:col-span-2"><span className="font-semibold text-gray-900">Salon Address:</span> {selected.salon_address || '-'}</p>
												</>
											) : (
												<p className="sm:col-span-2"><span className="font-semibold text-gray-900">Customer Address:</span> {selected.address || '-'}</p>
											)}
										</div>
									</div>

									<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
										<p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Payment Details</p>
										<div className="mt-2 space-y-1 text-gray-700">
											<p className="break-all"><span className="font-semibold text-gray-900">Transaction ID:</span> {selected.transaction_id || '-'}</p>
											<p className="break-all"><span className="font-semibold text-gray-900">Order ID:</span> {selected.order_id || '-'}</p>
											<p className="break-all"><span className="font-semibold text-gray-900">Signature:</span> {selected.signature || '-'}</p>
										</div>
									</div>

									<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
										<p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">Date/Time</p>
										<div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 text-gray-700">
											<p><span className="font-semibold text-gray-900">Slot Date:</span> {selected.slot_date || '-'}</p>
											<p><span className="font-semibold text-gray-900">Slot Time:</span> {selected.slot_time || '-'}</p>
											<p className="sm:col-span-2"><span className="font-semibold text-gray-900">Created At:</span> {formatDateTime(selected.created_at)}</p>
										</div>
									</div>
								</div>
							) : (
								<div className="py-10 flex items-center justify-center">
									<p className="text-gray-500 font-medium">No details</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
