import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ADMIN_PATHS } from '../../routes/adminPaths';
import { getAdminProfile, logoutAdmin } from '../../server/authApi';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AdminLayout() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await getAdminProfile();
        if (response?.success) {
          setAdmin(response.data);
          return;
        }
        // Token exists but is invalid/expired -> clear it to avoid redirect loop
        logoutAdmin();
        navigate(ADMIN_PATHS.LOGIN, { replace: true });
      } catch {
        logoutAdmin();
        navigate(ADMIN_PATHS.LOGIN, { replace: true });
      } finally {
        setLoading(false);
      }
    };

    if (!localStorage.getItem('adminToken')) {
      navigate(ADMIN_PATHS.LOGIN, { replace: true });
      return;
    }

    fetchProfile();
  }, [navigate]);

  const handleLogout = () => {
    logoutAdmin();
    navigate(ADMIN_PATHS.LOGIN, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-800">
      <Sidebar admin={admin} handleLogout={handleLogout} />
      <div className="ml-72 min-h-screen flex flex-col">
        <Topbar admin={admin} />
        <div className="admin-crm-surface flex-1 flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm font-medium text-slate-500">Loading Dashboard...</p>
            </div>
          ) : (
            <Outlet context={{ admin }} />
          )}
        </div>
      </div>
    </div>
  );
}
