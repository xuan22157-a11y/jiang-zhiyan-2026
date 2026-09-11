import { CSSProperties, PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KeyboardInput, MobileScroll, useKeyboard } from "./mobile";
import "./prototype.css";

type ScreenId =
  | "AUTH-01" | "AUTH-02" | "AUTH-03" | "AUTH-04" | "HOME-01"
  | "A-01" | "A-02" | "A-03" | "A-04" | "A-05" | "A-06"
  | "A-07" | "A-08" | "A-09" | "A-10" | "A-11" | "A-12"
  | "B-01" | "B-Q-01" | "B-D-01" | "B-P-01"
  | "C-S-01" | "C-A-01" | "C-A-02"
  | "PROFILE-01" | "SETTINGS-01" | "SETTINGS-02";

type SoundKind = "click" | "correct" | "wrong" | "coin" | "work" | "success";
const ASSET_ROOT = "/assets/ceramic/screens";
const DESIGN_W = 812;
const DESIGN_H = 375;

const nextAssets: Partial<Record<ScreenId, ScreenId[]>> = {
  "AUTH-01": ["AUTH-03"], "AUTH-03": ["AUTH-02", "AUTH-04"], "AUTH-02": ["AUTH-04"],
  "AUTH-04": ["HOME-01"], "HOME-01": ["A-01", "B-01", "C-S-01"],
  "A-01": ["A-02"], "A-02": ["A-03"], "A-03": ["A-04"], "A-04": ["A-05"],
  "A-05": ["A-06"], "A-06": ["A-07"], "A-07": ["A-08"], "A-08": ["A-09"],
  "A-09": ["A-10"], "A-10": ["A-11"], "A-11": ["A-12"], "A-12": ["HOME-01"],
  "B-01": ["B-Q-01", "B-D-01", "B-P-01"], "B-D-01": ["C-S-01"],
  "C-S-01": ["C-A-01"], "C-A-01": ["C-A-02"], "PROFILE-01": ["SETTINGS-01"],
  "SETTINGS-01": ["SETTINGS-02"], "SETTINGS-02": ["SETTINGS-01"],
};

function rect(x: number, y: number, width: number, height: number): CSSProperties {
  return { left: `${x / DESIGN_W * 100}%`, top: `${y / DESIGN_H * 100}%`, width: `${width / DESIGN_W * 100}%`, height: `${height / DESIGN_H * 100}%` };
}

function artCrop(art: ScreenId, box: [number, number, number, number]): CSSProperties {
  const [x, y, width, height] = box;
  return { backgroundImage: `url(${ASSET_ROOT}/${art}.png)`, backgroundSize: `${DESIGN_W / width * 100}% ${DESIGN_H / height * 100}%`, backgroundPosition: `${x / (DESIGN_W - width) * 100}% ${y / (DESIGN_H - height) * 100}%` };
}

interface HotspotProps { label: string; box: [number, number, number, number]; sourceBox?: [number, number, number, number]; onClick: () => void; disabled?: boolean; choice?: boolean; selected?: boolean; dimmed?: boolean; art?: ScreenId; }
function Hotspot({ label, box, sourceBox, onClick, disabled = false, choice = false, selected = false, dimmed = false, art }: HotspotProps) {
  const [x, y, width, height] = box;
  const [sourceX, sourceY, sourceWidth, sourceHeight] = sourceBox ?? box;
  const choiceArt = art ?? (label.includes("Dynasty") ? "A-01" : label.startsWith("Select porcelain") ? "A-02" : label === "Next step" && x === 668 ? "A-06" : ["Knowledge Quiz", "DIY Crafting", "Pottery PK"].includes(label) ? "B-01" : ["White Porcelain Crafting", "Creative Workshop", "Collection", "Auction House"].includes(label) ? "HOME-01" : undefined);
  const visualStyle = choiceArt ? artCrop(choiceArt, [sourceX, sourceY, sourceWidth, sourceHeight]) : undefined;
  return <button className={`game-hotspot${choice ? " is-choice" : ""}${selected ? " is-selected" : ""}${choiceArt ? " has-choice-art" : ""}${label === "Next step" ? " is-next" : ""}${dimmed ? " is-dimmed" : ""}`} style={rect(...box)} aria-label={label} title={label} aria-pressed={choice ? selected : undefined} onClick={onClick} disabled={disabled}>{choiceArt && <i className="choice-art" style={visualStyle} />}{!choiceArt && <span>{label}</span>}</button>;
}

declare global { interface Window { webkitAudioContext: typeof AudioContext; } }

