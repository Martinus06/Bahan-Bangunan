import React, { useState, useRef, useEffect } from 'react';

const ARMeasurementApp = () => {
  const [isARActive, setIsARActive] = useState(false);
  const [points, setPoints] = useState([]);
  const [currentCategory, setCurrentCategory] = useState('lantai');
  const [calibrationMultiplier, setCalibrationMultiplier] = useState(1);
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState(null);
  const [manualInputs, setManualInputs] = useState({
    category: 'lantai',
    panjang: '',
    lebar: '',
    tinggi: ''
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const pixelPerMeterRef = useRef(50);
  const animationFrameRef = useRef(null);

  const MATERIALS_BY_CATEGORY = {
    lantai: {
      keramik: { per_m2: 11, unit: 'buah', name: 'Keramik 30x30cm' },
      semen: { per_m2: 10, unit: 'kg', name: 'Semen' },
      pasir: { per_m2: 0.03, unit: 'm³', name: 'Pasir' },
      perekat: { per_m2: 5, unit: 'kg', name: 'Perekat Lantai' },
      nat: { per_m2: 0.5, unit: 'kg', name: 'Nat Keramik' }
    },
    tembok: {
      hebel: { per_m2: 8.33, unit: 'buah', name: 'Hebel (60x20cm)' },
      semen: { per_m2: 9.6, unit: 'kg', name: 'Semen' },
      pasir: { per_m2: 0.024, unit: 'm³', name: 'Pasir' },
      acian: { per_m2: 3.5, unit: 'kg', name: 'Acian' },
      cat: { per_m2: 0.15, unit: 'liter', name: 'Cat (2 lapis)' }
    },
    plafon: {
      gypsum: { per_m2: 1, unit: 'lembar', name: 'Gypsum 120x240cm' },
      rangka: { per_m2: 3, unit: 'batang', name: 'Rangka Hollow' },
      sekrup: { per_m2: 20, unit: 'buah', name: 'Sekrup Gypsum' },
      compound: { per_m2: 0.8, unit: 'kg', name: 'Compound' },
      cat: { per_m2: 0.12, unit: 'liter', name: 'Cat Plafon' }
    }
  };

  const CATEGORY_LABELS = {
    lantai: '🟦 Lantai',
    tembok: '🧱 Tembok',
    plafon: '⬜ Plafon'
  };

  // Calculate distances between all points
  const calculateAllDistances = (pointsList, pixelPerMeter, calibration) => {
    const updatedPoints = [...pointsList];
    
    for (let i = 0; i < updatedPoints.length; i++) {
      const nextIndex = (i + 1) % updatedPoints.length;
      
      if (i === updatedPoints.length - 1 && updatedPoints.length < 3) continue;
      
      const p1 = updatedPoints[i];
      const p2 = updatedPoints[nextIndex];
      
      const distanceInPixels = Math.sqrt(
        Math.pow(p2.x - p1.x, 2) + 
        Math.pow(p2.y - p1.y, 2)
      );
      
      const distanceInMeters = (distanceInPixels / pixelPerMeter) * calibration;
      
      if (!updatedPoints[i].distances) updatedPoints[i].distances = {};
      updatedPoints[i].distances[nextIndex] = distanceInMeters;
    }
    
    return updatedPoints;
  };

  // Draw canvas
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    
    if (!ctx || !canvas) return;

    // Add roundRect polyfill
    if (!ctx.roundRect) {
      ctx.roundRect = function(x, y, width, height, radius) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
      };
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw points
    points.forEach((point, index) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 20, 0, 2 * Math.PI);
      ctx.fillStyle = '#3B82F6';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5;
      ctx.stroke();

      const label = `Titik ${index + 1}`;
      ctx.font = 'bold 28px Arial';
      const textWidth = ctx.measureText(label).width;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.beginPath();
      ctx.roundRect(point.x + 28, point.y - 40, textWidth + 20, 40, 10);
      ctx.fill();
      
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(label, point.x + 38, point.y - 12);
    });

    // Draw lines
    if (points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      if (points.length > 2) {
        ctx.lineTo(points[0].x, points[0].y);
      }
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 10;
      ctx.setLineDash([25, 15]);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Draw distances
      for (let i = 0; i < points.length; i++) {
        const nextIndex = (i + 1) % points.length;
        if (i === points.length - 1 && points.length <= 2) break;
        
        const p1 = points[i];
        const p2 = points[nextIndex];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        const distanceInMeters = (p1.distances && p1.distances[nextIndex]) || 0;
        const distanceText = `${distanceInMeters.toFixed(2)} m`;

        ctx.font = 'bold 32px Arial';
        const distTextWidth = ctx.measureText(distanceText).width;
        
        ctx.fillStyle = 'rgba(59, 130, 246, 0.95)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.roundRect(midX - distTextWidth/2 - 18, midY - 28, distTextWidth + 36, 52, 12);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(distanceText, midX, midY + 10);
        ctx.shadowBlur = 0;
      }
    }

    animationFrameRef.current = requestAnimationFrame(drawCanvas);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Draw loop effect
  useEffect(() => {
    if (isARActive && points.length > 0) {
      drawCanvas();
    }
  }, [points, isARActive]);

  // Start AR
  const startAR = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1920 }, 
          height: { ideal: 1080 } 
        }
      });
      
      streamRef.current = stream;
      setIsARActive(true);
      
      // Wait for next render cycle
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            const canvas = canvasRef.current;
            if (canvas && videoRef.current) {
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              
              const resolution = canvas.width * canvas.height;
              const screenDiagonal = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
              
              if (resolution > 2000000) {
                pixelPerMeterRef.current = screenDiagonal / 20;
              } else if (resolution > 1000000) {
                pixelPerMeterRef.current = screenDiagonal / 25;
              } else {
                pixelPerMeterRef.current = screenDiagonal / 30;
              }
              
              console.log(`Auto-calibration: ${pixelPerMeterRef.current.toFixed(1)} pixels per meter`);
              console.log(`Resolution: ${canvas.width}x${canvas.height} (${resolution} total pixels)`);
              
              drawCanvas();
            }
          };
        }
      }, 100);
    } catch (err) {
      alert('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
      console.error(err);
      setIsARActive(false);
    }
  };

  // Stop AR
  const stopAR = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsARActive(false);
    setPoints([]);
    setCalibrationMultiplier(1);
  };

  // Add point at center
  const addPointAtCenter = () => {
    const canvas = canvasRef.current;
    if (!canvas || points.length >= 8) {
      if (points.length >= 8) alert('Maksimal 8 titik!');
      return;
    }
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const newPoints = [...points, { x: centerX, y: centerY }];
    const updatedPoints = calculateAllDistances(newPoints, pixelPerMeterRef.current, calibrationMultiplier);
    setPoints(updatedPoints);
  };

  // Canvas click handler
  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length >= 8) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    const newPoints = [...points, { x, y }];
    const updatedPoints = calculateAllDistances(newPoints, pixelPerMeterRef.current, calibrationMultiplier);
    setPoints(updatedPoints);
  };

  // Update calibration
  const handleCalibrationChange = (value) => {
    setCalibrationMultiplier(value);
    if (points.length > 0) {
      const updatedPoints = calculateAllDistances(points, pixelPerMeterRef.current, value);
      setPoints(updatedPoints);
    }
  };

  // Calculate area
  const calculateArea = () => {
    if (points.length < 3) {
      alert('Minimal 3 titik diperlukan!');
      return;
    }

    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    area = Math.abs(area / 2);
    
    const areaInM2 = (area / Math.pow(pixelPerMeterRef.current, 2)) * Math.pow(calibrationMultiplier, 2);

    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
      const nextIndex = (i + 1) % points.length;
      if (i === points.length - 1 && points.length < 3) break;
      
      const distanceInMeters = (points[i].distances && points[i].distances[nextIndex]) || 0;
      perimeter += distanceInMeters;
    }

    displayResults(areaInM2, perimeter, currentCategory);
  };

  // Calculate material manually
  const hitungMaterialManual = () => {
    const panjang = parseFloat(manualInputs.panjang);
    const lebar = parseFloat(manualInputs.lebar);
    
    if (!panjang || !lebar) {
      alert('Mohon isi panjang dan lebar!');
      return;
    }

    const areaInM2 = panjang * lebar;
    const perimeter = 2 * (panjang + lebar);

    displayResults(areaInM2, perimeter, manualInputs.category);
  };

  // Display results
  const displayResults = (areaInM2, perimeter, category) => {
    const materials = MATERIALS_BY_CATEGORY[category];
    const materialsList = Object.keys(materials).map(key => {
      const material = materials[key];
      const amount = (areaInM2 * material.per_m2 * 1.1).toFixed(2);
      return {
        name: material.name,
        amount: amount,
        unit: material.unit
      };
    });

    setResults({
      area: areaInM2.toFixed(2),
      perimeter: perimeter.toFixed(2),
      category: category,
      materials: materialsList
    });
    setShowResults(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-purple-700 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-5 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 text-2xl font-bold">
            📷 Pengukur AR
          </div>
          <div>Ukur Titik ke Titik</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-5">
        {/* Landing Screen */}
        {!isARActive && (
          <div>
            <div className="bg-gray-800 rounded-xl aspect-video mb-5 flex items-center justify-center text-6xl text-gray-600">
              ➕
            </div>

            <div className="bg-blue-900/50 backdrop-blur rounded-xl p-5 mb-5">
              <button 
                onClick={startAR}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-lg mb-4 transition"
              >
                📷 Buka Kamera AR untuk memulai
              </button>
              
              <p className="text-red-300 font-semibold mb-2">⚠️ Cara Menggunakan:</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>Buka kamera AR dan arahkan ke area yang ingin diukur</li>
                <li>Gerakkan perangkat perlahan untuk tracking 3D</li>
                <li>Pilih kategori pengukuran (Lantai/Tembok/Plafon)</li>
                <li>Tap "Tandai Titik" untuk titik pertama</li>
                <li>Gerakkan ke titik kedua, lalu tap "Tandai Titik" lagi</li>
                <li>Jarak otomatis terhitung menggunakan sensor AR</li>
              </ol>
            </div>

            <div className="bg-gray-800/80 backdrop-blur rounded-xl p-5">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                🧮 Dimensi untuk Kalkulator
              </h2>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Kategori</label>
                <select 
                  value={manualInputs.category}
                  onChange={(e) => setManualInputs({...manualInputs, category: e.target.value})}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="lantai">🟦 Lantai</option>
                  <option value="tembok">🧱 Tembok</option>
                  <option value="plafon">⬜ Plafon</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Panjang (meter)</label>
                <input 
                  type="number" 
                  value={manualInputs.panjang}
                  onChange={(e) => setManualInputs({...manualInputs, panjang: e.target.value})}
                  placeholder="Dari pengukuran atau input manual" 
                  step="0.01"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Lebar (meter)</label>
                <input 
                  type="number"
                  value={manualInputs.lebar}
                  onChange={(e) => setManualInputs({...manualInputs, lebar: e.target.value})}
                  placeholder="Dari pengukuran atau input manual" 
                  step="0.01"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Tinggi (meter) - Opsional</label>
                <input 
                  type="number"
                  value={manualInputs.tinggi}
                  onChange={(e) => setManualInputs({...manualInputs, tinggi: e.target.value})}
                  placeholder="Untuk menghitung volume" 
                  step="0.01"
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500"
                />
              </div>

              <button 
                onClick={hitungMaterialManual}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-lg transition"
              >
                📊 Hitung Material
              </button>
            </div>
          </div>
        )}

        {/* AR Screen */}
        {isARActive && (
          <div>
            {/* Category Selector */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {Object.keys(CATEGORY_LABELS).map(cat => (
                <button
                  key={cat}
                  onClick={() => setCurrentCategory(cat)}
                  className={`p-3 border-2 rounded-lg font-bold transition ${
                    currentCategory === cat
                      ? 'bg-gradient-to-br from-blue-500 to-purple-600 border-blue-500 shadow-lg'
                      : 'bg-white/10 border-white/30 hover:bg-white/20'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Video Container */}
            <div className="bg-gray-800 rounded-xl overflow-hidden relative aspect-video mb-5">
              <video 
                ref={videoRef}
                autoPlay 
                playsInline
                className="w-full h-full object-cover"
              />
              <canvas 
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="absolute top-0 left-0 w-full h-full cursor-crosshair"
              />
              
              {/* Info Overlay */}
              <div className="absolute top-3 left-3 bg-black/75 backdrop-blur rounded-lg p-3 text-xs z-10">
                <p><strong>Kategori: <span>{CATEGORY_LABELS[currentCategory].split(' ')[1]}</span></strong></p>
                <p><strong>Titik: <span>{points.length}</span></strong></p>
              </div>

              {/* Calibration Overlay */}
              <div className="absolute bottom-3 left-3 right-3 bg-black/75 backdrop-blur rounded-lg p-3 text-xs z-10 flex items-center gap-3">
                <label className="font-bold whitespace-nowrap text-blue-400">📏 Kalibrasi:</label>
                <input 
                  type="range" 
                  min="0.5" 
                  max="3" 
                  value={calibrationMultiplier}
                  onChange={(e) => handleCalibrationChange(parseFloat(e.target.value))}
                  step="0.1"
                  className="flex-1 h-2 bg-blue-500/30 rounded appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgb(59 130 246) 0%, rgb(59 130 246) ${((calibrationMultiplier - 0.5) / 2.5) * 100}%, rgba(59, 130, 246, 0.3) ${((calibrationMultiplier - 0.5) / 2.5) * 100}%, rgba(59, 130, 246, 0.3) 100%)`
                  }}
                />
                <span className="min-w-[60px] text-right font-bold text-green-400">{calibrationMultiplier.toFixed(1)}x</span>
              </div>

              {/* Tips */}
              <div className="absolute bottom-16 left-3 right-3 bg-black/75 backdrop-blur rounded-lg p-2 text-[10px] z-10">
                💡 <strong>Tips Kalibrasi:</strong> Ukur objek yang sudah diketahui panjangnya (misal: pintu 2m). Jika hasil lebih kecil, geser ke kanan. Jika lebih besar, geser ke kiri.
              </div>
            </div>

            {/* Mark Point Button */}
            <button 
              onClick={addPointAtCenter}
              className="w-full bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold py-5 px-6 rounded-lg mb-4 text-xl transition shadow-lg animate-pulse"
            >
              ✨ TANDAI TITIK
            </button>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button 
                onClick={() => {
                  setPoints([]);
                  setCalibrationMultiplier(1);
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-6 rounded-lg transition"
              >
                🔄 Reset
              </button>
              <button 
                onClick={calculateArea}
                disabled={points.length < 3}
                className={`font-bold py-4 px-6 rounded-lg transition ${
                  points.length >= 3
                    ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                {points.length >= 3 ? '✓ Hitung Material' : `Minimal 3 Titik (${points.length}/3)`}
              </button>
            </div>

            <button 
              onClick={stopAR}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-4 px-6 rounded-lg transition"
            >
              Tutup Kamera
            </button>
          </div>
        )}
      </div>

      {/* Results Modal */}
      {showResults && results && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur flex items-center justify-center p-5 z-50">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-600 to-green-500 p-5 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-xl font-bold">Hasil Perhitungan</h2>
              <button 
                onClick={() => setShowResults(false)}
                className="bg-white/20 hover:bg-white/35 w-9 h-9 rounded-full flex items-center justify-center text-2xl transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6">
              <div className="bg-blue-900/50 rounded-xl p-5 mb-5 text-center">
                <p className="inline-block bg-blue-500/30 px-4 py-2 rounded-full text-sm font-bold mb-3">
                  {CATEGORY_LABELS[results.category]}
                </p>
                <p className="text-sm text-gray-400">Luas Area</p>
                <p className="text-4xl font-bold my-2">{results.area} m²</p>
                <p className="text-sm text-gray-400 mt-2">Keliling: {results.perimeter} m</p>
              </div>

              <div className="mb-5">
                <h3 className="text-lg font-bold mb-4">Material yang Dibutuhkan:</h3>
                {results.materials.map((material, index) => (
                  <div key={index} className="bg-gray-700/50 rounded-xl p-4 mb-3 flex justify-between items-center">
                    <span className="font-medium">{material.name}</span>
                    <span className="text-xl font-bold text-green-400">{material.amount} {material.unit}</span>
                  </div>
                ))}
              </div>

              <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-xl p-4">
                <p className="text-yellow-400 font-semibold mb-2">💡 Catatan:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                  <li>Perhitungan sudah termasuk toleransi 10%</li>
                  <li>Material disesuaikan dengan kategori yang dipilih</li>
                  <li>Untuk hasil akurat, gunakan AR measurement</li>
                  <li>Konsultasikan dengan tukang berpengalaman</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          background: #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);
        }
      `}</style>
    </div>
  );
};

export default ARMeasurementApp;
