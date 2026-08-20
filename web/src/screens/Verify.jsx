import { useEffect, useRef, useState } from "react";
import { Camera, Check, ChevronLeft, CircleAlert, Info, LockKeyhole, ScanFace, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAttendance } from "../context/AttendanceContext";
import { API_BASE_URL } from "../constants";
import { useAuthStore } from "../store/useAuthStore";

export function analyzeFrame(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const sampleWidth = Math.min(canvas.width, 160);
  const sampleHeight = Math.min(canvas.height, 160);
  const startX = Math.max(0, Math.floor((canvas.width - sampleWidth) / 2));
  const startY = Math.max(0, Math.floor((canvas.height - sampleHeight) / 2));
  const pixels = context.getImageData(startX, startY, sampleWidth, sampleHeight).data;
  let total = 0;
  for (let index = 0; index < pixels.length; index += 16) total += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
  const brightness = total / Math.max(1, Math.floor(pixels.length / 16));
  return { brightness, hasEnoughLight: brightness > 28 && brightness < 245 };
}

async function detectFace(canvas) {
  if (!window.FaceDetector) return { supported: false, passed: true, label: "Guide check" };
  try {
    const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 2 });
    const faces = await detector.detect(canvas);
    if (faces.length !== 1) return { supported: true, passed: false, label: faces.length === 0 ? "Face not found" : "One face only" };
    const box = faces[0].boundingBox;
    const faceArea = box.width * box.height;
    const canvasArea = canvas.width * canvas.height;
    const centered = Math.abs((box.x + box.width / 2) - canvas.width / 2) < canvas.width * 0.24;
    const largeEnough = faceArea > canvasArea * 0.055;
    return { supported: true, passed: centered && largeEnough, label: centered && largeEnough ? "Face centered" : "Move into guide" };
  } catch {
    return { supported: false, passed: true, label: "Guide check" };
  }
}

function canvasBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
}

export function shouldRedirectToEnrollment(statusCode, detail, isEnrollment) {
  return !isEnrollment && statusCode === 409 && /re-enroll|enrollment unavailable|enroll your face/i.test(detail || "");
}

export function shouldOfferReEnrollment(statusCode, detail, isEnrollment) {
  return !isEnrollment && statusCode === 422 && /face verification failed/i.test(detail || "");
}

