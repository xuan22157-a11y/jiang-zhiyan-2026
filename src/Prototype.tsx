import { CSSProperties, PointerEvent, WheelEvent, useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KeyboardInput, MobileScroll, useKeyboard } from "./mobile";
import "./prototype.css";

type ScreenId =
  | "AUTH-01" | "AUTH-02" | "AUTH-03" | "AUTH-04" | "HOME-01"
  | "A-01" | "A-02" | "A-03" | "A-04" | "A-05" | "A-06"
  | "A-07" | "A-08" | "A-09" | "A-10" | "A-11" | "A-12"
  | "B-01" | "B-Q-01" | "B-D-INTRO" | "B-D-01" | "B-P-01"
  | "C-S-01" | "C-A-01" | "C-A-02"
  | "PROFILE-01" | "SETTINGS-01" | "SETTINGS-02";

type SoundKind = "click" | "correct" | "wrong" | "coin" | "work" | "success";
type TransitionKind = "focus" | "scene" | "map" | "clay" | "mist" | "fire" | "ceremony" | "dialogue" | "pk";
const ASSET_ROOT = "/assets/ceramic/screens";
const DESIGN_W = 812;
const DESIGN_H = 375;
const KILN_FIRE_FRAMES = Array.from({ length: 8 }, (_, index) => `/assets/ceramic/kiln-fire/fire-${String(index + 1).padStart(2, "0")}.png`);

function transitionFor(from: ScreenId, to: ScreenId): { kind: TransitionKind; duration: number } {
  if (from === "B-D-INTRO" && to === "B-D-01") return { kind: "dialogue", duration: 1180 };
  if (to === "B-P-01") return { kind: "pk", duration: 240 };
  if (from === "AUTH-01") return { kind: "scene", duration: 1180 };
  if (to === "A-04" || from === "A-04") return { kind: "map", duration: 1450 };
  if (from === "A-07" && to === "A-08") return { kind: "clay", duration: 820 };
  if (from === "A-08" && to === "A-09") return { kind: "mist", duration: 900 };
  if (from === "A-09" && to === "A-10") return { kind: "fire", duration: 1320 };
  if (to === "A-12") return { kind: "ceremony", duration: 1550 };
  if ((from === "HOME-01" && to.startsWith("A-")) || to === "A-07") return { kind: "scene", duration: 960 };
  return { kind: "focus", duration: 480 };
}

function StageTitle({ title, subtitle, mode }: { title: string; subtitle?: string; mode: "character" | "mist" | "line" }) {
  return <header className={`stage-copy stage-copy-${mode}`} aria-label={subtitle ? `${title}. ${subtitle}` : title}>
    <div className="stage-title-mask"><strong>{Array.from(title).map((character, index) => <span key={`${character}-${index}`} style={{ "--letter-index": index } as CSSProperties}>{character === " " ? "\u00a0" : character}</span>)}</strong></div>
    {subtitle && <small>{subtitle}</small>}
  </header>;
}

function KilnFireSequence({ completing }: { completing: boolean }) {
  const [frame, setFrame] = useState(0);
  const [previous, setPrevious] = useState(7);
  const step = useRef(0);

  useEffect(() => {
    KILN_FIRE_FRAMES.forEach(src => { const image = new Image(); image.src = src; });
    let timer = 0;
    const sequenceA = [0, 1, 2, 3, 4, 5, 6, 7];
    const sequenceB = [0, 1, 2, 4, 3, 5, 6, 7];
    const advance = () => {
      const sequence = Math.floor(step.current / 8) % 2 ? sequenceB : sequenceA;
      const next = sequence[(step.current + 1) % sequence.length];
      setFrame(current => { setPrevious(current); return next; });
      step.current += 1;
      timer = window.setTimeout(advance, 155 + (step.current % 4) * 13);
    };
    timer = window.setTimeout(advance, 170);
    return () => window.clearTimeout(timer);
  }, []);

  return <div className={`kiln-fire-sequence${completing ? " is-bright" : ""}`}>
    <img key={`previous-${previous}`} className="kiln-fire-frame is-previous" src={KILN_FIRE_FRAMES[previous]} alt="" draggable={false} />
    <img key={`current-${frame}`} className="kiln-fire-frame is-current" src={KILN_FIRE_FRAMES[frame]} alt="" draggable={false} />
  </div>;
}

function AuctionCollection({ onSelect }: { onSelect: () => void }) {
  const [offset, setOffset] = useState(0);
  const motion = useRef({ dragging: false, y: 0, time: 0, velocity: 0 });
  const moved = useRef(false);
  const frame = useRef<number | null>(null);
  const minOffset = -300;
  const constrain = (value: number) => value > 0 ? value * .24 : value < minOffset ? minOffset + (value - minOffset) * .24 : value;
  const settle = useCallback((velocity = motion.current.velocity) => {
    if (frame.current) window.cancelAnimationFrame(frame.current);
    const tick = () => {
      setOffset(current => {
        let next = current + velocity;
        velocity *= .91;
        if (next > 0) { velocity += (0 - next) * .075; next *= .94; }
        if (next < minOffset) { velocity += (minOffset - next) * .075; next = minOffset + (next - minOffset) * .94; }
        if (Math.abs(velocity) < .08 && next <= .3 && next >= minOffset - .3) { frame.current = null; return Math.max(minOffset, Math.min(0, next)); }
        frame.current = window.requestAnimationFrame(tick);
        return next;
      });
    };
    frame.current = window.requestAnimationFrame(tick);
  }, []);
  useEffect(() => () => { if (frame.current) window.cancelAnimationFrame(frame.current); }, []);
  const sourceCards = Array.from({ length: 8 }, (_, index) => {
    const column = index % 4; const row = Math.floor(index / 4);
    return [92 + column * 104, 16 + row * 135, 85, 119] as [number, number, number, number];
  });
  return <div className="auction-collection-viewport" onWheel={(event: WheelEvent<HTMLDivElement>) => { event.preventDefault(); setOffset(value => constrain(value - event.deltaY * .42)); settle(-event.deltaY * .065); }} onPointerDown={(event) => { if (frame.current) window.cancelAnimationFrame(frame.current); moved.current = false; motion.current = { dragging: true, y: event.clientY, time: performance.now(), velocity: 0 }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!motion.current.dragging) return; const now = performance.now(); const delta = event.clientY - motion.current.y; const elapsed = Math.max(8, now - motion.current.time); if (Math.abs(delta) > 2) moved.current = true; motion.current.velocity = delta / elapsed * 14; motion.current.y = event.clientY; motion.current.time = now; setOffset(value => constrain(value + delta)); }} onPointerUp={(event) => { motion.current.dragging = false; event.currentTarget.releasePointerCapture(event.pointerId); settle(); }} onPointerCancel={() => { motion.current.dragging = false; settle(); }}>
    <div className="auction-card-grid" style={{ transform: `translateY(${offset}px)` }}>
      {Array.from({ length: 20 }, (_, index) => <button key={index} className="auction-ceramic-card" style={{ ...artCrop("C-A-01", sourceCards[index % sourceCards.length]), animationDelay: `${180 + index * 92}ms` } as CSSProperties} aria-label={`Porcelain lot ${index + 1}`} onClick={() => { if (!moved.current) onSelect(); }} />)}
    </div>
  </div>;
}

const nextAssets: Partial<Record<ScreenId, ScreenId[]>> = {
  "AUTH-01": ["AUTH-03"], "AUTH-03": ["AUTH-02", "AUTH-04"], "AUTH-02": ["AUTH-04"],
  "AUTH-04": ["HOME-01"], "HOME-01": ["A-01", "B-01", "C-S-01"],
  "A-01": ["A-02"], "A-02": ["A-03"], "A-03": ["A-04"], "A-04": ["A-05"],
  "A-05": ["A-06"], "A-06": ["A-07"], "A-07": ["A-08"], "A-08": ["A-09"],
  "A-09": ["A-10"], "A-10": ["A-11"], "A-11": ["C-S-01"], "A-12": ["HOME-01"],
  "B-01": ["B-Q-01", "B-D-INTRO", "B-P-01"], "B-D-INTRO": ["B-D-01"], "B-D-01": ["B-01"],
  "C-S-01": ["C-A-01"], "C-A-01": ["C-A-02"], "C-A-02": ["A-12"], "PROFILE-01": ["SETTINGS-01"],
  "SETTINGS-01": ["SETTINGS-02"], "SETTINGS-02": ["SETTINGS-01"],
};

const artifactIntroductions = [
  { title: "Sweet White Glaze Vase", lines: ["A refined Ming porcelain form known for its gentle ivory glaze.", "Its quiet silhouette and softened highlights express the restraint of Dehua craftsmanship.", "The balanced neck and rounded body reveal the potter's precise control of proportion."] },
  { title: "White-Glazed Meiping Vase", lines: ["The elegant meiping profile was designed to hold a single flowering branch.", "A narrow mouth, full shoulder and tapered foot create a calm, continuous rhythm.", "Its translucent white glaze gives the porcelain a warm and tactile depth."] },
  { title: "Dehua Kiln White-Glazed Seated Guanyin Statue", lines: ["Originating in Dehua, Fujian during the Ming Dynasty, this white-glazed Guanyin statue is renowned for its pure, jade-like porcelain and smooth, lustrous glaze.", "Its serene expression and graceful form reflect the exceptional craftsmanship of Dehua porcelain sculpture.", "Blending artistic beauty with Buddhist symbolism, Dehua Guanyin statues remain treasured masterpieces of traditional Chinese ceramic art."] },
  { title: "White-Glazed Ritual Vessel", lines: ["This sculptural vessel combines a ceremonial profile with delicately modelled relief.", "Soft glaze gathers in the recesses, revealing its carved details without harsh contrast.", "The work reflects the dialogue between ritual form and refined porcelain technique."] },
  { title: "Dehua Miniature Bottle", lines: ["A compact bottle distilled into a clear and harmonious silhouette.", "Its luminous white surface responds gently to changing light.", "Small scale and disciplined proportions make the piece feel intimate and precious."] },
];

