// Global Variables
let stream = null;
let points = [];
let currentCategory = 'lantai';
let video, canvas, ctx;
// KALIBRASI BARU: 100 pixel di layar = 1 meter di dunia nyata (default)
// Ini artinya 1 pixel = 1 cm
let pixelPerMeter = 100; // Seberapa banyak pixel untuk 1 meter
let calibrationMultiplier = 1; // Multiplier untuk kalibrasi manual

// Material Constants by Category
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

// Start AR Camera
async function startAR() {
    document.getElementById('landingScreen').classList.add('hidden');
    document.getElementById('arScreen').classList.remove('hidden');

    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'environment', 
                width: { ideal: 1920 }, 
                height: { ideal: 1080 } 
            }
        });
        video.srcObject = stream;
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Auto-kalibrasi berdasarkan resolusi kamera
            // Logika: resolusi lebih tinggi = bisa capture detail lebih kecil
            const resolution = canvas.width * canvas.height;
            if (resolution > 2000000) { // Full HD+ (1920x1080+)
                pixelPerMeter = 150; // 150px = 1m, jadi 1px ≈ 0.67cm
            } else if (resolution > 1000000) { // HD (1280x720)
                pixelPerMeter = 100; // 100px = 1m, jadi 1px = 1cm
            } else { // Standard (640x480)
                pixelPerMeter = 80; // 80px = 1m, jadi 1px = 1.25cm
            }
            
            drawCanvas();
        };
    } catch (err) {
        alert('Tidak dapat mengakses kamera. Pastikan izin kamera diberikan.');
        console.error(err);
        stopAR();
    }

    // Setup calibration slider
    const calibrationSlider = document.getElementById('calibrationSlider');
    const calibrationValue = document.getElementById('calibrationValue');
    
    calibrationSlider.addEventListener('input', (e) => {
        calibrationMultiplier = parseFloat(e.target.value);
        calibrationValue.textContent = calibrationMultiplier.toFixed(1) + 'x';
    });

    // Click on canvas to add point
    canvas.onclick = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        // Hitung jarak dalam pixel
        const distanceInPixels = points.length > 0 ? 
            Math.sqrt(Math.pow(x - points[points.length - 1].x, 2) + 
                      Math.pow(y - points[points.length - 1].y, 2)) : 0;
        
        // Konversi ke centimeter: (pixel / pixelPerMeter) * 100 * calibration
        const distanceInCm = (distanceInPixels / pixelPerMeter) * 100 * calibrationMultiplier;
        
        addPointAt(x, y, distanceInCm);
    };
}

