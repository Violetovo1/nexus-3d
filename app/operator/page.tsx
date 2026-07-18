"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./operator.module.css";

type OperatorJob = {
  code: string;
  status: string;
  image_name: string | null;
  image_url: string | null;
  model_name: string | null;
  model_url: string | null;
  created_at: string;
  model_ready_at: string | null;
  updated_at: string;
};

type UploadState = {
  file: File | null;
  busy: boolean;
  message: string;
  error: string;
};

const EMPTY_UPLOAD_STATE: UploadState = {
  file: null,
  busy: false,
  message: "",
  error: "",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function statusText(status: string) {
  if (status === "processing") return "等待模型";
  if (status === "model_uploading") return "模型上传中";
  if (status === "ready") return "模型已就绪";
  if (status === "completed") return "演示已完成";
  if (status === "failed") return "任务失败";
  return status;
}

export default function OperatorPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [jobs, setJobs] = useState<OperatorJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [globalError, setGlobalError] = useState("");
  const [uploadStates, setUploadStates] = useState<
    Record<string, UploadState>
  >({});

  const waitingCount = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.status === "processing" ||
          job.status === "model_uploading",
      ).length,
    [jobs],
  );

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);

    try {
      const response = await fetch("/api/operator/jobs", {
        cache: "no-store",
      });

      if (response.status === 401) {
        setAuthenticated(false);
        setJobs([]);
        return;
      }

      const result = (await response.json()) as {
        jobs?: OperatorJob[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "读取任务失败");
      }

      setAuthenticated(true);
      setJobs(result.jobs || []);
      setGlobalError("");
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "读取任务失败",
      );
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!authenticated) return;

    const timer = window.setInterval(() => {
      void loadJobs();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [authenticated, loadJobs]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");

    try {
      const response = await fetch("/api/operator/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "登录失败");
      }

      setPassword("");
      setAuthenticated(true);
      await loadJobs();
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "登录失败",
      );
    } finally {
      setLoginBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/operator/logout", { method: "POST" });
    setAuthenticated(false);
    setJobs([]);
  }

  function updateUploadState(code: string, patch: Partial<UploadState>) {
    setUploadStates((current) => ({
      ...current,
      [code]: {
        ...(current[code] || EMPTY_UPLOAD_STATE),
        ...patch,
      },
    }));
  }

  function chooseModel(
    code: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] || null;
    event.target.value = "";

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".glb")) {
      updateUploadState(code, {
        file: null,
        error: "请选择 .glb 文件",
        message: "",
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      updateUploadState(code, {
        file: null,
        error: "GLB 文件不能超过 50MB",
        message: "",
      });
      return;
    }

    updateUploadState(code, {
      file,
      error: "",
      message: "模型已选择，等待上传",
    });
  }

  async function uploadModel(job: OperatorJob) {
    const uploadState = uploadStates[job.code] || EMPTY_UPLOAD_STATE;
    const file = uploadState.file;

    if (!file) {
      updateUploadState(job.code, {
        error: "请先选择对应的 GLB 文件",
      });
      return;
    }

    updateUploadState(job.code, {
      busy: true,
      error: "",
      message: "正在申请上传通道...",
    });

    try {
      const uploadUrlResponse = await fetch(
        `/api/operator/jobs/${encodeURIComponent(job.code)}/upload-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileSize: file.size,
          }),
        },
      );

      const uploadUrlResult = (await uploadUrlResponse.json()) as {
        upload?: {
          bucket: string;
          path: string;
          token: string;
        };
        error?: string;
      };

      if (!uploadUrlResponse.ok || !uploadUrlResult.upload) {
        throw new Error(uploadUrlResult.error || "申请上传地址失败");
      }

      updateUploadState(job.code, {
        message: "正在上传 GLB 模型...",
      });

      const supabase = getSupabaseBrowserClient();
      const { error: storageError } = await supabase.storage
        .from(uploadUrlResult.upload.bucket)
        .uploadToSignedUrl(
          uploadUrlResult.upload.path,
          uploadUrlResult.upload.token,
          file,
          {
            contentType: "model/gltf-binary",
            cacheControl: "3600",
          },
        );

      if (storageError) {
        throw new Error(`模型上传失败：${storageError.message}`);
      }

      updateUploadState(job.code, {
        message: "正在通知演示端...",
      });

      const completeResponse = await fetch(
        `/api/operator/jobs/${encodeURIComponent(job.code)}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelPath: uploadUrlResult.upload.path,
            modelName: file.name,
          }),
        },
      );

      const completeResult = (await completeResponse.json()) as {
        error?: string;
      };

      if (!completeResponse.ok) {
        throw new Error(completeResult.error || "更新任务状态失败");
      }

      updateUploadState(job.code, {
        busy: false,
        file: null,
        error: "",
        message: "上传成功，演示端将自动显示模型",
      });

      await loadJobs();
    } catch (error) {
      updateUploadState(job.code, {
        busy: false,
        error:
          error instanceof Error ? error.message : "上传模型失败",
        message: "",
      });
    }
  }

  if (authenticated === null) {
    return (
      <main className={styles.loadingScreen}>
        <div className={styles.loader} />
        <span>正在连接任务中心...</span>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className={styles.loginPage}>
        <div className={styles.loginGlow} />
        <form className={styles.loginCard} onSubmit={login}>
          <div className={styles.brandMark}>AI</div>
          <span className={styles.eyebrow}>OPERATOR CONSOLE</span>
          <h1>AI·3D越境科技</h1>
          <p>输入管理密码，进入跨设备模型同步控制台。</p>

          <label>
            <span>管理密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="请输入 OPERATOR_PASSWORD"
              autoComplete="current-password"
            />
          </label>

          {loginError && <div className={styles.formError}>{loginError}</div>}

          <button disabled={loginBusy || !password}>
            {loginBusy ? "验证中..." : "进入操作端"}
          </button>
          <small>登录状态将在 12 小时后自动失效</small>
        </form>
      </main>
    );
  }

  return (
    <main className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>AI</div>
          <div>
            <strong>AI·3D越境科技</strong>
            <span>MODEL OPERATOR CONSOLE</span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <div className={styles.onlineBadge}>
            <span />
            实时同步
          </div>
          <button onClick={() => void loadJobs()} disabled={loadingJobs}>
            {loadingJobs ? "刷新中" : "刷新任务"}
          </button>
          <button onClick={logout}>退出</button>
        </div>
      </header>

      <section className={styles.summary}>
        <div>
          <span>待处理任务</span>
          <strong>{waitingCount}</strong>
        </div>
        <div>
          <span>任务总数</span>
          <strong>{jobs.length}</strong>
        </div>
        <div>
          <span>已同步模型</span>
          <strong>{jobs.filter((job) => job.status === "ready").length}</strong>
        </div>
        <div>
          <span>自动刷新</span>
          <strong>3 SEC</strong>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.sectionHeading}>
          <div>
            <span>LIVE JOB QUEUE</span>
            <h1>模型同步任务</h1>
          </div>
          <p>
            在 Tripo 生成模型后，找到相同任务编号，上传 GLB 即可。
          </p>
        </div>

        {globalError && <div className={styles.globalError}>{globalError}</div>}

        {!loadingJobs && jobs.length === 0 && (
          <div className={styles.emptyState}>
            <div>◇</div>
            <h2>暂无生成任务</h2>
            <p>演示端点击“开始生成 3D 模型”后，任务会出现在这里。</p>
          </div>
        )}

        <div className={styles.jobGrid}>
          {jobs.map((job) => {
            const uploadState =
              uploadStates[job.code] || EMPTY_UPLOAD_STATE;
            const ready = job.status === "ready";

            return (
              <article className={styles.jobCard} key={job.code}>
                <div className={styles.preview}>
                  {job.image_url ? (
                    <img src={job.image_url} alt={job.image_name || job.code} />
                  ) : (
                    <div className={styles.previewPlaceholder}>IMAGE</div>
                  )}
                  <div className={styles.previewCode}>{job.code}</div>
                  <div
                    className={`${styles.statusBadge} ${
                      ready ? styles.statusReady : ""
                    }`}
                  >
                    {statusText(job.status)}
                  </div>
                </div>

                <div className={styles.jobBody}>
                  <div className={styles.jobTitle}>
                    <div>
                      <span>INPUT ASSET</span>
                      <h2>{job.image_name || "未命名图片"}</h2>
                    </div>
                    <span>{formatTime(job.created_at)}</span>
                  </div>

                  <dl>
                    <div>
                      <dt>任务编号</dt>
                      <dd>{job.code}</dd>
                    </div>
                    <div>
                      <dt>模型文件</dt>
                      <dd>{job.model_name || "等待上传"}</dd>
                    </div>
                    <div>
                      <dt>更新时间</dt>
                      <dd>{formatTime(job.updated_at)}</dd>
                    </div>
                  </dl>

                  {ready ? (
                    <div className={styles.readyPanel}>
                      <span>✓</span>
                      <div>
                        <strong>模型已同步</strong>
                        <p>演示端将在满足最低等待时间后自动展示。</p>
                      </div>
                      {job.model_url && (
                        <a href={job.model_url} target="_blank" rel="noreferrer">
                          查看 GLB
                        </a>
                      )}
                    </div>
                  ) : (
                    <div className={styles.uploadPanel}>
                      <label className={styles.filePicker}>
                        <input
                          type="file"
                          accept=".glb,model/gltf-binary,application/octet-stream"
                          onChange={(event) => chooseModel(job.code, event)}
                          hidden
                        />
                        <span>选择 GLB</span>
                        <strong>
                          {uploadState.file
                            ? uploadState.file.name
                            : "尚未选择模型"}
                        </strong>
                      </label>

                      <button
                        onClick={() => void uploadModel(job)}
                        disabled={uploadState.busy || !uploadState.file}
                      >
                        {uploadState.busy
                          ? uploadState.message || "上传中..."
                          : "上传模型并完成任务"}
                      </button>

                      {uploadState.message && !uploadState.busy && (
                        <div className={styles.uploadSuccess}>
                          {uploadState.message}
                        </div>
                      )}
                      {uploadState.error && (
                        <div className={styles.uploadError}>
                          {uploadState.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