function rect(x: number, y: number, width: number, height: number): CSSProperties {
  return { left: `${x / DESIGN_W * 100}%`, top: `${y / DESIGN_H * 100}%`, width: `${width / DESIGN_W * 100}%`, height: `${height / DESIGN_H * 100}%` };
}

function artCrop(art: ScreenId, box: [number, number, number, number]): CSSProperties {
  const [x, y, width, height] = box;
  return { backgroundImage: `url(${ASSET_ROOT}/${art}.png)`, backgroundSize: `${DESIGN_W / width * 100}% ${DESIGN_H / height * 100}%`, backgroundPosition: `${x / (DESIGN_W - width) * 100}% ${y / (DESIGN_H - height) * 100}%` };
}

function imageCrop(url: string, box: [number, number, number, number]): CSSProperties {
  const [x, y, width, height] = box;
  return { ...rect(x, y, width, height), backgroundImage: `url(${url})`, backgroundSize: `${DESIGN_W / width * 100}% ${DESIGN_H / height * 100}%`, backgroundPosition: `${x / (DESIGN_W - width) * 100}% ${y / (DESIGN_H - height) * 100}%` };
}

interface HotspotProps { label: string; box: [number, number, number, number]; sourceBox?: [number, number, number, number]; onClick: () => void; disabled?: boolean; choice?: boolean; selected?: boolean; dimmed?: boolean; art?: ScreenId; }
function Hotspot({ label, box, sourceBox, onClick, disabled = false, choice = false, selected = false, dimmed = false, art }: HotspotProps) {
  const [x, y, width, height] = box;
  const [sourceX, sourceY, sourceWidth, sourceHeight] = sourceBox ?? box;
  const choiceArt = art ?? (label.includes("Dynasty") ? "A-01" : label.startsWith("Select porcelain") ? "A-02" : label === "Next step" && x === 668 ? "A-06" : ["Knowledge Quiz", "DIY Crafting", "Pottery PK"].includes(label) ? "B-01" : ["White Porcelain Crafting", "Creative Workshop", "Collection", "Auction House"].includes(label) ? "HOME-01" : undefined);
  const visualStyle = choiceArt ? artCrop(choiceArt, [sourceX, sourceY, sourceWidth, sourceHeight]) : undefined;
  const homeChoice = choiceArt === "HOME-01";
  const homeChoiceAsset = homeChoice ? {
    "White Porcelain Crafting": "/assets/ceramic/home-options/white-porcelain-crafting.png",
    "Creative Workshop": "/assets/ceramic/home-options/creative-workshop.png",
    "Collection": "/assets/ceramic/home-options/collection.png",
    "Auction House": "/assets/ceramic/home-options/auction-house.png",
  }[label] : undefined;
  const workshopChoiceAsset = choiceArt === "B-01" ? {
    "Knowledge Quiz": "/assets/ceramic/workshop-options/knowledge-quiz.png",
    "DIY Crafting": "/assets/ceramic/workshop-options/diy-studio.png",
    "Pottery PK": "/assets/ceramic/workshop-options/pottery-challenge.png",
  }[label] : undefined;
  const homeChoiceClass = homeChoice ? ` home-choice-${label.toLowerCase().replaceAll(" ", "-")}` : "";
  const workshopChoiceClass = workshopChoiceAsset ? ` workshop-choice-${label.toLowerCase().replaceAll(" ", "-")}` : "";
  return <button className={`game-hotspot${choice ? " is-choice" : ""}${selected ? " is-selected" : ""}${choiceArt ? " has-choice-art" : ""}${homeChoice ? " is-home-choice" : ""}${workshopChoiceAsset ? " is-workshop-choice" : ""}${homeChoiceClass}${workshopChoiceClass}${label === "Next step" ? " is-next" : ""}${dimmed ? " is-dimmed" : ""}`} style={rect(...box)} aria-label={label} title={label} aria-pressed={choice ? selected : undefined} onClick={onClick} disabled={disabled}>{choiceArt && !homeChoice && !workshopChoiceAsset && <i className="choice-art" style={visualStyle} />}{homeChoiceAsset ? <><i className="home-choice-glass" aria-hidden="true" /><img className="home-choice-image" src={homeChoiceAsset} alt="" draggable={false} /></> : workshopChoiceAsset ? <><i className="workshop-choice-glass" aria-hidden="true" /><img className="workshop-choice-image" src={workshopChoiceAsset} alt="" draggable={false} /></> : !choiceArt && <span>{label}</span>}</button>;
}

const MERCHANT_DIALOGUE = "Your white porcelain has caught my attention. The craftsmanship and finish are quite impressive, and I’d like to place an order for ¥150. Please review the order details below and confirm if you’re ready to accept my offer.";

function TypewriterAudio({ enabled, delayMs, durationMs }: { enabled: boolean; delayMs: number; durationMs: number }) {
  useEffect(() => {
    if (!enabled) return;
    const audio = new Audio("/assets/ceramic/audio/typewriter.mp3");
    audio.preload = "auto";
    audio.loop = true;
    audio.volume = .34;
    const startTimer = window.setTimeout(() => {
      audio.currentTime = 0;
      void audio.play().catch(() => {});
    }, delayMs);
    const stopTimer = window.setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, delayMs + durationMs);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(stopTimer);
      audio.pause();
      audio.src = "";
    };
  }, [delayMs, durationMs, enabled]);
  return null;
}

function PotteryPkIntro() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startedAt - 2300;
      const next = elapsed <= 0 ? 0 : Math.min(95, elapsed / 1200 * 95);
      setProgress(next);
      if (next < 95) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return <div className="pk-intro-stage" aria-label={`Pottery comparison progress ${Math.round(progress)} percent`}>
    <img className="pk-background" src="/assets/ceramic/pk/background.png" alt="" draggable={false} />
    <div className="pk-light-spread" aria-hidden="true" />
    <div className="pk-dust" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <i key={index} />)}</div>
    <div className="pk-portrait pk-portrait-left"><img src="/assets/ceramic/pk/left-portrait.png" alt="Porcelain maker" draggable={false} /></div>
    <div className="pk-left-title" aria-label="A Porcelain Maker in the Ming and Qing Dynasties"><span>A Porcelain Maker in the</span><span>Ming &amp; Qing Dynasties</span></div>
    <div className="pk-right-title">Porcelain Artisan</div>
    <div className="pk-portrait pk-portrait-right"><img src="/assets/ceramic/pk/right-portrait.png" alt="Porcelain artisan" draggable={false} /></div>
    <div className="pk-vs" aria-label="versus"><span>V</span><span>S</span><i /></div>
    <div className="pk-progress" style={{ "--pk-progress": `${progress}%` } as CSSProperties}>
      <div className="pk-progress-track"><span /></div>
      <img className="pk-progress-vase" src="/assets/ceramic/pk/progress-vase.png?v=2" alt="" draggable={false} />
      <output className={progress >= 78 ? "is-visible" : ""}>{Math.round(progress)}%</output>
    </div>
  </div>;
}

function MerchantDialogueIntro({ onContinue, soundEnabled }: { onContinue: () => void; soundEnabled: boolean }) {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    let index = 0;
    let interval = 0;
    const delay = window.setTimeout(() => {
      interval = window.setInterval(() => {
        index += 1;
        setVisibleText(MERCHANT_DIALOGUE.slice(0, index));
        if (index >= MERCHANT_DIALOGUE.length) window.clearInterval(interval);
      }, 20);
    }, 1320);
    return () => { window.clearTimeout(delay); window.clearInterval(interval); };
  }, []);

  const complete = visibleText.length === MERCHANT_DIALOGUE.length;
  return <div className="merchant-dialogue-intro">
    <TypewriterAudio enabled={soundEnabled} delayMs={1320} durationMs={MERCHANT_DIALOGUE.length * 20 + 100} />
    <div className="merchant-dialogue-dim" aria-hidden="true" />
    <img className="merchant-dialogue-character" src="/assets/ceramic/dialogue/merchant-figma.png" alt="Mysterious customer" draggable={false} />
    <section className="merchant-dialogue-copy" aria-live="polite">
      <img className="merchant-dialogue-bubble" src="/assets/ceramic/dialogue/dialogue-card-figma.svg" alt="" draggable={false} />
      <span className="merchant-dialogue-header-glow" aria-hidden="true" />
      <span className="merchant-dialogue-inner-frame" aria-hidden="true" />
      <strong>Mysterious Customer：</strong>
      <p>{visibleText}<i aria-hidden="true" /></p>
      <button className={`merchant-dialogue-continue${complete ? " is-ready" : ""}`} onClick={onContinue} disabled={!complete}>Continue</button>
    </section>
  </div>;
}

declare global { interface Window { webkitAudioContext: typeof AudioContext; } }

interface CeramicModel3DProps {
  tool: number;
  angle: number;
  progress: number;
  onCraft: (amount: number) => void;
  onAngle: (angle: number) => void;
  onFirstDrag: () => void;
  onRotationSound: (active: boolean, speed?: number) => void;
}

