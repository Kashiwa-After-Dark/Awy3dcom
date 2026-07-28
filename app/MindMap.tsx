"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

type RouteName = "レイソルロード" | "テラス" | "未分類";

type Comment = {
  id: string;
  route: RouteName;
  observer: string;
  time: string;
  hour: number | null;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  sourceFile: string;
};

type NodeRecord = {
  comment: Comment;
  mesh: THREE.Mesh;
  line: Line2;
  label: THREE.Sprite;
};

const ROUTE_COLORS = {
  レイソルロード: 0x00d9ff,
  テラス: 0x8c52ff,
  未分類: 0x5f7892,
};

function makeLabel(text: string, color: string, width = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "500 42px 'Yu Gothic', 'Meiryo', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = color;
  context.shadowBlur = 22;
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width / 92, 1.4, 1);
  return sprite;
}

function makeNodeLabel(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const context = canvas.getContext("2d")!;
  context.font = "500 23px 'Yu Gothic', 'Meiryo', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.shadowColor = "#01050d";
  context.shadowBlur = 5;
  context.lineWidth = 4;
  context.strokeStyle = "rgba(1, 5, 13, 0.72)";
  context.fillStyle = color;
  const displayText = text.length > 16 ? `${text.slice(0, 15)}…` : text;
  context.strokeText(displayText, 256, 48);
  context.fillText(displayText, 256, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.68, depthWrite: false }),
  );
  label.scale.set(2.7, 0.5, 1);
  label.visible = false;
  return label;
}

function makeSphere(radius: number, color: number, intensity = 1.5) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 24),
    new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.24,
      metalness: 0.5,
      transparent: true,
      opacity: 0.94,
    }),
  );
}

