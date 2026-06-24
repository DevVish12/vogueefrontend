import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const formatDateTime = (value) => {
	if (!value) return '-';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '-';
	return date.toLocaleString();
};

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

const fallbackAvatarSvg =
	"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Crect width='100%25' height='100%25' rx='64' fill='%23e5e7eb'/%3E%3Cpath d='M64 68c14.36 0 26-11.64 26-26S78.36 16 64 16 38 27.64 38 42s11.64 26 26 26zm0 10c-22.09 0-40 17.91-40 40v2h80v-2c0-22.09-17.91-40-40-40z' fill='%239ca3af'/%3E%3C/svg%3E";

const buildAvatarUrl = (user, backendOrigin) => {
	const avatar = user?.avatar;
	if (!avatar) return fallbackAvatarSvg;
	if (typeof avatar !== 'string') return fallbackAvatarSvg;

	if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
	if (avatar.startsWith('/uploads/')) return `${backendOrigin}${avatar}`;

	// Stored as filename in /uploads/profile
	return `${backendOrigin}/uploads/profile/${encodeURIComponent(avatar)}`;
};

export default function UserManagePage() {
	const [users, setUsers] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedUser, setSelectedUser] = useState(null);

	const apiBase = useMemo(() => getApiBase(), []);
	const backendOrigin = useMemo(() => getBackendOrigin(apiBase), [apiBase]);

	const fetchUsers = useCallback(async () => {
		try {
			setLoading(true);
			setError('');

			const token = localStorage.getItem('adminToken');
			const response = await fetch(`${apiBase}/admin/users`, {
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {})
				}
			});

			if (!response.ok) {
				let msg = `Failed to fetch users (${response.status})`;
				try {
					const body = await response.json();
					if (body?.message) msg = body.message;
				} catch {
					// ignore
				}
				throw new Error(msg);
			}

			const data = await response.json();
			setUsers(Array.isArray(data?.users) ? data.users : []);
		} catch (e) {
			setError(e?.message || 'Failed to fetch users');
			setUsers([]);
		} finally {
			setLoading(false);
		}
	}, [apiBase]);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	useEffect(() => {
		// Live updates: refresh when a user is created or updated from the mobile app.
		const socket = io(backendOrigin, {
			transports: ['websocket', 'polling'],
			reconnection: true,
			autoConnect: true
		});

		const handleRefresh = () => {
			fetchUsers();
		};

		socket.on('userCreated', handleRefresh);
		socket.on('userUpdated', handleRefresh);

		return () => {
			socket.off('userCreated', handleRefresh);
			socket.off('userUpdated', handleRefresh);
			socket.disconnect();
		};
	}, [backendOrigin, fetchUsers]);

	const openModal = (user) => {
		setSelectedUser(user);
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
		// keep selectedUser for transition; clear after a tick
		setTimeout(() => setSelectedUser(null), 150);
	};

	return (
		<div className="flex-1 p-6">
			<div className="max-w-6xl mx-auto">
				<div className="flex items-center justify-between mb-6">
					<h1 className="text-2xl font-bold text-gray-900">User Management</h1>
				</div>

				<div className="bg-white border border-gray-200 rounded-2xl shadow-sm">
					<div className="p-4 sm:p-6">
						{loading ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-gray-500 font-medium">Loading users...</p>
							</div>
						) : error ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-red-600 font-medium">{error}</p>
							</div>
						) : users.length === 0 ? (
							<div className="py-16 flex items-center justify-center">
								<p className="text-gray-500 font-medium">No users found</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="min-w-full text-sm">
									<thead>
										<tr className="text-left text-gray-600 border-b border-gray-200">
											<th className="py-3 px-3 font-semibold">ID</th>
											<th className="py-3 px-3 font-semibold">Name</th>
											<th className="py-3 px-3 font-semibold">Mobile</th>
											<th className="py-3 px-3 font-semibold">Email</th>
											<th className="py-3 px-3 font-semibold">Gender</th>
											<th className="py-3 px-3 font-semibold">City</th>
											<th className="py-3 px-3 font-semibold">Status</th>
											<th className="py-3 px-3 font-semibold">Created Date</th>
											<th className="py-3 px-3 font-semibold">Action</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100">
										{users.map((user) => (
											<tr key={user.id} className="text-gray-800">
												<td className="py-3 px-3 whitespace-nowrap">{user.id}</td>
												<td className="py-3 px-3 whitespace-nowrap">{user.name || '-'}</td>
												<td className="py-3 px-3 whitespace-nowrap">{user.mobile || '-'}</td>
												<td className="py-3 px-3 whitespace-nowrap">{user.email || '-'}</td>
												<td className="py-3 px-3 whitespace-nowrap">{user.gender || '-'}</td>
												<td className="py-3 px-3 whitespace-nowrap">{user.city || '-'}</td>
												<td className="py-3 px-3 whitespace-nowrap">
													<span
														className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
															String(user.status || '').toLowerCase() === 'active'
																	? 'bg-green-50 text-green-700'
																	: 'bg-gray-100 text-gray-700'
														}`}
													>
														{user.status || '-'}
													</span>
												</td>
												<td className="py-3 px-3 whitespace-nowrap">{formatDate(user.created_at)}</td>
												<td className="py-3 px-3 whitespace-nowrap">
													<button
														onClick={() => openModal(user)}
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
			<div
				className={`fixed inset-0 z-50 ${isModalOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
				aria-hidden={!isModalOpen}
			>
				<div
					onClick={closeModal}
					className={`absolute inset-0 bg-black/40 transition-opacity duration-150 ${
						isModalOpen ? 'opacity-100' : 'opacity-0'
					}`}
				/>

				<div className="absolute inset-0 flex items-center justify-center p-4">
					<div
						role="dialog"
						aria-modal="true"
						onClick={(e) => e.stopPropagation()}
						className={`w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-200 transform transition-all duration-150 ${
							isModalOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
						}`}
					>
						<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
							<h2 className="text-lg font-bold text-gray-900">User Details</h2>
							<button
								onClick={closeModal}
								className="w-9 h-9 rounded-lg hover:bg-gray-100 text-gray-600 flex items-center justify-center transition-colors"
								aria-label="Close"
							>
								×
							</button>
						</div>

						<div className="px-6 py-6">
							{selectedUser ? (
								<div className="space-y-5">
									<div className="flex flex-col items-center">
										<img
											src={buildAvatarUrl(selectedUser, backendOrigin)}
											alt={selectedUser?.name || 'User'}
											className="w-24 h-24 rounded-full object-cover border border-gray-200"
											onError={(e) => {
												e.currentTarget.src = fallbackAvatarSvg;
											}}
										/>
										<p className="mt-3 font-semibold text-gray-900">{selectedUser?.name || '-'}</p>
									</div>

									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<div>
											<p className="text-xs font-semibold text-gray-500">Mobile</p>
											<p className="text-sm font-medium text-gray-900">{selectedUser?.mobile || '-'}</p>
										</div>
										<div>
											<p className="text-xs font-semibold text-gray-500">Email</p>
											<p className="text-sm font-medium text-gray-900 break-all">{selectedUser?.email || '-'}</p>
										</div>
										<div>
											<p className="text-xs font-semibold text-gray-500">Gender</p>
											<p className="text-sm font-medium text-gray-900">{selectedUser?.gender || '-'}</p>
										</div>
										<div>
											<p className="text-xs font-semibold text-gray-500">City</p>
											<p className="text-sm font-medium text-gray-900">{selectedUser?.city || '-'}</p>
										</div>
										<div>
											<p className="text-xs font-semibold text-gray-500">Role</p>
											<p className="text-sm font-medium text-gray-900">{selectedUser?.role || '-'}</p>
										</div>
										<div>
											<p className="text-xs font-semibold text-gray-500">Status</p>
											<p className="text-sm font-medium text-gray-900">{selectedUser?.status || '-'}</p>
										</div>
										<div>
											<p className="text-xs font-semibold text-gray-500">Created At</p>
											<p className="text-sm font-medium text-gray-900">{formatDateTime(selectedUser?.created_at)}</p>
										</div>
										<div>
											<p className="text-xs font-semibold text-gray-500">Updated At</p>
											<p className="text-sm font-medium text-gray-900">{formatDateTime(selectedUser?.updated_at)}</p>
										</div>
									</div>
								</div>
							) : (
								<div className="py-10 flex items-center justify-center">
									<p className="text-gray-500 font-medium">No user selected</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