function CeramicModel3D({ tool, angle, progress, onCraft, onAngle, onFirstDrag, onRotationSound }: CeramicModel3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const gesture = useRef({ dragging: false, x: 0, time: 0, velocity: 0, angle: THREE.MathUtils.degToRad(angle) });
  const callbacksRef = useRef({ onCraft, onAngle, onFirstDrag, onRotationSound });
  callbacksRef.current = { onCraft, onAngle, onFirstDrag, onRotationSound };

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
    let rotationAudioActive = false;
    const render = () => {
      const state = gesture.current;
      if (!state.dragging && Math.abs(state.velocity) > .00015) {
        state.angle += state.velocity;
        state.velocity *= .91;
        callbacksRef.current.onAngle(THREE.MathUtils.radToDeg(state.angle));
      }
      const rotating = Math.abs(state.velocity) > .0008;
      if (rotating !== rotationAudioActive) {
        rotationAudioActive = rotating;
        callbacksRef.current.onRotationSound(rotating, Math.min(1, Math.abs(state.velocity) * 12));
      }
      root.rotation.y = state.angle;
      key.position.x = -2.7 + Math.sin(state.angle) * .45;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    };
    render();
    return () => {
      callbacksRef.current.onRotationSound(false);
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
    callbacksRef.current.onRotationSound(true, Math.min(1, Math.abs(dx) / Math.max(1, dt) * 2.4));
    callbacksRef.current.onAngle(THREE.MathUtils.radToDeg(gesture.current.angle)); callbacksRef.current.onCraft(Math.abs(dx) * .075);
  };
  const pointerUp = () => { gesture.current.dragging = false; if (Math.abs(gesture.current.velocity) < .0008) callbacksRef.current.onRotationSound(false); };

  return <div ref={mountRef} className="ceramic-model-3d" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} />;
}

type CraftStage = "shaping" | "carving" | "glazing";

function CraftToolModel3D({ stage }: { stage: Exclude<CraftStage, "shaping"> }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, .01, 20);
    camera.position.set(0, .08, 4.1);
    scene.add(new THREE.HemisphereLight(0xffefd6, 0x3b3028, 2.2));
    const key = new THREE.DirectionalLight(0xffddb0, 3.4); key.position.set(-2, 3, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xdde7ec, 1.4); rim.position.set(3, 1, -2); scene.add(rim);
    const root = new THREE.Group(); scene.add(root);
    const attach = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 2.7 / Math.max(size.x, size.y, size.z, .001);
      object.scale.setScalar(scale);
      object.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      object.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach(material => { if (material instanceof THREE.MeshStandardMaterial) { material.roughness = stage === "glazing" ? .28 : .42; material.envMapIntensity = .75; } });
      });
      root.add(object);
    };
    const loader = new GLTFLoader();
    const original = stage === "glazing" ? "/assets/ceramic/models/spray-hand.glb" : "/assets/ceramic/models/carving-hand.glb";
    const fallback = stage === "glazing" ? "/assets/ceramic/models/spray-hand-runtime.glb" : "/assets/ceramic/models/carving-hand-runtime.glb";
    loader.load(original, result => attach(result.scene), undefined, () => loader.load(fallback, result => attach(result.scene)));
    const resize = () => { const { width, height } = mount.getBoundingClientRect(); renderer.setSize(Math.max(1, width), Math.max(1, height), false); camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(mount); resize();
    let frame = 0; const render = () => { renderer.render(scene, camera); frame = requestAnimationFrame(render); }; render();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); scene.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } }); renderer.dispose(); renderer.domElement.remove(); };
  }, [stage]);
  return <div ref={mountRef} className="tool-model-3d" aria-hidden="true" />;
}

type InteractionMark = { x: number; y: number; strength: number; speed?: number; length?: number; angle?: number };
type MistParticle = { id: number; x: number; y: number; dx: number; dy: number; size: number; opacity: number; duration: number };

function GlazeCoverageField({ marks, progress }: { marks: InteractionMark[]; progress: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.globalCompositeOperation = "source-over";
    marks.forEach((mark, index) => {
      const x = mark.x / 100 * canvas.width;
      const y = mark.y / 100 * canvas.height;
      const radius = 38 + (index % 5) * 3;
      context.save();
      context.translate(x, y);
      context.scale(1, .72 + (index % 3) * .05);
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, `rgba(255,253,246,${.026 + mark.strength * .018})`);
      gradient.addColorStop(.42, `rgba(249,247,240,${.018 + mark.strength * .012})`);
      gradient.addColorStop(.78, "rgba(245,243,236,.006)");
      gradient.addColorStop(1, "rgba(245,243,236,0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(0, 0, radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });
  }, [marks]);
  return <canvas ref={canvasRef} className="glaze-coverage-field" width={512} height={384} style={{ opacity: .45 + progress / 220 }} aria-hidden="true" />;
}

function CraftInteractionLayer({ stage, active, progress, onStart, onEnd, onApply, onWorkSound }: { stage: CraftStage; active: boolean; progress: number; onStart: (event: PointerEvent<HTMLDivElement>) => void; onEnd: () => void; onApply: (amount: number) => void; onWorkSound: (speed: number, contact?: boolean) => void; }) {
  const [toolPoint, setToolPoint] = useState({ x: -10, y: 62, tilt: -8 });
  const [marks, setMarks] = useState<InteractionMark[]>([]);
  const [mist, setMist] = useState<MistParticle[]>([]);
  const mistId = useRef(0);
  const toolPointRef = useRef(toolPoint);
  const target = useRef(toolPoint);
  const previous = useRef({ x: 0, y: 0, time: 0 });
  const previousContact = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let frame = 0;
    const follow = () => {
      setToolPoint(current => ({ x: current.x + (target.current.x - current.x) * (stage === "carving" ? .24 : .16), y: current.y + (target.current.y - current.y) * (stage === "carving" ? .24 : .16), tilt: current.tilt + (target.current.tilt - current.tilt) * .18 }));
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(frame);
  }, [stage]);
  useEffect(() => { toolPointRef.current = toolPoint; }, [toolPoint]);
  useEffect(() => {
    if (stage !== "glazing" || !active) return;
    const emit = () => {
      const origin = toolPointRef.current;
      const burst = Array.from({ length: 25 }, (_, index) => {
        const id = mistId.current++;
        const edge = (index - 12) / 12;
        return { id, x: origin.x, y: origin.y, dx: 108 + (id % 7) * 3.2, dy: edge * (24 + (id % 5) * 3.5) + ((id * 11) % 9 - 4), size: .72 + (id % 4) * .3, opacity: .42 + (id % 5) * .055, duration: 920 + (id % 7) * 58 };
      });
      setMist(current => [...current.slice(-500), ...burst]);
    };
    emit();
    const timer = window.setInterval(emit, 44);
    return () => window.clearInterval(timer);
  }, [active, stage]);
  if (stage === "shaping") return null;
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-6, Math.min(106, (event.clientX - bounds.left) / bounds.width * 100));
    const y = Math.max(3, Math.min(97, (event.clientY - bounds.top) / bounds.height * 100));
    const now = performance.now();
    const distance = previous.current.time ? Math.hypot(event.clientX - previous.current.x, event.clientY - previous.current.y) : 0;
    const elapsed = Math.max(12, now - previous.current.time);
    const speed = Math.min(1, distance / elapsed * 2.4);
    target.current = { x, y, tilt: stage === "carving" ? -10 + (x - 50) * .08 : -2 + (y - 50) * .035 };
    previous.current = { x: event.clientX, y: event.clientY, time: now };
    if (event.buttons !== 1) { previousContact.current = null; return; }
    event.currentTarget.setPointerCapture(event.pointerId);
    const contact = stage === "glazing" ? x > -6 && x < 45 && y > 11 && y < 93 : x > 21 && x < 79 && y > 11 && y < 93;
    if (!contact) { previousContact.current = null; return; }
    const tipX = stage === "carving" ? x + 2.7 : x + 40;
    const tipY = stage === "carving" ? y + 2.5 : y;
    const strength = stage === "glazing" ? Math.max(.28, 1 - Math.abs(x - 52) / 70) : .55 + speed * .18;
    const firstContact = stage === "carving" && !previousContact.current;
    if (stage === "carving") {
      const last = previousContact.current;
      if (!last) onWorkSound(0, true);
      if (last) {
        const dx = tipX - last.x;
        const dy = tipY - last.y;
        const angle = Math.atan2(dy * bounds.height, dx * bounds.width) * 180 / Math.PI;
        const length = Math.max(.8, Math.hypot(dx, dy * bounds.height / bounds.width));
        setMarks(current => [...current.slice(-72), { x: last.x, y: last.y, strength, speed, length, angle }]);
      }
      previousContact.current = { x: tipX, y: tipY };
    } else {
      setMarks(current => [...current.slice(-159), { x: tipX, y: tipY, strength, speed }]);
    }
    onApply(stage === "glazing" ? .84 - speed * .5 : .58 + speed * .5);
    if (!firstContact) onWorkSound(speed);
  };
  const start = (event: PointerEvent<HTMLDivElement>) => { previousContact.current = null; onStart(event); move(event); };
  const stop = () => { previousContact.current = null; onEnd(); };
  const distanceClass = Math.abs(toolPoint.x - 50) < 24 ? "optimal" : Math.abs(toolPoint.x - 50) < 39 ? "near" : "far";
  return <div className={`craft-interaction-layer ${stage} ${active ? "active" : "ready"} ${distanceClass}`} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} aria-label={stage === "carving" ? "Hold to Carve" : "Move to aim, then hold and drag to spray glaze"}>
    {stage === "carving" && <div className="carving-traces" aria-hidden="true">{marks.map((mark, index) => <i key={index} style={{ left: `${mark.x}%`, top: `${mark.y}%`, width: `${mark.length ?? 1}%`, opacity: mark.strength, transform: `rotate(${mark.angle ?? 0}deg)` }} />)}</div>}
    {stage === "glazing" && <GlazeCoverageField marks={marks} progress={progress} />}
    {stage === "glazing" && <div className="airborne-mist" aria-hidden="true">{mist.map(particle => <i key={particle.id} style={{ left: `${particle.x}%`, top: `${particle.y}%`, width: `${particle.size}px`, height: `${particle.size}px`, opacity: particle.opacity, "--mist-dx": `${particle.dx}px`, "--mist-dy": `${particle.dy}px`, "--mist-duration": `${particle.duration}ms` } as CSSProperties} />)}</div>}
    {active && <div className="craft-contact-particles" aria-hidden="true">{marks.slice(stage === "carving" ? -14 : -5).map((mark, index) => <i className={stage === "carving" && index % 9 === 2 && (mark.speed ?? 0) > .4 ? "chip" : ""} key={`${marks.length}-${index}`} style={{ left: `${mark.x}%`, top: `${mark.y}%`, animationDelay: `${index * 18}ms`, "--dust-drift": `${((index % 3) - 1) * (3 + (mark.speed ?? 0) * 4)}px`, "--dust-fall": `${13 + index % 4 * 4 + (mark.speed ?? 0) * 10}px`, "--dust-duration": `${520 + index % 4 * 85}ms` } as CSSProperties} />)}</div>}
    <div className={`craft-hand-tool ${stage}`} style={{ left: `${toolPoint.x}%`, top: `${toolPoint.y}%`, rotate: `${toolPoint.tilt}deg` }} aria-hidden="true"><img className="tool-model-2d" src={stage === "carving" ? "/assets/ceramic/models/carving-hand-reference.png" : "/assets/ceramic/models/spray-hand-reference.png"} alt="" draggable={false} /></div>
    <div className="tool-state-label" aria-hidden="true">{active ? (stage === "carving" ? "Carving" : "Spraying glaze") : (stage === "carving" ? "Hold to Carve" : "Hold to spray")}</div>
    {stage === "glazing" && <div className="coverage-readout" aria-hidden="true">Glaze coverage · {Math.round(progress)}%</div>}
  </div>;
}