interface CeramicModel3DProps {
  tool: number;
  angle: number;
  progress: number;
  onCraft: (amount: number) => void;
  onAngle: (angle: number) => void;
  onFirstDrag: () => void;
}

function CeramicModel3D({ tool, angle, progress, onCraft, onAngle, onFirstDrag }: CeramicModel3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const gesture = useRef({ dragging: false, x: 0, time: 0, velocity: 0, angle: THREE.MathUtils.degToRad(angle) });
  const callbacksRef = useRef({ onCraft, onAngle, onFirstDrag });
  callbacksRef.current = { onCraft, onAngle, onFirstDrag };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.setAttribute("aria-label", "Interactive 3D porcelain model");
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, .01, 30);
    // A slightly elevated, pulled-back product view matches the supplied
    // reference: the mouth remains visible and the wide outer wheel fits in
    // frame without flattening or cropping the model.
    camera.position.set(0, 1.22, 6.35);
    camera.lookAt(0, -.22, 0);
    const root = new THREE.Group();
    root.position.y = -.42;
    scene.add(root);
    modelRef.current = root;

    scene.add(new THREE.HemisphereLight(0xfff6dd, 0x4a392c, 1.65));
    const key = new THREE.DirectionalLight(0xffe4b2, 3.1);
    key.position.set(-2.7, 3.8, 3.4); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); scene.add(key);
    const fill = new THREE.DirectionalLight(0xd9e4ec, 1.05);
    fill.position.set(3.2, 1.2, 2.2); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd08a, 1.25);
    rim.position.set(1.8, 2.5, -3); scene.add(rim);

    const loader = new GLTFLoader();
    const attachModel = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      // The supplied model is wider than it is tall, so matching only the
      // longest dimension makes it look much smaller than the vase in the art.
      // This scale visually matches the original vessel while preserving the
      // model's real proportions and rotation.
      // The A-07 background is now clean, so the complete supplied model can be
      // framed without overscaling it to hide baked-in artwork. This leaves the
      // vessel and its included wheel fully visible throughout a rotation.
      const scale = 5.22 / Math.max(size.x, size.y, size.z, .001);
      object.scale.setScalar(scale);
      object.position.set(-center.x * scale, -box.min.y * scale - 1.06, -center.z * scale);
      object.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true; child.receiveShadow = true;
        const source = Array.isArray(child.material) ? child.material : [child.material];
        source.forEach(material => {
          if (!(material instanceof THREE.MeshStandardMaterial)) return;
          material.roughness = .43; material.metalness = .01; material.envMapIntensity = .72;
          materialsRef.current.push(material);
        });
      });
      root.add(object);
    };
    loader.load("/assets/ceramic/models/ceramic-vase-runtime.glb", gltf => attachModel(gltf.scene), undefined, () => {
      const profile = [new THREE.Vector2(.38, 0), new THREE.Vector2(.55, .12), new THREE.Vector2(.62, .52), new THREE.Vector2(.48, .86), new THREE.Vector2(.34, 1.2), new THREE.Vector2(.36, 1.58), new THREE.Vector2(.5, 1.72), new THREE.Vector2(.53, 1.8)];
      const fallback = new THREE.Mesh(new THREE.LatheGeometry(profile, 96), new THREE.MeshStandardMaterial({ color: 0xf1ece1, roughness: .43, metalness: .01 }));
      attachModel(fallback);
    });

    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      renderer.setSize(Math.max(1, width), Math.max(1, height), false);
      camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame = 0;
    const render = () => {
      const state = gesture.current;
      if (!state.dragging && Math.abs(state.velocity) > .00015) {
        state.angle += state.velocity;
        state.velocity *= .91;
        callbacksRef.current.onAngle(THREE.MathUtils.radToDeg(state.angle));
      }
      root.rotation.y = state.angle;
      key.position.x = -2.7 + Math.sin(state.angle) * .45;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();
    return () => {
      window.cancelAnimationFrame(frame); observer.disconnect();
      scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const mats = Array.isArray(object.material) ? object.material : [object.material]; mats.forEach(material => material.dispose()); } });
      renderer.dispose(); renderer.domElement.remove(); materialsRef.current = [];
    };
  }, []);

  useEffect(() => {
    materialsRef.current.forEach(material => {
      const glaze = tool === 1 ? Math.min(1, progress / 100) : 0;
      material.roughness = tool === 1 ? THREE.MathUtils.lerp(.48, .16, glaze) : tool === 5 ? .25 : tool === 4 ? .62 : .43;
      material.color.set(tool === 1 ? new THREE.Color().lerpColors(new THREE.Color(0xe7dfd1), new THREE.Color(0xfff9eb), glaze) : tool === 5 ? 0xfff9e9 : 0xf1ece1);
      material.needsUpdate = true;
    });
  }, [progress, tool]);

  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current.dragging = true; gesture.current.x = event.clientX; gesture.current.time = performance.now(); gesture.current.velocity = 0;
    callbacksRef.current.onFirstDrag();
  };
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!gesture.current.dragging) return;
    const now = performance.now();
    const dx = event.clientX - gesture.current.x;
    const dt = Math.max(8, now - gesture.current.time);
    gesture.current.angle += dx * .012;
    gesture.current.velocity = dx / dt * .17;
    gesture.current.x = event.clientX; gesture.current.time = now;
    callbacksRef.current.onAngle(THREE.MathUtils.radToDeg(gesture.current.angle)); callbacksRef.current.onCraft(Math.abs(dx) * .075);
  };
  const pointerUp = () => { gesture.current.dragging = false; };

  return <div ref={mountRef} className="ceramic-model-3d" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} />;
}

