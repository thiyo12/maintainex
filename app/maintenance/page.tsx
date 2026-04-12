import { FiMail, FiPhone, FiMapPin, FiTool } from 'react-icons/fi'

export default async function MaintenancePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom right, #FCD34D, #FFC300, #FB923C)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ maxWidth: '672px', width: '100%' }}>
        <div style={{
          background: 'white',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '32px'
        }}>
          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '80px',
              height: '80px',
              background: '#1F2937',
              borderRadius: '16px',
              marginBottom: '24px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}>
              <span style={{ color: '#FFC300', fontWeight: 'bold', fontSize: '48px' }}>M</span>
            </div>
            <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>
              Maintain<span style={{ color: '#FFC300' }}>ex</span>
            </h1>
          </div>

          <div style={{ marginBottom: '32px', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              background: '#FEF3C7',
              color: '#1F2937',
              padding: '12px 24px',
              borderRadius: '9999px',
              marginBottom: '24px'
            }}>
              <FiTool style={{ width: '20px', height: '20px' }} />
              <span style={{ fontWeight: 600 }}>Coming Soon</span>
            </div>
            
            <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1F2937', marginBottom: '16px' }}>
              We&apos;re Making Things Better!
            </h2>
            
            <p style={{ color: '#6B7280', fontSize: '18px', lineHeight: '1.625', marginBottom: '24px' }}>
              Our website is currently undergoing some scheduled maintenance to serve you better.
              We&apos;ll be back shortly. Thank you for your patience!
            </p>
          </div>

          <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '32px' }}>
            <h3 style={{ color: '#6B7280', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', textAlign: 'center' }}>
              Get in Touch
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
              <a 
                href="mailto:contact@maintainex.com" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280', textDecoration: 'none' }}
              >
                <FiMail style={{ width: '20px', height: '20px' }} />
                <span>contact@maintainex.com</span>
              </a>
              
              <a 
                href="tel:+94XXXXXXXXX" 
                style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280', textDecoration: 'none' }}
              >
                <FiPhone style={{ width: '20px', height: '20px' }} />
                <span>+94 XX XXX XXXX</span>
              </a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#9CA3AF' }}>
              <FiMapPin style={{ width: '16px', height: '16px' }} />
              <span>Sri Lanka</span>
            </div>
          </div>

          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #F3F4F6', textAlign: 'center' }}>
            <p style={{ color: '#FFC300', fontWeight: 500, fontStyle: 'italic', marginBottom: '8px' }}>
              Shine Beyond Expectations
            </p>
            <p style={{ color: '#9CA3AF', fontSize: '14px' }}>
              - Maintainex
            </p>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: '14px', marginTop: '24px' }}>
          Need urgent assistance? Contact us directly via email or phone.
        </p>
      </div>
    </div>
  )
}
