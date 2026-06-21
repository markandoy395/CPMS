import React, { useEffect, useState } from 'react'
import { Printer, X } from 'lucide-react'

export function AssetLabelModal({ item, onClose }) {
  const [qrCode, setQrCode] = useState('')

  useEffect(() => {
    import('qrcode').then(({ default: QRCode }) => {
      return QRCode.toDataURL(`CPMS:${item.item_code}`, {
        width: 280,
        margin: 1,
        errorCorrectionLevel: 'H',
        color: { dark: '#111827', light: '#ffffff' }
      })
    }).then(setQrCode)
  }, [item.item_code])

  return (
    <div className="asset-tool-overlay asset-label-overlay" role="dialog" aria-modal="true" aria-label="Asset label">
      <div className="asset-tool-dialog label-dialog">
        <div className="asset-tool-header no-print">
          <div><h2>Asset Label</h2><p>Print and attach this label to the property.</p></div>
          <button className="btn-icon" onClick={onClose} aria-label="Close label"><X size={20} /></button>
        </div>
        <div className="asset-label-print">
          <div className="asset-label-brand">CPMS PROPERTY</div>
          {qrCode && <img src={qrCode} alt={`QR code for ${item.item_code}`} />}
          <strong>{item.item_code}</strong>
          <span>{item.item_name}</span>
          <dl>
            <div><dt>Serial</dt><dd>{item.serial_number || 'N/A'}</dd></div>
            <div><dt>Department</dt><dd>{item.department || 'Unassigned'}</dd></div>
            <div><dt>Custodian</dt><dd>{item.assigned_to || 'Unassigned'}</dd></div>
          </dl>
        </div>
        <div className="form-actions no-print">
          <button className="btn btn-primary" onClick={() => window.print()}><Printer size={18} /> Print Label</button>
        </div>
      </div>
    </div>
  )
}
