"use client";

import type { ChangeEvent, CSSProperties } from "react";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Html,
  OrbitControls,
  useGLTF,
} from "@react-three/drei";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./studio.module.css";

const MINIMUM_DURATION = 60;

type GenerationStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "waiting"
  | "completed"
  | "error";

type CreatedJobResponse = {
  job: {
    code: string;
  };
  upload: {
    bucket: string;
    path: string;
    token: string;
  };
};

type JobStatusResponse = {
  code: string;
  status: string;
  model_url: string | null;
  model_name: string | null;
};

const phases = [
  {
    max: 18,
    number: "01",
    title: "视觉特征解析",
    subtitle: "识别主体轮廓、结构边界与纹理层级",
  },
  {
    max: 38,
    number: "02",
    title: "深度空间估计",
    subtitle: "推演隐藏区域、透视关系与空间尺度",
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
    subtitle: "连接点云数据并生成连续三角网格",
  },
  {
    max: 100,
    number: "05",
    title: "材质纹理生成",
    subtitle: "完成 PBR 材质、光泽与纹理映射",
  },
] as const;

function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  return (
    <primitive
      object={clonedScene}
      scale={1.45}
      position={[0, -0.75, 0]}
    />
  );
}

function ModelViewport({ url }: { url: string }) {
  return (
    <Canvas
      camera={{ position: [0, 1.15, 4.8], fov: 38 }}
      dpr={[1, 1.8]}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={1.55} />
      <directionalLight
        position={[4, 6, 4]}
        intensity={3.4}
        color="#fff0c8"
      />
      <directionalLight
        position={[-4, 2, -3]}
        intensity={2.15}
        color="#66e5f0"
      />
      <spotLight
        position={[0, 6, 2]}
        angle={0.55}
        penumbra={1}
        intensity={4.4}
        color="#e5b75f"
      />

      <Suspense
        fallback={
          <Html center>
            <div className={styles.modelLoading}>模型载入中...</div>
          </Html>
        }
      >
        <Model url={url} />
        <Environment preset="city" />
        <ContactShadows
          position={[0, -1.28, 0]}
          opacity={0.5}
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
        autoRotateSpeed={0.72}
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
        } as CSSProperties
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
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const modelUrlRef = useRef<string | null>(null);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [remainingSeconds, setRemainingSeconds] =
    useState(MINIMUM_DURATION);
  const [dragging, setDragging] = useState(false);
  const [taskCode, setTaskCode] = useState("--");
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [modelName, setModelName] = useState("生成模型.glb");
  const [errorMessage, setErrorMessage] = useState("");

  const currentPhaseIndex = phases.findIndex(
    (phase) => progress <= phase.max,
  );
  const safePhaseIndex =
    currentPhaseIndex === -1 ? phases.length - 1 : currentPhaseIndex;
  const currentPhase = phases[safePhaseIndex];

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function clearTimers() {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }

  function selectFile(file?: File) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("请上传 JPG、PNG 或 WEBP 图片");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("图片大小不能超过 20MB");
      return;
    }

    clearTimers();

    if (previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setUploadedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setStatus("idle");
    setProgress(0);
    setRemainingSeconds(MINIMUM_DURATION);
    setTaskCode("--");
    setModelUrl(null);
    setModelName("生成模型.glb");
    setErrorMessage("");
    modelUrlRef.current = null;
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function completeGeneration(url: string) {
    clearTimers();
    modelUrlRef.current = url;
    setModelUrl(url);
    setProgress(100);
    setRemainingSeconds(0);

    window.setTimeout(() => {
      setStatus("completed");
    }, 700);
  }

  function updateProgressClock() {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
    }

    progressTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;

      if (elapsed < MINIMUM_DURATION) {
        const ratio = elapsed / MINIMUM_DURATION;
        const eased = Math.floor(
          97 * (1 - Math.pow(1 - ratio, 1.45)),
        );

        setProgress(Math.max(2, Math.min(97, eased)));
        setRemainingSeconds(
          Math.max(0, Math.ceil(MINIMUM_DURATION - elapsed)),
        );
        return;
      }

      setRemainingSeconds(0);

      if (modelUrlRef.current) {
        completeGeneration(modelUrlRef.current);
      } else {
        setProgress(98);
        setStatus("waiting");
      }
    }, 200);
  }

  async function pollJob(code: string) {
    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(code)}`, {
        cache: "no-store",
      });

      if (!response.ok) return;

      const job = (await response.json()) as JobStatusResponse;

      if (job.model_url && job.status === "ready") {
        modelUrlRef.current = job.model_url;
        setModelUrl(job.model_url);
        setModelName(job.model_name || "生成模型.glb");

        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        if (elapsed >= MINIMUM_DURATION) {
          completeGeneration(job.model_url);
        }
      }
    } catch {
      // 网络短暂波动时保持生成动画，下一轮继续查询。
    }
  }

  function startPolling(code: string) {
    void pollJob(code);

    if (pollingTimerRef.current) {
      clearInterval(pollingTimerRef.current);
    }

    pollingTimerRef.current = setInterval(() => {
      void pollJob(code);
    }, 2000);
  }

  async function startGeneration() {
    if (!uploadedFile || !previewUrl) {
      alert("请先上传一张图片，再开始生成模型");
      fileInputRef.current?.click();
      return;
    }

    if (status === "uploading" || status === "processing") return;

    clearTimers();
    modelUrlRef.current = null;
    startedAtRef.current = Date.now();
    setTaskCode("正在创建...");
    setStatus("uploading");
    setProgress(2);
    setRemainingSeconds(MINIMUM_DURATION);
    setModelUrl(null);
    setErrorMessage("");
    updateProgressClock();

    try {
      const createResponse = await fetch("/api/jobs/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName: uploadedFile.name,
          fileType: uploadedFile.type,
          fileSize: uploadedFile.size,
        }),
      });

      const createResult = (await createResponse.json()) as
        | CreatedJobResponse
        | { error?: string };

      if (!createResponse.ok || !("job" in createResult)) {
        throw new Error(
          "error" in createResult && createResult.error
            ? createResult.error
            : "创建任务失败",
        );
      }

      const code = createResult.job.code;
      setTaskCode(code);

      const supabase = getSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(createResult.upload.bucket)
        .uploadToSignedUrl(
          createResult.upload.path,
          createResult.upload.token,
          uploadedFile,
          {
            contentType: uploadedFile.type,
            cacheControl: "3600",
          },
        );

      if (uploadError) {
        throw new Error(`图片上传失败：${uploadError.message}`);
      }

      setStatus("processing");
      startPolling(code);
    } catch (error) {
      clearTimers();
      setStatus("error");
      setProgress(0);
      setRemainingSeconds(MINIMUM_DURATION);
      setErrorMessage(
        error instanceof Error ? error.message : "启动任务失败",
      );
    }
  }

  function resetWorkspace() {
    clearTimers();
    modelUrlRef.current = null;
    setStatus("idle");
    setProgress(0);
    setRemainingSeconds(MINIMUM_DURATION);
    setTaskCode("--");
    setModelUrl(null);
    setErrorMessage("");
  }

  const fileSize = uploadedFile
    ? `${(uploadedFile.size / 1024 / 1024).toFixed(2)} MB`
    : "--";

  const fileFormat = uploadedFile
    ? uploadedFile.type.replace("image/", "").toUpperCase()
    : "--";

  const isBusy = status === "uploading" || status === "processing";
  const isGenerating =
    status === "uploading" ||
    status === "processing" ||
    status === "waiting";

  return (
    <main className={styles.app}>
      <div className={styles.background} aria-hidden="true">
        <div className={styles.auroraGold} />
        <div className={styles.auroraBlue} />
        <div className={styles.auroraPurple} />
        <div className={styles.grid} />
        <div className={styles.noise} />
        <img
          className={styles.xiezhiBackground}
          src="/assets/xiezhi-bg.png"
          alt=""
        />
        <div className={styles.particles}>
          {Array.from({ length: 26 }).map((_, index) => (
            <span
              key={index}
              style={
                {
                  "--x": `${(index * 37) % 100}%`,
                  "--y": `${(index * 61) % 100}%`,
                  "--delay": `${(index % 8) * -1.2}s`,
                  "--duration": `${8 + (index % 6)}s`,
                } as CSSProperties
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
            云端协作在线
          </div>
          <button className={styles.iconButton} aria-label="帮助">
            ?
          </button>
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
              <span className={styles.sectionCode}>IMAGE TO 3D</span>
              <h2>图片生成模型</h2>
            </div>
            <span className={styles.demoTag}>LIVE DEMO</span>
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
            onDragOver={(event) => event.preventDefault()}
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

            {previewUrl ? (
              <img
                src={previewUrl}
                alt="输入图片预览"
                className={styles.uploadPreview}
              />
            ) : (
              <div className={styles.emptyUploadPreview}>
                <div className={styles.emptyUploadIcon}>＋</div>
                <strong>拖入或选择图片</strong>
                <span>支持 JPG、PNG、WEBP</span>
              </div>
            )}

            {previewUrl && (
              <div className={styles.uploadOverlay}>
                <div className={styles.uploadIcon}>↥</div>
                <strong>点击更换图片</strong>
                <span>JPG · PNG · WEBP</span>
              </div>
            )}

            <div className={styles.cornerTopLeft} />
            <div className={styles.cornerTopRight} />
            <div className={styles.cornerBottomLeft} />
            <div className={styles.cornerBottomRight} />
          </div>

          <div className={styles.fileInfo}>
            <div>
              <span>INPUT ASSET</span>
              <strong>
                {uploadedFile ? uploadedFile.name : "尚未选择输入图片"}
              </strong>
            </div>
            <span
              className={
                uploadedFile ? styles.readyBadge : styles.waitingBadge
              }
            >
              {uploadedFile ? "READY" : "WAITING"}
            </span>
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
              <strong>YUEJING CLOUD WORKFLOW</strong>
              <small>双电脑协同演示模式</small>
            </div>
            <span className={styles.engineOnline} />
          </div>

          <button
            className={styles.generateButton}
            onClick={startGeneration}
            disabled={!uploadedFile || isBusy}
          >
            <span>
              {status === "uploading"
                ? "正在上传输入图片"
                : status === "processing"
                  ? `正在生成 ${progress}%`
                  : status === "waiting"
                    ? "等待操作端上传模型"
                    : status === "completed"
                      ? "重新创建生成任务"
                      : status === "error"
                        ? "重新尝试"
                        : "开始生成 3D 模型"}
            </span>
            <span className={styles.buttonArrow}>→</span>
          </button>

          {errorMessage && (
            <div className={styles.cloudError}>{errorMessage}</div>
          )}

          <p className={styles.demoNotice}>
            点击后会创建云端任务。另一台电脑打开 /operator，上传对应
            GLB；前台至少等待 60 秒后自动展示模型。
          </p>
        </aside>

        <section className={styles.viewport}>
          <div className={styles.viewportHeader}>
            <div className={styles.viewportTitle}>
              <span
                className={`${styles.viewportStatusDot} ${
                  status === "waiting" ? styles.statusWaiting : ""
                }`}
              />
              <div>
                <strong>
                  {status === "idle"
                    ? "等待输入"
                    : status === "uploading"
                      ? "正在上传输入资产"
                      : status === "processing"
                        ? "AI 模型重建中"
                        : status === "waiting"
                          ? "等待操作端同步模型"
                          : status === "completed"
                            ? "模型生成完成"
                            : "任务启动失败"}
                </strong>
                <span>PROJECT / {taskCode}</span>
              </div>
            </div>
            <div className={styles.viewportTools}>
              <button>适应视图</button>
              <button>网格</button>
              <button>灯光</button>
            </div>
          </div>

          <div className={styles.viewportCanvas}>
            <div className={styles.axisWidget}>
              <span className={styles.axisY}>Y</span>
              <span className={styles.axisX}>X</span>
              <span className={styles.axisZ}>Z</span>
              <i />
            </div>

            {(status === "idle" || status === "error") && (
              <div className={styles.idleState}>
                {previewUrl ? (
                  <>
                    <div className={styles.idleArtwork}>
                      <img src={previewUrl} alt="当前上传的参考图片" />
                      <div className={styles.idleGlow} />
                      <div className={styles.idleLabel}>
                        <span>REFERENCE IMAGE</span>
                        <strong>{uploadedFile?.name}</strong>
                      </div>
                    </div>
                    <div className={styles.idleCopy}>
                      <span className={styles.copyEyebrow}>
                        INPUT ASSET READY
                      </span>
                      <h1>
                        图像已载入
                        <br />
                        准备三维重建
                      </h1>
                      <p>
                        点击左侧开始按钮，系统将创建任务编号并把图片同步到
                        操作端。生成的 GLB 上传后会自动回传到此视口。
                      </p>
                      <div className={styles.readyInformation}>
                        <span>图像格式</span>
                        <strong>{fileFormat}</strong>
                        <span>文件大小</span>
                        <strong>{fileSize}</strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={styles.emptyWorkspace}>
                    <div className={styles.emptyWorkspaceVisual}>
                      <div className={styles.emptyCube}>
                        <span />
                        <span />
                        <span />
                      </div>
                      <div className={styles.emptyOrbit} />
                      <div className={styles.emptyOrbitSecond} />
                    </div>
                    <span className={styles.copyEyebrow}>AI IMAGE TO 3D</span>
                    <h1>
                      上传图像
                      <br />
                      开启三维创造
                    </h1>
                    <p>
                      上传 JPG、PNG 或 WEBP 图片，系统将展示完整的三维重建
                      流程，并等待操作端同步真实 GLB 模型。
                    </p>
                    <button
                      className={styles.emptyWorkspaceButton}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      选择输入图片
                      <span>→</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {isGenerating && (
              <div className={styles.processingState}>
                <img
                  className={styles.processingImage}
                  src={previewUrl}
                  alt="生成中的输入图片"
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
                  {Array.from({ length: 66 }).map((_, index) => (
                    <i
                      key={index}
                      style={
                        {
                          "--px": `${(index * 47) % 92}%`,
                          "--py": `${(index * 73) % 88}%`,
                          "--pd": `${(index % 12) * -0.2}s`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>

                <div className={styles.processingHud}>
                  <CircularProgress progress={progress} />
                  <div className={styles.processingText}>
                    <span>STAGE {currentPhase.number} / 05</span>
                    <h2>
                      {status === "uploading"
                        ? "同步输入资产"
                        : status === "waiting"
                          ? "等待模型同步"
                          : currentPhase.title}
                    </h2>
                    <p>
                      {status === "uploading"
                        ? "正在将输入图片上传至云端任务中心"
                        : status === "waiting"
                          ? `任务 ${taskCode} 已完成前置处理，等待操作端上传 GLB`
                          : currentPhase.subtitle}
                    </p>
                    <div className={styles.progressBar}>
                      <div style={{ width: `${progress}%` }} />
                    </div>
                    <div className={styles.progressMeta}>
                      <span>
                        ESTIMATED TIME
                        <strong>
                          {status === "waiting"
                            ? "SYNC"
                            : `00:${remainingSeconds
                                .toString()
                                .padStart(2, "0")}`}
                        </strong>
                      </span>
                      <span>
                        JOB ID <strong>{taskCode}</strong>
                      </span>
                      <span>
                        MODEL <strong>{modelUrl ? "READY" : "PENDING"}</strong>
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
                          {status === "waiting" && index === 4
                            ? "WAITING MODEL"
                            : index < safePhaseIndex
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

            {status === "completed" && modelUrl && (
              <div className={styles.completedState}>
                <div className={styles.modelCanvas}>
                  <ModelViewport url={modelUrl} />
                </div>
                <div className={styles.completedBadge}>
                  <span className={styles.completedCheck}>✓</span>
                  <div>
                    <span>GENERATION COMPLETE</span>
                    <strong>{modelName}</strong>
                  </div>
                </div>
                <div className={styles.modelStatistics}>
                  <div>
                    <span>任务</span>
                    <strong>{taskCode}</strong>
                  </div>
                  <div>
                    <span>状态</span>
                    <strong>READY</strong>
                  </div>
                  <div>
                    <span>材质</span>
                    <strong>PBR</strong>
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
                <span>CLOUD</span>
                <strong>SUPABASE</strong>
              </div>
              <div>
                <span>MODEL</span>
                <strong>{modelUrl ? "READY" : "PENDING"}</strong>
              </div>
              <button onClick={resetWorkspace}>重置视图</button>
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
            <button className={styles.activeAssetTab}>全部</button>
            <button>图像</button>
            <button>模型</button>
          </div>

          <div className={styles.assetSearch}>
            <span>⌕</span>
            <input placeholder="搜索资产" />
          </div>

          <div className={styles.assetList}>
            <button className={uploadedFile ? styles.activeAsset : ""}>
              <div className={styles.assetThumbnail}>
                {previewUrl ? (
                  <img src={previewUrl} alt="输入图片" />
                ) : (
                  <div className={styles.emptyAssetThumbnail}>＋</div>
                )}
              </div>
              <div className={styles.assetInformation}>
                <strong>
                  {uploadedFile ? uploadedFile.name : "等待输入图片"}
                </strong>
                <span>
                  {uploadedFile ? `IMAGE · ${fileFormat}` : "IMAGE · EMPTY"}
                </span>
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
                <strong>{modelName}</strong>
                <span>
                  {status === "completed"
                    ? "MODEL · READY"
                    : status === "waiting"
                      ? "MODEL · SYNCING"
                      : "MODEL · PENDING"}
                </span>
              </div>
              <span
                className={`${styles.assetState} ${
                  status === "completed" ? styles.assetStateReady : ""
                }`}
              />
            </button>
          </div>

          <div className={styles.assetDetails}>
            <div className={styles.detailTitle}>
              <span>任务信息</span>
              <small>DETAILS</small>
            </div>
            <dl>
              <div>
                <dt>任务编号</dt>
                <dd>{taskCode}</dd>
              </div>
              <div>
                <dt>协作模式</dt>
                <dd>双电脑同步</dd>
              </div>
              <div>
                <dt>最低等待</dt>
                <dd>60 秒</dd>
              </div>
              <div>
                <dt>云端存储</dt>
                <dd>Supabase</dd>
              </div>
              <div>
                <dt>生成状态</dt>
                <dd>
                  {status === "idle"
                    ? "等待开始"
                    : status === "uploading"
                      ? "上传输入图片"
                      : status === "processing"
                        ? `${progress}%`
                        : status === "waiting"
                          ? "等待模型同步"
                          : status === "completed"
                            ? "已完成"
                            : "启动失败"}
                </dd>
              </div>
            </dl>
          </div>

          <div className={styles.assetFooter}>
            <div>
              <span className={styles.storageBar}>
                <i />
              </span>
              <span>任务资产通过云端跨设备同步</span>
            </div>
            <button
              onClick={() => window.open("/operator", "_blank")}
            >
              打开操作端
            </button>
          </div>
        </aside>
      </div>
    </main>
  );
}