function makeGlow(radius: number, color: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  gradient.addColorStop(0.28, "rgba(255, 255, 255, 0.48)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.scale.setScalar(radius * 5);
  glow.visible = false;
  return glow;
}

function formatTime(value: string) {
  if (!value) return "時刻不明";
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(
    new Date(value),
  );
}

function getPeopleCount(comment: Comment) {
  const text = `${comment.title} ${comment.description}`.normalize("NFKC");
  const ignoredSuffixes = new Set(["時", "分", "秒", "年", "月", "日", "円", "%", "歳"]);
  const counts = Array.from(text.matchAll(/\d+/g), (match) => {
    const end = (match.index ?? 0) + match[0].length;
    return ignoredSuffixes.has(text.slice(end, end + 1)) ? 0 : Number(match[0]);
  });
  return Math.max(1, counts.reduce((total, count) => total + count, 0));
}

export function MindMap() {
  const mountRef = useRef<HTMLDivElement>(null);
  const recordsRef = useRef<NodeRecord[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [selected, setSelected] = useState<Comment | null>(null);
  const [route, setRoute] = useState("all");
  const [hour, setHour] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/comments.json")
      .then((response) => response.json())
      .then((data: Comment[]) => setComments(data))
      .finally(() => setLoading(false));
  }, []);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (comment: Comment) => {
      const routeMatch = route === "all" || comment.route === route;
      const hourMatch = hour === "all" || comment.hour === Number(hour);
      const textMatch =
        !query || `${comment.title} ${comment.description} ${comment.observer}`.toLowerCase().includes(query);
      return routeMatch && hourMatch && textMatch;
    };
  }, [route, hour, search]);

  const visibleCount = useMemo(() => comments.filter(matches).length, [comments, matches]);

  useEffect(() => {
    for (const record of recordsRef.current) {
      const visible = matches(record.comment);
      record.mesh.visible = visible;
      record.line.visible = visible;
      if (!visible) record.label.visible = false;
    }
  }, [matches]);

  useEffect(() => {
    for (const record of recordsRef.current) {
      const isSelected = record.comment.id === selected?.id;
      const baseColor = ROUTE_COLORS[record.comment.route];
      const material = record.mesh.material as THREE.MeshPhysicalMaterial;
      const glow = record.mesh.userData.glow as THREE.Sprite;
      const glowMaterial = glow.material as THREE.SpriteMaterial;
      record.mesh.userData.selected = isSelected;
      material.color.setHex(isSelected ? 0xf5ffd7 : baseColor);
      material.emissive.setHex(isSelected ? 0xc8ff00 : baseColor);
      material.emissiveIntensity = isSelected ? 9 : 1.55;
      material.roughness = isSelected ? 0.08 : 0.24;
      material.metalness = isSelected ? 0 : 0.5;
      material.opacity = isSelected ? 1 : 0.94;
      glowMaterial.color.setHex(baseColor);
      glowMaterial.opacity = 0.82;
      glow.visible = false;
    }
  }, [selected]);

  useEffect(() => {
    if (!mountRef.current || comments.length === 0) return;
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x01050d);
    scene.fog = new THREE.FogExp2(0x01050d, 0.018);

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 160);
    camera.position.set(0, 8, 22);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.minDistance = 2.5;
    controls.maxDistance = 52;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.22;

    scene.add(new THREE.AmbientLight(0x6fbaff, 0.5));
    const cyanLight = new THREE.PointLight(0x00d9ff, 70, 35);
    cyanLight.position.set(-8, 7, 9);
    scene.add(cyanLight);
    const purpleLight = new THREE.PointLight(0x8c52ff, 55, 35);
    purpleLight.position.set(9, -4, 8);
    scene.add(purpleLight);

    const grid = new THREE.GridHelper(80, 40, 0x0b6f99, 0x082034);
    grid.position.y = -8;
    scene.add(grid);

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(1200 * 3);
    for (let i = 0; i < starPositions.length; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 90;
      starPositions[i + 1] = (Math.random() - 0.5) * 55;
      starPositions[i + 2] = (Math.random() - 0.5) * 70;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    scene.add(
      new THREE.Points(
        starGeometry,
        new THREE.PointsMaterial({ color: 0x2ccfff, size: 0.055, transparent: true, opacity: 0.52 }),
      ),
    );

    const graph = new THREE.Group();
    scene.add(graph);

    const station = makeSphere(2.05, 0x00d9ff, 2.25);
    graph.add(station);
    const stationLabel = makeLabel("柏駅", "#b9f5ff", 340);
    stationLabel.position.set(0, 0, 2.2);
    graph.add(stationLabel);

    const anchors: Record<RouteName, THREE.Vector3> = {
      レイソルロード: new THREE.Vector3(-7.2, 0, 0),
      テラス: new THREE.Vector3(7.2, 0, 0),
      未分類: new THREE.Vector3(0, -6, 0),
    };

    const lineMaterials: LineMaterial[] = [];
    const addConnection = (
      from: THREE.Vector3,
      to: THREE.Vector3,
      color: number,
      opacity = 0.6,
      width = 1.5,
    ) => {
      const geometry = new LineGeometry();
      geometry.setPositions([from.x, from.y, from.z, to.x, to.y, to.z]);
      const material = new LineMaterial({
        color,
        linewidth: width,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      material.resolution.set(mount.clientWidth, mount.clientHeight);
      lineMaterials.push(material);
      const line = new Line2(geometry, material);
      line.computeLineDistances();
      return line;
    };

    for (const routeName of ["レイソルロード", "テラス"] as RouteName[]) {
      const anchor = anchors[routeName];
      const routeSphere = makeSphere(1.45, ROUTE_COLORS[routeName], 1.9);
      routeSphere.position.copy(anchor);
      graph.add(routeSphere);
      const label = makeLabel(routeName, routeName === "レイソルロード" ? "#6be7ff" : "#bda1ff", 600);
      label.position.copy(anchor).add(new THREE.Vector3(0, 0, 1.7));
      graph.add(label);
      graph.add(addConnection(new THREE.Vector3(), anchor, ROUTE_COLORS[routeName], 0.85, 3.2));
    }

    const perRoute = new Map<RouteName, number>();
    const records: NodeRecord[] = [];
    for (const comment of comments) {
      const routeName = comment.route;
      const index = perRoute.get(routeName) ?? 0;
      perRoute.set(routeName, index + 1);
      const anchor = anchors[routeName];
      const golden = Math.PI * (3 - Math.sqrt(5));
      const angle = index * golden;
      const ring = 3.2 + (index % 13) * 0.19;
      const hourOffset = ((comment.hour ?? 21) - 20.5) * 0.64;
      const position = new THREE.Vector3(
        anchor.x + Math.cos(angle) * ring,
        hourOffset + Math.sin(index * 0.91) * 2.2,
        Math.sin(angle) * ring,
      );
      const peopleCount = getPeopleCount(comment);
      const radius = 0.15 * Math.cbrt(Math.min(peopleCount, 64));
      const mesh = makeSphere(radius, ROUTE_COLORS[routeName], 1.55);
      const glow = makeGlow(radius, ROUTE_COLORS[routeName]);
      const label = makeNodeLabel(
        comment.title || comment.description || "無題の観察",
        routeName === "レイソルロード" ? "#9ff2ff" : "#d2c0ff",
      );
      label.position.set(0, radius + 0.34, 0);
      mesh.add(glow);
      mesh.add(label);
      mesh.position.copy(position);
      mesh.userData.comment = comment;
      mesh.userData.glow = glow;
      graph.add(mesh);
      const line = addConnection(anchor, position, ROUTE_COLORS[routeName], 0.24, 1.5);
      graph.add(line);
      records.push({ comment, mesh, line, label });
    }
    recordsRef.current = records;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hovered: THREE.Mesh | null = null;
    let focusTransition: {
      cameraFrom: THREE.Vector3;
      cameraTo: THREE.Vector3;
      targetFrom: THREE.Vector3;
      targetTo: THREE.Vector3;
      startedAt: number;
    } | null = null;

    const pick = (event: PointerEvent, commit: boolean) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const candidates = records.filter((record) => record.mesh.visible).map((record) => record.mesh);
      const hit = raycaster.intersectObjects(candidates, false)[0]?.object as THREE.Mesh | undefined;
      if (hovered && hovered !== hit && !hovered.userData.selected) {
        (hovered.userData.glow as THREE.Sprite).visible = false;
      }
      hovered = hit ?? null;
      renderer.domElement.style.cursor = hit ? "pointer" : "grab";
      if (hit && !hit.userData.selected) (hit.userData.glow as THREE.Sprite).visible = true;
      if (commit && hit?.userData.comment) {
        setSelected(hit.userData.comment as Comment);
        const targetTo = hit.getWorldPosition(new THREE.Vector3());
        const viewDirection = camera.position.clone().sub(controls.target).normalize();
        const radius = (hit.geometry as THREE.SphereGeometry).parameters.radius;
        const focusDistance = Math.max(3.2, radius * 9);
        focusTransition = {
          cameraFrom: camera.position.clone(),
          cameraTo: targetTo.clone().addScaledVector(viewDirection, focusDistance),
          targetFrom: controls.target.clone(),
          targetTo,
          startedAt: performance.now(),
        };
        controls.autoRotate = false;
      }
    };
    const clearHover = () => {
      if (hovered && !hovered.userData.selected) (hovered.userData.glow as THREE.Sprite).visible = false;
      hovered = null;
      renderer.domElement.style.cursor = "grab";
    };
    const onMove = (event: PointerEvent) => pick(event, false);
    const onClick = (event: PointerEvent) => pick(event, true);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", clearHover);
    renderer.domElement.addEventListener("click", onClick);

    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      for (const material of lineMaterials) material.resolution.set(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    const cancelFocus = () => {
      focusTransition = null;
    };
    controls.addEventListener("start", cancelFocus);

    let animation = 0;
    let labelFrame = 0;
    const tick = () => {
      animation = requestAnimationFrame(tick);
      station.rotation.y += 0.003;
      if (focusTransition) {
        const progress = Math.min((performance.now() - focusTransition.startedAt) / 700, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        camera.position.lerpVectors(focusTransition.cameraFrom, focusTransition.cameraTo, eased);
        controls.target.lerpVectors(focusTransition.targetFrom, focusTransition.targetTo, eased);
        if (progress === 1) focusTransition = null;
      }
      labelFrame += 1;
      if (labelFrame % 6 === 0) {
        const selectedRecord = records.find((record) => record.mesh.userData.selected);
        const selectedPosition = selectedRecord?.mesh.position;
        const nearby = records
          .filter((record) => record.mesh.visible)
          .map((record) => {
            const cameraDistance = camera.position.distanceTo(record.mesh.position);
            const selectedDistance = selectedPosition
              ? selectedPosition.distanceTo(record.mesh.position)
              : Number.POSITIVE_INFINITY;
            return { record, cameraDistance, selectedDistance };
          })
          .filter(({ record, cameraDistance, selectedDistance }) =>
            record.mesh.userData.selected || cameraDistance < 5.8 || selectedDistance < 2.8,
          )
          .sort((a, b) => {
            const aDistance = a.record.mesh.userData.selected ? -1 : Math.min(a.cameraDistance, a.selectedDistance);
            const bDistance = b.record.mesh.userData.selected ? -1 : Math.min(b.cameraDistance, b.selectedDistance);
            return aDistance - bDistance;
          })
          .slice(0, 8);
        const visibleLabels = new Set(nearby.map(({ record }) => record));
        for (const record of records) record.label.visible = visibleLabels.has(record);
      }
      controls.update();
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(animation);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", clearHover);
      renderer.domElement.removeEventListener("click", onClick);
      controls.removeEventListener("start", cancelFocus);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      recordsRef.current = [];
    };
  }, [comments]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">KASHIWA AFTER DARK / FIELD NOTES</p>
          <h1>柏駅・夜間観察 3Dマインドマップ</h1>
        </div>
        <div className="count"><strong>{visibleCount}</strong><span>表示コメント</span></div>
      </header>

      <section className="controlbar" aria-label="コメントの絞り込み">
        <label>ルート
          <select value={route} onChange={(event) => setRoute(event.target.value)}>
            <option value="all">すべて</option>
            <option value="レイソルロード">レイソルロード</option>
            <option value="テラス">テラス</option>
          </select>
        </label>
        <label>時間帯
          <select value={hour} onChange={(event) => setHour(event.target.value)}>
            <option value="all">18～24時</option>
            {[18, 19, 20, 21, 22, 23].map((value) => <option key={value} value={value}>{value}時台</option>)}
          </select>
        </label>
        <label className="search">コメント検索
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="匂い、音、カップル…" />
        </label>
      </section>

      <section className="stage" aria-label="3Dマインドマップ">
        {loading && <div className="loading">観察コメントを読み込んでいます…</div>}
        <div ref={mountRef} className="canvas-mount" />
        <div className="guide">ドラッグ：回転　ホイール：拡大縮小　小球をクリック：詳細</div>
        <div className="route-key" aria-label="ルートの色">
          <span><i className="cyan" />レイソルロード</span>
          <span><i className="purple" />テラス</span>
        </div>
      </section>

      <aside className={`detail-panel ${selected ? "open" : ""}`} aria-live="polite">
        {selected ? (
          <>
            <button className="close" onClick={() => setSelected(null)} aria-label="詳細を閉じる">×</button>
            <p className="eyebrow">{selected.route} / {formatTime(selected.time)}</p>
            <h2>{selected.title || "無題の観察"}</h2>
            {selected.description && <p className="description">{selected.description}</p>}
            <dl>
              <div><dt>調査者</dt><dd>{selected.observer}</dd></div>
              <div><dt>元ファイル</dt><dd>{selected.sourceFile}</dd></div>
            </dl>
          </>
        ) : (
          <p>コメントの球体を選択すると詳細が表示されます。</p>
        )}
      </aside>
    </main>
  );
}