type CraftStage = "shaping" | "carving" | "glazing";

function CraftInteractionLayer({ stage, point, active, progress, onStart, onMove, onEnd }: { stage: CraftStage; point: { x: number; y: number } | null; active: boolean; progress: number; onStart: (event: PointerEvent<HTMLDivElement>) => void; onMove: (event: PointerEvent<HTMLDivElement>) => void; onEnd: () => void; }) {
  if (stage === "shaping") return null;
  const marks = Math.min(9, Math.floor(progress / 8));
  return <div className={`craft-interaction-layer ${stage} ${active ? "active" : ""}`} onPointerDown={onStart} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd} aria-label={stage === "carving" ? "Drag to carve the porcelain" : "Hold and drag to glaze the porcelain"}>
    {stage === "carving" && <div className="carving-traces" aria-hidden="true">{Array.from({ length: marks }, (_, index) => <i key={index} style={{ top: `${30 + index * 4.8}%`, width: `${18 + (index % 3) * 7}%`, transform: `rotate(${index % 2 ? 2 : -2}deg)` }} />)}</div>}
    {stage === "glazing" && <div className="glaze-coverage" style={{ opacity: .08 + progress / 125 }} aria-hidden="true" />}
    <div className={`craft-hand-tool ${stage}`} style={point ? { left: `${point.x}%`, top: `${point.y}%` } : undefined} aria-hidden="true"><i />{stage === "glazing" && active && <span className="spray-cloud" />}</div>
  </div>;
}

function useGameAudio(enabled: boolean, musicVolume: number) {
  const contextRef = useRef<AudioContext | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const ceramicRef = useRef<HTMLAudioElement | null>(null);
  const audioSettingsRef = useRef({ enabled, musicVolume });
  audioSettingsRef.current = { enabled, musicVolume };
  const startMusic = useCallback(() => {
    if (!musicRef.current) return;
    musicRef.current.muted = false;
    musicRef.current.volume = audioSettingsRef.current.enabled ? audioSettingsRef.current.musicVolume : 0;
    void musicRef.current.play().catch(() => {
      // Browsers may wait for the first user gesture before allowing audio.
    });
  }, []);
  const ensureAudio = useCallback(() => {
    if (!contextRef.current) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      contextRef.current = new AudioCtor();
    }
    startMusic();
    if (contextRef.current.state === "suspended") void contextRef.current.resume();
    return contextRef.current;
  }, [startMusic]);
  useEffect(() => {
    startMusic();
  }, [startMusic]);
  useEffect(() => () => {
    musicRef.current?.pause();
    ceramicRef.current?.pause();
    if (ceramicRef.current) ceramicRef.current.src = "";
    void contextRef.current?.close();
  }, []);
  useEffect(() => {
    if (!musicRef.current) return;
    musicRef.current.volume = enabled ? musicVolume : 0;
  }, [enabled, musicVolume]);
  const play = useCallback((kind: SoundKind = "click") => {
    if (!enabled) return;
    const context = ensureAudio();
    if (kind === "click") {
      if (!ceramicRef.current) {
        ceramicRef.current = new Audio("/assets/ceramic/intro/ceramic-click.mp3");
        ceramicRef.current.preload = "auto";
      }
      ceramicRef.current.pause();
      ceramicRef.current.currentTime = 0;
      ceramicRef.current.volume = 0.48;
      void ceramicRef.current.play().catch(() => {});
      return;
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const config: Record<SoundKind, [number, number, OscillatorType]> = {
      click: [420, .07, "triangle"], correct: [880, .18, "sine"], wrong: [135, .2, "sawtooth"],
      coin: [1180, .22, "sine"], work: [260, .08, "triangle"], success: [660, .5, "sine"],
    };
    const [frequency, duration, type] = config[kind];
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (kind === "correct" || kind === "success") oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, now + duration);
    gain.gain.setValueAtTime(kind === "wrong" ? .055 : .035, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }, [enabled, ensureAudio]);
  return { play, ensureAudio, musicRef };
}

