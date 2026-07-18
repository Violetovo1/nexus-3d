"use client";

import "./globals.css";
import {
  Component,
  type CSSProperties,
  type ChangeEvent,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Float, OrbitControls, useGLTF } from "@react-three/drei";

const GENERATION_TIME = 60_000;

const stages = [
  {
    start: 0,
    end: 18,
    code: "01",
    title: "视觉特征解析",
    detail: "识别主体轮廓、材质边界与关键结构",
  },
  {
    start: 18,
    end: 38,
    code: "02",
    title: "空间深度估计",
    detail: "推演遮挡关系、视差与三维空间层级",
  },
  {
    start: 38,
    end: 62,
    code: "03",
    title: "三维点云构建",
    detail: "将二维特征投射为高密度空间点云",
  },
  {
    start: 62,
    end: 84,
    code: "04",
    title: "网格拓扑重建",
    detail: "连接几何表面并优化模型拓扑结构",
  },
  {
    start: 84,
    end: 101,
    code: "05",
    title: "智能材质生成",
    detail: "完成纹理映射、光照适配与最终渲染",
  },
];

function DemoModel() {
  const { scene } = useGLTF("/models/demo.glb");
  const model = useMemo(() => scene.clone(true), [scene]);

  return (
    <Float speed={1.25} rotationIntensity={0.14} floatIntensity={0.18}>
      <primitive object={model} scale={1.45} rotation={[0, -0.28, 0]} />
    </Float>
  );
}

useGLTF.preload("/models/demo.glb");

class ViewerErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="model-error">
          <div className="model-error-icon">!</div>
          <strong>模型文件尚未就绪</strong>
          <span>请确认文件路径为 public/models/demo.glb</span>
        </div>
      );
    }

    return this.props.children;
  }
}