function useGameAudio(enabled: boolean, musicVolume: number, musicSource: string) {
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
    const audio = musicRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = musicSource;
    audio.load();
    startMusic();
  }, [musicSource, startMusic]);
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
  const playTransition = useCallback((kind: TransitionKind, durationMs: number, direction: 1 | -1 = 1) => {
    if (!enabled) return;
    const context = ensureAudio();
    const now = context.currentTime;
    const duration = Math.min(1.35, Math.max(.24, durationMs / 1000 * .72));
    const master = context.createGain();
    const panner = context.createStereoPanner();
    panner.pan.setValueAtTime(-.32 * direction, now);
    panner.pan.linearRampToValueAtTime(.32 * direction, now + duration);
    master.gain.setValueAtTime(.0001, now);
    master.gain.linearRampToValueAtTime(kind === "ceremony" ? .042 : kind === "fire" ? .032 : .018, now + duration * .18);
    master.gain.exponentialRampToValueAtTime(.0001, now + duration);
    master.connect(panner).connect(context.destination);

    const frequencies: Record<TransitionKind, [number, number]> = {
      focus: [420, 510], scene: [292, 438], map: [176, 264], clay: [230, 345], mist: [330, 495], fire: [110, 220], ceremony: [528, 792], dialogue: [360, 540], pk: [392, 588],
    };
    const [low, high] = frequencies[kind];
    [low, high].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const voice = context.createGain();
      oscillator.type = index ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now + index * .06);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * (kind === "fire" ? .86 : 1.035), now + duration);
      voice.gain.setValueAtTime(index ? .38 : .5, now);
      voice.gain.exponentialRampToValueAtTime(.0001, now + duration * (index ? .86 : 1));
      oscillator.connect(voice).connect(master);
      oscillator.start(now + index * .06);
      oscillator.stop(now + duration);
    });

    if (["map", "clay", "mist", "fire"].includes(kind)) {
      const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < data.length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const textureGain = context.createGain();
      filter.type = "bandpass";
      filter.frequency.value = kind === "fire" ? 150 : kind === "clay" ? 680 : kind === "map" ? 920 : 1450;
      filter.Q.value = .7;
      textureGain.gain.setValueAtTime(.0001, now);
      textureGain.gain.linearRampToValueAtTime(kind === "mist" ? .018 : .011, now + duration * .22);
      textureGain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      source.buffer = buffer;
      source.connect(filter).connect(textureGain).connect(panner);
      source.start(now);
    }
  }, [enabled, ensureAudio]);
  return { play, playTransition, ensureAudio, musicRef };
}

