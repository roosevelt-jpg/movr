// frontend/web/src/pages/MerchantVerificationPage.tsx
import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import axios from 'axios';

const MerchantVerificationPage: React.FC = () => {
  const [step, setStep] = useState<'business' | 'owner' | 'license' | 'review' | 'pending' | 'verified'>(
    'business'
  );
  const [formData, setFormData] = useState({
    businessName: '',
    businessRegistrationNumber: '',
    businessCategory: '',
    businessPhone: '',
    businessEmail: '',
    businessAddress: '',
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
    ownerIdType: 'national_id',
  });

  const [files, setFiles] = useState({
    ownerIdFront: null as File | null,
    ownerIdBack: null as File | null,
    businessLicense: null as File | null,
    registrationCertificate: null as File | null,
  });

  const [verificationStatus, setVerificationStatus] = useState({
    businessVerified: false,
    ownerVerified: false,
    licenseVerified: false,
    confidenceScore: 0,
  });

  // Get merchant verification status
  const { data: merchantStatus } = useQuery('merchant-status', async () => {
    const response = await axios.get('/api/v1/merchant/verification-status');
    return response.data;
  });

  // Submit merchant verification
  const submitVerification = useMutation(
    async (formDataToSend: FormData) => {
      const response = await axios.post('/api/v1/merchant/verify', formDataToSend, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    {
      onSuccess: (data) => {
        setVerificationStatus({
          businessVerified: data.details.businessVerified,
          ownerVerified: data.details.ownerVerified,
          licenseVerified: data.details.licenseVerified,
          confidenceScore: data.confidence,
        });

        if (data.verified) {
          setStep('verified');
        } else {
          setStep('pending');
        }
      },
    }
  );

  const handleFileChange = (field: string, file: File) => {
    setFiles((prev) => ({ ...prev, [field]: file }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const formDataToSend = new FormData();

    // Add form fields
    Object.entries(formData).forEach(([key, value]) => {
      formDataToSend.append(key, value);
    });

    // Add files
    if (files.ownerIdFront) formDataToSend.append('ownerIdFront', files.ownerIdFront);
    if (files.ownerIdBack) formDataToSend.append('ownerIdBack', files.ownerIdBack);
    if (files.businessLicense) formDataToSend.append('businessLicense', files.businessLicense);
    if (files.registrationCertificate)
      formDataToSend.append('registrationCertificate', files.registrationCertificate);

    submitVerification.mutate(formDataToSend);
  };

  if (merchantStatus?.verified) {
    return (
      <div style={styles.container as any}>
        <div style={styles.successCard as any}>
          <div style={styles.successIcon as any}>✅</div>
          <h2 style={styles.successTitle as any}>Business Verified!</h2>
          <p style={styles.successText as any}>
            Your business has been verified. You can now start selling on MOVR Marketplace.
          </p>
          <button style={styles.successButton as any}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container as any}>
      <div style={styles.header as any}>
        <h1 style={styles.title as any}>Business Verification</h1>
        <p style={styles.subtitle as any}>Get verified in 3 easy steps</p>
      </div>

      {/* Progress Indicator */}
      <div style={styles.progressContainer as any}>
        {['business', 'owner', 'license'].map((s, idx) => (
          <div key={s} style={styles.progressStep as any}>
            <div
              style={{
                ...styles.progressCircle,
                backgroundColor:
                  ['business', 'owner', 'license'].indexOf(step) >= idx ? 'var(--jet-black)' : 'var(--border)',
              } as any}
            >
              <span style={{ color: ['business', 'owner', 'license'].indexOf(step) >= idx ? 'var(--pure-white)' : 'var(--text-secondary)' }}>
                {idx + 1}
              </span>
            </div>
            <p style={styles.progressLabel as any}>{s.charAt(0).toUpperCase() + s.slice(1)}</p>
          </div>
        ))}
      </div>

      {/* Business Information Step */}
      {step === 'business' && (
        <div style={styles.formCard as any}>
          <h2 style={styles.formTitle as any}>Business Information</h2>

          <div style={styles.formGroup as any}>
            <label style={styles.label as any}>Business Name *</label>
            <input
              type="text"
              value={formData.businessName}
              onChange={(e) => handleInputChange('businessName', e.target.value)}
              placeholder="Enter your business name"
              style={styles.input as any}
            />
          </div>

          <div style={styles.formGroup as any}>
            <label style={styles.label as any}>Registration Number *</label>
            <input
              type="text"
              value={formData.businessRegistrationNumber}
              onChange={(e) => handleInputChange('businessRegistrationNumber', e.target.value)}
              placeholder="e.g., BN-12345678"
              style={styles.input as any}
            />
          </div>

          <div style={styles.formGroup as any}>
            <label style={styles.label as any}>Business Category *</label>
            <select
              value={formData.businessCategory}
              onChange={(e) => handleInputChange('businessCategory', e.target.value)}
              style={styles.input as any}
            >
              <option value="">Select Category</option>
              <option value="grocery">Grocery & Food</option>
              <option value="electronics">Electronics</option>
              <option value="fashion">Fashion & Apparel</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="furniture">Furniture</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div style={styles.formRow as any}>
            <div style={styles.formGroup as any}>
              <label style={styles.label as any}>Phone *</label>
              <input
                type="tel"
                value={formData.businessPhone}
                onChange={(e) => handleInputChange('businessPhone', e.target.value)}
                placeholder="+233..."
                style={styles.input as any}
              />
            </div>
            <div style={styles.formGroup as any}>
              <label style={styles.label as any}>Email *</label>
              <input
                type="email"
                value={formData.businessEmail}
                onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                placeholder="business@example.com"
                style={styles.input as any}
              />
            </div>
          </div>

          <div style={styles.formGroup as any}>
            <label style={styles.label as any}>Business Address *</label>
            <input
              type="text"
              value={formData.businessAddress}
              onChange={(e) => handleInputChange('businessAddress', e.target.value)}
              placeholder="Street address"
              style={styles.input as any}
            />
          </div>

          <button
            onClick={() => setStep('owner')}
            disabled={!formData.businessName || !formData.businessPhone}
            style={styles.nextButton as any}
          >
            Next: Owner Details
          </button>
        </div>
      )}

      {/* Owner Information Step */}
      {step === 'owner' && (
        <div style={styles.formCard as any}>
          <h2 style={styles.formTitle as any}>Owner Identity Verification</h2>

          <div style={styles.formRow as any}>
            <div style={styles.formGroup as any}>
              <label style={styles.label as any}>First Name *</label>
              <input
                type="text"
                value={formData.ownerFirstName}
                onChange={(e) => handleInputChange('ownerFirstName', e.target.value)}
                placeholder="John"
                style={styles.input as any}
              />
            </div>
            <div style={styles.formGroup as any}>
              <label style={styles.label as any}>Last Name *</label>
              <input
                type="text"
                value={formData.ownerLastName}
                onChange={(e) => handleInputChange('ownerLastName', e.target.value)}
                placeholder="Doe"
                style={styles.input as any}
              />
            </div>
          </div>

          <div style={styles.formGroup as any}>
            <label style={styles.label as any}>ID Type *</label>
            <select
              value={formData.ownerIdType}
              onChange={(e) => handleInputChange('ownerIdType', e.target.value)}
              style={styles.input as any}
            >
              <option value="national_id">National ID</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving License</option>
            </select>
          </div>

          {/* ID Document Upload */}
          <div style={styles.uploadSection as any}>
            <h3 style={styles.uploadTitle as any}>Upload ID Documents</h3>

            <div style={styles.uploadGroup as any}>
              <label style={styles.uploadLabel as any}>Front Side of ID *</label>
              <div style={styles.uploadBox as any}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && handleFileChange('ownerIdFront', e.target.files[0])}
                  style={styles.fileInput as any}
                />
                <p style={styles.uploadText as any}>
                  {files.ownerIdFront ? `✓ ${files.ownerIdFront.name}` : '📷 Click to upload'}
                </p>
              </div>
            </div>

            <div style={styles.uploadGroup as any}>
              <label style={styles.uploadLabel as any}>Back Side of ID *</label>
              <div style={styles.uploadBox as any}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && handleFileChange('ownerIdBack', e.target.files[0])}
                  style={styles.fileInput as any}
                />
                <p style={styles.uploadText as any}>
                  {files.ownerIdBack ? `✓ ${files.ownerIdBack.name}` : '📷 Click to upload'}
                </p>
              </div>
            </div>
          </div>

          <div style={styles.buttonGroup as any}>
            <button onClick={() => setStep('business')} style={styles.backButton as any}>
              Back
            </button>
            <button
              onClick={() => setStep('license')}
              disabled={!files.ownerIdFront || !files.ownerIdBack}
              style={styles.nextButton as any}
            >
              Next: Business License
            </button>
          </div>
        </div>
      )}

      {/* Business License Step */}
      {step === 'license' && (
        <div style={styles.formCard as any}>
          <h2 style={styles.formTitle as any}>Business Documents</h2>

          <div style={styles.uploadSection as any}>
            <div style={styles.uploadGroup as any}>
              <label style={styles.uploadLabel as any}>Business License *</label>
              <div style={styles.uploadBox as any}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && handleFileChange('businessLicense', e.target.files[0])}
                  style={styles.fileInput as any}
                />
                <p style={styles.uploadText as any}>
                  {files.businessLicense ? `✓ ${files.businessLicense.name}` : '📷 Click to upload'}
                </p>
              </div>
            </div>

            <div style={styles.uploadGroup as any}>
              <label style={styles.uploadLabel as any}>Registration Certificate (Optional)</label>
              <div style={styles.uploadBox as any}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files && handleFileChange('registrationCertificate', e.target.files[0])}
                  style={styles.fileInput as any}
                />
                <p style={styles.uploadText as any}>
                  {files.registrationCertificate ? `✓ ${files.registrationCertificate.name}` : '📷 Click to upload'}
                </p>
              </div>
            </div>
          </div>

          <div style={styles.infoBox as any}>
            <h4 style={styles.infoTitle as any}>✓ Requirements</h4>
            <ul style={styles.infoList as any}>
              <li>All documents must be clear and readable</li>
              <li>Registration number must match business records</li>
              <li>Owner ID must match person managing the business</li>
              <li>Verification typically completes within 24 hours</li>
            </ul>
          </div>

          <div style={styles.buttonGroup as any}>
            <button onClick={() => setStep('owner')} style={styles.backButton as any}>
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!files.businessLicense || submitVerification.isLoading}
              style={styles.submitButton as any}
            >
              {submitVerification.isLoading ? 'Verifying...' : '✓ Submit for Verification'}
            </button>
          </div>
        </div>
      )}

      {/* Pending Step */}
      {step === 'pending' && (
        <div style={styles.successCard as any}>
          <div style={styles.pendingIcon as any}>⏳</div>
          <h2 style={styles.successTitle as any}>Verification in Progress</h2>
          <p style={styles.successText as any}>
            Your documents have been submitted. Our security team is reviewing them now.
          </p>
          <div style={styles.statsGrid as any}>
            <div style={styles.statItem as any}>
              <span style={styles.statLabel as any}>Business Verified</span>
              <span style={styles.statValue as any}>
                {verificationStatus.businessVerified ? '✓' : '⏳'}
              </span>
            </div>
            <div style={styles.statItem as any}>
              <span style={styles.statLabel as any}>Owner Verified</span>
              <span style={styles.statValue as any}>
                {verificationStatus.ownerVerified ? '✓' : '⏳'}
              </span>
            </div>
            <div style={styles.statItem as any}>
              <span style={styles.statLabel as any}>License Verified</span>
              <span style={styles.statValue as any}>
                {verificationStatus.licenseVerified ? '✓' : '⏳'}
              </span>
            </div>
            <div style={styles.statItem as any}>
              <span style={styles.statLabel as any}>Confidence Score</span>
              <span style={styles.statValue as any}>{verificationStatus.confidenceScore}%</span>
            </div>
          </div>
          <p style={styles.timelineText as any}>✓ Expected completion: 24 hours</p>
        </div>
      )}

      {/* Verified Step */}
      {step === 'verified' && (
        <div style={styles.successCard as any}>
          <div style={styles.successIcon as any}>✅</div>
          <h2 style={styles.successTitle as any}>Verification Complete!</h2>
          <p style={styles.successText as any}>
            All documents have been verified. Your store is now live on MOVR Marketplace.
          </p>
          <div style={styles.statsGrid as any}>
            <div style={styles.statItem as any}>
              <span style={styles.statLabel as any}>Confidence Score</span>
              <span style={styles.statValue as any}>{verificationStatus.confidenceScore}%</span>
            </div>
          </div>
          <button style={styles.successButton as any}>Start Selling</button>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '2rem',
    backgroundColor: 'var(--surface-elevated)',
    minHeight: '100vh',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: 'var(--jet-black)',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: '0.5rem 0 0',
  },
  progressContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '2rem',
    position: 'relative',
  },
  progressStep: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
  },
  progressCircle: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  progressLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  formCard: {
    backgroundColor: 'var(--pure-white)',
    padding: '2rem',
    borderRadius: '12px',
    borderLeft: '4px solid var(--jet-black)',
    marginBottom: '2rem',
  },
  formTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'var(--jet-black)',
    marginBottom: '1.5rem',
  },
  formGroup: {
    marginBottom: '1.5rem',
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--jet-black)',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  uploadSection: {
    marginTop: '2rem',
    paddingTop: '2rem',
    borderTop: '1px solid var(--border)',
  },
  uploadTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--jet-black)',
    marginBottom: '1rem',
  },
  uploadGroup: {
    marginBottom: '1.5rem',
  },
  uploadLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--jet-black)',
    marginBottom: '8px',
  },
  uploadBox: {
    border: '2px dashed var(--border)',
    borderRadius: '8px',
    padding: '2rem',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  fileInput: {
    display: 'none',
  },
  uploadText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  infoBox: {
    backgroundColor: 'var(--surface-elevated)',
    padding: '1rem',
    borderRadius: '8px',
    marginTop: '1.5rem',
  },
  infoTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--jet-black)',
    margin: 0,
    marginBottom: '0.5rem',
  },
  infoList: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    margin: 0,
    paddingLeft: '1.5rem',
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    marginTop: '2rem',
  },
  backButton: {
    flex: 1,
    padding: '12px',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    backgroundColor: 'var(--pure-white)',
    color: 'var(--jet-black)',
    fontWeight: '500',
    cursor: 'pointer',
  },
  nextButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'var(--jet-black)',
    color: 'var(--pure-white)',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  submitButton: {
    flex: 1,
    padding: '12px',
    backgroundColor: 'var(--success)',
    color: 'var(--pure-white)',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  successCard: {
    backgroundColor: 'var(--pure-white)',
    padding: '2rem',
    borderRadius: '12px',
    textAlign: 'center',
  },
  successIcon: {
    fontSize: '48px',
    marginBottom: '1rem',
  },
  pendingIcon: {
    fontSize: '48px',
    marginBottom: '1rem',
    animation: 'pulse 2s infinite',
  },
  successTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: 'var(--jet-black)',
    marginBottom: '0.5rem',
  },
  successText: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    marginBottom: '1.5rem',
  },
  successButton: {
    padding: '12px 24px',
    backgroundColor: 'var(--success)',
    color: 'var(--pure-white)',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '500',
    cursor: 'pointer',
    fontSize: '14px',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    margin: '1.5rem 0',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1rem',
    backgroundColor: 'var(--surface-elevated)',
    borderRadius: '8px',
  },
  statLabel: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginBottom: '0.5rem',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: 'var(--jet-black)',
  },
  timelineText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginTop: '1rem',
  },
};

export default MerchantVerificationPage;
