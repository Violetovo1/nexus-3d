"use client";

import {
  ChangeEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";
import styles from "./studio.module.css";

const DEMO_DURATION = 60;

const phases = [
  {
    max: 18,
    number: "01",
    title: "视觉特征解析",
    subtitle: "识别主体轮廓、材质边界与结构关系",
  },
  {
    max: 38,
    number: "02",
    title: "深度空间估计",
    subtitle: "推演隐藏区域与三维空间层级",
  },
  {
    max: 60,
    number: "03",
    title: "三维点云构建",
    subtitle: "生成空间采样点并校准几何比例",
  },
  {
    max: 82,
    number: "04",
    title: "网格拓扑重建",
    subtitle: "连接点云数据，生成连续三角网格",
  },
  {
    max: 100,
    number: "05",
    title: "材质纹理生成",
    subtitle: "完成金属材质、光泽与纹理映射",
  },
];

function DemoModel() {
  const { scene } = useGLTF("/models/demo.glb");

  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  return (
    <primitive
      object={clonedScene}
      scale={1.45}
      position={[0, -0.72, 0]}
    />
  );
}

function ModelViewport() {
  return (
    <Canvas
      camera={{
        position: [0, 1.15, 4.8],
        fov: 38,
      }}
      dpr={[1, 1.8]}
      gl={{
        antialias: true,
        alpha: true,
      }}
    >
      <ambientLight intensity={1.7} />

      <directionalLight
        position={[4, 6, 4]}
        intensity={3.2}
        color="#fff1c7"
      />

      <directionalLight
        position={[-4, 2, -3]}
        intensity={2.2}
        color="#62e8ff"
      />

      <spotLight
        position={[0, 6, 1]}
        angle={0.5}
        penumbra={1}
        intensity={5}
        color="#eabf68"
      />

      <Suspense fallback={null}>
        <DemoModel />

        <ContactShadows
          position={[0, -1.25, 0]}
          opacity={0.55}
          scale={8}
          blur={2.8}
          far={4}
        />
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        minDistance={2.7}
        maxDistance={8}
        autoRotate
        autoRotateSpeed={0.75}
      />
    </Canvas>
  );
}

function CircularProgress({ progress }: { progress: number }) {
  return (
    <div
      className={styles.circularProgress}
      style={
        {
          "--progress": `${progress * 3.6}deg`,
        } as React.CSSProperties
      }
    >
      <div className={styles.circularProgressInner}>
        <strong>{progress}</strong>
        <span>%</span>
      </div>
    </div>
  );
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(
    "/assets/xiezhi-reference.jpg",
  );

  const [progress, setProgress] = useState(0);
  const [remainingSeconds, setRemainingSeconds] =
    useState(DEMO_DURATION);

  const [status, setStatus] = useState<
    "idle" | "processing" | "completed"
  >("idle");

  const [viewMode, setViewMode] = useState<"video" | "model">(
    "video",
  );

  const [modelAvailable, setModelAvailable] = useState(false);
  const [dragging, setDragging] = useState(false);

  const currentPhaseIndex = phases.findIndex(
    (phase) => progress <= phase.max,
  );

  const safePhaseIndex =
    currentPhaseIndex === -1
      ? phases.length - 1
      : currentPhaseIndex;

  const currentPhase = phases[safePhaseIndex];

  useEffect(() => {
    fetch("/models/demo.glb", {
      method: "HEAD",
    })
      .then((response) => {
        setModelAvailable(response.ok);
      })
      .catch(() => {
        setModelAvailable(false);
      });
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function selectFile(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("请上传 JPG、PNG 或 WEBP 图片");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("图片不能超过 20MB");
      return;
    }

    if (previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    const localUrl = URL.createObjectURL(file);

    setUploadedFile(file);
    setPreviewUrl(localUrl);
    setStatus("idle");
    setProgress(0);
    setRemainingSeconds(DEMO_DURATION);
    setViewMode("video");
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    selectFile(event.target.files?.[0]);
  }

  function startGeneration() {
    if (status === "processing") return;

    setStatus("processing");
    setProgress(0);
    setRemainingSeconds(DEMO_DURATION);
    setViewMode("video");

    const startedAt = Date.now();

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      const nextProgress = Math.min(
        100,
        Math.floor((elapsed / DEMO_DURATION) * 100),
      );

      setProgress(nextProgress);
      setRemainingSeconds(
        Math.max(0, Math.ceil(DEMO_DURATION - elapsed)),
      );

      if (elapsed >= DEMO_DURATION) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }

        setProgress(100);
        setRemainingSeconds(0);
        setStatus("completed");

        if (modelAvailable) {
          setViewMode("model");
        }
      }
    }, 200);
  }

  function resetWorkspace() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setStatus("idle");
    setProgress(0);
    setRemainingSeconds(DEMO_DURATION);
    setViewMode("video");
  }

  return (
    <main className={styles.app}>
      <div className={styles.background}>
        <div className={styles.auroraGold} />
        <div className={styles.auroraBlue} />
        <div className={styles.auroraPurple} />
        <div className={styles.grid} />
        <div className={styles.noise} />

        <div className={styles.particles}>
          {Array.from({ length: 24 }).map((_, index) => (
            <span
              key={index}
              style={
                {
                  "--x": `${(index * 37) % 100}%`,
                  "--y": `${(index * 61) % 100}%`,
                  "--delay": `${(index % 8) * -1.2}s`,
                  "--duration": `${8 + (index % 6)}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            <span />
            <span />
            <span />
          </div>

          <div className={styles.brandText}>
            <strong>AI·3D越境科技</strong>
            <span>AI VISUAL COMPUTING LAB</span>
          </div>
        </div>

        <nav className={styles.navigation}>
          <button className={styles.activeNav}>生成工作台</button>
          <button>资产中心</button>
          <button>模型编辑</button>
          <button>应用场景</button>
        </nav>

        <div className={styles.headerActions}>
          <div className={styles.systemBadge}>
            <span />
            演示引擎在线
          </div>

          <button className={styles.iconButton}>?</button>

          <div className={styles.avatar}>越</div>
        </div>
      </header>

      <div className={styles.studio}>
        <aside className={styles.toolRail}>
          <button className={styles.activeTool}>
            <span className={styles.toolIcon}>◇</span>
            <span>生成</span>
          </button>

          <button>
            <span className={styles.toolIcon}>▦</span>
            <span>资产</span>
          </button>

          <button>
            <span className={styles.toolIcon}>◫</span>
            <span>纹理</span>
          </button>

          <button>
            <span className={styles.toolIcon}>△</span>
            <span>拓扑</span>
          </button>

          <button>
            <span className={styles.toolIcon}>◎</span>
            <span>动画</span>
          </button>

          <div className={styles.toolRailSpacer} />

          <button>
            <span className={styles.toolIcon}>⚙</span>
            <span>设置</span>
          </button>
        </aside>

        <aside className={styles.controlPanel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionCode}>
                IMAGE TO 3D
              </span>
              <h2>图片生成模型</h2>
            </div>

            <span className={styles.demoTag}>DEMO</span>
          </div>

          <div className={styles.modeTabs}>
            <button className={styles.activeMode}>单图生成</button>
            <button>多视图</button>
          </div>

          <div
            className={`${styles.uploadCard} ${
              dragging ? styles.uploadCardDragging : ""
            }`}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              selectFile(event.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              hidden
            />

            <img
              src={previewUrl}
              alt="输入图片预览"
              className={styles.uploadPreview}
            />

            <div className={styles.uploadOverlay}>
              <div className={styles.uploadIcon}>＋</div>
              <strong>
                {uploadedFile ? "更换图片" : "上传参考图片"}
              </strong>
              <span>JPG · PNG · WEBP</span>
            </div>

            <div className={styles.cornerTopLeft} />
            <div className={styles.cornerTopRight} />
            <div className={styles.cornerBottomLeft} />
            <div className={styles.cornerBottomRight} />
          </div>

          <div className={styles.fileInfo}>
            <div>
              <span>INPUT ASSET</span>
              <strong>
                {uploadedFile
                  ? uploadedFile.name
                  : "獬豸黄金摆件.jpg"}
              </strong>
            </div>

            <span className={styles.readyBadge}>READY</span>
          </div>

          <section className={styles.settingsSection}>
            <div className={styles.settingsTitle}>
              <span>生成设置</span>
              <small>GENERATION CONFIG</small>
            </div>

            <div className={styles.settingRow}>
              <div>
                <strong>几何质量</strong>
                <span>高精度网格重建</span>
              </div>

              <select defaultValue="精细">
                <option>标准</option>
                <option>精细</option>
                <option>超精细</option>
              </select>
            </div>

            <div className={styles.settingRow}>
              <div>
                <strong>PBR 材质</strong>
                <span>金属度与粗糙度贴图</span>
              </div>

              <button className={styles.switchActive}>
                <span />
              </button>
            </div>

            <div className={styles.settingRow}>
              <div>
                <strong>智能拓扑</strong>
                <span>自动优化模型面数</span>
              </div>

              <button className={styles.switchActive}>
                <span />
              </button>
            </div>

            <div className={styles.settingRow}>
              <div>
                <strong>自动补全</strong>
                <span>推演被遮挡结构</span>
              </div>

              <button className={styles.switchActive}>
                <span />
              </button>
            </div>
          </section>

          <div className={styles.engineCard}>
            <div className={styles.engineIcon}>AI</div>

            <div>
              <span>生成引擎</span>
              <strong>YUEJING 3D ENGINE</strong>
              <small>高精度演示模型</small>
            </div>

            <span className={styles.engineOnline} />
          </div>

          <button
            className={styles.generateButton}
            onClick={startGeneration}
            disabled={status === "processing"}
          >
            <span>
              {status === "processing"
                ? `正在生成 ${progress}%`
                : status === "completed"
                  ? "重新生成模型"
                  : "开始生成 3D 模型"}
            </span>

            <span className={styles.buttonArrow}>→</span>
          </button>

          <p className={styles.demoNotice}>
            演示模式将在约 60 秒后呈现预置模型，不产生
            API 费用。
          </p>
        </aside>

        <section className={styles.viewport}>
          <div className={styles.viewportHeader}>
            <div className={styles.viewportTitle}>
              <span className={styles.viewportStatusDot} />

              <div>
                <strong>
                  {status === "idle"
                    ? "等待生成"
                    : status === "processing"
                      ? "AI 模型重建中"
                      : "模型生成完成"}
                </strong>

                <span>
                  PROJECT / XIEZHI_GOLDEN_SCULPTURE
                </span>
              </div>
            </div>

            <div className={styles.viewportTools}>
              <button>适应视图</button>
              <button>网格</button>
              <button>灯光</button>

              {status === "completed" && modelAvailable && (
                <div className={styles.viewSwitch}>
                  <button
                    className={
                      viewMode === "video"
                        ? styles.activeView
                        : ""
                    }
                    onClick={() => setViewMode("video")}
                  >
                    动态展示
                  </button>

                  <button
                    className={
                      viewMode === "model"
                        ? styles.activeView
                        : ""
                    }
                    onClick={() => setViewMode("model")}
                  >
                    3D 交互
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className={styles.viewportCanvas}>
            <div className={styles.axisWidget}>
              <span className={styles.axisY}>Y</span>
              <span className={styles.axisX}>X</span>
              <span className={styles.axisZ}>Z</span>
              <i />
            </div>

            {status === "idle" && (
              <div className={styles.idleState}>
                <div className={styles.idleArtwork}>
                  <img
                    src={previewUrl}
                    alt="獬豸黄金摆件"
                  />

                  <div className={styles.idleGlow} />

                  <div className={styles.idleLabel}>
                    <span>REFERENCE IMAGE</span>
                    <strong>獬豸黄金摆件</strong>
                  </div>
                </div>

                <div className={styles.idleCopy}>
                  <span className={styles.copyEyebrow}>
                    AI IMAGE TO 3D
                  </span>

                  <h1>
                    让二维图像
                    <br />
                    进入三维世界
                  </h1>

                  <p>
                    上传一张图片，启动视觉解析、空间估计、
                    点云构建、网格重建与材质生成演示。
                  </p>
                </div>
              </div>
            )}

            {status === "processing" && (
              <div className={styles.processingState}>
                <video
                  className={styles.processingVideo}
                  src="/assets/xiezhi-showcase.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                />

                <div className={styles.processingShade} />
                <div className={styles.scanLine} />

                <div className={styles.scanFrame}>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>

                <div className={styles.pointCloud}>
                  {Array.from({ length: 60 }).map(
                    (_, index) => (
                      <i
                        key={index}
                        style={
                          {
                            "--px": `${(index * 47) % 92}%`,
                            "--py": `${(index * 73) % 88}%`,
                            "--pd": `${(index % 12) * -0.2}s`,
                          } as React.CSSProperties
                        }
                      />
                    ),
                  )}
                </div>

                <div className={styles.processingHud}>
                  <CircularProgress progress={progress} />

                  <div className={styles.processingText}>
                    <span>
                      STAGE {currentPhase.number} / 05
                    </span>

                    <h2>{currentPhase.title}</h2>
                    <p>{currentPhase.subtitle}</p>

                    <div className={styles.progressBar}>
                      <div
                        style={{
                          width: `${progress}%`,
                        }}
                      />
                    </div>

                    <div className={styles.progressMeta}>
                      <span>
                        ESTIMATED TIME{" "}
                        <strong>
                          00:
                          {remainingSeconds
                            .toString()
                            .padStart(2, "0")}
                        </strong>
                      </span>

                      <span>
                        VERTICES{" "}
                        <strong>
                          {Math.floor(
                            4280 + progress * 2167,
                          ).toLocaleString()}
                        </strong>
                      </span>

                      <span>
                        FACES{" "}
                        <strong>
                          {Math.floor(
                            2100 + progress * 1059,
                          ).toLocaleString()}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.phaseTimeline}>
                  {phases.map((phase, index) => (
                    <div
                      key={phase.number}
                      className={`${styles.phaseItem} ${
                        index < safePhaseIndex
                          ? styles.phaseCompleted
                          : index === safePhaseIndex
                            ? styles.phaseCurrent
                            : ""
                      }`}
                    >
                      <span>{phase.number}</span>
                      <div>
                        <strong>{phase.title}</strong>
                        <small>
                          {index < safePhaseIndex
                            ? "COMPLETE"
                            : index === safePhaseIndex
                              ? "PROCESSING"
                              : "PENDING"}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {status === "completed" && (
              <div className={styles.completedState}>
                {viewMode === "model" && modelAvailable ? (
                  <div className={styles.modelCanvas}>
                    <ModelViewport />
                  </div>
                ) : (
                  <video
                    className={styles.resultVideo}
                    src="/assets/xiezhi-showcase.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                    controls
                  />
                )}

                <div className={styles.completedBadge}>
                  <span className={styles.completedCheck}>
                    ✓
                  </span>

                  <div>
                    <span>GENERATION COMPLETE</span>
                    <strong>獬豸黄金摆件 · 高精度模型</strong>
                  </div>
                </div>

                <div className={styles.modelStatistics}>
                  <div>
                    <span>顶点</span>
                    <strong>220,980</strong>
                  </div>

                  <div>
                    <span>面数</span>
                    <strong>108,024</strong>
                  </div>

                  <div>
                    <span>材质</span>
                    <strong>PBR 4K</strong>
                  </div>

                  <div>
                    <span>格式</span>
                    <strong>GLB</strong>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.viewportFooter}>
              <div>
                <span>FPS</span>
                <strong>60</strong>
              </div>

              <div>
                <span>RENDER</span>
                <strong>WEBGL</strong>
              </div>

              <div>
                <span>ENGINE</span>
                <strong>YJ-3D</strong>
              </div>

              <button onClick={resetWorkspace}>
                重置视图
              </button>
            </div>
          </div>
        </section>

        <aside className={styles.assetPanel}>
          <div className={styles.assetHeader}>
            <div>
              <span>PROJECT ASSETS</span>
              <h3>项目资产</h3>
            </div>

            <button>＋</button>
          </div>

          <div className={styles.assetTabs}>
            <button className={styles.activeAssetTab}>
              全部
            </button>
            <button>图像</button>
            <button>模型</button>
          </div>

          <div className={styles.assetSearch}>
            <span>⌕</span>
            <input placeholder="搜索资产" />
          </div>

          <div className={styles.assetList}>
            <button className={styles.activeAsset}>
              <div className={styles.assetThumbnail}>
                <img
                  src="/assets/xiezhi-reference.jpg"
                  alt="獬豸参考图"
                />
              </div>

              <div className={styles.assetInformation}>
                <strong>獬豸参考图</strong>
                <span>IMAGE · JPG</span>
              </div>

              <span className={styles.assetMenu}>•••</span>
            </button>

            <button>
              <div className={styles.assetThumbnail}>
                <video
                  src="/assets/xiezhi-showcase.mp4"
                  muted
                />
                <span className={styles.playIcon}>▶</span>
              </div>

              <div className={styles.assetInformation}>
                <strong>模型动态展示</strong>
                <span>VIDEO · MP4</span>
              </div>

              <span className={styles.assetMenu}>•••</span>
            </button>

            <button>
              <div
                className={`${styles.assetThumbnail} ${styles.generatedThumbnail}`}
              >
                <span>3D</span>
              </div>

              <div className={styles.assetInformation}>
                <strong>獬豸模型</strong>
                <span>
                  {status === "completed"
                    ? "MODEL · READY"
                    : "MODEL · PENDING"}
                </span>
              </div>

              <span
                className={`${styles.assetState} ${
                  status === "completed"
                    ? styles.assetStateReady
                    : ""
                }`}
              />
            </button>
          </div>

          <div className={styles.assetDetails}>
            <div className={styles.detailTitle}>
              <span>资产信息</span>
              <small>DETAILS</small>
            </div>

            <dl>
              <div>
                <dt>项目名称</dt>
                <dd>獬豸黄金摆件</dd>
              </div>

              <div>
                <dt>创建方式</dt>
                <dd>图片生成 3D</dd>
              </div>

              <div>
                <dt>模型质量</dt>
                <dd>高精度</dd>
              </div>

              <div>
                <dt>纹理规格</dt>
                <dd>PBR · 4K</dd>
              </div>

              <div>
                <dt>生成状态</dt>
                <dd>
                  {status === "idle"
                    ? "等待开始"
                    : status === "processing"
                      ? `${progress}%`
                      : "已完成"}
                </dd>
              </div>
            </dl>
          </div>

          <div className={styles.assetFooter}>
            <div>
              <span className={styles.storageBar}>
                <i />
              </span>

              <span>项目存储 1.28 GB / 10 GB</span>
            </div>

            <button>管理资产</button>
          </div>
        </aside>
      </div>
    </main>
  );
}

useGLTF.preload("/models/demo.glb");
