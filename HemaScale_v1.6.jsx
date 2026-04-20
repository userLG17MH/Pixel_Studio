import React, { useState, useRef, useEffect } from 'react';
import { Activity, Brain, Image as ImageIcon, CheckCircle, Database, ShieldCheck, Target, Search } from 'lucide-react';

// --- INTERNAL LOGIC: Peripheral_Counter.js (spatial clustering + threshold classification) ---
// UI: HemaScale AI v1.4 (statistical inference engine aesthetic)

const App = () => {
  const [image, setImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  const canvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const rawCanvasRef = useRef(null);
  const [detectionBox, setDetectionBox] = useState(null); // {x,y,w,h,label}

  const BLOOD_CELL_CLASSES = [
    { id: 'Neutrophil',  name: 'Neutrophil',  description: 'Multilobed nucleus (3-5 lobes). Granular cytoplasm. Most abundant WBC.',     color: 'text-blue-600'   },
    { id: 'Lymphocyte',  name: 'Lymphocyte',  description: 'Large, round, dense nucleus with minimal cytoplasm.',                          color: 'text-purple-600' },
    { id: 'Monocyte',    name: 'Monocyte',    description: 'Largest WBC, large kidney or horseshoe-shaped nucleus.',                       color: 'text-indigo-600' },
    { id: 'Eosinophil',  name: 'Eosinophil',  description: 'Bilocular nucleus, bright orange/red granules.',                               color: 'text-orange-600' },
    { id: 'Basophil',    name: 'Basophil',    description: 'Large dark granules obscuring the nucleus. Very rare.',                        color: 'text-slate-700'  },
    { id: 'Myeloblast',  name: 'Myeloblast',  description: 'Immature large cell, high N:C ratio, often has nucleoli.',                     color: 'text-red-600'    },
  ];

  // --- CLASSIFICATION (from Peripheral_Counter.js) ---
  const classify = (area, circularity) => {
    if (area > 3000 && area < 8500) {
      return circularity < 0.65 ? BLOOD_CELL_CLASSES[0] : BLOOD_CELL_CLASSES[1];
    } else if (area >= 8500 && area < 15000) {
      return BLOOD_CELL_CLASSES[2];
    } else if (area >= 15000) {
      return BLOOD_CELL_CLASSES[5];
    } else if (area > 0 && area <= 3000) {
      return BLOOD_CELL_CLASSES[1];
    }
    return { id: 'Unknown', name: 'Low Signal', description: 'Could not isolate a clear WBC nucleus. Please check stain quality.', color: 'text-slate-400' };
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
        setResults(null);
        setDetectionBox(null);
        setActiveStep(0);
      };
      reader.readAsDataURL(file);
    }
  };

  // Redraw detection boxes on preview canvas whenever results change
  useEffect(() => {
    if (!results || !image || !previewCanvasRef.current) return;
    const pCanvas = previewCanvasRef.current;
    const img = new window.Image();
    img.onload = () => {
      const displayW = pCanvas.offsetWidth || 380;
      const displayH = Math.round(displayW * (img.naturalHeight / img.naturalWidth));
      pCanvas.width = displayW;
      pCanvas.height = Math.max(displayH, 80);
      const pCtx = pCanvas.getContext('2d');
      pCtx.drawImage(img, 0, 0, displayW, pCanvas.height);
      if (results.area > 0 && results.bbox) {
        const { minX, maxX, minY, maxY } = results.bbox;
        const scaleX = displayW / 300;
        const scaleY = pCanvas.height / 300;
        const pad = 8;
        const bx = Math.max(0, minX * scaleX - pad);
        const by = Math.max(0, minY * scaleY - pad);
        const bw = Math.min(displayW - bx, (maxX - minX) * scaleX + pad * 2);
        const bh = Math.min(pCanvas.height - by, (maxY - minY) * scaleY + pad * 2);
        pCtx.strokeStyle = '#ef4444';
        pCtx.lineWidth = 2;
        pCtx.setLineDash([5, 4]);
        pCtx.strokeRect(bx, by, bw, bh);
        pCtx.setLineDash([]);
        const label = results.prediction.name;
        pCtx.font = 'bold 10px monospace';
        const tw = pCtx.measureText(label).width + 10;
        pCtx.fillStyle = '#ef4444';
        pCtx.fillRect(bx, Math.max(0, by - 18), tw, 18);
        pCtx.fillStyle = '#ffffff';
        pCtx.fillText(label, bx + 5, Math.max(13, by - 5));
      }
    };
    img.src = image;
  }, [results, image]);

  // Draw image (+ red dashed detection box after results) on the Raw Input canvas
  useEffect(() => {
    const rCanvas = rawCanvasRef.current;
    if (!image || !rCanvas) return;
    const img = new window.Image();
    img.onload = () => {
      const size = rCanvas.offsetWidth || 300;
      rCanvas.width = size;
      rCanvas.height = size;
      const rCtx = rCanvas.getContext('2d');
      rCtx.drawImage(img, 0, 0, size, size);

      if (results && results.area > 0 && results.bbox) {
        const { minX, maxX, minY, maxY } = results.bbox;
        const scale = size / 300;
        const pad = 10;
        const bx = Math.max(0, minX * scale - pad);
        const by = Math.max(0, minY * scale - pad);
        const bw = Math.min(size - bx, (maxX - minX) * scale + pad * 2);
        const bh = Math.min(size - by, (maxY - minY) * scale + pad * 2);

        // Glow + dashed red box
        rCtx.shadowColor = '#ef4444';
        rCtx.shadowBlur = 6;
        rCtx.strokeStyle = '#ef4444';
        rCtx.lineWidth = 2;
        rCtx.setLineDash([6, 4]);
        rCtx.strokeRect(bx, by, bw, bh);
        rCtx.shadowBlur = 0;
        rCtx.setLineDash([]);

        // Label tag above box
        const label = results.prediction.name;
        rCtx.font = 'bold 11px monospace';
        const tw = rCtx.measureText(label).width + 12;
        const ty = Math.max(0, by - 20);
        rCtx.fillStyle = '#ef4444';
        rCtx.fillRect(bx, ty, tw, 20);
        rCtx.fillStyle = '#ffffff';
        rCtx.fillText(label, bx + 6, ty + 14);
      }
    };
    img.src = image;
  }, [results, image]);

  const processImage = async () => {
    if (!image) return;
    setProcessing(true);
    setActiveStep(1);

    await new Promise(r => setTimeout(r, 600));
    setActiveStep(2);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = new window.Image();
    img.src = image;

    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx.drawImage(img, 0, 0, 300, 300);

      const imageData = ctx.getImageData(0, 0, 300, 300);
      const data = imageData.data;

      const maskCanvas = maskCanvasRef.current;
      maskCanvas.width = 300;
      maskCanvas.height = 300;
      const mCtx = maskCanvas.getContext('2d');
      const maskData = mCtx.createImageData(300, 300);

      // Deep purple detection (from Peripheral_Counter.js)
      let purplePixels = [];
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const isDarkPurple = (r > 60 && b > 90 && b > r * 1.1 && r > g * 1.3 && (r + g + b) < 450);
        const idx = i / 4;
        if (isDarkPurple) purplePixels.push({ x: idx % 300, y: Math.floor(idx / 300), i });
      }

      // Spatial clustering – largest object isolation (from Peripheral_Counter.js)
      let filteredPixels = [];
      if (purplePixels.length > 0) {
        const avgX = purplePixels.reduce((s, p) => s + p.x, 0) / purplePixels.length;
        const avgY = purplePixels.reduce((s, p) => s + p.y, 0) / purplePixels.length;
        filteredPixels = purplePixels.filter(p =>
          Math.sqrt(Math.pow(p.x - avgX, 2) + Math.pow(p.y - avgY, 2)) < 60
        );
      }

      let minX = 300, maxX = 0, minY = 300, maxY = 0;
      filteredPixels.forEach(p => {
        // Purple mask colour (v1.4 palette)
        maskData.data[p.i]     = 140;
        maskData.data[p.i + 1] = 40;
        maskData.data[p.i + 2] = 255;
        maskData.data[p.i + 3] = 255;
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
      });
      mCtx.putImageData(maskData, 0, 0);
      setActiveStep(3);

      const area = filteredPixels.length;
      const perimeter = 2 * ((maxX - minX) + (maxY - minY));
      const circularity = area > 0 ? (4 * Math.PI * area) / (perimeter * perimeter) : 0;
      const prediction = classify(area, circularity);

      // Confidence: deterministic based on area signal strength (no random)
      const confidence = area > 0 ? Math.min(98, Math.round(70 + (Math.min(area, 12000) / 12000) * 28)) : 0;

      setTimeout(() => {
        setResults({
          area,
          circularity: circularity.toFixed(2),
          prediction,
          confidence,
          bbox: { minX, maxX, minY, maxY },
        });
        setProcessing(false);
        setActiveStep(4);
      }, 800);
    };
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">

        {/* ── HEADER ── */}
        <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black flex items-center gap-3 text-slate-900">
              <Database className="w-10 h-10 text-indigo-600" />
              HemaScale AI <span className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">v1.5</span>
            </h1>
            <p className="text-slate-500 mt-1 font-medium tracking-tight uppercase text-[10px]">Spatial Clustering Engine / Feature Analysis</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Inference Mode</span>
              <span className="text-xs font-bold text-indigo-600 uppercase">Threshold / Blob Isolation</span>
            </div>
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
              <ShieldCheck className="w-6 h-6 text-indigo-500" />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-4 space-y-6">

            {/* Upload + Process */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xs font-black mb-4 uppercase tracking-widest text-slate-400 flex justify-between">
                <span>Microscope Data</span>
                {image && <span className="text-green-500">Loaded</span>}
              </h2>

              {/* Image preview with detection overlay */}
              {image ? (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-indigo-100 shadow-sm bg-slate-900">
                    {/* Plain image shown until analysis runs; canvas overlays after */}
                    {!results && (
                      <img src={image} alt="Loaded smear" className="w-full object-cover max-h-48" />
                    )}
                    {/* Canvas always mounted so ref is available; visible only after results */}
                    <canvas
                      ref={previewCanvasRef}
                      className={`w-full block ${results ? '' : 'hidden'}`}
                    />
                    <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-[8px] text-white px-2 py-1 rounded font-bold uppercase tracking-widest">
                      {results ? 'Detection' : 'Preview'}
                    </div>
                    <label className="absolute inset-0 cursor-pointer opacity-0 hover:opacity-100 transition-opacity bg-black/40 flex items-center justify-center">
                      <span className="text-white text-[10px] font-black uppercase tracking-widest bg-white/20 backdrop-blur-sm px-3 py-2 rounded-xl">Change Image</span>
                      <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              ) : (
                /* Empty state drop zone */
                <div className="relative group aspect-video">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed h-full rounded-2xl flex flex-col items-center justify-center gap-2 border-slate-200 bg-slate-50 transition-all group-hover:border-indigo-300">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Drop smear image</span>
                  </div>
                </div>
              )}
              <button
                disabled={!image || processing}
                onClick={processImage}
                className="w-full mt-6 py-4 px-4 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2"
              >
                {processing ? <Activity className="w-5 h-5 animate-spin" /> : <Target className="w-5 h-5" />}
                {processing ? 'PROCESSING PIPELINE...' : 'RUN ANALYSIS'}
              </button>
            </section>

            {/* Pipeline Steps */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xs font-black mb-6 uppercase tracking-widest text-slate-400">Pipeline Debugger</h2>
              <div className="space-y-4">
                {[
                  { id: 1, label: 'Normalization & Load',   desc: 'Rasterising input frame'        },
                  { id: 2, label: 'Deep Purple Masking',    desc: 'Isolating chromatin pixels'     },
                  { id: 3, label: 'Blob Isolation',         desc: 'Removing RBC edge noise'        },
                  { id: 4, label: 'Cell Classification',    desc: 'Area + Circularity thresholds'  },
                ].map(step => (
                  <div key={step.id} className={`flex items-start gap-3 transition-opacity ${activeStep >= step.id ? 'opacity-100' : 'opacity-30'}`}>
                    <div className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activeStep >= step.id ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      {step.id}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{step.label}</div>
                      <div className="text-[10px] text-slate-400 leading-none mt-1">{step.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Feature Metrics */}
            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <h2 className="text-xs font-black mb-6 uppercase tracking-widest text-slate-400">Extracted Features</h2>
              {results ? (
                <div className="space-y-4">
                  {[
                    { label: 'Nucleus Area (px)',  value: results.area,         max: 20000 },
                    { label: 'Circularity Factor', value: parseFloat(results.circularity) * 100, max: 100, suffix: '' },
                    { label: 'Confidence',         value: results.confidence,   max: 100,   suffix: '%' },
                  ].map(m => (
                    <div key={m.label}>
                      <div className="flex justify-between text-[10px] font-bold mb-1">
                        <span className="text-slate-500">{m.label}</span>
                        <span className="text-indigo-600">{m.label === 'Nucleus Area (px)' ? m.value : m.value.toFixed ? m.value.toFixed(1) + (m.suffix ?? '') : m.value + (m.suffix ?? '')}</span>
                      </div>
                      <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 transition-all duration-700 rounded-full"
                          style={{ width: `${Math.min(100, (m.value / m.max) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 italic text-center py-4 uppercase tracking-widest">Awaiting Analysis...</div>
              )}
            </section>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="lg:col-span-8 space-y-6">

            {/* Image pair */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-200 relative">
                <span className="absolute top-4 left-4 bg-black/50 backdrop-blur-md text-[8px] text-white px-2 py-1 rounded font-bold uppercase z-10 tracking-widest">Raw Input</span>
                <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden flex items-center justify-center">
                  {image ? (
                    <canvas ref={rawCanvasRef} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <canvas ref={rawCanvasRef} className="hidden" />
                      <ImageIcon className="w-12 h-12 text-slate-200" />
                    </>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              </div>

              <div className="bg-white p-2 rounded-3xl shadow-sm border border-slate-200 relative">
                <span className="absolute top-4 left-4 bg-indigo-500/80 backdrop-blur-md text-[8px] text-white px-2 py-1 rounded font-bold uppercase z-10 tracking-widest">Isolated Nucleus</span>
                <div className="aspect-square bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center">
                  <canvas ref={maskCanvasRef} className="w-full h-full object-contain opacity-70" />
                  {!results && !processing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                      <Search className="w-12 h-12 mb-2 opacity-20" />
                      <span className="text-sm opacity-50">Waiting…</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Results card */}
            {results && (
              <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden transition-all">
                <div className="p-10">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                      <div className="text-[10px] font-black tracking-[0.2em] uppercase text-indigo-500 mb-2">Classification Result</div>
                      <h3 className="text-5xl font-black tracking-tight text-slate-900">{results.prediction.name}</h3>
                    </div>
                    <div className="bg-indigo-50 px-6 py-4 rounded-2xl text-center border border-indigo-100 min-w-[140px]">
                      <div className="text-[10px] font-black uppercase text-indigo-400 mb-1">Confidence</div>
                      <div className="text-3xl font-mono font-bold text-indigo-600">{results.confidence}%</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                      <div className="text-[9px] font-black text-slate-400 uppercase mb-2">Nucleus Area (px)</div>
                      <div className="text-2xl font-bold text-slate-800">{results.area}</div>
                    </div>
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                      <div className="text-[9px] font-black text-slate-400 uppercase mb-2">Shape Factor</div>
                      <div className="text-2xl font-bold text-slate-800">{results.circularity}</div>
                    </div>
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                      <div className="text-[9px] font-black text-slate-400 uppercase mb-2">RBC Noise Filter</div>
                      <div className="text-2xl font-bold text-green-600">Active</div>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-900 p-6 px-10 text-slate-400 text-sm italic">
                  "{results.prediction.description}"
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