export default function Verify() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode");
  const isEnrollment = mode === "enroll";
  const action = mode === "check-out" ? "check-out" : "check-in";
  const { currentUser, currentUserRecord, markRecognitionEnrolled, applyVerifiedAttendance, todayComplete, isLoading } = useAttendance();
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [phase, setPhase] = useState("consent");
  const [hasConsent, setHasConsent] = useState(false);
  const [quality, setQuality] = useState({ lighting: null, face: null, frame: null });
  const [message, setMessage] = useState("");
  const [suggestEnrollment, setSuggestEnrollment] = useState(false);
  const [uploadState, setUploadState] = useState("idle");
  const [pin, setPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  useEffect(() => {
    if (!isEnrollment && !isLoading && currentUserRecord && currentUserRecord.recognitionStatus !== "enrolled") {
      navigate("/verify?mode=enroll", { replace: true, state: { message: "Enroll your attendance photo before checking in or out." } });
    }
  }, [currentUserRecord, isEnrollment, isLoading, navigate]);

  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);

  const openCamera = async () => {
    if (!hasConsent) return;
    if (!navigator.mediaDevices?.getUserMedia) { setMessage("This browser does not provide camera access. Try a recent Chrome, Safari, or Edge browser."); setPhase("failed"); return; }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }, audio: false });
      setStream(mediaStream);
      setPhase("camera");
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = mediaStream; }, 40);
    } catch {
      setMessage("Camera access is blocked. Check browser permissions, then try again.");
      setPhase("failed");
    }
  };

  const uploadCapture = async (blob) => {
    if (!API_BASE_URL) return { uploaded: false, message: "The attendance API is not configured." };
    if (!token) {
      stream?.getTracks().forEach((track) => track.stop());
      logout();
      navigate("/login", { replace: true, state: { message: "Your session expired. Please sign in again." } });
      return { uploaded: false, redirected: true, message: "Your session expired. Please sign in again." };
    }
    setUploadState("checking");
    try {
      const formData = new FormData();
      formData.append("capture", blob, `${currentUser.id}-${Date.now()}.jpg`);
      if (!isEnrollment) formData.append("action", action);
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}${isEnrollment ? "/v1/attendance/face/enroll" : "/v1/attendance/verify"}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        logout();
        navigate("/login", { replace: true, state: { message: "Your session expired. Please sign in again." } });
        return { uploaded: false, message: "Your session expired. Please sign in again." };
      }
      if (shouldRedirectToEnrollment(response.status, payload.detail, isEnrollment)) {
        stream?.getTracks().forEach((track) => track.stop());
        navigate("/verify?mode=enroll", { replace: true, state: { message: payload.detail } });
        return { uploaded: false, redirected: true, message: payload.detail };
      }
      if (shouldOfferReEnrollment(response.status, payload.detail, isEnrollment)) setSuggestEnrollment(true);
      if (!response.ok) throw new Error(payload.detail || "The attendance service rejected this capture.");
      setUploadState("uploaded");
      return { uploaded: true, message: isEnrollment ? "Your face was enrolled by the backend." : `Backend verified your face and recorded ${action}.` };
    } catch (error) {
      setUploadState("offline");
      return { uploaded: false, message: error.message || "The backend verification could not be completed." };
    }
  };

  const verifyWithPin = async () => {
    if (!token) {
      logout();
      navigate("/login", { replace: true, state: { message: "Your session expired. Please sign in again." } });
      return;
    }
    if (isEnrollment || !API_BASE_URL || !/^\d{6}$/.test(pin)) return setMessage("Enter your six-digit attendance PIN.");
    setPinLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL.replace(/\/$/, "")}/v1/attendance/pin/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, pin }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        logout();
        navigate("/login", { replace: true, state: { message: "Your session expired. Please sign in again." } });
        return;
      }
      if (!response.ok) throw new Error(payload.detail || "PIN verification failed.");
      applyVerifiedAttendance?.(payload);
      setMessage(`PIN verified and ${action} recorded.`);
      setPhase("success");
      setPin("");
    } catch (error) {
      setMessage(error.message || "PIN verification failed.");
    } finally {
      setPinLoading(false);
    }
  };

  const captureAndVerify = async () => {
    if (!videoRef.current || phase !== "camera") return;
    setPhase("checking");
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    context.save();
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.restore();

    const lighting = analyzeFrame(canvas);
    const face = await detectFace(canvas);
    const frame = { passed: canvas.width >= 320 && canvas.height >= 320, label: `${canvas.width} × ${canvas.height}` };
    setQuality({ lighting, face, frame });
    if (!lighting.hasEnoughLight || !face.passed || !frame.passed) {
      setMessage(!lighting.hasEnoughLight ? "Move to a brighter, evenly lit area." : face.label === "Guide check" ? "Keep your face inside the guide and take another capture." : face.label);
      setPhase("failed");
      stream?.getTracks().forEach((track) => track.stop());
      return;
    }

    const blob = await canvasBlob(canvas);
    if (!blob) { setMessage("The browser could not prepare a JPEG capture. Try again."); setPhase("failed"); return; }
    const upload = await uploadCapture(blob);
    if (!upload.uploaded) {
      if (upload.redirected) return;
      setMessage(upload.message);
      setPhase("failed");
      stream?.getTracks().forEach((track) => track.stop());
      return;
    }
    if (isEnrollment) markRecognitionEnrolled(currentUser.id);
    setMessage(upload.message);
    setPhase("success");
    stream?.getTracks().forEach((track) => track.stop());
  };

  const heading = isEnrollment ? "Enroll photo" : action === "check-in" ? "Check in" : "Check out";
  const isCameraVisible = phase === "camera" || phase === "checking";
  const progress = phase === "consent" ? 1 : isCameraVisible ? 2 : phase === "success" ? 3 : 2;

  if (!isEnrollment && todayComplete) {
    return <div className="flex min-h-screen items-center justify-center bg-[#EAF3F9] px-4 text-ink"><section className="w-full max-w-md rounded-[28px] border border-line bg-white p-7 text-center shadow-[0_14px_38px_rgba(23,50,77,0.09)]"><div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-mint-soft text-mint"><Check size={32} /></div><p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-blue">Today&apos;s attendance</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">Attendance is already complete</h1><p className="mt-3 text-sm leading-6 text-muted">Your check-in and check-out are both recorded for today. You can return tomorrow for the next attendance cycle.</p><button onClick={() => navigate("/app")} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white">Back to workspace <ChevronLeft size={16} className="rotate-180" /></button></section></div>;
  }

  return (
    <div className="min-h-screen bg-[#EAF3F9] text-ink"><header className="flex items-center justify-between border-b border-line bg-white/80 px-4 py-4 backdrop-blur-xl sm:px-6"><button onClick={() => navigate(-1)} className="flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-bold text-muted hover:bg-canvas"><ChevronLeft size={17} /> Back</button><div className="flex items-center gap-2 text-xs font-bold"><div className="flex size-7 items-center justify-center rounded-lg bg-blue text-white"><ScanFace size={15} /></div> Facial Recognition Attendance</div><span className="text-[11px] font-semibold text-muted">Step {progress} of 3</span></header>
      <main className="mx-auto flex min-h-[calc(100vh-73px)] max-w-[880px] items-start justify-center px-4 py-5 sm:items-center sm:py-8"><div className="grid w-full gap-5 lg:grid-cols-[1fr_0.86fr] lg:items-center lg:gap-6 motion-enter">
        <section><div className="mb-5 flex items-center gap-2 text-xs font-bold text-blue"><span className={`flex size-6 items-center justify-center rounded-full ${progress >= 1 ? "bg-blue text-white" : "bg-white text-muted"}`}>1</span><span className="h-px w-8 bg-blue/20" /><span className={`flex size-6 items-center justify-center rounded-full ${progress >= 2 ? "bg-blue text-white" : "bg-white text-muted"}`}>2</span><span className="h-px w-8 bg-blue/20" /><span className={`flex size-6 items-center justify-center rounded-full ${progress >= 3 ? "bg-blue text-white" : "bg-white text-muted"}`}>3</span></div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue">{isEnrollment ? "Attendance enrollment" : action === "check-in" ? "Arrival verification" : "Departure verification"}</p><h1 className="mt-2 text-[34px] font-bold tracking-[-0.04em] text-ink sm:text-[42px]">{phase === "success" ? (isEnrollment ? "Photo enrolled" : `${heading} recorded`) : phase === "failed" ? "Let's try that again" : heading}</h1><p className="mt-3 max-w-md text-sm leading-6 text-muted">{phase === "consent" ? (isEnrollment ? "Take one clear photo. After the backend accepts it, future attendance captures can be checked against your enrolled profile." : "Use a consented camera capture to verify today's attendance and upload the JPEG through your organization's evidence policy.") : phase === "camera" ? "Keep one face centered in the guide, look toward the camera, and capture when the lighting indicator is ready." : phase === "checking" ? "Checking framing, lighting, and face presence on this device, then contacting the attendance service." : phase === "success" ? message : message || "The capture did not meet the minimum quality checks."}</p>
          {phase === "consent" && <div className="mt-7 space-y-3"><div className="rounded-[22px] border border-line bg-white p-4 shadow-[0_8px_26px_rgba(23,50,77,0.045)]"><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-soft text-blue"><LockKeyhole size={18} /></div><div><p className="text-sm font-bold text-ink">Consent before camera</p><p className="mt-1 text-xs leading-5 text-muted">Your image is uploaded only through the configured attendance evidence endpoint. The organization policy decides whether the backend retains it. No biometric template or automatic employment decision is created by this UI.</p></div></div><button onClick={() => setHasConsent((value) => !value)} className="mt-4 flex w-full items-start gap-3 border-t border-line pt-4 text-left"><span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border ${hasConsent ? "border-blue bg-blue text-white" : "border-[#C8CED8] bg-white text-transparent"}`}><Check size={13} /></span><span className="text-xs leading-5 text-ink">I consent to this capture and to the organization's stated attendance evidence processing.</span></button></div><button disabled={!hasConsent} onClick={openCamera} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue px-4 text-sm font-bold text-white shadow-[0_8px_20px_rgba(90,169,230,0.18)] disabled:cursor-not-allowed disabled:opacity-40"><Camera size={18} /> Continue to camera</button></div>}
          {phase === "failed" && <>
            <button onClick={() => { setPhase("consent"); setMessage(""); setSuggestEnrollment(false); setUploadState("idle"); setQuality({ lighting: null, face: null, frame: null }); }} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white"><RefreshSpinner /> Start again</button>
            {suggestEnrollment && <button onClick={() => navigate("/verify?mode=enroll", { state: { message: "Retake your attendance enrollment photo in good lighting, then try attendance again." } })} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-blue/20 bg-blue-soft px-4 text-xs font-bold text-blue"><ScanFace size={16} /> Retake enrollment photo</button>}
            {!isEnrollment && <div className="mt-4 rounded-2xl border border-line bg-white p-4"><p className="text-xs font-bold text-ink">Camera unavailable?</p><p className="mt-1 text-xs leading-5 text-muted">Use your six-digit attendance PIN instead.</p><div className="mt-3 flex gap-2"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit PIN" className="min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 py-2.5 text-sm tracking-[0.25em] outline-none focus:border-blue" /><button type="button" onClick={verifyWithPin} disabled={pinLoading || pin.length !== 6} className="rounded-xl bg-blue px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40">{pinLoading ? "Checking…" : "Use PIN"}</button></div></div>}
          </>}
          {phase === "success" && <button onClick={() => navigate("/app")} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white">Done <ChevronLeft size={16} className="rotate-180" /></button>}
        </section>

        <section className={`${isCameraVisible ? "order-first lg:order-none" : ""} rounded-[28px] border border-line bg-white p-3 shadow-[0_14px_38px_rgba(23,50,77,0.09)] sm:p-5`}>{isCameraVisible ? <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-ink sm:aspect-square"><video ref={videoRef} autoPlay playsInline muted className="size-full object-cover -scale-x-100" /><canvas ref={canvasRef} className="hidden" /><div className="absolute inset-0 bg-ink/15" /><div className="absolute inset-[16%] rounded-[46%] border-2 border-white/75 shadow-[0_0_0_999px_rgba(23,50,77,0.18)]" /><div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-full bg-ink/60 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-md">{phase === "checking" ? "Analyzing capture" : "Center one face"}</div><div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl bg-ink/60 px-3 py-2.5 text-[10px] font-semibold text-white backdrop-blur-md"><span className="flex items-center gap-1.5"><LockKeyhole size={13} /> Consent recorded</span><span>Front camera</span></div></div> : <div className="flex aspect-square flex-col items-center justify-center rounded-[22px] bg-[#F7F9FD] text-center"><div className={`flex size-24 items-center justify-center rounded-[30px] ${phase === "success" ? "bg-mint-soft text-mint" : phase === "failed" ? "bg-rose-soft text-rose" : "bg-blue-soft text-blue"}`}>{phase === "success" ? <Check size={48} /> : phase === "failed" ? <CircleAlert size={44} /> : <ScanFace size={48} />}</div><p className="mt-6 text-sm font-bold text-ink">{phase === "success" ? (uploadState === "uploaded" ? "Backend receipt received" : "Preview result recorded") : phase === "failed" ? "Capture needs another look" : "Camera stays closed until consent"}</p><p className="mt-2 max-w-[240px] text-xs leading-5 text-muted">{phase === "consent" ? "You will see the browser permission prompt only after you continue." : phase === "success" ? "The capture quality checks passed. Review the message on the left for the evidence service result." : "Review the guidance on the left to continue."}</p></div>}
          {phase === "camera" && <button onClick={captureAndVerify} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue px-4 text-sm font-bold text-white shadow-[0_8px_20px_rgba(90,169,230,0.18)]"><UploadCloud size={18} /> {isEnrollment ? "Capture and upload" : "Capture attendance"}</button>}
          {phase === "checking" && <div className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-white"><RefreshSpinner /> Checking and uploading</div>}
          <div className="mt-4 grid grid-cols-3 gap-2">{[{ label: "Lighting", value: quality.lighting ? (quality.lighting.hasEnoughLight ? "Ready" : "Adjust") : "Pending", icon: Sparkles, tone: quality.lighting?.hasEnoughLight ? "text-mint" : "text-muted" }, { label: "Face", value: quality.face?.label ?? "Pending", icon: ScanFace, tone: quality.face?.passed ? "text-mint" : "text-muted" }, { label: "Frame", value: quality.frame?.passed ? "Ready" : quality.frame ? "Adjust" : "Pending", icon: ShieldCheck, tone: quality.frame?.passed ? "text-mint" : "text-muted" }].map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-2xl bg-canvas p-3"><Icon size={15} className={tone} /><p className="mt-3 text-[10px] font-bold text-muted">{label}</p><p className="mt-0.5 truncate text-[11px] font-bold text-ink">{value}</p></div>)}</div><div className="mt-4 flex items-start gap-2 rounded-2xl border border-line bg-[#EAF3F9] p-3 text-[11px] leading-5 text-muted"><Info size={14} className="mt-0.5 shrink-0 text-blue" /> On-device checks only assess capture quality. Identity matching, liveness, retention, and audit logging remain backend responsibilities.</div>
        </section>
      </div></main>
    </div>
  );
}

function RefreshSpinner() { return <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />; }
