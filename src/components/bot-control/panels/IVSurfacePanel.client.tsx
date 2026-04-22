"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface SurfacePoint {
  moneyness: number;
  expiry: number;
  iv: number;
}

interface IVSurfaceData {
  points: SurfacePoint[];
  strikes: number[];
  expiries: number[];
  spot: number;
  snapshotAt?: string;
}

interface IVSurfacePanelProps {
  botInstanceId: string;
}

const EXPIRY_LABELS = ["1D", "1W", "2W", "1M", "3M", "6M", "1Y"];

export function IVSurfacePanel({ botInstanceId }: IVSurfacePanelProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rendererRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cameraRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meshRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [surfaceData, setSurfaceData] = useState<IVSurfaceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const threeRef = useRef<boolean>(false);

  const fetchLatest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bot/iv-surface/latest?botInstanceId=${botInstanceId}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) {
        setSurfaceData({
          points: json.data.surface_grid as SurfacePoint[],
          strikes: json.data.strikes,
          expiries: json.data.expiries,
          spot: json.data.spot_price,
          snapshotAt: json.data.snapshot_at,
        });
      }
    } catch (err) {
      setError("No se pudo cargar la superficie IV");
    } finally {
      setLoading(false);
    }
  }, [botInstanceId]);

  const recalculate = async () => {
    setRecalculating(true);
    try {
      const res = await fetch("/api/bot/iv-surface/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botInstanceId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success("Superficie IV recalculada");
      await fetchLatest();
    } catch {
      toast.error("Error al recalcular superficie IV");
    } finally {
      setRecalculating(false);
    }
  };

  // Build Three.js scene once surface data is available
  useEffect(() => {
    if (!surfaceData || !mountRef.current) return;
    if (threeRef.current) return; // already initialized

    let cancelled = false;

    (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import(
        // @ts-expect-error dynamic import path
        "three/examples/jsm/controls/OrbitControls.js"
      );

      if (cancelled || !mountRef.current) return;
      threeRef.current = true;

      const W = mountRef.current.clientWidth;
      const H = mountRef.current.clientHeight || 400;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(W, H);
      renderer.setPixelRatio(window.devicePixelRatio);
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0a0f);
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 1000);
      camera.position.set(4, 3, 4);
      cameraRef.current = camera;

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 0.8;

      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
      scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0x4488ff, 1.2);
      dirLight.position.set(5, 10, 5);
      scene.add(dirLight);

      // Build surface geometry
      const nStrikes = surfaceData.strikes.length; // 21
      const nExpiries = surfaceData.expiries.length; // 7

      const geometry = new THREE.PlaneGeometry(
        4, 3,
        nStrikes - 1, nExpiries - 1
      );
      geometry.rotateX(-Math.PI / 2);

      const positions = geometry.attributes.position;
      const ivValues: number[] = [];

      for (let ei = 0; ei < nExpiries; ei++) {
        for (let si = 0; si < nStrikes; si++) {
          const idx = ei * nStrikes + si;
          const point = surfaceData.points[idx];
          if (point) {
            const vertIdx = ei * nStrikes + si;
            const x = (si / (nStrikes - 1)) * 4 - 2;
            const z = (ei / (nExpiries - 1)) * 3 - 1.5;
            const y = point.iv * 2; // scale IV for visual height
            positions.setXYZ(vertIdx, x, y, z);
            ivValues.push(point.iv);
          }
        }
      }
      geometry.computeVertexNormals();

      // Vertex colors by IV level (low=blue, mid=green, high=red)
      const minIV = Math.min(...ivValues);
      const maxIV = Math.max(...ivValues);
      const colors = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) {
        const iv = ivValues[i] ?? minIV;
        const t = maxIV > minIV ? (iv - minIV) / (maxIV - minIV) : 0.5;
        // Blue → Cyan → Green → Yellow → Red
        const r = t < 0.5 ? t * 2 * 0.2 : 0.2 + (t - 0.5) * 2 * 0.8;
        const g = t < 0.25 ? t * 4 * 0.6 : t < 0.75 ? 0.6 : 0.6 - (t - 0.75) * 4 * 0.6;
        const b = t < 0.5 ? 0.9 - t * 2 * 0.7 : 0.2;
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        shininess: 60,
        wireframe: false,
      });

      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      meshRef.current = mesh;

      // Wireframe overlay
      const wireMaterial = new THREE.MeshBasicMaterial({
        color: 0x334466,
        wireframe: true,
        opacity: 0.15,
        transparent: true,
      });
      const wireMesh = new THREE.Mesh(geometry.clone(), wireMaterial);
      scene.add(wireMesh);

      // Axes helper
      scene.add(new THREE.AxesHelper(2));

      // Animation loop
      const animate = () => {
        animFrameRef.current = requestAnimationFrame(animate);
        controls.autoRotate = autoRotate;
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      // Resize handler
      const onResize = () => {
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight || 400;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      return () => {
        window.removeEventListener("resize", onResize);
      };
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceData]);

  // Sync autoRotate to controls
  useEffect(() => {
    if (!sceneRef.current) return;
    // controls.autoRotate is updated each frame in the animate loop
  }, [autoRotate]);

  // Cleanup
  useEffect(() => {
    fetchLatest();
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.domElement?.remove();
        rendererRef.current = null;
      }
      threeRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0f] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-white">Superficie IV — XAUUSD (Heston)</h3>
          {surfaceData?.snapshotAt && (
            <p className="text-xs text-white/40 mt-0.5">
              Snapshot:{" "}
              {new Date(surfaceData.snapshotAt).toLocaleTimeString("es-ES", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRotate((v) => !v)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              autoRotate
                ? "border-blue-500/50 text-blue-400 bg-blue-500/10"
                : "border-white/10 text-white/40 hover:text-white/60"
            }`}
          >
            {autoRotate ? "Auto-rot ON" : "Auto-rot OFF"}
          </button>
          <button
            onClick={recalculate}
            disabled={recalculating}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${recalculating ? "animate-spin" : ""}`} />
            Recalcular
          </button>
          <button
            onClick={fetchLatest}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded border border-white/10 text-white/40 hover:text-white/60 transition-colors disabled:opacity-40"
          >
            <RotateCcw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Expiry labels */}
      {surfaceData && (
        <div className="flex items-center gap-0 px-4 py-1 border-b border-white/5">
          <span className="text-xs text-white/30 mr-2">Vencimientos:</span>
          {EXPIRY_LABELS.map((label, i) => (
            <span key={i} className="text-xs text-white/50 mr-3">
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Canvas container */}
      <div className="relative" style={{ height: 400 }}>
        {(loading || !surfaceData) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            {loading ? (
              <>
                <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <p className="text-sm text-white/40">Cargando superficie...</p>
              </>
            ) : error ? (
              <>
                <p className="text-sm text-white/40">{error}</p>
                <button
                  onClick={recalculate}
                  disabled={recalculating}
                  className="text-xs px-4 py-2 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
                >
                  {recalculating ? "Calculando..." : "Calcular superficie"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-white/40">Sin datos de superficie IV</p>
                <button
                  onClick={recalculate}
                  disabled={recalculating}
                  className="text-xs px-4 py-2 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
                >
                  {recalculating ? "Calculando..." : "Generar primera superficie"}
                </button>
              </>
            )}
          </div>
        )}
        <div ref={mountRef} className="w-full h-full" />
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/5">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/30">IV baja</span>
          <div className="h-2 w-24 rounded-full bg-gradient-to-r from-blue-600 via-green-500 to-red-500" />
          <span className="text-xs text-white/30">IV alta</span>
        </div>
        {surfaceData && (
          <span className="text-xs text-white/30">
            Spot:{" "}
            <span className="text-white/60">
              ${surfaceData.spot.toFixed(2)}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
