import { type PageSchema, AdminPage, pageToUrl } from 'admin_lsac';
import { apiFetch } from '../lib/api';
import { Navigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const usersSchema: PageSchema = {
  name: 'Users',
  actions: [],
  rowActions: [
    {
      name: 'Update User',
      fields: [
        { name: 'api_key', label: 'API Key', type: 'string' },
        { name: 'wallet', label: 'Wallet Balance', type: 'number' },
        { 
          name: 'role', 
          label: 'Role', 
          type: 'dropdown', 
          options: [{ value: 'USER', display: 'User' }, { value: 'ADMIN', display: 'Admin' }]
        }
      ],
      onSubmit: async (...args) => {
        let targetId = null;

        args.forEach(arg => {
            if (arg && typeof arg === 'object' && arg.id) {
                targetId = arg.id;
            }
        });

        if (!targetId) {
            throw new Error('Error: no ID found.');
        }

        const formValues = args[0] || {};

        const customPayload = {
            api_key: formValues.api_key,
            wallet: formValues.wallet,
            role: formValues.role
        };

        const res = await apiFetch(`/api/users/${targetId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customPayload) 
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to update user');
        }
        return await res.json();
      }
    },
    {
      name: 'Delete User',
      onSubmit: async (formValues, row) => { 
        
        const targetId = row?.id || formValues?.id; 
        
        if (!targetId) {
            throw new Error('Could not find User ID to delete.');
        }

        const res = await apiFetch(`/api/users/${targetId}`, {
          method: 'DELETE'
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to delete user');
        }
        return await res.json();
      }
    }
  ],
  getRequest: async () => {
    const res = await apiFetch('/api/users');
    if (!res.ok) throw new Error('Failed to fetch users');
    const data = await res.json();
    return data.users || [];
  },
  tableFields: [
    { name: 'ID', access: (obj: any) => obj.id },
    { name: 'Firebase UID', access: (obj: any) => obj.firebase_uid },
    { name: 'Role', access: (obj: any) => obj.role },
    { name: 'Wallet', access: (obj: any) => obj.wallet },
    { name: 'API Key', access: (obj: any) => obj.api_key || 'N/A' },
    { name: 'Created At', access: (obj: any) => new Date(obj.created_at).toLocaleString() }
  ]
};

export const sessionsSchema: PageSchema = {
  name: 'Sessions',
  actions: [],
  rowActions: [
    {
      name: 'Update Session',
      fields: [
        { name: 'pnl', label: 'PNL (Profit/Loss)', type: 'number' },
        { 
          name: 'status', 
          label: 'Status', 
          type: 'dropdown', 
          options: [
            { value: 'ACTIVE', display: 'Active' }, 
            { value: 'STOPPED', display: 'Stopped' },
            { value: 'COMPLETED', display: 'Completed' },
            { value: 'FAILED', display: 'Failed' }
          ]
        }
      ],
      onSubmit: async (...args: any[]) => {
        let targetId = null;
        let oldRow: any = {};

        args.forEach(arg => {
            if (arg && typeof arg === 'object' && arg.id) {
                targetId = arg.id;
                oldRow = arg;
            }
        });

        if (!targetId) {
            throw new Error('Error: no ID found.');
        }

        const formValues = args[0] || {};
        const customPayload: any = {};
        
        if (formValues.pnl !== undefined) customPayload.pnl = formValues.pnl;
        if (formValues.status !== undefined) customPayload.status = formValues.status;

        const terminalStatuses = ['STOPPED', 'COMPLETED', 'FAILED'];
        
        if (
            formValues.status && 
            terminalStatuses.includes(formValues.status) && 
            oldRow.status !== formValues.status
        ) {
            customPayload.stop_timestamp = new Date().toISOString();
        }

        const res = await apiFetch(`/api/sessions/${targetId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customPayload) 
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to update session');
        }
        return await res.json();
      }
    },
    {
      name: 'Delete Session',
      onSubmit: async (...args: any[]) => {
        let targetId = null;

        args.forEach(arg => {
            if (arg && typeof arg === 'object' && arg.id) {
                targetId = arg.id;
            }
        });

        if (!targetId) {
            throw new Error('Error: no ID found.');
        }

        const res = await apiFetch(`/api/sessions/${targetId}`, {
          method: 'DELETE'
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to delete session');
        }
        return await res.json();
      }
    }
  ],
  getRequest: async () => {
    const res = await apiFetch('/api/sessions');
    if (!res.ok) throw new Error('Failed to fetch sessions');
    const data = await res.json();
    return data.sessions || [];
  },
  tableFields: [
    { name: 'ID', access: (obj: any) => obj.id },
    { name: 'User', access: (obj: any) => obj.user ? `User: ${obj.user.id}` : `User ID: ${obj.user_id}` },
    { name: 'Status', access: (obj: any) => obj.status },
    { name: 'PNL', access: (obj: any) => obj.pnl !== null ? obj.pnl : 'N/A' },
    { name: 'Start', access: (obj: any) => obj.start_timestamp ? new Date(obj.start_timestamp).toLocaleString() : 'N/A' },
    { name: 'Stop', access: (obj: any) => obj.stop_timestamp ? new Date(obj.stop_timestamp).toLocaleString() : 'Activ' },
    { 
      name: 'Trades (IDs)', 
      access: (obj: any) => (obj.trades && Array.isArray(obj.trades) && obj.trades.length > 0) 
        ? obj.trades.map((t: any) => t.id).join(', ') 
        : 'Fără trade-uri' 
    }
  ]
};

export const tradesSchema: PageSchema = {
  name: 'Trades',
  actions: [],
  rowActions: [
    {
      name: 'Update Trade',
      fields: [
        { name: 'price', label: 'Price', type: 'number' },
        { name: 'quantity', label: 'Quantity', type: 'number' },
        { 
          name: 'type', 
          label: 'Type', 
          type: 'dropdown', 
          options: [
            { value: 'BUY', display: 'Buy' }, 
            { value: 'SELL', display: 'Sell' }
          ]
        }
      ],
      onSubmit: async (...args: any[]) => {
        let targetId = null;

        args.forEach(arg => {
            if (arg && typeof arg === 'object' && arg.id) {
                targetId = arg.id;
            }
        });

        if (!targetId) {
            throw new Error('Internal error: Could not find Trade ID.');
        }

        const formValues = args[0] || {};

        const customPayload: any = {};
        if (formValues.price !== undefined) customPayload.price = formValues.price;
        if (formValues.quantity !== undefined) customPayload.quantity = formValues.quantity;
        if (formValues.type !== undefined) customPayload.type = formValues.type;

        const res = await apiFetch(`/api/trades/${targetId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(customPayload) 
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to update trade.');
        }
        return await res.json();
      }
    },
    {
      name: 'Delete Trade',
      onSubmit: async (...args: any[]) => {
        let targetId = null;

        args.forEach(arg => {
            if (arg && typeof arg === 'object' && arg.id) {
                targetId = arg.id;
            }
        });

        if (!targetId) {
            throw new Error('Internal error: Could not find Trade ID.');
        }

        const res = await apiFetch(`/api/trades/${targetId}`, {
          method: 'DELETE'
        });
        
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to delete trade.');
        }
        return await res.json();
      }
    }
  ],
  getRequest: async () => {
    const res = await apiFetch('/api/trades');
    if (!res.ok) throw new Error('Failed to fetch trades.');
    const data = await res.json();
    return data.trades || [];
  },
  tableFields: [
    { name: 'ID', access: (obj: any) => obj.id },
    { name: 'Session ID', access: (obj: any) => obj.session_id },
    { name: 'Type', access: (obj: any) => obj.type },
    { name: 'Price', access: (obj: any) => obj.price },
    { name: 'Quantity', access: (obj: any) => obj.quantity },
    { name: 'Timestamp', access: (obj: any) => obj.timestamp ? new Date(obj.timestamp).toLocaleString() : 'N/A' }
  ]
};

export const adminSchemas = [usersSchema, sessionsSchema, tradesSchema];

export function AdminDashboard() {
  const { "*": splat } = useParams();
  const { currentUser, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (!currentUser) {
        setIsAdmin(false);
        setChecking(false);
        return;
      }
      try {
        const res = await apiFetch(`/api/users/firebase/${currentUser.uid}`);
        if (!res.ok) throw new Error('Not found');
        const user = await res.json();
        setIsAdmin(user.role === 'ADMIN');
      } catch {
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    }
    checkAdmin();
  }, [currentUser]);

  if (loading || checking) return <div className="p-8 text-center">Loading...</div>;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  let selectedPage = adminSchemas.find(p => pageToUrl(p) === splat);
  if (!selectedPage && adminSchemas.length > 0) {
    selectedPage = adminSchemas[0];
    if (!splat || splat === '') {
      return <Navigate to={`/dashboard/admin/${pageToUrl(selectedPage)}`} replace />;
    }
  }
  if (!selectedPage) return <div>No admin schemas defined</div>;

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden min-h-[80vh]">
      <AdminPage
        pages={adminSchemas}
        selectedPage={selectedPage}
        basePath="/dashboard/admin"
        apiURL="http://localhost:5000"
      />
    </div>
  );
}