export default function Prototype() {
  const keyboard = useKeyboard();
  const [history, setHistory] = useState<ScreenId[]>(["AUTH-01"]);
  const [transitioning, setTransitioning] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [toast, setToast] = useState("");
  const [feedback, setFeedback] = useState<"" | "correct" | "wrong">("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [workProgress, setWorkProgress] = useState(0);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState("");
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);
  const [selectedTools, setSelectedTools] = useState<number[]>([]);
  const [selectedCraftTool, setSelectedCraftTool] = useState(3);
  const [modelAngle, setModelAngle] = useState(0);
  const [hasRotated, setHasRotated] = useState(false);
  const [kilnReady, setKilnReady] = useState(false);
  const [bid, setBid] = useState(1280);
  const transitionTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const workSoundAt = useRef(0);
  const modelAngleRef = useRef(0);
  const dragMotion = useRef({ x: 0, time: 0, velocity: 0 });
  const inertiaFrame = useRef<number | null>(null);
  const screen = history[history.length - 1];
  const musicVolume = (["AUTH-01", "AUTH-02", "AUTH-03"] as ScreenId[]).includes(screen) ? 0.78 : 0.2;
  const { play, ensureAudio, musicRef } = useGameAudio(soundOn, musicVolume);

  const notify = useCallback((message: string, kind: SoundKind = "click") => {
    setToast(message); play(kind);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  }, [play]);

  const go = useCallback((next: ScreenId) => {
    keyboard.hide(); ensureAudio(); play("click"); setTransitioning(true);
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = window.setTimeout(() => {
      setHistory(current => [...current, next]); setTransitioning(false); setFeedback(""); setWorkProgress(0); setDragPoint(null); setDragging(false); setSelectedChoice("");
    }, 300);
  }, [ensureAudio, keyboard, play]);

  const back = useCallback(() => {
    keyboard.hide(); play("click"); setTransitioning(true);
    window.setTimeout(() => { setHistory(current => current.length > 1 ? current.slice(0, -1) : current); setTransitioning(false); setFeedback(""); setWorkProgress(0); }, 300);
  }, [keyboard, play]);

  useEffect(() => { (nextAssets[screen] ?? []).forEach(id => { const image = new Image(); image.src = `${ASSET_ROOT}/${id}.png`; }); }, [screen]);
  useEffect(() => { if (screen !== "AUTH-04") return; const timer = window.setTimeout(() => go("HOME-01"), 1700); return () => window.clearTimeout(timer); }, [go, screen]);
  useEffect(() => {
    if (screen !== "A-10") { setKilnReady(false); return; }
    const timer = window.setTimeout(() => { setKilnReady(true); notify("Firing complete", "success"); }, 2400);
    return () => window.clearTimeout(timer);
  }, [notify, screen]);
  useEffect(() => {
    if (screen !== "A-07" || workProgress < 64 || feedback === "correct") return;
    setFeedback("correct"); notify("Step complete", "correct");
  }, [feedback, notify, screen, workProgress]);
  useEffect(() => () => { if (transitionTimer.current) window.clearTimeout(transitionTimer.current); if (toastTimer.current) window.clearTimeout(toastTimer.current); if (inertiaFrame.current) window.cancelAnimationFrame(inertiaFrame.current); }, []);

  const dragWork = (event: PointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = (event.clientX - bounds.left) / bounds.width * 100;
    setDragPoint({ x: pointerX, y: (event.clientY - bounds.top) / bounds.height * 100 });
    if (screen === "A-07") {
      const now = performance.now();
      const deltaX = event.clientX - dragMotion.current.x;
      const deltaTime = Math.max(8, now - dragMotion.current.time);
      if (dragMotion.current.time) {
        modelAngleRef.current += deltaX * .72;
        dragMotion.current.velocity = deltaX / deltaTime * 11;
        setModelAngle(modelAngleRef.current);
        setWorkProgress(value => Math.min(100, value + Math.abs(deltaX) * .075));
      }
      dragMotion.current.x = event.clientX;
      dragMotion.current.time = now;
    } else setWorkProgress(value => Math.min(100, value + 1.8));
    event.currentTarget.setPointerCapture(event.pointerId);
    const now = performance.now();
    if (now - workSoundAt.current > 120) { play("work"); workSoundAt.current = now; }
  };
  const beginWork = (event: PointerEvent<HTMLDivElement>) => {
    if (inertiaFrame.current) window.cancelAnimationFrame(inertiaFrame.current);
    setDragging(true); setHasRotated(true);
    dragMotion.current = { x: event.clientX, time: performance.now(), velocity: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const endWork = () => {
    setDragging(false);
    if (screen !== "A-07") return finishWork();
    let velocity = dragMotion.current.velocity;
    const coast = () => {
      velocity *= .9;
      if (Math.abs(velocity) < .08) { inertiaFrame.current = null; return; }
      modelAngleRef.current += velocity;
      setModelAngle(modelAngleRef.current);
      inertiaFrame.current = window.requestAnimationFrame(coast);
    };
    if (Math.abs(velocity) > .35) inertiaFrame.current = window.requestAnimationFrame(coast);
    if (workProgress >= 64) finishWork();
  };
  const finishWork = () => {
    setDragging(false);
    if (workProgress < 20) { setFeedback("wrong"); notify("Keep working on the porcelain", "wrong"); return; }
    setFeedback("correct"); setWorkProgress(100); notify("Step complete", "correct");
  };
  const register = () => {
    if (!phone || !code || !password) { setFeedback("wrong"); notify("Please complete all fields", "wrong"); return; }
    setFeedback("correct"); notify("Registration complete", "correct"); window.setTimeout(() => go("AUTH-04"), 450);
  };
  const selectAnswer = (correct: boolean) => { setFeedback(correct ? "correct" : "wrong"); notify(correct ? "Correct answer" : "Try another answer", correct ? "correct" : "wrong"); };
  const raiseBid = () => { const nextBid = bid + 100; setBid(nextBid); setFeedback("correct"); notify(`Bid confirmed · ¥${nextBid.toLocaleString()} · Mock balance ¥8,620`, "coin"); };
  const chooseAndGo = (choice: string, next: ScreenId) => {
    setSelectedChoice(choice); play("correct");
    window.setTimeout(() => go(next), 620);
  };
  const workScreens: ScreenId[] = ["A-07", "A-08", "A-09", "B-D-01"];
  const craftStage: CraftStage | null = screen === "A-07" ? "shaping" : screen === "A-08" ? "carving" : screen === "A-09" ? "glazing" : null;
  const activeCraftTool = craftStage === "carving" ? 0 : craftStage === "glazing" ? 1 : selectedCraftTool;

  return <MobileScroll className="app-screen ceramic-scroll"><main className="game-shell" onPointerDown={() => ensureAudio()}>
    <audio ref={musicRef} className="game-bgm" src="/assets/ceramic/intro/moonlit-shadows-audio.mp4" preload="auto" loop playsInline />
    <section className={`game-stage screen-${screen.toLowerCase()} ${transitioning ? "is-leaving" : "is-entering"} ${feedback}`} key={screen}>
      <img className={`screen-art${screen === "AUTH-01" ? " start-background" : ""}`} src={screen === "AUTH-01" ? "/assets/ceramic/start-bg.png" : craftStage ? `${ASSET_ROOT}/A-07.png` : `${ASSET_ROOT}/${screen}.png`} alt={`${screen} game screen`} draggable={false} />
      {screen !== "AUTH-01" && <div className="scene-atmosphere" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6, 7].map(item => <i key={item} />)}</div>}
      {screen === "A-09" && <div className="glaze-reveal" style={{ opacity: Math.min(1, Math.max(.18, workProgress / 92)) }} aria-hidden="true" />}
      {screen === "A-11" && <div className="completion-sheen" aria-hidden="true" />}

      {screen === "AUTH-01" && <>
        <div className="start-mark" aria-hidden="true">
          <img className="start-ring" src="/assets/ceramic/intro/brush-ring.png" alt="" />
          <img className="start-char start-char-one" src="/assets/ceramic/intro/ci.png" alt="" />
          <img className="start-char start-char-two" src="/assets/ceramic/intro/yi.png" alt="" />
          <img className="start-char start-char-three" src="/assets/ceramic/intro/fang.png" alt="" />
          <img className="start-vase" src="/assets/ceramic/intro/vase.png" alt="" />
          <img className="start-seal" src="/assets/ceramic/intro/seal.png" alt="" />
        </div>
        <div className="start-breeze" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map(item => <i key={item} />)}</div>
        <nav className="start-side-menu" aria-label="Quick links">
          <span>⇩<small>Resources</small></span><span>▣<small>Notices</small></span><span>●<small>Profile</small></span>
        </nav>
        <div className="start-age"><b>8+</b><small>Age Notice</small></div>
        <span className="start-enter-tip">Tap to Enter</span>
        <Hotspot label="Enter the Porcelain Art Workshop" box={[250, 45, 330, 290]} onClick={() => go("AUTH-03")} />
      </>}
      {screen === "AUTH-03" && <><Hotspot label="WeChat Login" box={[412, 180, 170, 42]} onClick={() => go("AUTH-04")} /><Hotspot label="QQ Login" box={[412, 229, 170, 42]} onClick={() => go("AUTH-04")} /><Hotspot label="Phone Login" box={[412, 278, 170, 42]} onClick={() => go("AUTH-02")} /><Hotspot label="Back" box={[10, 10, 55, 48]} onClick={back} /></>}
      {screen === "AUTH-02" && <><div className="registration-fields" style={rect(150, 132, 274, 122)}><KeyboardInput value={phone} onChange={event => setPhone(event.target.value)} inputMode="tel" aria-label="Phone number" /><KeyboardInput value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" aria-label="Verification code" /><KeyboardInput value={password} onChange={event => setPassword(event.target.value)} type="password" aria-label="Password" /></div><Hotspot label="Register" box={[212, 263, 155, 38]} onClick={register} /><Hotspot label="WeChat Registration" box={[495, 145, 175, 42]} onClick={() => go("AUTH-04")} /><Hotspot label="QQ Registration" box={[495, 211, 175, 42]} onClick={() => go("AUTH-04")} /><Hotspot label="Back" box={[10, 10, 55, 48]} onClick={back} /></>}
      {screen === "AUTH-04" && <div className="guide-loader"><span /></div>}

      {screen === "HOME-01" && <><Hotspot choice selected={selectedChoice === "home-craft"} label="White Porcelain Crafting" box={[142, 60, 224, 294]} onClick={() => chooseAndGo("home-craft", "A-01")} /><Hotspot choice selected={selectedChoice === "home-workshop"} label="Creative Workshop" box={[385, 63, 313, 140]} onClick={() => chooseAndGo("home-workshop", "B-01")} /><Hotspot choice selected={selectedChoice === "home-collection"} label="Collection" box={[385, 210, 151, 145]} onClick={() => chooseAndGo("home-collection", "PROFILE-01")} /><Hotspot choice selected={selectedChoice === "home-auction"} label="Auction House" box={[541, 210, 157, 145]} onClick={() => chooseAndGo("home-auction", "C-A-01")} /><Hotspot label="Shop" box={[12, 88, 86, 65]} onClick={() => go("C-S-01")} /><Hotspot label="Introduction" box={[748, 73, 57, 64]} onClick={() => go("A-05")} /><Hotspot label="Profile" box={[748, 145, 57, 64]} onClick={() => go("PROFILE-01")} /><Hotspot label="Settings" box={[748, 217, 57, 64]} onClick={() => go("SETTINGS-01")} /></>}

      {screen === "A-01" && <><div className="dynasty-choice-reset" aria-hidden="true" />{[24, 212, 400, 588].map((x, index) => <Hotspot art="A-01" choice selected={selectedChoice === `dynasty-${index}`} key={x} label={["Tang Dynasty", "Song Dynasty", "Yuan Dynasty", "Ming and Qing Dynasties"][index]} box={[x, 84, 170, 228]} sourceBox={index === 3 ? [584, 67, 200, 265] : [x, 84, 170, 228]} onClick={() => chooseAndGo(`dynasty-${index}`, "A-02")} />)}<Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-02" && <>{[15, 194, 371, 550].map((x, index) => <Hotspot art="A-02" choice selected={selectedChoice === `porcelain-${index}`} key={x} label={`Select porcelain ${index + 1}`} box={[x, 79, 166, 228]} onClick={() => chooseAndGo(`porcelain-${index}`, "A-03")} />)}<Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-03" && <><div className="puzzle-vase-light" aria-hidden="true" /><div className="puzzle-piece-stage" aria-hidden="true"><i className="puzzle-piece piece-one" style={{ ...rect(457, 157, 70, 42), ...artCrop("A-03", [457, 157, 70, 42]) }} /><i className="puzzle-piece piece-two" style={{ ...rect(457, 232, 80, 20), ...artCrop("A-03", [457, 232, 80, 20]) }} /><i className="puzzle-piece piece-three" style={{ ...rect(592, 211, 38, 60), ...artCrop("A-03", [592, 211, 38, 60]) }} /></div><Hotspot art="A-03" choice label="Introduction" box={[420, 294, 108, 39]} onClick={() => notify("Discover the story of this porcelain", "click")} /><Hotspot art="A-03" choice selected={selectedChoice === "puzzle-start"} label="Start making" box={[577, 294, 103, 39]} onClick={() => { setSelectedChoice("puzzle-start"); setFeedback("correct"); notify("Puzzle complete", "correct"); window.setTimeout(() => go("A-04"), 650); }} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-04" && <><Hotspot label="Enter the required artifact introduction" box={[285, 120, 250, 180]} onClick={() => go("A-05")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-05" && <><Hotspot label="Continue to material selection" box={[0, 0, 812, 375]} onClick={() => go("A-06")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-06" && <>{[102, 200, 303, 412, 520, 627].map((x, index) => <button key={`material-${index}`} aria-label={`Select material ${index + 1}`} aria-pressed={selectedMaterials.includes(index)} className={`material-pick ${selectedMaterials.includes(index) ? "selected" : ""}`} style={rect(x, 59, 77, 69)} onClick={() => { play("click"); setSelectedMaterials(items => items.includes(index) ? items.filter(item => item !== index) : [...items, index]); }} />)}{[89, 171, 254, 337, 420, 503, 585, 668].map((x, index) => <button key={`tool-${index}`} aria-label={`Select tool ${index + 1}`} aria-pressed={selectedTools.includes(index)} className={`material-pick tool-pick ${selectedTools.includes(index) ? "selected" : ""}`} style={rect(x, 200, 61, 77)} onClick={() => { play("click"); setSelectedTools(items => items.includes(index) ? items.filter(item => item !== index) : [...items, index]); }} />)}<Hotspot label="Next step" box={[668, 315, 125, 45]} onClick={() => selectedMaterials.length && selectedTools.length ? go("A-07") : notify("Select at least one material and one tool", "wrong")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}

      {workScreens.includes(screen) && <>
        {craftStage && <>
          <CeramicModel3D tool={activeCraftTool} angle={modelAngle} progress={workProgress} onCraft={amount => { if (craftStage === "shaping") setWorkProgress(value => Math.min(100, value + amount)); }} onAngle={value => { setModelAngle(value); modelAngleRef.current = value; }} onFirstDrag={() => setHasRotated(true)} />
          <div className={`model-tool-effect tool-mode-${activeCraftTool}`} aria-hidden="true" />
          {!hasRotated && <div className="rotation-coach" aria-hidden="true"><span>↔</span> Drag to rotate</div>}
          <div className="craft-tool-reset" aria-hidden="true" />
          {(["Carving Tool", "Spray Gun", "Pottery Wheel", "Shaping Tool", "Polishing Tool", "Glazing Tool"] as const).map((name, index) => {
            const x = [198, 276, 355, 430, 509, 590][index];
            return <button key={name} data-tool-name={name} className={`craft-tool-choice${activeCraftTool === index ? " selected" : " inactive"}`} style={{ ...rect(x, 16, 56, 50), ...artCrop("A-07", [x, 16, 56, 50]) }} aria-label={name} aria-pressed={activeCraftTool === index} onClick={() => { if (craftStage === "shaping") setSelectedCraftTool(index); notify(craftStage === "shaping" ? `${name} ready` : `${craftStage === "carving" ? "Carving Tool" : "Spray Gun"} is required for this stage`, "click"); }} />;
          })}
          <CraftInteractionLayer stage={craftStage} point={dragPoint} active={dragging} progress={workProgress} onStart={beginWork} onMove={dragWork} onEnd={endWork} />
        </>}
        {screen === "B-D-01" && <div className={`work-surface${dragging ? " is-dragging" : ""}`} style={rect(215, 54, 420, 274)} onPointerMove={dragWork} onPointerDown={beginWork} onPointerUp={endWork} onPointerCancel={endWork} aria-label="Drag the tool across the porcelain">{dragPoint && <span className="drag-tool" style={{ left: `${dragPoint.x}%`, top: `${dragPoint.y}%` }} />}</div>}
        {feedback === "correct" && <><div className="craft-success" aria-hidden="true">{[0, 1, 2, 3, 4].map(item => <i key={item} />)}</div><div className="step-complete" role="status">Step Complete</div></>}
        <div className="work-progress" aria-label={`Progress ${Math.round(workProgress)} percent`}><span style={{ width: `${workProgress}%` }} /></div>
        <Hotspot art={screen} sourceBox={[687, 318, 112, 44]} dimmed={workProgress < (screen === "A-07" ? 64 : 20)} label={screen === "B-D-01" ? "Publish to shop" : "Next step"} box={[687, 318, 112, 44]} onClick={() => { if (workProgress < (screen === "A-07" ? 64 : 20)) return notify("Complete the current craft step first", "wrong"); go(screen === "A-07" ? "A-08" : screen === "A-08" ? "A-09" : screen === "A-09" ? "A-10" : "C-S-01"); }} />
        <Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} />
      </>}
      {screen === "A-10" && <><div className="kiln-progress"><span /></div><Hotspot label={kilnReady ? "View the finished piece" : "Firing in progress"} box={[658, 309, 137, 49]} onClick={() => kilnReady ? go("A-11") : notify("The kiln is still firing")} disabled={!kilnReady} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-11" && <><Hotspot label="Complete crafting" box={[686, 316, 112, 44]} onClick={() => { play("success"); go("A-12"); }} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-12" && <><div className="celebration" aria-hidden="true">✦ <i>✦</i> <b>✦</b></div><Hotspot label="Return Home" box={[350, 283, 112, 45]} onClick={() => { setHistory(["HOME-01"]); play("click"); }} /></>}

      {screen === "B-01" && <><Hotspot choice selected={selectedChoice === "workshop-quiz"} label="Knowledge Quiz" box={[21, 75, 238, 260]} onClick={() => chooseAndGo("workshop-quiz", "B-Q-01")} /><Hotspot choice selected={selectedChoice === "workshop-diy"} label="DIY Crafting" box={[286, 75, 238, 260]} onClick={() => chooseAndGo("workshop-diy", "B-D-01")} /><Hotspot choice selected={selectedChoice === "workshop-pk"} label="Pottery PK" box={[552, 75, 238, 260]} onClick={() => chooseAndGo("workshop-pk", "B-P-01")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "B-Q-01" && <><Hotspot label="Answer A" box={[462, 183, 138, 35]} onClick={() => selectAnswer(false)} /><Hotspot label="Answer B" box={[616, 183, 138, 35]} onClick={() => selectAnswer(true)} /><Hotspot label="Answer C" box={[462, 231, 138, 35]} onClick={() => selectAnswer(false)} /><Hotspot label="Answer D" box={[616, 231, 138, 35]} onClick={() => selectAnswer(false)} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "B-P-01" && <><Hotspot label="Start pottery challenge" box={[300, 120, 210, 155]} onClick={() => { setFeedback("correct"); notify("Challenge complete · Victory", "success"); }} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}

      {screen === "C-S-01" && <><Hotspot label="Open Auction House" box={[92, 42, 620, 290]} onClick={() => go("C-A-01")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "C-A-01" && <><Hotspot label="View auction item" box={[82, 75, 650, 245]} onClick={() => go("C-A-02")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "C-A-02" && <><Hotspot label="Raise bid" box={[642, 276, 122, 48]} onClick={raiseBid} /><div className="bid-status">Current mock bid: ¥{bid.toLocaleString()}</div><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}

      {screen === "PROFILE-01" && <><Hotspot label="Settings" box={[690, 317, 105, 43]} onClick={() => go("SETTINGS-01")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "SETTINGS-01" && <><Hotspot label="Basic Settings" box={[20, 112, 102, 50]} onClick={() => go("SETTINGS-02")} /><Hotspot label={soundOn ? "Mute sound" : "Enable sound"} box={[267, 128, 398, 104]} onClick={() => { setSoundOn(value => !value); setToast(soundOn ? "Sound muted" : "Sound enabled"); }} /><button className={`sound-switch ${soundOn ? "on" : ""}`} style={rect(682, 317, 104, 38)} onClick={() => { setSoundOn(value => !value); setToast(soundOn ? "Sound muted" : "Sound enabled"); }}>{soundOn ? "Sound On" : "Sound Off"}</button><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "SETTINGS-02" && <><Hotspot label="Sound Settings" box={[20, 63, 102, 50]} onClick={() => go("SETTINGS-01")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {toast && <div className="game-toast" role="status">{toast}</div>}
    </section>
  </main></MobileScroll>;
}
