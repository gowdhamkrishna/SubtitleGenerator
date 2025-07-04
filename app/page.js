"use client"
import { useRef, useState, useEffect } from "react";

const initialSubtitles = [
  { id: 1, start: 0, end: 2, text: "Hello, welcome to the video.", x: 0.5, y: 0.8, width: 0.8, height: 0.18 },
  { id: 2, start: 2, end: 5, text: "This is a sample subtitle segment.", x: 0.5, y: 0.8, width: 0.8, height: 0.18 },
  { id: 3, start: 5, end: 8, text: "You can edit this text.", x: 0.5, y: 0.8, width: 0.8, height: 0.18 },
];

const FONT_FAMILIES = [
  { label: "Sans", value: "sans-serif" },
  { label: "Serif", value: "serif" },
  { label: "Mono", value: "monospace" },
  { label: "Comic", value: "Comic Sans MS, Comic Sans, cursive" },
  { label: "Impact", value: "Impact, Charcoal, sans-serif" },
];
const FONT_SIZES = [24, 32, 40, 48, 56, 64, 80, 96, 120, 144, 180, 240];
const RATIOS = [
  { label: "16:9", value: 16 / 9 },
  { label: "9:16", value: 9 / 16 },
  { label: "1:1", value: 1 },
];

function findSubtitleAtTime(subtitles, time) {
  return subtitles.find(seg => time >= seg.start && time < seg.end);
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(2).padStart(5, '0');
  return `${m}:${sec}`;
}

