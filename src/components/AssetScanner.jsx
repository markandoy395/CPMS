import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Image, Keyboard, RefreshCw, X } from 'lucide-react'

function getCameraError(error) {
  if (!window.isSecureContext) {
    return 'Camera access requires HTTPS or localhost. Open CPMS using localhost on this device, or scan a saved image below.'
  }

  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was blocked. Allow camera access in the browser site settings, then select Retry Camera.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device. Connect a camera or scan a saved image below.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is being used by another application. Close it there, then select Retry Camera.'
    case 'OverconstrainedError':
      return 'The selected camera is unavailable. Choose another camera and try again.'
    case 'CameraTimeoutError':
      return 'Camera permission did not complete. Select the camera icon in the address bar, allow access, then select Retry Camera.'
    case 'VideoTimeoutError':
      return 'Camera access was allowed, but the video did not start. Close other camera apps and select Retry Camera.'
    default:
      return 'The camera could not start. Check browser permission, then select Retry Camera.'
  }
}

function timeoutError(name, milliseconds) {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      const error = new Error(name)
      error.name = name
      reject(error)
    }, milliseconds)
  })
}

function cleanAssetCode(value) {
  return value.trim().replace(/^CPMS:/i, '')
}

export function AssetScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const readerRef = useRef(null)
  const activeRef = useRef(true)
  const detectedRef = useRef(false)
  const cameraRequestRef = useRef(0)
  const onDetectedRef = useRef(onDetected)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [manualCode, setManualCode] = useState('')
  const [cameras, setCameras] = useState([])
  const [selectedCamera, setSelectedCamera] = useState('')
  const [imageScanning, setImageScanning] = useState(false)

  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1
    controlsRef.current?.stop()
    controlsRef.current = null
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
      stopCamera()
    }
  }, [stopCamera])

  const completeScan = useCallback((rawValue) => {
    if (detectedRef.current || !rawValue) return
    detectedRef.current = true
    stopCamera()
    onDetectedRef.current(cleanAssetCode(rawValue))
  }, [stopCamera])

  const startScanner = useCallback(async (cameraId = selectedCamera) => {
    stopCamera()
    const requestId = cameraRequestRef.current
    detectedRef.current = false
    setError('')
    setStatus('requesting')

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError(getCameraError())
      return
    }

    try {
      const constraints = {
        audio: false,
        video: cameraId
          ? { deviceId: { exact: cameraId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
      }
      const mediaRequest = navigator.mediaDevices.getUserMedia(constraints)
      mediaRequest.then(stream => {
        if (!activeRef.current || requestId !== cameraRequestRef.current) {
          stream.getTracks().forEach(track => track.stop())
        }
      }).catch(() => {})

      const stream = await Promise.race([
        mediaRequest,
        timeoutError('CameraTimeoutError', 12000)
      ])

      if (!activeRef.current || requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }

      const video = videoRef.current
      video.srcObject = stream
      await Promise.race([
        video.play(),
        timeoutError('VideoTimeoutError', 8000)
      ])

      if (!activeRef.current || requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }

      setStatus('scanning')
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      if (!activeRef.current || requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }

      const reader = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 150,
        delayBetweenScanSuccess: 500
      })
      readerRef.current = reader

      const onResult = (result, scanError, controls) => {
        if (!activeRef.current || detectedRef.current) return
        if (result) {
          controls?.stop()
          completeScan(result.getText())
        } else if (scanError && scanError.name && !['NotFoundException', 'ChecksumException', 'FormatException'].includes(scanError.name)) {
          setError('The camera is active, but a frame could not be read. Hold the label steady inside the green box.')
        }
      }

      const devices = await BrowserMultiFormatReader.listVideoInputDevices()
      setCameras(devices)
      const activeDevice = stream.getVideoTracks()[0]?.getSettings?.().deviceId
      if (activeDevice) setSelectedCamera(activeDevice)

      controlsRef.current = await reader.decodeFromVideoElement(video, onResult)

      if (!activeRef.current || requestId !== cameraRequestRef.current) {
        controlsRef.current?.stop()
        return
      }
    } catch (cameraError) {
      if (!activeRef.current) return
      stopCamera()
      setStatus('error')
      setError(getCameraError(cameraError))
    }
  }, [completeScan, selectedCamera, stopCamera])

  const changeCamera = (event) => {
    const cameraId = event.target.value
    setSelectedCamera(cameraId)
    startScanner(cameraId)
  }

  const scanImage = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImageScanning(true)
    setError('')
    const imageUrl = URL.createObjectURL(file)

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = readerRef.current || new BrowserMultiFormatReader()
      const result = await reader.decodeFromImageUrl(imageUrl)
      completeScan(result.getText())
    } catch {
      setError('No readable barcode or QR code was found in that image. Try a sharper, well-lit photo.')
    } finally {
      URL.revokeObjectURL(imageUrl)
      setImageScanning(false)
    }
  }

  const submitManual = (event) => {
    event.preventDefault()
    if (manualCode.trim()) completeScan(manualCode)
  }

  return (
    <div className="asset-tool-overlay" role="dialog" aria-modal="true" aria-label="Scan asset code">
      <div className="asset-tool-dialog scanner-dialog">
        <div className="asset-tool-header">
          <div><h2>Scan Asset</h2><p>Scan a barcode or QR property label.</p></div>
          <button className="btn-icon" onClick={onClose} aria-label="Close scanner"><X size={20} /></button>
        </div>

        <div className={`scanner-viewport ${status === 'scanning' ? 'is-scanning' : ''}`}>
          <video ref={videoRef} muted playsInline />
          {status === 'scanning' && <div className="scanner-frame" aria-hidden="true"><Camera size={28} /></div>}
          {status !== 'scanning' && (
            <div className="scanner-start-panel">
              <Camera size={34} />
              <strong>{status === 'requesting' ? 'Allow camera access in the browser prompt...' : 'Camera is off'}</strong>
              <button className="btn btn-primary" type="button" onClick={() => startScanner()} disabled={status === 'requesting'}>
                {status === 'error' ? <RefreshCw size={18} /> : <Camera size={18} />}
                {status === 'error' ? 'Retry Camera' : 'Start Camera'}
              </button>
            </div>
          )}
        </div>

        <div className="scanner-controls">
          {cameras.length > 1 && (
            <label>
              <span>Camera</span>
              <select value={selectedCamera} onChange={changeCamera} disabled={status === 'requesting'}>
                {cameras.map((camera, index) => (
                  <option key={camera.deviceId} value={camera.deviceId}>{camera.label || `Camera ${index + 1}`}</option>
                ))}
              </select>
            </label>
          )}
          <label className="btn btn-secondary scanner-image-button">
            <Image size={18} /> {imageScanning ? 'Scanning...' : 'Scan Image'}
            <input type="file" accept="image/*" capture="environment" onChange={scanImage} disabled={imageScanning} />
          </label>
        </div>

        {status === 'scanning' && !error && <p className="scanner-status">Camera ready. Center the complete label inside the green box.</p>}
        {error && <p className="text-danger scanner-error" role="alert">{error}</p>}

        <form className="scanner-manual" onSubmit={submitManual}>
          <Keyboard size={18} />
          <input value={manualCode} onChange={event => setManualCode(event.target.value)} placeholder="Enter item code or serial number" />
          <button className="btn btn-primary" type="submit">Find Asset</button>
        </form>
      </div>
    </div>
  )
}
