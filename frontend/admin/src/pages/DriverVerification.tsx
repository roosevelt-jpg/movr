// frontend/admin/src/pages/DriverVerification.tsx
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'react-query';
import toast from 'react-hot-toast';

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'pending' | 'verified' | 'suspended' | 'rejected';
  verifications: {
    nationalId: boolean;
    passport: boolean;
    drivingLicense: boolean;
    faceVerification: boolean;
    backgroundCheck: boolean;
  };
  documents: Array<{
    type: string;
    verified: boolean;
    uploadedAt: Date;
    expiryDate: Date;
  }>;
  verificationScore: number; // 0-100
  videoRecordings: number;
  sosIncidents: number;
}

const DriverVerificationDashboard: React.FC = () => {
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Fetch all drivers with verification status
  const { data: drivers, refetch } = useQuery('drivers-verification', async () => {
    const response = await fetch('/api/v1/admin/drivers/verification-status');
    return response.json();
  });

  // Fetch driver details
  const { data: driverDetails } = useQuery(
    ['driver-details', selectedDriver?.id],
    async () => {
      if (!selectedDriver) return null;
      const response = await fetch(`/api/v1/admin/drivers/${selectedDriver.id}/details`);
      return response.json();
    },
    { enabled: !!selectedDriver }
  );

  // Approve driver mutation
  const approveDriver = useMutation(
    async (driverId: string) => {
      const response = await fetch(`/api/v1/admin/drivers/${driverId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'admin', approvalNotes: 'All documents verified' }),
      });
      return response.json();
    },
    {
      onSuccess: () => {
        toast.success('Driver approved');
        refetch();
      },
      onError: () => {
        toast.error('Failed to approve driver');
      },
    }
  );

  // Reject driver mutation
  const rejectDriver = useMutation(
    async ({ driverId, reason }: { driverId: string; reason: string }) => {
      const response = await fetch(`/api/v1/admin/drivers/${driverId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: reason }),
      });
      return response.json();
    },
    {
      onSuccess: () => {
        toast.success('Driver rejected');
        refetch();
      },
    }
  );

  const filteredDrivers = drivers?.data?.filter((d: Driver) =>
    filterStatus === 'all' ? true : d.status === filterStatus
  ) || [];

  return (
    <div style={{ padding: '2rem', backgroundColor: 'var(--surface-elevated)', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 500, marginBottom: '1.5rem' }}>
        Driver Verification Dashboard
      </h1>

      {/* Filter Controls */}
      <div style={{ marginBottom: '2rem', display: 'flex', gap: '1rem' }}>
        {['all', 'pending', 'verified', 'rejected', 'suspended'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            style={{
              padding: '8px 16px',
              backgroundColor: filterStatus === status ? 'var(--jet-black)' : 'var(--pure-white)',
              color: filterStatus === status ? 'var(--pure-white)' : 'var(--jet-black)',
              border: '0.5px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)} ({filteredDrivers.filter((d: Driver) => d.status === status).length})
          </button>
        ))}
      </div>

      {/* Drivers List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {filteredDrivers.map((driver: Driver) => (
          <div
            key={driver.id}
            onClick={() => setSelectedDriver(driver)}
            style={{
              backgroundColor: 'var(--pure-white)',
              border: '0.5px solid var(--text-primary)',
              borderRadius: '12px',
              padding: '1.5rem',
              cursor: 'pointer',
              boxShadow: selectedDriver?.id === driver.id ? '0 0 0 2px var(--jet-black)' : 'none',
            }}
          >
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>{driver.name}</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0.25rem 0' }}>{driver.email}</p>
            </div>

            {/* Verification Score */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Verification Score</span>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{driver.verificationScore}%</span>
              </div>
              <div style={{ height: '6px', backgroundColor: 'var(--text-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    backgroundColor: driver.verificationScore >= 80 ? 'var(--success)' : driver.verificationScore >= 60 ? 'var(--warning)' : 'var(--error)',
                    width: `${driver.verificationScore}%`,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            </div>

            {/* Documents Status */}
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 0.5rem' }}>Documents</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div style={{ fontSize: '12px', padding: '0.5rem', backgroundColor: driver.verifications.nationalId ? 'color-mix(in srgb, var(--success) 22%, transparent)' : 'color-mix(in srgb, var(--error) 18%, transparent)', borderRadius: '4px' }}>
                  ✓ National ID
                </div>
                <div style={{ fontSize: '12px', padding: '0.5rem', backgroundColor: driver.verifications.drivingLicense ? 'color-mix(in srgb, var(--success) 22%, transparent)' : 'color-mix(in srgb, var(--error) 18%, transparent)', borderRadius: '4px' }}>
                  ✓ Driving License
                </div>
                <div style={{ fontSize: '12px', padding: '0.5rem', backgroundColor: driver.verifications.faceVerification ? 'color-mix(in srgb, var(--success) 22%, transparent)' : 'color-mix(in srgb, var(--error) 18%, transparent)', borderRadius: '4px' }}>
                  ✓ Face Verification
                </div>
                <div style={{ fontSize: '12px', padding: '0.5rem', backgroundColor: driver.verifications.backgroundCheck ? 'color-mix(in srgb, var(--success) 22%, transparent)' : 'color-mix(in srgb, var(--error) 18%, transparent)', borderRadius: '4px' }}>
                  ✓ Background Check
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div
              style={{
                display: 'inline-block',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 500,
                backgroundColor:
                  driver.status === 'verified' ? 'color-mix(in srgb, var(--success) 22%, transparent)' :
                  driver.status === 'pending' ? 'color-mix(in srgb, var(--warning) 22%, transparent)' :
                  driver.status === 'rejected' ? 'color-mix(in srgb, var(--error) 22%, transparent)' :
                  'color-mix(in srgb, var(--electric-violet) 22%, transparent)',
                color:
                  driver.status === 'verified' ? 'var(--success)' :
                  driver.status === 'pending' ? 'var(--warning)' :
                  driver.status === 'rejected' ? 'var(--error)' : 'var(--electric-violet)',
              }}
            >
              {driver.status.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed View */}
      {selectedDriver && (
        <div style={{ backgroundColor: 'var(--pure-white)', borderRadius: '12px', padding: '2rem', borderLeft: '4px solid var(--jet-black)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '1.5rem' }}>
            {selectedDriver.name} - Detailed Verification
          </h2>

          {/* Documents Table */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '1rem' }}>Documents</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--text-primary)' }}>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '13px', fontWeight: 500 }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '13px', fontWeight: 500 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '13px', fontWeight: 500 }}>Uploaded</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '13px', fontWeight: 500 }}>Expires</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '13px', fontWeight: 500 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedDriver.documents.map((doc, idx) => (
                  <tr key={idx} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem', fontSize: '14px' }}>{doc.type}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          backgroundColor: doc.verified ? 'var(--surface-elevated)' : 'var(--surface-elevated)',
                          color: doc.verified ? 'var(--success)' : 'var(--warning)',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 500,
                        }}
                      >
                        {doc.verified ? '✓ Verified' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {new Date(doc.expiryDate).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <button
                        onClick={() => window.open(`/api/v1/documents/${doc.type}/view`)}
                        style={{
                          padding: '4px 12px',
                          fontSize: '12px',
                          backgroundColor: 'var(--border)',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Video Recording Stats */}
          <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: 'var(--surface-elevated)', borderRadius: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '1rem' }}>Recording & Safety</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Video Recordings</p>
                <p style={{ fontSize: '24px', fontWeight: 500, margin: '0.5rem 0' }}>{selectedDriver.videoRecordings}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>SOS Incidents</p>
                <p style={{ fontSize: '24px', fontWeight: 500, margin: '0.5rem 0', color: selectedDriver.sosIncidents > 0 ? 'var(--error)' : 'var(--success)' }}>
                  {selectedDriver.sosIncidents}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '1rem' }}>
            {selectedDriver.status === 'pending' && (
              <>
                <button
                  onClick={() => approveDriver.mutate(selectedDriver.id)}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'var(--success)',
                    color: 'var(--pure-white)',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  ✓ Approve Driver
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Rejection reason:');
                    if (reason) rejectDriver.mutate({ driverId: selectedDriver.id, reason });
                  }}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'var(--error)',
                    color: 'var(--pure-white)',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  ✗ Reject Driver
                </button>
              </>
            )}
            {selectedDriver.status === 'verified' && (
              <button
                onClick={() => {
                  const reason = prompt('Suspension reason:');
                  if (reason) rejectDriver.mutate({ driverId: selectedDriver.id, reason });
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'var(--warning)',
                  color: 'var(--pure-white)',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                ⚠ Suspend Driver
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverVerificationDashboard;