export default function Home() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [subtitles, setSubtitles] = useState(initialSubtitles);
  const [currentTime, setCurrentTime] = useState(0);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].value);
  const [fontSize, setFontSize] = useState(FONT_SIZES[1]);
  const [textColor, setTextColor] = useState("#111827");
  const [bgColor, setBgColor] = useState("#00000080");
  const [bgAlpha, setBgAlpha] = useState(0.5);
  const [ratio, setRatio] = useState(RATIOS[0].value);
  const [isBold, setIsBold] = useState(true);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isShadow, setIsShadow] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const fileInputRef = useRef();
  const videoRef = useRef();
  const overlayRef = useRef();
  const [selectedSubtitleId, setSelectedSubtitleId] = useState(null);
  const [videoWidthState, setVideoWidthState] = useState(1280);
  const [videoHeightState, setVideoHeightState] = useState(720);
  const [playUntil, setPlayUntil] = useState(null);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTextColor('#ffffff');
    } else {
      setTextColor('#111827');
    }
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!videoFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("video", videoFile);
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setUploadResult(data);
    setUploading(false);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const currentSubtitle = findSubtitleAtTime(subtitles, currentTime);

  const handleSubtitleChange = (field, value) => {
    if (!currentSubtitle) return;
    setSubtitles(subtitles.map(seg =>
      seg.id === currentSubtitle.id ? { ...seg, [field]: value } : seg
    ));
  };

  const handleAddSubtitle = (time = currentTime) => {
    const newSeg = {
      id: Date.now(),
      start: Math.floor(time * 100) / 100,
      end: Math.floor((time + 2) * 100) / 100,
      text: "New subtitle at this time",
      x: 0.5, y: 0.8, width: 0.8, height: 0.18,
    };
    setSubtitles([...subtitles, newSeg]);
  };

  const handleDownload = async () => {
    if (!videoFile) {
      alert("Please upload a video file first. Subtitle overlay is not implemented yet; download will return the original video.");
      return;
    }
    setDownloading(true);
    setDownloadProgress(0);
    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      // Send all subtitle style info
      const styledSubtitles = subtitles.map(seg => ({
        ...seg,
        textColor,
        fontFamily,
        fontSize
      }));
      formData.append("subtitles", JSON.stringify(styledSubtitles));
      formData.append("videoWidth", videoWidthState);
      formData.append("videoHeight", videoHeightState);
      const res = await fetch("/api/render", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to render video");
      const contentLength = res.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = res.body.getReader();
      let received = 0;
      let chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) setDownloadProgress(Math.round((received / total) * 100));
      }
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "video_with_text.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setDownloadProgress(100);
    } catch (err) {
      alert("Failed to download video: " + err.message);
      setDownloadProgress(0);
    }
    setDownloading(false);
  };

  // Calculate video dimensions based on actual video resolution (scaled to fit baseWidth)
  const baseWidth = 600;
  const scale = baseWidth / videoWidthState;
  const previewWidth = baseWidth;
  const previewHeight = Math.round(videoHeightState * scale);

  // Compose background color with alpha
  const bgCss = bgColor.slice(0, 7) + Math.round(bgAlpha * 255).toString(16).padStart(2, '0');

  // Drag/resize logic
  const handleOverlayMouseDown = (e) => {
    if (!currentSubtitle) return;
    if (e.target.dataset.resize) {
      setResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: currentSubtitle.width,
        height: currentSubtitle.height,
      });
    } else {
      setDragging(true);
      const rect = overlayRef.current.getBoundingClientRect();
      setDragOffset({
        x: (e.clientX - rect.left) / baseWidth,
        y: (e.clientY - rect.top) / previewHeight,
      });
    }
    document.body.style.userSelect = 'none';
  };

  const handleOverlayMouseUp = () => {
    setDragging(false);
    setResizing(false);
    document.body.style.userSelect = '';
  };

  const handleOverlayMouseMove = (e) => {
    if (!currentSubtitle) return;
    if (dragging) {
      const rect = overlayRef.current.parentElement.getBoundingClientRect();
      let x = (e.clientX - rect.left) / baseWidth - dragOffset.x + currentSubtitle.width / 2;
      let y = (e.clientY - rect.top) / previewHeight - dragOffset.y + currentSubtitle.height / 2;
      x = Math.max(currentSubtitle.width / 2, Math.min(1 - currentSubtitle.width / 2, x));
      y = Math.max(currentSubtitle.height / 2, Math.min(1 - currentSubtitle.height / 2, y));
      setSubtitles(subtitles.map(seg =>
        seg.id === currentSubtitle.id ? { ...seg, x, y } : seg
      ));
    } else if (resizing) {
      const dx = (e.clientX - resizeStart.x) / baseWidth;
      const dy = (e.clientY - resizeStart.y) / previewHeight;
      let width = Math.max(0.1, Math.min(1, resizeStart.width + dx));
      let height = Math.max(0.08, Math.min(0.5, resizeStart.height + dy));
      setSubtitles(subtitles.map(seg =>
        seg.id === currentSubtitle.id ? { ...seg, width, height } : seg
      ));
    }
  };

  if (typeof window !== 'undefined') {
    window.onmousemove = dragging || resizing ? handleOverlayMouseMove : null;
    window.onmouseup = dragging || resizing ? handleOverlayMouseUp : null;
  }

  // When a subtitle is selected, jump to its start time
  useEffect(() => {
    if (selectedSubtitleId && videoRef.current) {
      const seg = subtitles.find(s => s.id === selectedSubtitleId);
      if (seg) videoRef.current.currentTime = seg.start;
    }
  }, [selectedSubtitleId]);

  // Helper to get the selected subtitle
  const selectedSubtitle = subtitles.find(s => s.id === selectedSubtitleId);

  // Add subtitle at current time
  const handleAddSubtitleAtCurrentTime = () => {
    const time = currentTime;
    const newSeg = {
      id: Date.now(),
      start: Math.floor(time * 100) / 100,
      end: Math.floor((time + 2) * 100) / 100,
      text: "",
      x: 0.5, y: 0.8, width: 0.8, height: 0.18,
      textColor, fontFamily, fontSize, isBold, isItalic, isUnderline, isShadow
    };
    setSubtitles([...subtitles, newSeg]);
    setSelectedSubtitleId(newSeg.id);
  };

  // Edit subtitle fields
  const handleSelectedSubtitleChange = (field, value) => {
    setSubtitles(subtitles.map(seg =>
      seg.id === selectedSubtitleId ? { ...seg, [field]: value } : seg
    ));
  };

  // Delete subtitle
  const handleDeleteSelectedSubtitle = () => {
    setSubtitles(subtitles.filter(seg => seg.id !== selectedSubtitleId));
    setSelectedSubtitleId(null);
  };

  // When a video is loaded, detect its resolution
  const handleLoadedMetadata = (e) => {
    setVideoWidthState(e.target.videoWidth);
    setVideoHeightState(e.target.videoHeight);
  };

  // Listen for playUntil and pause at the right time
  useEffect(() => {
    if (!playUntil || !videoRef.current) return;
    const onTimeUpdate = () => {
      if (videoRef.current.currentTime >= playUntil) {
        videoRef.current.pause();
        setPlayUntil(null);
      }
    };
    videoRef.current.addEventListener('timeupdate', onTimeUpdate);
    return () => videoRef.current.removeEventListener('timeupdate', onTimeUpdate);
  }, [playUntil]);

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-purple-100">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur shadow-sm py-4 mb-2">
        <h1 className="text-3xl font-extrabold text-center text-purple-700 tracking-tight">🎬 Subtitle Overlay Editor</h1>
      </header>
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-6xl mx-auto px-2 md:px-0">
        {/* Main left column: Upload, Video, Add, List */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Upload Section (moved here) */}
          <section className="bg-white rounded-xl shadow p-6 flex flex-col gap-4">
            <h2 className="text-lg font-bold text-blue-700 flex items-center gap-2"><span>⬆️</span> Upload</h2>
            <form onSubmit={handleUpload} className="flex flex-col gap-3 items-start">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                ref={fileInputRef}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                title="Upload your video file"
              />
              <button
                type="submit"
                disabled={!videoFile || uploading}
                className="bg-blue-600 hover:bg-blue-700 transition text-white px-4 py-2 rounded-lg disabled:opacity-50 w-full font-semibold flex items-center gap-2"
                title="Upload video"
              >
                <span>Upload Video</span>
              </button>
            </form>
            {uploadResult && uploadResult.filePath && (
              <div className="text-green-700 text-sm mt-2">Upload successful!</div>
            )}
          </section>
          <div className="bg-white/90 rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <h2 className="text-xl font-bold text-blue-700 mb-2">Video Preview</h2>
            <div className="relative rounded-xl overflow-hidden" style={{ width: previewWidth, height: previewHeight }}>
              {videoUrl ? (
                <>
                  <video
                    src={videoUrl}
                    controls
                    width={previewWidth}
                    height={previewHeight}
                    className="rounded-xl shadow-lg"
                    style={{ background: '#000', width: previewWidth, height: previewHeight }}
                    ref={videoRef}
                    onTimeUpdate={handleTimeUpdate}
                    onLoadedMetadata={handleLoadedMetadata}
                  />
                  {/* Overlay editable text for current subtitle */}
                  {findSubtitleAtTime(subtitles, currentTime) && (
                    <div
                      ref={overlayRef}
                      className="absolute flex flex-col items-center border-2 border-blue-400 cursor-move group"
                      style={{
                        left: `${(findSubtitleAtTime(subtitles, currentTime).x - findSubtitleAtTime(subtitles, currentTime).width / 2) * videoWidthState * scale}px`,
                        top: `${(findSubtitleAtTime(subtitles, currentTime).y - findSubtitleAtTime(subtitles, currentTime).height / 2) * videoHeightState * scale}px`,
                        width: `${findSubtitleAtTime(subtitles, currentTime).width * videoWidthState * scale}px`,
                        height: `${findSubtitleAtTime(subtitles, currentTime).height * videoHeightState * scale}px`,
                        zIndex: 10,
                        pointerEvents: 'auto',
                        resize: 'none',
                        userSelect: dragging || resizing ? 'none' : 'auto',
                      }}
                      onMouseDown={handleOverlayMouseDown}
                    >
                      <textarea
                        value={findSubtitleAtTime(subtitles, currentTime).text}
                        onChange={e => handleSubtitleChange("text", e.target.value)}
                        className="text-center bg-transparent resize-none outline-none border-none shadow-none w-full h-full rounded-xl"
                        style={{
                          color: findSubtitleAtTime(subtitles, currentTime).textColor || textColor,
                          background: bgCss,
                          fontFamily: findSubtitleAtTime(subtitles, currentTime).fontFamily || fontFamily,
                          fontSize: (findSubtitleAtTime(subtitles, currentTime).fontSize || fontSize) * scale,
                          fontWeight: findSubtitleAtTime(subtitles, currentTime).isBold ? 'bold' : 'normal',
                          fontStyle: findSubtitleAtTime(subtitles, currentTime).isItalic ? 'italic' : 'normal',
                          textDecoration: findSubtitleAtTime(subtitles, currentTime).isUnderline ? 'underline' : 'none',
                          textShadow: findSubtitleAtTime(subtitles, currentTime).isShadow ? '2px 2px 8px #000, 0 0 2px #000' : 'none',
                          minHeight: 0,
                          minWidth: 0,
                          height: '100%',
                          width: '100%',
                          pointerEvents: 'auto',
                          lineHeight: 1,
                          padding: 0,
                          boxSizing: 'border-box',
                        }}
                        rows={1}
                        cols={1}
                      />
                      {/* Resize handle */}
                      <div
                        data-resize
                        className="absolute right-0 bottom-0 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize group-hover:block border-2 border-white"
                        style={{ zIndex: 20 }}
                        onMouseDown={handleOverlayMouseDown}
                        title="Resize subtitle box"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-xl">Upload a video to start</div>
              )}
            </div>
            <button
              className="mt-4 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl shadow-lg hover:from-blue-700 hover:to-purple-700 transition text-lg font-semibold self-center"
              onClick={handleAddSubtitleAtCurrentTime}
              disabled={!videoUrl}
            >
              + Add Subtitle at {currentTime.toFixed(2)}s
            </button>
            <hr className="my-4 border-blue-100" />
            <h3 className="text-lg font-bold text-blue-700 mb-2 flex items-center gap-2"><span>📝</span> Subtitle Segments</h3>
            <div className="flex flex-col gap-2">
              {subtitles.length === 0 && <div className="text-gray-400">No subtitles yet.</div>}
              {subtitles.map(seg => (
                <div
                  key={seg.id}
                  className={`flex items-center gap-3 p-2 rounded-lg transition cursor-pointer ${selectedSubtitleId === seg.id ? 'bg-blue-100 border border-blue-400' : 'hover:bg-blue-50'}`}
                  onClick={() => setSelectedSubtitleId(seg.id)}
                >
                  <button
                    className="text-blue-600 font-bold text-lg px-2 py-1 rounded hover:bg-blue-200 transition"
                    onClick={e => {
                      e.stopPropagation();
                      if (videoRef.current) {
                        videoRef.current.currentTime = seg.start;
                        videoRef.current.play();
                        setPlayUntil(seg.end);
                      }
                    }}
                    title="Play this subtitle"
                  >▶</button>
                  <span className="text-sm font-mono text-gray-700 w-20">{formatTime(seg.start)} - {formatTime(seg.end)}</span>
                  <span className="flex-1 text-gray-800 truncate">{seg.text || <span className="italic text-gray-400">(empty)</span>}</span>
                  <button
                    className="text-red-500 px-2 py-1 rounded hover:bg-red-100 transition"
                    onClick={e => { e.stopPropagation(); setSubtitles(subtitles.filter(s => s.id !== seg.id)); if (selectedSubtitleId === seg.id) setSelectedSubtitleId(null); }}
                    title="Delete subtitle"
                  >✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Edit panel on the right for desktop, below for mobile */}
        {selectedSubtitle && (
          <div className="w-full md:w-96 bg-white rounded-2xl shadow-xl p-6 border border-blue-200 flex flex-col gap-4 mt-6 md:mt-0 md:ml-0">
            <h4 className="text-lg font-bold mb-2 text-blue-700">Edit Subtitle</h4>
            <div className="flex flex-col gap-4">
              <label className="flex flex-col text-sm text-black">
                Text
                <input
                  type="text"
                  value={selectedSubtitle.text}
                  onChange={e => handleSelectedSubtitleChange('text', e.target.value)}
                  className="border rounded px-2 py-1 mt-1"
                />
              </label>
              <div className="flex flex-wrap gap-3 items-center">
                <label className="flex items-center gap-1 text-sm text-black">
                  Font
                  <select
                    value={selectedSubtitle.fontFamily || fontFamily}
                    onChange={e => handleSelectedSubtitleChange('fontFamily', e.target.value)}
                    className="border rounded px-1 py-0.5"
                  >
                    {FONT_FAMILIES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-sm text-black">
                  Size
                  <select
                    value={selectedSubtitle.fontSize || fontSize}
                    onChange={e => handleSelectedSubtitleChange('fontSize', Number(e.target.value))}
                    className="border rounded px-1 py-0.5"
                  >
                    {FONT_SIZES.map(s => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-sm text-black">
                  <input type="checkbox" checked={!!selectedSubtitle.isBold} onChange={e => handleSelectedSubtitleChange('isBold', e.target.checked)} /> <span>B</span>
                </label>
                <label className="flex items-center gap-1 text-sm text-black">
                  <input type="checkbox" checked={!!selectedSubtitle.isItalic} onChange={e => handleSelectedSubtitleChange('isItalic', e.target.checked)} /> <span><i>I</i></span>
                </label>
                <label className="flex items-center gap-1 text-sm text-black">
                  <input type="checkbox" checked={!!selectedSubtitle.isUnderline} onChange={e => handleSelectedSubtitleChange('isUnderline', e.target.checked)} /> <span><u>U</u></span>
                </label>
                <label className="flex items-center gap-1 text-sm text-black">
                  <input type="checkbox" checked={!!selectedSubtitle.isShadow} onChange={e => handleSelectedSubtitleChange('isShadow', e.target.checked)} /> <span>Shadow</span>
                </label>
              </div>
              <label className="flex flex-col text-sm text-black">
                Font Color
                <input
                  type="color"
                  value={selectedSubtitle.textColor || textColor}
                  onChange={e => handleSelectedSubtitleChange('textColor', e.target.value)}
                  className="w-10 h-8 mt-1 border-none bg-transparent cursor-pointer"
                />
              </label>
              <div className="flex gap-4 items-end">
                <label className="flex flex-col text-sm text-black flex-1">
                  Start Time
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={selectedSubtitle.start}
                    onChange={e => handleSelectedSubtitleChange('start', parseFloat(e.target.value))}
                    className="border rounded px-2 py-1 mt-1"
                  />
                  <input
                    type="range"
                    min="0"
                    max={selectedSubtitle.end}
                    step="0.01"
                    value={selectedSubtitle.start}
                    onChange={e => handleSelectedSubtitleChange('start', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </label>
                <label className="flex flex-col text-sm text-black flex-1">
                  End Time
                  <input
                    type="number"
                    min={selectedSubtitle.start}
                    max={videoRef.current?.duration || 1000}
                    step="0.01"
                    value={selectedSubtitle.end}
                    onChange={e => handleSelectedSubtitleChange('end', parseFloat(e.target.value))}
                    className="border rounded px-2 py-1 mt-1"
                  />
                  <input
                    type="range"
                    min={selectedSubtitle.start}
                    max={videoRef.current?.duration || 1000}
                    step="0.01"
                    value={selectedSubtitle.end}
                    onChange={e => handleSelectedSubtitleChange('end', parseFloat(e.target.value))}
                    className="mt-1"
                  />
                </label>
                <button
                  className="ml-2 px-3 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600 transition"
                  onClick={() => handleSelectedSubtitleChange('end', videoRef.current?.duration || selectedSubtitle.end)}
                  title="Extend to end of video"
                >
                  Extend to End
                </button>
              </div>
              <button
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition self-end"
                onClick={handleDeleteSelectedSubtitle}
              >
                Delete
              </button>
            </div>
          </div>
        )}
        {/* Style Controls and Download Section (unchanged) */}
        <div className="flex flex-col md:flex-row gap-8 w-full mt-8">
          <aside className="flex flex-col gap-8 w-full md:w-80">
            {/* Style Section */}
            <section className="bg-white rounded-xl shadow p-6 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-purple-700 flex items-center gap-2"><span>🎨</span> Subtitle Style</h2>
              <div className="flex flex-wrap gap-3 items-center">
                <label className="flex items-center gap-1 text-sm text-black" title="Font family">
                  <span>Font</span>
                  <select value={fontFamily} onChange={e => setFontFamily(e.target.value)} className="border rounded px-1 py-0.5">
                    {FONT_FAMILIES.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-sm text-black" title="Font size">
                  <span>Size</span>
                  <select value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="border rounded px-1 py-0.5">
                    {FONT_SIZES.map(s => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-1 text-sm text-black" title="Text color">
                  <span>Text</span>
                  <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} />
                </label>
                <label className="flex items-center gap-1 text-sm text-black" title="Background color">
                  <span>BG</span>
                  <input type="color" value={bgColor.slice(0,7)} onChange={e => setBgColor(e.target.value + bgColor.slice(7))} />
                  <input type="range" min="0" max="1" step="0.01" value={bgAlpha} onChange={e => setBgAlpha(Number(e.target.value))} className="ml-2 w-16" />
                  <span className="text-xs">Opacity</span>
                </label>
                <label className="flex items-center gap-1 text-sm text-black" title="Aspect ratio">
                  <span>Ratio</span>
                  <select value={ratio} onChange={e => setRatio(Number(e.target.value))} className="border rounded px-1 py-0.5">
                    {RATIOS.map(r => (
                      <option key={r.label} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap gap-3 items-center mt-2">
                <label className="flex items-center gap-1 text-sm text-black" title="Bold">
                  <input type="checkbox" checked={isBold} onChange={e => setIsBold(e.target.checked)} /> <span>B</span>
                </label>
                <label className="flex items-center gap-1 text-sm text-black" title="Italic">
                  <input type="checkbox" checked={isItalic} onChange={e => setIsItalic(e.target.checked)} /> <span><i>I</i></span>
                </label>
                <label className="flex items-center gap-1 text-sm text-black" title="Underline">
                  <input type="checkbox" checked={isUnderline} onChange={e => setIsUnderline(e.target.checked)} /> <span><u>U</u></span>
                </label>
                <label className="flex items-center gap-1 text-sm text-black" title="Shadow">
                  <input type="checkbox" checked={isShadow} onChange={e => setIsShadow(e.target.checked)} /> <span>Shadow</span>
                </label>
              </div>
            </section>
            {/* Download Section */}
            <section className="bg-white rounded-xl shadow p-6 flex flex-col gap-4">
              <h2 className="text-lg font-bold text-green-700 flex items-center gap-2"><span>⬇️</span> Download</h2>
              <button
                onClick={handleDownload}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 transition text-white px-6 py-3 rounded-lg text-lg font-semibold w-full shadow-lg flex items-center justify-center gap-2"
                disabled={!videoFile || downloading}
                title="Download video with embedded subtitles (not yet implemented)"
              >
                {downloading ? (
                  <span className="flex items-center gap-2"><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> Processing...</span>
                ) : (
                  <>Download (original video only)</>
                )}
              </button>
              {downloading && (
                <div className="w-full mt-2">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${downloadProgress}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-700 mt-1 text-center">{downloadProgress}%</div>
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