// Select Category
function selectCategory(category) {
    currentCategory = category;
    
    // Update button states
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-category="${category}"]`).classList.add('active');
    
    // Update display
    document.getElementById('currentCategory').textContent = CATEGORY_LABELS[category].split(' ')[1];
}

// Add Point at Center (for button click)
function addPointAtCenter() {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const distanceInPixels = points.length > 0 ? 
        Math.sqrt(Math.pow(centerX - points[points.length - 1].x, 2) + 
                  Math.pow(centerY - points[points.length - 1].y, 2)) : 0;
    
    const distanceInCm = (distanceInPixels / pixelPerMeter) * 100 * calibrationMultiplier;
    
    addPointAt(centerX, centerY, distanceInCm);
}

// Add Point at Specific Location
function addPointAt(x, y, distance) {
    if (points.length >= 8) {
        alert('Maksimal 8 titik!');
        return;
    }
    
    // Simpan titik dengan jarak dari titik SEBELUMNYA
    points.push({ x, y, distance });
    updateUI();
}

// Update UI
function updateUI() {
    document.getElementById('pointCount').textContent = points.length;
    const calculateBtn = document.getElementById('calculateBtn');
    
    if (points.length >= 3) {
        calculateBtn.disabled = false;
        calculateBtn.textContent = '✔ Hitung Material';
    } else {
        calculateBtn.disabled = true;
        calculateBtn.textContent = `Minimal 3 Titik (${points.length}/3)`;
    }
}

// Draw Canvas - GARIS DAN TEKS DIPERBESAR
function drawCanvas() {
    if (!ctx || !canvas) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw points
    points.forEach((point, index) => {
        // Point circle - DIPERBESAR LEBIH BESAR
        ctx.beginPath();
        ctx.arc(point.x, point.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = '#3B82F6';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 5;
        ctx.stroke();

        // Point label with background - DIPERBESAR LEBIH BESAR
        const label = `Titik ${index + 1}`;
        ctx.font = 'bold 28px Arial';
        const textWidth = ctx.measureText(label).width;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.beginPath();
        ctx.roundRect(point.x + 28, point.y - 40, textWidth + 20, 40, 10);
        ctx.fill();
        
        // Text
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(label, point.x + 38, point.y - 12);
    });

    // Draw lines - GARIS DIPERBESAR SANGAT TEBAL
    if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
        if (points.length > 2) {
            ctx.lineTo(points[0].x, points[0].y);
        }
        // GARIS SUPER TEBAL
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 10; // Diperbesar dari 6 ke 10
        ctx.setLineDash([25, 15]); // Dash lebih panjang
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Draw distances - TEKS DIPERBESAR SANGAT BESAR
        for (let i = 0; i < points.length; i++) {
            const nextIndex = (i + 1) % points.length;
            if (i === points.length - 1 && points.length <= 2) break;
            
            const p1 = points[i];
            const p2 = points[nextIndex];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const distance = p1.distance || 0;

            // Format distance lebih baik
            let distanceText;
            if (distance >= 100) {
                distanceText = `${(distance / 100).toFixed(2)} m`;
            } else {
                distanceText = `${distance.toFixed(1)} cm`;
            }

            // Measure text width for background - FONT SUPER BESAR
            ctx.font = 'bold 32px Arial'; // Diperbesar dari 20px ke 32px
            const distTextWidth = ctx.measureText(distanceText).width;
            
            // Background - DIPERBESAR LEBIH BESAR
            ctx.fillStyle = 'rgba(59, 130, 246, 0.95)';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.roundRect(midX - distTextWidth/2 - 18, midY - 28, distTextWidth + 36, 52, 12);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Text - SUPER BESAR DAN TEBAL
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 4;
            ctx.fillText(distanceText, midX, midY + 10);
            ctx.shadowBlur = 0;
        }
    }

    requestAnimationFrame(drawCanvas);
}

// Reset Measurement
function resetMeasurement() {
    points = [];
    calibrationMultiplier = 1;
    const slider = document.getElementById('calibrationSlider');
    const value = document.getElementById('calibrationValue');
    if (slider) slider.value = 1;
    if (value) value.textContent = '1.0x';
    updateUI();
}

// Stop AR
function stopAR() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    document.getElementById('arScreen').classList.add('hidden');
    document.getElementById('landingScreen').classList.remove('hidden');
    resetMeasurement();
}

// Calculate Area
function calculateArea() {
    if (points.length < 3) {
        alert('Minimal 3 titik diperlukan!');
        return;
    }

    // Calculate area using Shoelace formula
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    area = Math.abs(area / 2);
    
    // Konversi pixel² ke m²
    // Formula: (area_pixel / pixelPerMeter²) * calibrationMultiplier²
    // Contoh: area 10,000 px² dengan 100px/m = 10000/(100*100) = 1 m²
    const areaInM2 = (area / Math.pow(pixelPerMeter, 2)) * Math.pow(calibrationMultiplier, 2);

    // Calculate perimeter
    let perimeter = 0;
    for (let i = 0; i < points.length; i++) {
        perimeter += points[i].distance || 0;
    }
    perimeter = perimeter / 100; // Convert cm to m

    displayResults(areaInM2, perimeter, currentCategory);
}

// Calculate Material Manual
function hitungMaterialManual() {
    const panjang = parseFloat(document.getElementById('panjang').value);
    const lebar = parseFloat(document.getElementById('lebar').value);
    const category = document.getElementById('manualCategory').value;
    
    if (!panjang || !lebar) {
        alert('Mohon isi panjang dan lebar!');
        return;
    }

    const areaInM2 = panjang * lebar;
    const perimeter = 2 * (panjang + lebar);

    displayResults(areaInM2, perimeter, category);
}

// Display Results
function displayResults(areaInM2, perimeter, category) {
    document.getElementById('areaValue').textContent = areaInM2.toFixed(2);
    document.getElementById('perimeterValue').textContent = perimeter.toFixed(2);
    document.getElementById('modalCategory').textContent = CATEGORY_LABELS[category];

    const materialsList = document.getElementById('materialsList');
    materialsList.innerHTML = '';
    
    const materials = MATERIALS_BY_CATEGORY[category];
    Object.keys(materials).forEach(key => {
        const material = materials[key];
        const amount = (areaInM2 * material.per_m2 * 1.1).toFixed(2); // +10% tolerance
        
        materialsList.innerHTML += `
            <div class="material-item">
                <span class="material-name">${material.name}</span>
                <span class="material-amount">${amount} ${material.unit}</span>
            </div>
        `;
    });

    document.getElementById('resultsModal').classList.remove('hidden');
}

// Close Modal - DIPERBAIKI!
function closeModal() {
    document.getElementById('resultsModal').classList.add('hidden');
}

// Polyfill for roundRect (for older browsers)
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
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