function ModelViewer() {
  return (
    <ViewerErrorBoundary>
      <Canvas
        camera={{ position: [0, 0.15, 4.2], fov: 38 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={1.8} />
        <directionalLight position={[4, 5, 5]} intensity={3.2} />
        <directionalLight position={[-4, 2, -3]} intensity={1.4} color="#4fd8ff" />
        <pointLight position={[0, -2, 3]} intensity={1.6} color="#7b61ff" />
        <Suspense fallback={null}>
          <DemoModel />
          <ContactShadows
            position={[0, -1.45, 0]}
            opacity={0.42}
            scale={7}
            blur={2.8}
            far={4}
          />
        </Suspense>
        <OrbitControls
          makeDefault
          enableDamping
          minDistance={2.2}
          maxDistance={7}
          autoRotate
          autoRotateSpeed={0.75}
        />
      </Canvas>
    </ViewerErrorBoundary>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [message, setMessage] = useState("上传一张图片，启动三维重建演示");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  const activeStageIndex = Math.min(
    stages.length - 1,
    Math.max(0, stages.findIndex((stage) => progress < stage.end)),
  );
  const activeStage = stages[activeStageIndex];
  const remainingSeconds = Math.max(0, Math.ceil((100 - progress) * 0.6));

  useEffect(() => {
    document.title = "AI·3D越境科技";

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (timerRef.current) clearInterval(timerRef.current);
    if (imageUrl) URL.revokeObjectURL(imageUrl);

    const nextUrl = URL.createObjectURL(selectedFile);
    setFile(selectedFile);
    setImageUrl(nextUrl);
    setPhase("idle");
    setProgress(0);
    setMessage("图像已载入，系统等待生成指令");
  }

  function startGeneration() {
    if (!file) {
      setMessage("请先选择一张用于演示的图片");
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);

    setPhase("loading");
    setProgress(0);
    setMessage("AI 视觉引擎已启动");
    startedAtRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const nextProgress = Math.min(100, Math.floor((elapsed / GENERATION_TIME) * 100));
      setProgress(nextProgress);

      if (elapsed >= GENERATION_TIME) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
        setProgress(100);
        setPhase("done");
        setMessage("三维模型生成完成");
      }
    }, 180);
  }

  function resetStudio() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setProgress(0);
    setPhase("idle");
    setMessage(file ? "图像已载入，可再次启动生成" : "上传一张图片，启动三维重建演示");
  }

  return (
    <div className="site-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="grid-layer" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-symbol">
            <span>AI</span>
          </div>
          <div>
            <div className="brand-name">AI·3D越境科技</div>
            <div className="brand-caption">AI VISUAL COMPUTING LAB</div>
          </div>
        </div>

        <div className="system-status">
          <span className="live-dot" />
          <span>演示引擎在线</span>
          <i />
          <span>OFFLINE MODEL MODE</span>
        </div>
      </header>

      <main className="main-area">
        <section className="hero">
          <div>
            <div className="eyebrow">IMAGE TO 3D · DIGITAL CREATION ENGINE</div>
            <h1>
              让二维图像，<br />
              <span>进入三维世界</span>
            </h1>
            <p>
              通过视觉解析、深度估计、点云构建、网格重建与材质生成，
              呈现完整的 AI 图生 3D 交互演示。
            </p>
          </div>

          <div className="hero-metrics">
            <div>
              <strong>60</strong>
              <span>SEC PROCESS</span>
            </div>
            <div>
              <strong>5</strong>
              <span>AI STAGES</span>
            </div>
            <div>
              <strong>GLB</strong>
              <span>REAL-TIME VIEW</span>
            </div>
          </div>
        </section>

        <section className="studio-layout">
          <aside className="control-card glass-card">
            <div className="card-heading">
              <div>
                <span className="card-kicker">01 / INPUT</span>
                <h2>输入图像</h2>
              </div>
              <span className="panel-led" />
            </div>

            <label className={`drop-zone ${imageUrl ? "has-image" : ""}`}>
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt="上传图片预览" />
                  <div className="image-overlay">
                    <span>更换图片</span>
                  </div>
                </>
              ) : (
                <div className="upload-empty">
                  <div className="upload-icon">+</div>
                  <strong>上传图片</strong>
                  <span>JPG · PNG · WEBP</span>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleUpload} />
            </label>

            <div className="file-meta">
              <span>INPUT ASSET</span>
              <strong>{file ? file.name : "等待载入"}</strong>
              <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "MAX 20 MB"}</small>
            </div>

            <button
              className="primary-button"
              onClick={startGeneration}
              disabled={phase === "loading"}
            >
              <span>{phase === "loading" ? "生成进行中" : "开始生成 3D 模型"}</span>
              <b>→</b>
            </button>

            <div className="engine-note">
              <span className="note-icon">◇</span>
              <div>
                <strong>演示模式</strong>
                <p>系统将在 60 秒后展示预置 GLB 模型，不产生 API 费用。</p>
              </div>
            </div>
          </aside>

          <section className="viewport-card glass-card">
            <div className="viewport-toolbar">
              <div>
                <span className="card-kicker">02 / GENERATION VIEWPORT</span>
                <strong>{message}</strong>
              </div>
              <div className="viewport-actions">
                <span>FPS 60</span>
                <span>WEBGL</span>
                <button onClick={resetStudio} aria-label="重置生成演示">
                  ↻
                </button>
              </div>
            </div>

            <div className={`viewport-content phase-${phase}`}>
              {phase === "idle" && (
                <div className="idle-scene">
                  <div className="hologram">
                    <div className="holo-ring ring-one" />
                    <div className="holo-ring ring-two" />
                    <div className="holo-core">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="holo-axis axis-x" />
                    <div className="holo-axis axis-y" />
                  </div>
                  <div className="idle-copy">
                    <span>SYSTEM STANDBY</span>
                    <h3>等待生成指令</h3>
                    <p>上传图片后启动 AI 三维重建流程</p>
                  </div>
                </div>
              )}

              {phase === "loading" && (
                <div className="generation-scene">
                  <div className="scan-stage">
                    <div className="scan-frame">
                      {imageUrl && <img src={imageUrl} alt="正在分析的图片" />}
                      <div className="scan-grid" />
                      <div className="scan-line" />
                      <span className="corner corner-a" />
                      <span className="corner corner-b" />
                      <span className="corner corner-c" />
                      <span className="corner corner-d" />
                      <div className="feature-points">
                        {Array.from({ length: 18 }).map((_, index) => (
                          <i key={index} style={{ "--i": index } as CSSProperties} />
                        ))}
                      </div>
                    </div>
                    <div className="scan-caption">
                      <span>LIVE IMAGE ANALYSIS</span>
                      <strong>{file?.name}</strong>
                    </div>
                  </div>

                  <div className="process-stage">
                    <div className="progress-head">
                      <div
                        className="progress-orbit"
                        style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}
                      >
                        <div>
                          <strong>{progress}</strong>
                          <span>%</span>
                        </div>
                      </div>
                      <div className="active-stage-copy">
                        <span>PHASE {activeStage.code}</span>
                        <h2>{activeStage.title}</h2>
                        <p>{activeStage.detail}</p>
                      </div>
                    </div>

                    <div className="progress-bar">
                      <div style={{ width: `${progress}%` }} />
                    </div>

                    <div className="stage-list">
                      {stages.map((stage, index) => {
                        const finished = progress >= stage.end;
                        const active = index === activeStageIndex;
                        return (
                          <div
                            key={stage.code}
                            className={`${finished ? "finished" : ""} ${active ? "active" : ""}`}
                          >
                            <span>{finished ? "✓" : stage.code}</span>
                            <div>
                              <strong>{stage.title}</strong>
                              <small>{finished ? "COMPLETED" : active ? "PROCESSING" : "QUEUED"}</small>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="remaining-time">
                      <span>预计剩余时间</span>
                      <strong>00:{remainingSeconds.toString().padStart(2, "0")}</strong>
                    </div>
                  </div>
                </div>
              )}

              {phase === "done" && (
                <div className="result-scene">
                  <div className="model-canvas">
                    <ModelViewer />
                  </div>
                  <div className="result-badge">
                    <span className="result-check">✓</span>
                    <div>
                      <strong>MODEL GENERATED</strong>
                      <small>鼠标拖动旋转 · 滚轮缩放</small>
                    </div>
                  </div>
                  <div className="model-specs">
                    <span>GLB</span>
                    <span>PBR MATERIAL</span>
                    <span>REAL-TIME</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </section>
      </main>

      <footer className="footer">
        <span>© 2026 AI·3D越境科技</span>
        <span>AI DIGITAL CULTURE &amp; 3D VISUALIZATION</span>
      </footer>
    </div>
  );
}