export default function Prototype() {
  const keyboard = useKeyboard();
  const [history, setHistory] = useState<ScreenId[]>(["AUTH-01"]);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionKind, setTransitionKind] = useState<TransitionKind>("focus");
  const [soundOn, setSoundOn] = useState(true);
  const [settingsPane, setSettingsPane] = useState<"sound" | "basic">("sound");
  const [soundEffectsLevel, setSoundEffectsLevel] = useState(72);
  const [gameMusicLevel, setGameMusicLevel] = useState(58);
  const [inGameMusicLevel, setInGameMusicLevel] = useState(78);
  const [outGameMusicLevel, setOutGameMusicLevel] = useState(45);
  const [toast, setToast] = useState("");
  const [feedback, setFeedback] = useState<"" | "correct" | "wrong">("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [workProgress, setWorkProgress] = useState(0);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState("");
  const [orderFields, setOrderFields] = useState([false, false, false]);
  const [profileCardIndex, setProfileCardIndex] = useState(1);
  const [selectedMaterials, setSelectedMaterials] = useState<number[]>([]);
  const [selectedTools, setSelectedTools] = useState<number[]>([]);
  const [selectedCraftTool, setSelectedCraftTool] = useState(3);
  const [porcelainRailShifted, setPorcelainRailShifted] = useState(false);
  const [modelAngle, setModelAngle] = useState(0);
  const [hasRotated, setHasRotated] = useState(false);
  const [kilnReady, setKilnReady] = useState(false);
  const [firingProgress, setFiringProgress] = useState(0);
  const [kilnPhase, setKilnPhase] = useState<"firing" | "hold" | "complete">("firing");
  const [bid, setBid] = useState(1280);
  const transitionTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const workSoundAt = useRef(0);
  const carvingScrapeRef = useRef<HTMLAudioElement | null>(null);
  const glazeSprayRef = useRef<HTMLAudioElement | null>(null);
  const kilnFireRef = useRef<HTMLAudioElement | null>(null);
  const wheelAudioRef = useRef<HTMLAudioElement | null>(null);
  const cardHoverAudioRef = useRef<HTMLAudioElement | null>(null);
  const pageTurnAudioRef = useRef<HTMLAudioElement | null>(null);
  const levelCompleteAudioRef = useRef<HTMLAudioElement | null>(null);
  const wheelFadeFrame = useRef<number | null>(null);
  const wheelSourceNode = useRef<MediaElementAudioSourceNode | null>(null);
  const wheelGainNode = useRef<GainNode | null>(null);
  const wheelStopTimer = useRef<number | null>(null);
  const previousSoundAngle = useRef(0);
  const lastHoveredCard = useRef<Element | null>(null);
  const hoverSoundAt = useRef(0);
  const scrapeFadeFrame = useRef<number | null>(null);
  const sprayFadeFrame = useRef<number | null>(null);
  const modelAngleRef = useRef(0);
  const dragMotion = useRef({ x: 0, time: 0, velocity: 0 });
  const inertiaFrame = useRef<number | null>(null);
  const screen = history[history.length - 1];
  const isAuctionScreen = screen === "C-A-01" || screen === "C-A-02" || screen === "A-12";
  const isPkScreen = screen === "B-P-01";
  const musicSource = isAuctionScreen ? "/assets/ceramic/audio/auction-bgm.mp4" : isPkScreen ? "/assets/ceramic/audio/pk-bgm.mp4" : "/assets/ceramic/intro/moonlit-shadows-audio.mp4";
  const musicVolume = ((["AUTH-01", "AUTH-02", "AUTH-03"] as ScreenId[]).includes(screen) ? 0.78 : isPkScreen ? 0.34 : isAuctionScreen ? 0.36 : 0.2) * gameMusicLevel / 100;
  const { play, playTransition, ensureAudio, musicRef } = useGameAudio(soundOn, musicVolume, musicSource);

  const setWheelSound = useCallback((active: boolean, speed = .35) => {
    const audio = wheelAudioRef.current;
    if (!audio) return;
    if (wheelFadeFrame.current) { window.cancelAnimationFrame(wheelFadeFrame.current); wheelFadeFrame.current = null; }
    if (active && soundOn) {
      const context = ensureAudio();
      if (!wheelSourceNode.current) {
        wheelSourceNode.current = context.createMediaElementSource(audio);
        wheelGainNode.current = context.createGain();
        wheelSourceNode.current.connect(wheelGainNode.current).connect(context.destination);
      }
      if (wheelGainNode.current) wheelGainNode.current.gain.setTargetAtTime(2.8 + speed * .65, context.currentTime, .035);
      audio.volume = 1;
      audio.playbackRate = .84 + speed * .22;
      if (musicRef.current) musicRef.current.volume = Math.min(.09, musicVolume);
      if (audio.paused) void audio.play().catch(() => {});
      return;
    }
    const fade = () => {
      audio.volume *= .72;
      if (audio.volume < .008) { audio.pause(); audio.currentTime = 0; if (musicRef.current) musicRef.current.volume = soundOn ? musicVolume : 0; wheelFadeFrame.current = null; return; }
      wheelFadeFrame.current = window.requestAnimationFrame(fade);
    };
    if (!audio.paused) wheelFadeFrame.current = window.requestAnimationFrame(fade);
  }, [ensureAudio, musicRef, musicVolume, soundOn]);

  useEffect(() => {
    if (!(screen === "A-07" || screen === "A-08" || screen === "A-09")) { previousSoundAngle.current = modelAngle; return; }
    const delta = Math.abs(modelAngle - previousSoundAngle.current);
    previousSoundAngle.current = modelAngle;
    if (delta < .015) return;
    setWheelSound(true, Math.min(1, delta / 4));
    if (wheelStopTimer.current) window.clearTimeout(wheelStopTimer.current);
    wheelStopTimer.current = window.setTimeout(() => setWheelSound(false), 190);
    return () => { if (wheelStopTimer.current) window.clearTimeout(wheelStopTimer.current); };
  }, [modelAngle, screen, setWheelSound]);

  const cardHover = useCallback((event: PointerEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target.closest(".is-choice,.material-pick,.craft-tool-choice,.finished-scene-choice,.auction-ceramic-card") : null;
    if (!target) { lastHoveredCard.current = null; return; }
    if (target === lastHoveredCard.current || !soundOn) return;
    lastHoveredCard.current = target;
    const now = performance.now();
    if (now - hoverSoundAt.current < 90) return;
    hoverSoundAt.current = now;
    ensureAudio();
    const audio = cardHoverAudioRef.current;
    if (!audio) return;
    audio.pause(); audio.currentTime = 0; audio.volume = .32; audio.playbackRate = .98;
    void audio.play().catch(() => {});
  }, [ensureAudio, soundOn]);
  useEffect(() => {
    if (soundOn) return;
    setWheelSound(false);
    cardHoverAudioRef.current?.pause();
  }, [setWheelSound, soundOn]);

  const playCarvingScrape = useCallback((speed: number) => {
    const audio = carvingScrapeRef.current;
    if (!audio || !soundOn) return;
    if (scrapeFadeFrame.current) window.cancelAnimationFrame(scrapeFadeFrame.current);
    audio.volume = Math.min(.42, .19 + speed * .21);
    audio.playbackRate = .9 + speed * .22;
    if (audio.paused) void audio.play().catch(() => {});
  }, [soundOn]);
  const stopCarvingScrape = useCallback(() => {
    const audio = carvingScrapeRef.current;
    if (!audio || audio.paused) return;
    const fade = () => {
      audio.volume *= .7;
      if (audio.volume < .008) { audio.pause(); audio.currentTime = 0; scrapeFadeFrame.current = null; return; }
      scrapeFadeFrame.current = window.requestAnimationFrame(fade);
    };
    scrapeFadeFrame.current = window.requestAnimationFrame(fade);
  }, []);
  const playGlazeSpray = useCallback((speed: number) => {
    const audio = glazeSprayRef.current;
    if (!audio || !soundOn) return;
    if (sprayFadeFrame.current) window.cancelAnimationFrame(sprayFadeFrame.current);
    audio.volume = Math.min(.68, .5 + speed * .15);
    audio.playbackRate = .96 + speed * .08;
    if (audio.paused) void audio.play().catch(() => {});
  }, [soundOn]);
  const stopGlazeSpray = useCallback(() => {
    const audio = glazeSprayRef.current;
    if (!audio || audio.paused) return;
    const fade = () => {
      audio.volume *= .66;
      if (audio.volume < .012) { audio.pause(); audio.currentTime = 0; sprayFadeFrame.current = null; return; }
      sprayFadeFrame.current = window.requestAnimationFrame(fade);
    };
    sprayFadeFrame.current = window.requestAnimationFrame(fade);
  }, []);

  const notify = useCallback((message: string, kind: SoundKind = "click") => {
    setToast(message); play(kind);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1800);
  }, [play]);

  const go = useCallback((next: ScreenId) => {
    const transition = transitionFor(screen, next);
    keyboard.hide(); ensureAudio(); playTransition(transition.kind, transition.duration, 1); setTransitionKind(transition.kind); setTransitioning(true);
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = window.setTimeout(() => {
      setHistory(current => [...current, next]); setTransitioning(false); setFeedback(""); setWorkProgress(0); setDragPoint(null); setDragging(false); setSelectedChoice("");
    }, transition.duration);
  }, [ensureAudio, keyboard, playTransition, screen]);

  const back = useCallback(() => {
    keyboard.hide(); playTransition("focus", 360, -1); setTransitionKind("focus"); setTransitioning(true);
    window.setTimeout(() => { setHistory(current => current.length > 1 ? current.slice(0, -1) : current); setTransitioning(false); setFeedback(""); setWorkProgress(0); }, 300);
  }, [keyboard, playTransition]);

  const returnToWorkshop = useCallback(() => {
    keyboard.hide(); playTransition("focus", 420, -1); setTransitionKind("focus"); setTransitioning(true);
    if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
    transitionTimer.current = window.setTimeout(() => {
      setHistory(current => {
        const workshopIndex = current.lastIndexOf("B-01");
        return workshopIndex >= 0 ? current.slice(0, workshopIndex + 1) : ["HOME-01", "B-01"];
      });
      setTransitioning(false); setFeedback(""); setWorkProgress(0); setSelectedChoice("");
    }, 360);
  }, [keyboard, playTransition]);

  useEffect(() => { (nextAssets[screen] ?? []).forEach(id => { const image = new Image(); image.src = `${ASSET_ROOT}/${id}.png`; }); }, [screen]);
  useEffect(() => { if (screen !== "A-02") setPorcelainRailShifted(false); }, [screen]);
  useEffect(() => { if (screen !== "AUTH-04") return; const timer = window.setTimeout(() => go("HOME-01"), 1700); return () => window.clearTimeout(timer); }, [go, screen]);
  useEffect(() => {
    if (screen !== "A-10") { setKilnReady(false); setFiringProgress(0); setKilnPhase("firing"); return; }
    setKilnReady(false); setFiringProgress(0); setKilnPhase("firing");
    const started = performance.now();
    let frame = 0;
    const advance = (now: number) => {
      const elapsed = Math.min(1, (now - started) / 9000);
      const eased = 1 - Math.pow(1 - elapsed, 2.35);
      const value = elapsed >= 1 ? 100 : Math.min(99, eased * 100);
      setFiringProgress(value);
      if (elapsed < 1) frame = window.requestAnimationFrame(advance);
      else { setKilnReady(true); setKilnPhase("hold"); }
    };
    frame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(frame);
  }, [notify, screen]);
  useEffect(() => {
    if (screen !== "A-10" || !kilnReady) return;
    const reveal = window.setTimeout(() => { setKilnPhase("complete"); notify("Firing complete", "success"); }, 500);
    const transition = window.setTimeout(() => go("A-11"), 1380);
    return () => { window.clearTimeout(reveal); window.clearTimeout(transition); };
  }, [go, kilnReady, notify, screen]);
  useEffect(() => {
    if (screen !== "A-10" || !soundOn) return;
    const audio = kilnFireRef.current;
    if (!audio) return;
    ensureAudio(); audio.volume = .32; audio.currentTime = 0; void audio.play().catch(() => {});
    return () => { audio.pause(); audio.currentTime = 0; };
  }, [ensureAudio, screen, soundOn]);
  useEffect(() => {
    if (screen !== "A-04" || !soundOn) return;
    const audio = pageTurnAudioRef.current;
    if (!audio) return;
    const context = ensureAudio(); audio.volume = .36; audio.currentTime = 0; audio.playbackRate = .9; void audio.play().catch(() => {});
    const cue = (delay: number, frequency: number, volume: number, duration: number, type: OscillatorType = "sine") => window.setTimeout(() => {
      const oscillator = context.createOscillator(); const gain = context.createGain(); const now = context.currentTime;
      oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(frequency * .92, now + duration);
      gain.gain.setValueAtTime(.0001, now); gain.gain.linearRampToValueAtTime(volume, now + .018); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
      oscillator.connect(gain).connect(context.destination); oscillator.start(now); oscillator.stop(now + duration);
    }, delay);
    const timers = [cue(970, 178, .009, .1, "triangle"), cue(1270, 132, .011, .22, "sine"), cue(1530, 1120, .004, .18), ...[0,1,2,3,4,5].map(index => cue(1770 + index * 125, 238 + index % 3 * 13, .006 + index * .0003, .075, "triangle")), cue(2320, 164, .007, .09, "triangle"), cue(2430, 148, .007, .1, "triangle")];
    return () => { timers.forEach(timer => window.clearTimeout(timer)); audio.pause(); audio.currentTime = 0; };
  }, [ensureAudio, screen, soundOn]);
  useEffect(() => {
    if (screen !== "A-12" || !soundOn) return;
    const audio = levelCompleteAudioRef.current;
    if (!audio) return;
    const timer = window.setTimeout(() => {
      ensureAudio();
      audio.currentTime = 0;
      audio.volume = .56;
      audio.playbackRate = .82;
      void audio.play().catch(() => {});
      const context = ensureAudio();
      const resonance = context.createGain();
      const now = context.currentTime;
      resonance.gain.setValueAtTime(.0001, now);
      resonance.gain.linearRampToValueAtTime(.026, now + .08);
      resonance.gain.exponentialRampToValueAtTime(.0001, now + 2.35);
      resonance.connect(context.destination);
      [620, 930, 1240].forEach((frequency, index) => {
        const tone = context.createOscillator();
        const voice = context.createGain();
        tone.type = "sine";
        tone.frequency.setValueAtTime(frequency, now + index * .05);
        voice.gain.setValueAtTime(index === 0 ? .48 : .24, now);
        voice.gain.exponentialRampToValueAtTime(.0001, now + 2.2 - index * .18);
        tone.connect(voice).connect(resonance);
        tone.start(now + index * .05);
        tone.stop(now + 2.35);
      });
    }, 1120);
    return () => { window.clearTimeout(timer); audio.pause(); audio.currentTime = 0; };
  }, [ensureAudio, screen, soundOn]);
  useEffect(() => {
    const threshold = screen === "A-07" ? 64 : screen === "A-08" || screen === "A-09" ? 70 : null;
    if (threshold === null || workProgress < threshold || feedback === "correct") return;
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
    stopCarvingScrape();
    stopGlazeSpray();
    if (screen !== "A-07") return;
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
    const required = screen === "A-07" ? 64 : screen === "A-08" || screen === "A-09" ? 70 : 20;
    if (workProgress < required) { setFeedback("wrong"); notify("Keep working on the porcelain", "wrong"); return; }
    setFeedback("correct"); setWorkProgress(100); notify("Step complete", "correct");
  };
  const register = () => {
    if (!phone || !code || !password) { setFeedback("wrong"); notify("Please complete all fields", "wrong"); return; }
    setFeedback("correct"); notify("Registration complete", "correct"); window.setTimeout(() => go("AUTH-04"), 450);
  };
  const selectAnswer = (correct: boolean) => { setFeedback(correct ? "correct" : "wrong"); notify(correct ? "Correct answer" : "Try another answer", correct ? "correct" : "wrong"); };
  const raiseBid = () => { const nextBid = bid + 100; setBid(nextBid); setFeedback("correct"); notify(`Bid confirmed · ¥${nextBid.toLocaleString()} · Mock balance ¥8,620`, "coin"); window.setTimeout(() => go("A-12"), 720); };
  const chooseAndGo = (choice: string, next: ScreenId) => {
    setSelectedChoice(choice); play("correct");
    window.setTimeout(() => go(next), 620);
  };
  const workScreens: ScreenId[] = ["A-07", "A-08", "A-09"];
  const craftStage: CraftStage | null = screen === "A-07" ? "shaping" : screen === "A-08" ? "carving" : screen === "A-09" ? "glazing" : null;
  const activeCraftTool = craftStage === "carving" ? 0 : craftStage === "glazing" ? 1 : selectedCraftTool;
  const artifactIndex = screen === "A-05" && selectedChoice.startsWith("artifact-") ? Number(selectedChoice.slice(9)) : 2;
  const artifactIntro = artifactIntroductions[Number.isFinite(artifactIndex) ? artifactIndex : 2];

  return <MobileScroll className="app-screen ceramic-scroll"><main className="game-shell" onPointerDown={() => ensureAudio()} onPointerOver={cardHover} onPointerLeave={() => { lastHoveredCard.current = null; }}>
    <audio ref={musicRef} className="game-bgm" src={musicSource} preload="auto" loop playsInline />
    <audio ref={carvingScrapeRef} src="/assets/ceramic/audio/carving-scratch.mp3" preload="auto" loop playsInline />
    <audio ref={glazeSprayRef} src="/assets/ceramic/audio/glaze-spray.mp3" preload="auto" loop playsInline />
    <audio ref={kilnFireRef} src="/assets/ceramic/audio/kiln-fire.mp3" preload="auto" loop playsInline />
    <audio ref={wheelAudioRef} src="/assets/ceramic/audio/pottery-wheel.mp3" preload="auto" loop playsInline />
    <audio ref={cardHoverAudioRef} src="/assets/ceramic/audio/card-hover.mp3" preload="auto" playsInline />
    <audio ref={pageTurnAudioRef} src="/assets/ceramic/audio/page-turn.mp3" preload="auto" playsInline />
    <audio ref={levelCompleteAudioRef} src="/assets/ceramic/audio/level-complete.mp3" preload="auto" playsInline />
    <section className={`game-stage screen-${screen.toLowerCase()} transition-${transitionKind} ${screen === "A-02" && porcelainRailShifted ? "rail-right" : ""} ${transitioning ? "is-leaving" : "is-entering"} ${feedback}`} key={screen}>
      <img className={`screen-art${screen === "AUTH-01" ? " start-background" : ""}`} src={screen === "AUTH-01" ? "/assets/ceramic/start-bg.png" : screen === "HOME-01" ? `${ASSET_ROOT}/HOME-01-background.png` : screen === "B-D-INTRO" ? `${ASSET_ROOT}/B-D-01.png` : screen === "A-04" ? `${ASSET_ROOT}/A-04-stage.png` : screen === "A-05" ? `${ASSET_ROOT}/A-05-clean.png` : screen === "A-10" ? `${ASSET_ROOT}/A-10-stage.png` : screen === "A-11" ? `${ASSET_ROOT}/A-11-stage.png` : screen === "A-12" ? `${ASSET_ROOT}/A-12-background.png` : screen === "C-A-01" ? `${ASSET_ROOT}/C-A-01-stage.png` : craftStage ? `${ASSET_ROOT}/A-07.png` : `${ASSET_ROOT}/${screen}.png`} alt={`${screen} game screen`} draggable={false} />
      <div className="transition-material" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ "--particle-x": `${(index * 37) % 104 - 2}%`, "--particle-y": `${18 + (index * 29) % 70}%`, "--particle-delay": `${(index % 8) * 32}ms`, "--particle-scale": `${.55 + (index % 5) * .16}` } as CSSProperties} />)}</div>
      {screen !== "AUTH-01" && <div className="scene-atmosphere" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6, 7].map(item => <i key={item} />)}</div>}
      {screen === "A-08" && <StageTitle title="CARVING" subtitle="HOLD TO CARVE" mode="character" />}
      {screen === "A-09" && <StageTitle title="GLAZING" subtitle="SPRAY EVENLY ACROSS THE SURFACE" mode="mist" />}
      {screen === "C-A-01" && <StageTitle title="COLLECTION" mode="line" />}
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

      {screen === "HOME-01" && <><Hotspot choice selected={selectedChoice === "home-craft"} label="White Porcelain Crafting" box={[142, 60, 224, 294]} onClick={() => chooseAndGo("home-craft", "A-01")} /><Hotspot choice selected={selectedChoice === "home-workshop"} label="Creative Workshop" box={[385, 63, 313, 140]} onClick={() => chooseAndGo("home-workshop", "B-01")} /><Hotspot choice selected={selectedChoice === "home-collection"} label="Collection" box={[385, 210, 151, 145]} onClick={() => chooseAndGo("home-collection", "PROFILE-01")} /><Hotspot choice selected={selectedChoice === "home-auction"} label="Auction House" box={[541, 210, 157, 145]} onClick={() => chooseAndGo("home-auction", "C-A-01")} /><Hotspot label="Shop" box={[12, 88, 86, 65]} onClick={() => go("C-S-01")} /><Hotspot label="Introduction" box={[750, 92, 54, 38]} onClick={() => go("A-05")} /><Hotspot label="Profile" box={[750, 132, 54, 38]} onClick={() => go("PROFILE-01")} /><Hotspot label="Settings" box={[750, 171, 54, 40]} onClick={() => { setSettingsPane("sound"); go("SETTINGS-01"); }} /></>}

      {screen === "A-01" && <><div className="dynasty-choice-reset" aria-hidden="true" />{[24, 212, 400, 588].map((x, index) => <Hotspot art="A-01" choice selected={selectedChoice === `dynasty-${index}`} key={x} label={["Tang Dynasty", "Song Dynasty", "Yuan Dynasty", "Ming and Qing Dynasties"][index]} box={[x, 84, 170, 228]} sourceBox={index === 3 ? [584, 67, 200, 265] : [x, 84, 170, 228]} onClick={() => chooseAndGo(`dynasty-${index}`, "A-02")} />)}<Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-02" && <><div className="porcelain-choice-reset" aria-hidden="true" /><div className="porcelain-choice-rail">{[15, 194, 371, 550, 729].map((x, index) => <Hotspot art="A-02" choice selected={selectedChoice === `porcelain-${index}`} key={x} label={`Select porcelain ${index + 1}`} box={[x, 79, 166, 228]} sourceBox={[15 + index % 4 * 179, 79, 166, 228]} onClick={() => chooseAndGo(`porcelain-${index}`, "A-03")} />)}</div>{!porcelainRailShifted ? <button className="porcelain-edge-trigger edge-next" aria-label="Reveal more porcelain" onPointerEnter={() => setPorcelainRailShifted(true)} onFocus={() => setPorcelainRailShifted(true)} /> : <button className="porcelain-edge-trigger edge-previous" aria-label="Return to previous porcelain" onPointerEnter={() => setPorcelainRailShifted(false)} onFocus={() => setPorcelainRailShifted(false)} />}<Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-03" && <><div className="puzzle-vase-light" aria-hidden="true" /><div className="puzzle-piece-stage" aria-hidden="true"><i className="puzzle-piece piece-one" style={{ ...rect(457, 157, 70, 42), ...artCrop("A-03", [457, 157, 70, 42]) }} /><i className="puzzle-piece piece-two" style={{ ...rect(457, 232, 80, 20), ...artCrop("A-03", [457, 232, 80, 20]) }} /><i className="puzzle-piece piece-three" style={{ ...rect(592, 211, 38, 60), ...artCrop("A-03", [592, 211, 38, 60]) }} /></div><Hotspot art="A-03" choice label="Introduction" box={[420, 294, 108, 39]} onClick={() => notify("Discover the story of this porcelain", "click")} /><Hotspot art="A-03" choice selected={selectedChoice === "puzzle-start"} label="Start making" box={[577, 294, 103, 39]} onClick={() => { setSelectedChoice("puzzle-start"); setFeedback("correct"); notify("Puzzle complete", "correct"); window.setTimeout(() => go("A-04"), 650); }} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-04" && <>
        <div className="map-figma-reveal" aria-hidden="true"><i /><i /><i /></div>
        <img className="map-figma-shadow" src="/assets/ceramic/map/vase-shadow.png" style={rect(177, 194, 165, 67)} alt="" />
        <img className="map-figma-vase" src="/assets/ceramic/map/vase-full.png" style={rect(205, 101, 121, 190)} alt="" />
        {[{ x: 429, y: 35, correct: true }, { x: 385, y: 53 }, { x: 345, y: 88 }, { x: 352, y: 154 }, { x: 385, y: 187 }, { x: 366, y: 253 }].map((node, index) => {
          const choice = `map-level-${index}`;
          return <button key={choice} className={`map-level-choice map-level-hit${node.correct ? " is-current" : " is-locked"}${selectedChoice === choice ? " is-selected" : ""}`} style={{ ...rect(node.x - 15, node.y, 60, 78), "--map-node-delay": `${2250 + index * 230}ms` } as CSSProperties} aria-label={node.correct ? "Select current porcelain level" : `Select locked level ${index + 1}`} aria-pressed={selectedChoice === choice} onClick={() => { setSelectedChoice(choice); if (node.correct) { setFeedback("correct"); notify("Level selected", "correct"); window.setTimeout(() => go("A-05"), 720); } else { setFeedback("wrong"); notify("This level is still locked", "wrong"); } }}><img src="/assets/ceramic/map-puzzle.png" alt="" draggable={false} /></button>;
        })}
        <div className="map-level-prompt">Please select a level</div>
        <div className="map-ambient-ink" aria-hidden="true"><i /><i /><i /></div>
        <Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} />
      </>}
      {screen === "A-05" && <>
        <div className="artifact-copy-panel" key={`artifact-copy-${artifactIndex}`}>
          <TypewriterAudio enabled={soundOn} delayMs={180} durationMs={artifactIntro.lines.join(" ").length * 17 + 120} />
          <div className="artifact-typewriter" aria-label={artifactIntro.lines.join(" ")}>{artifactIntro.lines.join(" ").split("").map((character, index) => <span aria-hidden="true" key={`${index}-${character}`} style={{ "--character-delay": `${180 + index * 17}ms` } as CSSProperties}>{character}</span>)}</div>
        </div>
        <div className="artifact-option-list" aria-label="Artifact selection">
          {[[69,72,32,32],[64,109,42,42],[58,155,55,55],[64,219,42,42],[69,268,32,32]].map(([x,y,w,h],index) => <button key={index} className="artifact-bubble" style={{ ...rect(x,y,w,h), "--bubble-delay": `${index * -.8}s` } as CSSProperties} aria-label={`Select artifact ${index + 1}`} aria-pressed={artifactIndex === index} onClick={() => { setSelectedChoice(`artifact-${index}`); play("click"); }} />)}
        </div>
        <Hotspot label="Continue to material selection" box={[175, 58, 635, 300]} onClick={() => go("A-06")} />
        <Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} />
      </>}
      {screen === "A-06" && <>{[102, 200, 303, 412, 520, 627].map((x, index) => <button key={`material-${index}`} aria-label={`Select material ${index + 1}`} aria-pressed={selectedMaterials.includes(index)} className={`material-pick ${selectedMaterials.includes(index) ? "selected" : ""}`} style={rect(x, 59, 77, 69)} onClick={() => { play("click"); setSelectedMaterials(items => items.includes(index) ? items.filter(item => item !== index) : [...items, index]); }} />)}{[89, 171, 254, 337, 420, 503, 585, 668].map((x, index) => <button key={`tool-${index}`} aria-label={`Select tool ${index + 1}`} aria-pressed={selectedTools.includes(index)} className={`material-pick tool-pick ${selectedTools.includes(index) ? "selected" : ""}`} style={rect(x, 200, 61, 77)} onClick={() => { play("click"); setSelectedTools(items => items.includes(index) ? items.filter(item => item !== index) : [...items, index]); }} />)}<Hotspot label="Next step" box={[668, 315, 125, 45]} onClick={() => selectedMaterials.length && selectedTools.length ? go("A-07") : notify("Select at least one material and one tool", "wrong")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}

      {workScreens.includes(screen) && <>
        {craftStage && <>
          <CeramicModel3D tool={activeCraftTool} angle={modelAngle} progress={workProgress} onCraft={amount => { if (craftStage === "shaping") setWorkProgress(value => Math.min(100, value + amount)); }} onAngle={value => { setModelAngle(value); modelAngleRef.current = value; }} onFirstDrag={() => setHasRotated(true)} onRotationSound={setWheelSound} />
          <div className={`model-tool-effect tool-mode-${activeCraftTool}`} aria-hidden="true" />
          {!hasRotated && <div className="rotation-coach" aria-hidden="true"><span>↔</span> Drag to rotate</div>}
          <div className="craft-tool-reset" aria-hidden="true" />
          {(["Carving Tool", "Spray Gun", "Pottery Wheel", "Shaping Tool", "Polishing Tool", "Glazing Tool"] as const).map((name, index) => {
            const x = [198, 276, 355, 430, 509, 590][index];
            return <button key={name} data-tool-name={name} className={`craft-tool-choice${activeCraftTool === index ? " selected" : " inactive"}`} style={{ ...rect(x, 16, 56, 50), ...artCrop("A-07", [x, 16, 56, 50]), "--tool-delay": `${440 + index * 38}ms` } as CSSProperties} aria-label={name} aria-pressed={activeCraftTool === index} onClick={() => { if (craftStage === "shaping") setSelectedCraftTool(index); notify(craftStage === "shaping" ? `${name} ready` : `${craftStage === "carving" ? "Carving Tool" : "Spray Gun"} is required for this stage`, "click"); }} />;
          })}
          <CraftInteractionLayer stage={craftStage} active={dragging} progress={workProgress} onStart={beginWork} onEnd={endWork} onApply={amount => setWorkProgress(value => Math.min(100, value + amount * (craftStage === "glazing" ? .72 : 1)))} onWorkSound={(speed, contact) => { if (craftStage === "carving") { playCarvingScrape(speed); return; } if (craftStage === "glazing") { playGlazeSpray(speed); return; } const now = performance.now(); const cadence = 125 - speed * 55; if (contact || now - workSoundAt.current > cadence) { play(contact ? "click" : "work"); workSoundAt.current = now; } }} />
        </>}
        {feedback === "correct" && <><div className="craft-success" aria-hidden="true">{[0, 1, 2, 3, 4].map(item => <i key={item} />)}</div><div className="step-complete" role="status">Step Complete</div></>}
        <div className="work-progress" aria-label={`Progress ${Math.round(workProgress)} percent`}><span style={{ width: `${workProgress}%` }} /></div>
        <Hotspot art={screen} sourceBox={[687, 318, 112, 44]} dimmed={workProgress < (screen === "A-07" ? 64 : 70)} label="Next step" box={[687, 318, 112, 44]} onClick={() => { const required = screen === "A-07" ? 64 : 70; if (workProgress < required) return notify("Complete the current craft step first", "wrong"); go(screen === "A-07" ? "A-08" : screen === "A-08" ? "A-09" : "A-10"); }} />
        <Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} />
      </>}
      {screen === "A-10" && <><div className={`kiln-scene phase-${kilnPhase}`} style={{ "--firing-progress": `${firingProgress}%`, "--kiln-warmth": Math.min(.5, firingProgress / 240) } as CSSProperties} onPointerMove={event => { const bounds = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty("--kiln-pointer-x", `${(event.clientX - bounds.left) / bounds.width * 2 - 1}`); }} aria-hidden="true"><div className="kiln-title">{kilnPhase === "complete" ? "Firing Complete" : "Firing in progress..."}</div><div className="kiln-heat-haze" /><KilnFireSequence completing={kilnPhase !== "firing"} /><div className="kiln-ceramic-warmth" /><div className="kiln-completion-sweep" /><div className="kiln-embers">{Array.from({ length: kilnPhase === "firing" ? 10 : 16 }, (_, index) => <i key={index} />)}</div><div className="firing-progress"><div className="firing-track"><span /><b /></div><output>{Math.round(firingProgress)}%</output></div></div><Hotspot label={kilnReady ? "View the finished piece" : "Firing in progress"} box={[658, 309, 137, 49]} onClick={() => kilnReady ? go("A-11") : notify("The kiln is still firing")} disabled={!kilnReady} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-11" && <><div className="finished-scene-options" aria-label="Scene selection">{[0, 1, 2].map(index => { const x = 574 + index * 72; const active = selectedChoice === `finished-scene-${index}` || (!selectedChoice && index === 0); return <button key={index} className={`finished-scene-choice${active ? " selected" : ""}`} style={{ ...rect(x, 106, 57, 51), ...artCrop("A-11", [x, 106, 57, 51]) }} aria-label={`Finished scene ${index + 1}`} aria-pressed={active} onClick={() => { setSelectedChoice(`finished-scene-${index}`); play("click"); }} />; })}</div><Hotspot label="Complete crafting" box={[686, 316, 112, 44]} onClick={() => { play("success"); go("C-S-01"); }} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "A-12" && <><div className="level-scroll" aria-hidden="true"><div className="level-scroll-paper" style={{ inset: 0, backgroundImage: `url(${ASSET_ROOT}/A-12-scroll-base.png)`, backgroundSize: "100% 100%", backgroundPosition: "center" }} /><div className="level-title-art" style={imageCrop(`${ASSET_ROOT}/A-12.png`, [314, 131, 220, 35])} /><div className="level-star level-star-left" style={imageCrop(`${ASSET_ROOT}/A-12.png`, [336, 181, 58, 66])} /><div className="level-star level-star-right" style={imageCrop(`${ASSET_ROOT}/A-12.png`, [450, 183, 60, 65])} /><div className="level-star level-star-center" style={imageCrop(`${ASSET_ROOT}/A-12.png`, [390, 170, 66, 69])} /><div className="level-reward-art" style={imageCrop(`${ASSET_ROOT}/A-12.png`, [350, 250, 141, 43])} /></div><div className="celebration" aria-hidden="true">{Array.from({ length: 42 }, (_, index) => { const fromLeft = index % 2 === 0; const rank = Math.floor(index / 2); const palette = ["celadon", "ivory", "gold", "cinnabar"] as const; const reach = 145 + (rank * 43) % 225; const fallDrift = -24 + (rank * 19) % 49; const spin = 380 + (index % 5) * 130; return <i key={index} className={`celebration-petal petal-${index % 3} tone-${palette[index % palette.length]}`} style={{ "--petal-x": fromLeft ? "-2%" : "102%", "--petal-start-y": `${46 + (rank * 17) % 37}%`, "--petal-burst-x": `${fromLeft ? reach : -reach}px`, "--petal-burst-y": `${-88 - (rank * 29) % 128}px`, "--petal-fall-x": `${fromLeft ? reach + fallDrift : -reach + fallDrift}px`, "--petal-fall-y": `${142 + (rank % 5) * 22}px`, "--petal-delay": `${.62 + (rank % 9) * .055}s`, "--petal-duration": `${3.35 + (rank % 7) * .12}s`, "--petal-size": `${5 + (index % 4) * 1.5}px`, "--petal-spin-rise": `${Math.round(spin * .34)}deg`, "--petal-spin-hang": `${Math.round(spin * .48)}deg`, "--petal-spin": `${spin}deg` } as CSSProperties} />; })}<span className="celebration-halo" /></div><Hotspot art="A-12" sourceBox={[384, 296, 86, 28]} label="Return Home" box={[384, 296, 86, 28]} onClick={() => { setHistory(["HOME-01"]); play("click"); }} /></>}

      {screen === "B-01" && <><Hotspot choice selected={selectedChoice === "workshop-quiz"} label="Knowledge Quiz" box={[39, 54, 234, 298]} onClick={() => chooseAndGo("workshop-quiz", "B-Q-01")} /><Hotspot choice selected={selectedChoice === "workshop-diy"} label="DIY Crafting" box={[293, 54, 234, 298]} onClick={() => chooseAndGo("workshop-diy", "B-D-INTRO")} /><Hotspot choice selected={selectedChoice === "workshop-pk"} label="Pottery PK" box={[556, 54, 234, 298]} onClick={() => chooseAndGo("workshop-pk", "B-P-01")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "B-D-INTRO" && <MerchantDialogueIntro soundEnabled={soundOn} onContinue={() => go("B-D-01")} />}
      {screen === "B-D-01" && <>
        <div className="order-field-options" aria-label="Confirm order details">
          {[[132,108,320,30],[132,154,320,30],[132,200,320,30]].map((box,index) => <button key={index} className={`order-field-select${orderFields[index] ? " selected" : ""}`} style={rect(...box as [number,number,number,number])} aria-label={["Confirm delivery address","Confirm contact number","Confirm recipient name"][index]} aria-pressed={orderFields[index]} onClick={() => { setOrderFields(fields => fields.map((value,fieldIndex) => fieldIndex === index ? !value : value)); play("click"); }}><span aria-hidden="true">✓</span></button>)}
        </div>
        <button className={`order-submit${orderFields.every(Boolean) ? " ready" : ""}`} style={rect(272,265,90,30)} disabled={!orderFields.every(Boolean)} onClick={() => { play("success"); notify("Order submitted", "success"); setOrderFields([false,false,false]); returnToWorkshop(); }} aria-label="Submit confirmed order" />
        <Hotspot label="Cancel order" box={[132,265,90,30]} onClick={() => { setOrderFields([false,false,false]); returnToWorkshop(); }} />
      </>}
      {screen === "B-Q-01" && <><Hotspot label="Answer A" box={[462, 183, 138, 35]} onClick={() => selectAnswer(false)} /><Hotspot label="Answer B" box={[616, 183, 138, 35]} onClick={() => selectAnswer(true)} /><Hotspot label="Answer C" box={[462, 231, 138, 35]} onClick={() => selectAnswer(false)} /><Hotspot label="Answer D" box={[616, 231, 138, 35]} onClick={() => selectAnswer(false)} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "B-P-01" && <><PotteryPkIntro /><Hotspot label="Start pottery challenge" box={[300, 120, 210, 155]} onClick={() => { setFeedback("correct"); notify("Challenge complete · Victory", "success"); }} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}

      {screen === "C-S-01" && <><Hotspot label="Open Auction House" box={[92, 42, 620, 290]} onClick={() => go("C-A-01")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "C-A-01" && <><AuctionCollection onSelect={() => go("C-A-02")} /><Hotspot art="C-A-01" label="Enter the auction" box={[550, 82, 222, 221]} onClick={() => go("C-A-02")} /><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}
      {screen === "C-A-02" && <><Hotspot label="Raise bid" box={[642, 276, 122, 48]} onClick={raiseBid} /><div className="bid-status">Current mock bid: ¥{bid.toLocaleString()}</div><Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} /></>}

      {screen === "PROFILE-01" && <>
        <div className="profile-card-carousel" aria-label={`White porcelain card ${profileCardIndex + 1} of 3`}>
          {["card-1.png", "card-2.png", "card-3.png"].map((file,index) => { const position = index === profileCardIndex ? "center" : (index - profileCardIndex + 3) % 3 === 1 ? "right" : "left"; return <button key={file} className={`profile-porcelain-card ${position}`} aria-label={`Show porcelain card ${index + 1}`} aria-pressed={index === profileCardIndex} onClick={() => { setProfileCardIndex(index); play("click"); }}><img src={`/assets/ceramic/profile-cards/${file}?v=2`} alt="" draggable={false} /></button>; })}
          <button className="profile-card-arrow previous" style={artCrop("PROFILE-01",[33,207,25,25])} aria-label="Previous porcelain card" onClick={() => { setProfileCardIndex(index => (index + 2) % 3); play("click"); }} />
          <button className="profile-card-arrow next" style={artCrop("PROFILE-01",[355,207,25,25])} aria-label="Next porcelain card" onClick={() => { setProfileCardIndex(index => (index + 1) % 3); play("click"); }} />
          <div className="profile-card-dots-art" style={artCrop("PROFILE-01",[158,268,35,7])} aria-hidden="true" />
        </div>
        <Hotspot label="Back" box={[8, 8, 52, 45]} onClick={back} />
      </>}
      {screen === "SETTINGS-01" && <>
        <div className={`settings-panel-stack is-${settingsPane}`} aria-live="polite">
          <div className="settings-content-panel settings-content-sound" style={{ ...rect(170, 35, 610, 320), ...artCrop("SETTINGS-01", [170, 35, 610, 320]) }} aria-hidden={settingsPane !== "sound"} />
          <div className="settings-content-panel settings-content-basic" style={{ ...rect(170, 35, 610, 320), ...artCrop("SETTINGS-02", [170, 35, 610, 320]) }} aria-hidden={settingsPane !== "basic"} />
        </div>
        <nav className={`settings-section-nav is-${settingsPane}`} aria-label="Settings sections" style={rect(45, 70, 104, 120)}>
          <span className="settings-section-highlight" aria-hidden="true" />
          <button aria-current={settingsPane === "basic" ? "page" : undefined} onClick={() => setSettingsPane("basic")}>Basics</button>
          <button aria-current={settingsPane === "sound" ? "page" : undefined} onClick={() => setSettingsPane("sound")}>Sound Effects</button>
        </nav>
        {settingsPane === "sound" && <div className="settings-audio-controls" aria-label="Sound controls">
          <span className="settings-range-mask" style={rect(307, 98, 202, 34)} aria-hidden="true" />
          <span className="settings-range-mask" style={rect(613, 98, 122, 34)} aria-hidden="true" />
          <span className="settings-range-mask" style={rect(312, 206, 434, 34)} aria-hidden="true" />
          <span className="settings-range-mask" style={rect(312, 269, 434, 34)} aria-hidden="true" />
          <input className="settings-range range-effects" style={{ ...rect(312, 105, 192, 20), "--range-progress": `${soundEffectsLevel}%` } as CSSProperties} type="range" min="0" max="100" value={soundEffectsLevel} aria-label="Game sound effects volume" onChange={event => { const value = Number(event.target.value); setSoundEffectsLevel(value); setSoundOn(value > 0 || gameMusicLevel > 0); }} />
          <input className="settings-range range-game-music" style={{ ...rect(618, 105, 112, 20), "--range-progress": `${gameMusicLevel}%` } as CSSProperties} type="range" min="0" max="100" value={gameMusicLevel} aria-label="Game music volume" onChange={event => { const value = Number(event.target.value); setGameMusicLevel(value); setSoundOn(value > 0 || soundEffectsLevel > 0); }} />
          <input className="settings-range range-in-game" style={{ ...rect(317, 213, 424, 20), "--range-progress": `${inGameMusicLevel}%` } as CSSProperties} type="range" min="0" max="100" value={inGameMusicLevel} aria-label="In-game music volume" onChange={event => setInGameMusicLevel(Number(event.target.value))} />
          <input className="settings-range range-out-game" style={{ ...rect(317, 276, 424, 20), "--range-progress": `${outGameMusicLevel}%` } as CSSProperties} type="range" min="0" max="100" value={outGameMusicLevel} aria-label="Out-of-game music volume" onChange={event => setOutGameMusicLevel(Number(event.target.value))} />
        </div>}
        <Hotspot label="Back" box={[44, 32, 35, 35]} onClick={back} />
      </>}
      {screen === "SETTINGS-02" && <>
        <Hotspot label="Sound Settings" box={[45, 140, 104, 50]} onClick={() => go("SETTINGS-01")} />
        <Hotspot label="Back" box={[44, 32, 35, 35]} onClick={back} />
      </>}
      {toast && <div className="game-toast" role="status">{toast}</div>}
    </section>
  </main></MobileScroll>;
}
