import { useState, useEffect, useCallback, useRef } from 'react';
import { getCaseSlices } from '../services/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const ZOOM_STEPS  = [1, 1.5, 2, 3, 4];
const LOUPE_R     = 90;   // loupe radius px
const LOUPE_ZOOM  = 3.5;  // magnification inside loupe

// ─────────────────────────────────────────────────────────────────────────────
// BI-RADS colors (for clock diagram)
// ─────────────────────────────────────────────────────────────────────────────
const BIRADS_COLOR = { 2: '#22c55e', 3: '#eab308', 4: '#f97316', 5: '#ef4444', 6: '#7f1d1d' };
function biColor(b) { return BIRADS_COLOR[b] || '#6b7280'; }

function parseBbox(bboxJson) {
  try { return bboxJson ? JSON.parse(bboxJson) : null; } catch { return null; }
}

function clockToXY(clock, depth, cx, cy, maxR) {
  const frac  = { anterior: 0.28, middle: 0.56, posterior: 0.82 };
  const r     = (frac[depth] || 0.56) * maxR;
  const angle = (clock / 12) * 2 * Math.PI - Math.PI / 2;
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Breast clock diagram
// ─────────────────────────────────────────────────────────────────────────────
function BreastDiagram({ sideLabel, sideKey, findings, hoveredId, onHoverIn, onHoverOut }) {
  const SIZE = 92; const cx = SIZE / 2; const cy = SIZE / 2; const outerR = 38;
  const mine = findings.filter(f => f.clock_position && (f.breast_side === sideKey || f.breast_side === 'bilateral'));
  return (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-[9px] text-gray-500 font-bold tracking-widest uppercase">{sideLabel}</p>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} overflow="visible">
        <circle cx={cx} cy={cy} r={outerR} fill="#111827" stroke="#374151" strokeWidth="1" />
        {[0.28, 0.56, 0.82].map(f => (
          <circle key={f} cx={cx} cy={cy} r={outerR * f} fill="none" stroke="#1f2937" strokeWidth="0.6" strokeDasharray="2 3" />
        ))}
        {[0,3,6,9].map(h => {
          const a = (h/12)*2*Math.PI - Math.PI/2;
          return <line key={h} x1={cx} y1={cy} x2={cx+outerR*Math.cos(a)} y2={cy+outerR*Math.sin(a)} stroke="#1f2937" strokeWidth="0.6" />;
        })}
        {Array.from({length:12},(_,i)=>{
          const h=i+1; const a=(h/12)*2*Math.PI-Math.PI/2;
          const r1=outerR*(h%3===0?0.84:0.9); const r2=outerR*0.99;
          return <line key={h} x1={cx+r1*Math.cos(a)} y1={cy+r1*Math.sin(a)} x2={cx+r2*Math.cos(a)} y2={cy+r2*Math.sin(a)} stroke="#4b5563" strokeWidth={h%3===0?1.4:0.8} />;
        })}
        {[[12,cx,cy-outerR-7],[3,cx+outerR+7,cy],[6,cx,cy+outerR+7],[9,cx-outerR-7,cy]].map(([h,tx,ty])=>(
          <text key={h} x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fill="#4b5563" fontSize="7" fontFamily="monospace">{h}</text>
        ))}
        <circle cx={cx} cy={cy} r={2.8} fill="#6b7280" />
        {mine.map((f,idx)=>{
          const {x,y}=clockToXY(f.clock_position,f.depth,cx,cy,outerR);
          const color=biColor(f.bi_rads_suggestion); const isHov=f.id===hoveredId;
          return (
            <g key={f.id} style={{cursor:'pointer'}} onMouseEnter={()=>onHoverIn(f)} onMouseLeave={onHoverOut}>
              {isHov && <circle cx={x} cy={y} r={11} fill={color} opacity={0.2}/>}
              <circle cx={x} cy={y} r={isHov?7.5:5.5} fill={color} opacity={0.92} stroke="white" strokeWidth={isHov?1.5:0.8}/>
              <text x={x} y={y+0.5} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={isHov?7.5:6} fontWeight="bold">{idx+1}</text>
            </g>
          );
        })}
        {mine.length===0 && <text x={cx} y={cy+14} textAnchor="middle" fill="#374151" fontSize="7">—</text>}
      </svg>
    </div>
  );
}

function FindingTooltip({ finding }) {
  if (!finding) return null;
  const side = {L:'Left',R:'Right',bilateral:'Bilateral'}[finding.breast_side]||finding.breast_side;
  return (
    <div className="bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 shadow-2xl min-w-[170px] text-[10px]">
      <p className="font-bold text-white capitalize mb-1">{(finding.finding_type||'Finding').replace(/_/g,' ')}<span className="font-normal text-gray-400"> — {side}</span></p>
      <p className="text-gray-400">{finding.clock_position} o'clock{finding.quadrant?` · ${finding.quadrant}`:''}</p>
      {finding.depth && <p className="text-gray-400 capitalize">{finding.depth} depth</p>}
      {finding.distance_from_nipple_mm && <p className="text-gray-400">{finding.distance_from_nipple_mm} mm from nipple</p>}
      {finding.size_length_mm && <p className="text-gray-300 mt-0.5">Size: {finding.size_length_mm}{finding.size_width_mm?` × ${finding.size_width_mm}`:''} mm</p>}
      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-gray-700">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:biColor(finding.bi_rads_suggestion)}}/>
        <span className="font-semibold" style={{color:biColor(finding.bi_rads_suggestion)}}>BI-RADS {finding.bi_rads_suggestion}</span>
        {finding.malignancy_probability!=null && <span className="text-gray-500 ml-auto">{(finding.malignancy_probability*100).toFixed(0)}% risk</span>}
      </div>
    </div>
  );
}

function BreastLocalizationPanel({ findings }) {
  const [hovered, setHovered] = useState(null);
  const withClock = (findings||[]).filter(f=>f.clock_position);
  if (withClock.length===0) return null;
  const hasL = withClock.some(f=>f.breast_side==='L'||f.breast_side==='bilateral');
  const hasR = withClock.some(f=>f.breast_side==='R'||f.breast_side==='bilateral');
  return (
    <div className="absolute bottom-3 left-3 z-20 select-none">
      {hovered && <div className="mb-2"><FindingTooltip finding={hovered}/></div>}
      <div className="bg-black/85 border border-gray-700/80 rounded-2xl px-3 pt-2 pb-2.5 backdrop-blur-sm shadow-2xl">
        <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold text-center mb-1">Finding Locations</p>
        <div className="flex gap-4">
          {hasL && <BreastDiagram sideLabel="LEFT"  sideKey="L" findings={withClock} hoveredId={hovered?.id} onHoverIn={setHovered} onHoverOut={()=>setHovered(null)}/>}
          {hasR && <BreastDiagram sideLabel="RIGHT" sideKey="R" findings={withClock} hoveredId={hovered?.id} onHoverIn={setHovered} onHoverOut={()=>setHovered(null)}/>}
          {!hasL&&!hasR && <BreastDiagram sideLabel="BILATERAL" sideKey="bilateral" findings={withClock} hoveredId={hovered?.id} onHoverIn={setHovered} onHoverOut={()=>setHovered(null)}/>}
        </div>
        <div className="flex gap-2 justify-center mt-2 flex-wrap">
          {[2,3,4,5,6].map(b=>withClock.some(f=>f.bi_rads_suggestion===b)&&(
            <div key={b} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{background:biColor(b)}}/>
              <span className="text-[8px] text-gray-500">{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Image toolbar
// ─────────────────────────────────────────────────────────────────────────────
function Toolbar({ zoom, onZoomIn, onZoomOut, brightness, onBrightness, contrast, onContrast, invert, onInvert, loupeOn, onLoupe, bboxOn, onBbox, onReset }) {
  const zoomIdx = ZOOM_STEPS.indexOf(zoom);
  const canZoomIn  = zoomIdx < ZOOM_STEPS.length - 1;
  const canZoomOut = zoomIdx > 0;

  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-1 px-3 py-1.5 bg-black/70 backdrop-blur-sm border-b border-gray-800/60 flex-wrap">

      {/* Zoom */}
      <div className="flex items-center gap-1 pr-2 border-r border-gray-700">
        <span className="text-[9px] text-gray-500 uppercase tracking-widest mr-1">Zoom</span>
        <button onClick={onZoomOut} disabled={!canZoomOut}
          className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:bg-gray-700 disabled:opacity-30 text-sm font-bold transition">−</button>
        <span className="text-[11px] text-blue-400 font-mono font-bold w-8 text-center">{zoom}×</span>
        <button onClick={onZoomIn} disabled={!canZoomIn}
          className="w-5 h-5 flex items-center justify-center rounded text-gray-300 hover:bg-gray-700 disabled:opacity-30 text-sm font-bold transition">+</button>
      </div>

      {/* Brightness */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-gray-700">
        <span className="text-[9px] text-gray-500 uppercase tracking-widest">Bright</span>
        <input type="range" min={50} max={200} value={brightness} onChange={e=>onBrightness(Number(e.target.value))}
          className="w-20 h-1 accent-yellow-400 cursor-pointer"
          title={`Brightness: ${brightness}%`}
        />
        <span className="text-[9px] text-yellow-400 font-mono w-7">{brightness}%</span>
      </div>

      {/* Contrast */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-gray-700">
        <span className="text-[9px] text-gray-500 uppercase tracking-widest">Contrast</span>
        <input type="range" min={50} max={200} value={contrast} onChange={e=>onContrast(Number(e.target.value))}
          className="w-20 h-1 accent-cyan-400 cursor-pointer"
          title={`Contrast: ${contrast}%`}
        />
        <span className="text-[9px] text-cyan-400 font-mono w-7">{contrast}%</span>
      </div>

      {/* Invert / Negative */}
      <button onClick={onInvert}
        title="Invert (negative image) — helps visualise dense calcifications"
        className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase transition ${
          invert ? 'bg-purple-600 text-white' : 'text-gray-400 border border-gray-700 hover:border-gray-500'
        }`}>
        NEG
      </button>

      {/* Loupe */}
      <button onClick={onLoupe}
        title="Magnifier loupe (3.5×) — move cursor over image to inspect microcalcifications"
        className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase transition ${
          loupeOn ? 'bg-blue-600 text-white' : 'text-gray-400 border border-gray-700 hover:border-gray-500'
        }`}>
        🔬 LOUPE
      </button>

      {/* BBox overlay toggle */}
      <button onClick={onBbox}
        title="Toggle AI finding localization overlay"
        className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase transition ${
          bboxOn ? 'bg-green-700 text-white' : 'text-gray-400 border border-gray-700 hover:border-gray-500'
        }`}>
        ⬜ BBOX
      </button>

      {/* Reset */}
      <button onClick={onReset} title="Reset all image adjustments"
        className="ml-auto px-2 py-0.5 rounded text-[9px] text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-white uppercase tracking-wider transition">
        ↺ Reset
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Advanced image viewer (handles zoom, pan, filters, loupe)
// ─────────────────────────────────────────────────────────────────────────────
function AdvancedImageView({ src, alt, findings, onError }) {
  const [zoom,       setZoom]       = useState(1);
  const [panX,       setPanX]       = useState(0);
  const [panY,       setPanY]       = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast,   setContrast]   = useState(100);
  const [invert,     setInvert]     = useState(false);
  const [loupeOn,    setLoupeOn]    = useState(false);
  const [loupePx,    setLoupePx]    = useState({ x: 0, y: 0 });   // cursor in container
  const [loupeImgP,  setLoupeImgP]  = useState({ x: 0, y: 0 });   // cursor rel to image
  const [loupeImgSz, setLoupeImgSz] = useState({ w: 0, h: 0 });   // displayed image dims
  const [dragging,   setDragging]   = useState(false);
  const [showBbox,   setShowBbox]   = useState(true);
  const [imgRect,    setImgRect]    = useState({ left: 0, top: 0, width: 0, height: 0 });
  const dragStart = useRef(null);

  const containerRef = useRef(null);
  const imgRef       = useRef(null);

  // Zoom in / out
  const zoomIn  = () => { const i = ZOOM_STEPS.indexOf(zoom); if (i < ZOOM_STEPS.length-1) { setZoom(ZOOM_STEPS[i+1]); } };
  const zoomOut = () => { const i = ZOOM_STEPS.indexOf(zoom); if (i > 0) setZoom(ZOOM_STEPS[i-1]); };

  // Reset pan when zoom returns to 1
  useEffect(() => { if (zoom === 1) { setPanX(0); setPanY(0); } }, [zoom]);

  // Track rendered image bounds for bbox overlay
  const measureImg = useCallback(() => {
    if (imgRef.current && containerRef.current) {
      const iR = imgRef.current.getBoundingClientRect();
      const cR = containerRef.current.getBoundingClientRect();
      setImgRect({ left: iR.left - cR.left, top: iR.top - cR.top, width: iR.width, height: iR.height });
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(measureImg);
    ro.observe(container);
    return () => ro.disconnect();
  }, [measureImg]);

  // Scroll-wheel zoom
  const handleWheel = useCallback((e) => {
    // Only zoom if Ctrl is held — otherwise let parent handle (tomo scroll)
    if (!e.ctrlKey) return;
    e.preventDefault();
    e.deltaY < 0 ? zoomIn() : zoomOut();
  }, [zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pan — mouse drag
  const handleMouseDown = (e) => {
    if (loupeOn || zoom <= 1) return;
    e.preventDefault();
    dragStart.current = { startX: e.clientX, startY: e.clientY, panX, panY };
    setDragging(true);
  };
  const handleMouseMove = (e) => {
    if (loupeOn) {
      // Update loupe position
      const cRect = containerRef.current?.getBoundingClientRect();
      const iRect = imgRef.current?.getBoundingClientRect();
      if (cRect && iRect) {
        setLoupePx({ x: e.clientX - cRect.left, y: e.clientY - cRect.top });
        setLoupeImgP({ x: e.clientX - iRect.left, y: e.clientY - iRect.top });
        setLoupeImgSz({ w: iRect.width, h: iRect.height });
      }
      return;
    }
    if (!dragging || !dragStart.current) return;
    const dx = (e.clientX - dragStart.current.startX) / zoom;
    const dy = (e.clientY - dragStart.current.startY) / zoom;
    setPanX(dragStart.current.panX + dx);
    setPanY(dragStart.current.panY + dy);
  };
  const endDrag = () => { setDragging(false); dragStart.current = null; };

  const handleReset = () => {
    setZoom(1); setPanX(0); setPanY(0);
    setBrightness(100); setContrast(100);
    setInvert(false); setLoupeOn(false);
  };

  const cssFilter = `brightness(${brightness}%) contrast(${contrast}%)${invert ? ' invert(100%)' : ''}`;

  // Loupe: visible only when cursor is over the image
  const loupeVisible = loupeOn && loupeImgSz.w > 0
    && loupePx.x > 0 && loupePx.y > 0;

  const loupeStyle = loupeVisible ? {
    width:  LOUPE_R * 2,
    height: LOUPE_R * 2,
    left:   loupePx.x - LOUPE_R,
    top:    loupePx.y - LOUPE_R,
    backgroundImage:    `url(${src})`,
    backgroundSize:     `${loupeImgSz.w * LOUPE_ZOOM}px ${loupeImgSz.h * LOUPE_ZOOM}px`,
    backgroundPosition: `-${loupeImgP.x * LOUPE_ZOOM - LOUPE_R}px -${loupeImgP.y * LOUPE_ZOOM - LOUPE_R}px`,
    backgroundRepeat:   'no-repeat',
    filter: cssFilter,
  } : null;

  const cursor = loupeOn ? 'crosshair' : zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default';

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* Toolbar */}
      <div className="relative">
        <Toolbar
          zoom={zoom} onZoomIn={zoomIn} onZoomOut={zoomOut}
          brightness={brightness} onBrightness={setBrightness}
          contrast={contrast}     onContrast={setContrast}
          invert={invert}         onInvert={()=>setInvert(v=>!v)}
          loupeOn={loupeOn}       onLoupe={()=>setLoupeOn(v=>!v)}
          bboxOn={showBbox}       onBbox={()=>setShowBbox(v=>!v)}
          onReset={handleReset}
        />
      </div>

      {/* Image container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden relative"
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={() => { endDrag(); setLoupeImgSz({w:0,h:0}); }}
        onWheel={handleWheel}
      >
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          onError={onError}
          onLoad={measureImg}
          className="max-h-full max-w-full object-contain select-none"
          style={{
            transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 0.15s ease',
            filter: cssFilter,
            userSelect: 'none',
          }}
        />

        {/* AI Bounding Box Overlay */}
        {showBbox && imgRect.width > 0 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              zIndex: 15,
              transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
              transformOrigin: 'center center',
            }}
          >
            {(findings || []).map((finding, idx) => {
              const bbox = parseBbox(finding.bbox_json);
              if (!bbox || !bbox.w || !bbox.h) return null;
              // Remap from cropped-image coords (GPT-4o only saw breast tissue)
              // back to full-image coords (which include the FUJIFILM panel on the left)
              const PANEL = 0.38;
              const rx = imgRect.left + (PANEL + bbox.x * (1 - PANEL)) * imgRect.width;
              const ry = imgRect.top + bbox.y * imgRect.height;
              const rw = bbox.w * (1 - PANEL) * imgRect.width;
              const rh = bbox.h * imgRect.height;
              const color = biColor(finding.bi_rads_suggestion);
              const label = `${idx + 1} · ${(finding.finding_type || 'finding').replace(/_/g, ' ')} · BI-RADS ${finding.bi_rads_suggestion}`;
              const labelW = label.length * 6.2 + 10;
              return (
                <g key={finding.id}>
                  <rect
                    x={rx} y={ry} width={rw} height={rh}
                    fill={color} fillOpacity={0.08}
                    stroke={color} strokeWidth={2} strokeDasharray="6 3"
                    rx={3}
                  />
                  <rect x={rx} y={ry - 20} width={labelW} height={18} fill={color} fillOpacity={0.9} rx={3} />
                  <text x={rx + 5} y={ry - 7} fill="white" fontSize="10" fontWeight="bold" fontFamily="monospace">{label}</text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Loupe overlay */}
        {loupeVisible && (
          <div
            className="absolute rounded-full border-2 border-blue-400 pointer-events-none z-30 shadow-2xl"
            style={loupeStyle}
          >
            {/* Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-px h-6 bg-blue-400/60 absolute"/>
              <div className="h-px w-6 bg-blue-400/60 absolute"/>
            </div>
          </div>
        )}

        {/* Breast localization diagram */}
        <BreastLocalizationPanel findings={findings} />

        {/* Loupe hint */}
        {loupeOn && !loupeVisible && (
          <div className="absolute bottom-3 right-3 text-[10px] text-blue-400/70 pointer-events-none">
            Move cursor over image
          </div>
        )}

        {/* Zoom indicator (when zoomed) */}
        {zoom > 1 && (
          <div className="absolute top-10 right-3 text-[10px] text-blue-400/80 bg-black/50 px-2 py-0.5 rounded pointer-events-none">
            {zoom}× — drag to pan · Ctrl+scroll to zoom
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function NoImage({ caseData }) {
  return (
    <div className="text-gray-600 text-center">
      <p className="text-5xl mb-3">🩻</p>
      <p className="text-sm">Image not available</p>
      <p className="text-xs text-gray-500 mt-1">{caseData.dicom_file_path || ''}</p>
    </div>
  );
}

const DENSITY_LABEL = { A:'Almost Entirely Fatty', B:'Scattered Fibroglandular', C:'Heterogeneously Dense', D:'Extremely Dense' };

function ImageBadges({ caseData }) {
  return (
    <>
      {caseData.quality_score != null && (
        <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-200 text-xs">Quality: {Math.round(caseData.quality_score)}%</span>
      )}
      {caseData.density_category && (
        <span className="bg-gray-800 px-2 py-0.5 rounded text-gray-200 text-xs">Density {caseData.density_category} — {DENSITY_LABEL[caseData.density_category]||''}</span>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────
export default function SliceViewer({ caseId, caseData, seriesType, findings = [] }) {
  const [slices,  setSlices]  = useState([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (seriesType !== 'tomosynthesis') { setLoading(false); return; }
    getCaseSlices(caseId)
      .then(r => { setSlices(r.data.slices||[]); setCurrent(Math.floor((r.data.slices||[]).length/2)); })
      .catch(() => setError('Could not load slices'))
      .finally(() => setLoading(false));
  }, [caseId, seriesType]);

  const go = useCallback((delta) => {
    setCurrent(i => Math.max(0, Math.min(slices.length-1, i+delta)));
  }, [slices.length]);

  // Keyboard nav (tomo)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = (e) => {
      if (e.key==='ArrowUp'||e.key==='ArrowLeft')  { e.preventDefault(); go(-1); }
      if (e.key==='ArrowDown'||e.key==='ArrowRight'){ e.preventDefault(); go(+1); }
    };
    el.addEventListener('keydown', h);
    return () => el.removeEventListener('keydown', h);
  }, [go]);

  // Scroll (tomo, no Ctrl key)
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey) return; // Ctrl+scroll = zoom (handled in AdvancedImageView)
    e.preventDefault();
    go(e.deltaY > 0 ? 1 : -1);
  }, [go]);

  // ── 2D / Transpara ──────────────────────────────────────────────────────────
  if (seriesType !== 'tomosynthesis') {
    return (
      <div className="flex-1 bg-black flex flex-col min-w-0">
        {caseData.preprocessed_image_path ? (
          <AdvancedImageView
            src={`http://localhost:8000/${caseData.preprocessed_image_path}`}
            alt="Mammogram"
            findings={findings}
            onError={e => { e.target.style.display='none'; }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <NoImage caseData={caseData}/>
          </div>
        )}
        <div className="bg-black px-4 pb-2 flex gap-2 flex-wrap">
          <ImageBadges caseData={caseData}/>
        </div>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex-1 bg-black flex items-center justify-center text-gray-400 text-sm">
      <span className="animate-spin w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full inline-block mr-2"/>
      Loading slices…
    </div>
  );

  // ── Tomo error fallback ─────────────────────────────────────────────────────
  if (error || slices.length === 0) {
    return (
      <div className="flex-1 bg-black flex flex-col min-w-0">
        {caseData.preprocessed_image_path ? (
          <AdvancedImageView
            src={`http://localhost:8000/${caseData.preprocessed_image_path}`}
            alt="Mammogram"
            findings={findings}
            onError={e => { e.target.style.display='none'; }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center"><NoImage caseData={caseData}/></div>
        )}
        <div className="bg-black px-4 pb-2 flex gap-2 flex-wrap"><ImageBadges caseData={caseData}/></div>
      </div>
    );
  }

  // ── Tomosynthesis ───────────────────────────────────────────────────────────
  const pct = Math.round(((current+1)/slices.length)*100);

  return (
    <div ref={containerRef} tabIndex={0} className="flex-1 bg-black flex flex-col outline-none min-w-0" onWheel={handleWheel}>
      {/* Advanced image viewer for current slice */}
      <AdvancedImageView
        src={`http://localhost:8000${slices[current]}`}
        alt={`Slice ${current+1}`}
        findings={findings}
        onError={() => {}}
      />

      {/* Slice navigator */}
      <div className="bg-gray-900 px-4 pt-2 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={()=>go(-1)} disabled={current===0}
            className="text-gray-300 hover:text-white disabled:opacity-30 text-lg leading-none select-none">‹</button>
          <div className="flex-1">
            <input type="range" min={0} max={slices.length-1} value={current}
              onChange={e=>setCurrent(Number(e.target.value))}
              className="w-full h-1.5 appearance-none rounded-full cursor-pointer"
              style={{background:`linear-gradient(to right,#8b5cf6 ${pct}%,#374151 ${pct}%)`}}
            />
          </div>
          <button onClick={()=>go(+1)} disabled={current===slices.length-1}
            className="text-gray-300 hover:text-white disabled:opacity-30 text-lg leading-none select-none">›</button>
        </div>
        <div className="flex items-center justify-between mt-1.5 text-xs text-gray-400">
          <span className="text-violet-400 font-semibold">Tomo 3D</span>
          <span>Slice {current+1} / {slices.length}</span>
          <span className="text-gray-500">Scroll · arrows · Ctrl+scroll = zoom</span>
        </div>
      </div>

      <div className="bg-black px-4 pb-2 flex gap-2 flex-wrap">
        <ImageBadges caseData={caseData}/>
      </div>
    </div>
  );
}
