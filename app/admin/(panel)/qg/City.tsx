"use client";
// La ville de vos boutiques, en 3D.
// - Chaque boutique est un bâtiment : sa hauteur suit le chiffre d'affaires des 30 derniers jours.
// - Au centre, le QG des agents. Autour, les terrains à bâtir : les meilleures idées de la veille.
// - Les agents sont des petits personnages : ils marchent vers la boutique ou le terrain sur lequel ils travaillent.
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { QGData } from "@/lib/qg";
import { launchContent, launchVeille, qgSnapshot, setOpportunityStatus } from "../../agent-actions";

type Selected = { type: "site" | "agent" | "idea" | "qg"; id: string } | null;

const AGENTS: { id: string; kind: string; name: string; role: string; color: string }[] = [
  { id: "v1", kind: "veille", name: "Éclaireur tendances", role: "Repère les produits qui montent", color: "#6250d6" },
  { id: "v2", kind: "veille", name: "Éclaireur boutiques", role: "Trouve les boutiques qui vendent déjà", color: "#6250d6" },
  { id: "v3", kind: "veille", name: "Analyste", role: "Note chaque idée sur 100", color: "#6250d6" },
  { id: "c1", kind: "construction", name: "Chef de chantier", role: "Construit les nouvelles boutiques", color: "#eda100" },
  { id: "c2", kind: "construction", name: "Rédacteur", role: "Écrit fiches, pages et FAQ", color: "#eda100" },
  { id: "w1", kind: "contenu", name: "Auteur des guides", role: "Publie un guide par semaine et par boutique", color: "#1baf7a" },
  { id: "o1", kind: "commandes", name: "Logisticien", role: "Envoie les commandes au fournisseur, suit les colis", color: "#e34948" },
  { id: "r1", kind: "rapport", name: "Rapporteur", role: "Prépare le rapport du matin", color: "#3a3a3a" },
];

const eur = (c: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(c / 100));
const CELL = 16;

/** Emplacements autour du QG, du plus proche au plus lointain. */
function slots(n: number) {
  const out: [number, number][] = [];
  for (let r = 1; out.length < n; r++)
    for (let i = -r; i <= r; i++)
      for (let j = -r; j <= r; j++) if (Math.max(Math.abs(i), Math.abs(j)) === r) out.push([i, j]);
  return out
    .sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]))
    .slice(0, n);
}

function windowsTexture(color: string) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = "rgba(255,255,255,0.55)";
  for (let x = 0; x < 4; x++) for (let y = 0; y < 2; y++) g.fillRect(6 + x * 14, 8 + y * 30, 8, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function label(html: string, cls = "qg-label") {
  const el = document.createElement("div");
  el.className = cls;
  el.innerHTML = html;
  return new CSS2DObject(el);
}
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

export function City({ initial }: { initial: QGData }) {
  const [data, setData] = useState(initial);
  const [selected, setSelected] = useState<Selected>({ type: "qg", id: "qg" });
  const [noGL, setNoGL] = useState(false);
  const mount = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const busy = data.runs.some((r) => r.status === "en_cours");

  // Rafraîchissement : toutes les 4 s si un agent travaille, sinon toutes les 30 s
  useEffect(() => {
    const t = setInterval(async () => setData(await qgSnapshot()), busy ? 4000 : 30000);
    return () => clearInterval(t);
  }, [busy]);

  const layout = useMemo(() => {
    const sitesSorted = [...data.sites].sort((a, b) => b.revenue30 - a.revenue30);
    const s = slots(sitesSorted.length + data.ideas.length);
    return {
      sites: sitesSorted.map((site, i) => ({ site, x: s[i][0] * CELL, z: s[i][1] * CELL })),
      ideas: data.ideas.map((idea, i) => ({ idea, x: s[sitesSorted.length + i][0] * CELL, z: s[sitesSorted.length + i][1] * CELL })),
    };
    // le plan de la ville ne change que si la liste des boutiques ou des idées change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.sites.map((s) => s.id + Math.round(s.revenue30 / 5000)).join(), data.ideas.map((i) => i.id).join()]);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    const test = document.createElement("canvas");
    if (!(test.getContext("webgl2") || test.getContext("webgl"))) {
      setNoGL(true);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = () => el.clientWidth;
    const H = () => el.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.setSize(W(), H());
    labels.domElement.className = "qg-labels";
    el.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e9edf1");
    scene.fog = new THREE.Fog("#e9edf1", 110, 220);

    const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.5, 500);
    camera.position.set(54, 50, 66);
    const controls = new OrbitControls(camera, labels.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.25;
    controls.minDistance = 25;
    controls.maxDistance = 160;
    controls.target.set(0, 2, 0);

    scene.add(new THREE.HemisphereLight("#ffffff", "#c9d2da", 1.6));
    const sun = new THREE.DirectionalLight("#ffffff", 2.2);
    sun.position.set(40, 70, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, far: 200 });
    scene.add(sun);

    // Sol et rues
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: "#f6f7f8", roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const streets = new THREE.Group();
    const streetMat = new THREE.MeshStandardMaterial({ color: "#dde2e7", roughness: 1 });
    for (let k = -6; k <= 6; k++) {
      const a = new THREE.Mesh(new THREE.PlaneGeometry(3.6, CELL * 13), streetMat);
      a.rotation.x = -Math.PI / 2;
      a.position.set(k * CELL + CELL / 2, 0.01, 0);
      const b = a.clone();
      b.rotation.z = Math.PI / 2;
      b.position.set(0, 0.01, k * CELL + CELL / 2);
      streets.add(a, b);
    }
    scene.add(streets);

    const clickable: THREE.Object3D[] = [];
    const dynamic = new THREE.Group();
    scene.add(dynamic);

    // QG des agents
    const qg = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 9, 32), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.35 }));
    tower.position.y = 4.5;
    tower.castShadow = tower.receiveShadow = true;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#303030", roughness: 0.3, metalness: 0.2 }));
    dome.position.y = 9;
    dome.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.18, 8, 48), new THREE.MeshStandardMaterial({ color: "#303030" }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 6;
    qg.add(tower, dome, ring);
    qg.userData = { type: "qg", id: "qg" };
    const qgLabel = label(`<b>QG des agents</b>`);
    qgLabel.position.set(0, 13, 0);
    qg.add(qgLabel);
    scene.add(qg);
    clickable.push(qg);

    // Bâtiments et terrains (reconstruits quand le plan change)
    const buildCity = () => {
      dynamic.clear();
      clickable.splice(1);
      const L = layoutRef.current;
      const max = Math.max(...L.sites.map((s) => s.site.revenue30), 1);
      for (const { site, x, z } of L.sites) {
        const h = 3 + 24 * Math.sqrt(site.revenue30 / max);
        const g = new THREE.Group();
        const tex = windowsTexture(site.color);
        tex.repeat.set(1, Math.max(1, Math.round(h / 4)));
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(6.4, h, 6.4),
          new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, transparent: !site.active, opacity: site.active ? 1 : 0.45 }),
        );
        body.position.y = h / 2;
        body.castShadow = body.receiveShadow = true;
        const roof = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.5, 6.8), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.5 }));
        roof.position.y = h + 0.25;
        roof.castShadow = true;
        const base = new THREE.Mesh(new THREE.BoxGeometry(8, 0.25, 8), new THREE.MeshStandardMaterial({ color: "#ffffff" }));
        base.position.y = 0.12;
        base.receiveShadow = true;
        g.add(base, body, roof);
        g.position.set(x, 0, z);
        g.userData = { type: "site", id: site.id, height: h };
        const l = label(`<b>${esc(site.name)}</b><span>${eur(site.revenue30)} sur 30 j</span>`);
        l.position.set(0, h + 2.4, 0);
        g.add(l);
        dynamic.add(g);
        clickable.push(g);
      }
      for (const { idea, x, z } of L.ideas) {
        const g = new THREE.Group();
        const plot = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.18, 7.5), new THREE.MeshStandardMaterial({ color: "#c9b48a", roughness: 1 }));
        plot.position.y = 0.09;
        plot.receiveShadow = true;
        const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(5, 5, 5)), new THREE.LineBasicMaterial({ color: "#8a6d2f" }));
        frame.position.y = 2.6;
        const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 0.15), new THREE.MeshStandardMaterial({ color: "#ffffff" }));
        sign.position.set(-2.4, 1.4, 3.2);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4), new THREE.MeshStandardMaterial({ color: "#8a8a8a" }));
        pole.position.set(-2.4, 0.7, 3.2);
        g.add(plot, frame, sign, pole);
        g.position.set(x, 0, z);
        g.userData = { type: "idea", id: idea.id };
        const l = label(`<b>Idée ${idea.score}/100</b>`, "qg-label idea");
        l.position.set(0, 6.5, 0);
        g.add(l);
        dynamic.add(g);
        clickable.push(g);
      }
    };
    buildCity();
    let lastLayout = layoutRef.current;

    // Agents
    type Walker = { def: (typeof AGENTS)[number]; obj: THREE.Group; bubble: CSS2DObject; path: THREE.Vector3[]; idleUntil: number; phase: number };
    const intersections = (p: THREE.Vector3) => new THREE.Vector3(Math.round((p.x - CELL / 2) / CELL) * CELL + CELL / 2, 0, Math.round((p.z - CELL / 2) / CELL) * CELL + CELL / 2);
    const walkers: Walker[] = AGENTS.map((def, i) => {
      const obj = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.75, 4, 12), new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.5 }));
      body.position.y = 0.85;
      body.castShadow = true;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), new THREE.MeshStandardMaterial({ color: "#f3d9c4", roughness: 0.7 }));
      head.position.y = 1.75;
      head.castShadow = true;
      obj.add(body, head);
      const a = (i / AGENTS.length) * Math.PI * 2;
      obj.position.set(Math.cos(a) * 6, 0, Math.sin(a) * 6);
      obj.scale.setScalar(1.35);
      obj.userData = { type: "agent", id: def.id };
      const bubble = label("", "qg-bubble");
      bubble.position.set(0, 2.7, 0);
      bubble.visible = false;
      obj.add(bubble);
      scene.add(obj);
      clickable.push(obj);
      return { def, obj, bubble, path: [], idleUntil: 2 + i, phase: a };
    });

    const targetFor = (w: Walker): { point: THREE.Vector3; text: string } | null => {
      const run = dataRef.current.runs.find((r) => r.status === "en_cours" && r.kind === w.def.kind);
      const L = layoutRef.current;
      const siteSpot = (id: string | null) => L.sites.find((s) => s.site.id === id);
      if (run) {
        const s = siteSpot(run.site_id);
        if (s) return { point: new THREE.Vector3(s.x + (w.phase % 3) - 1, 0, s.z + 6), text: "Au travail" };
        if (L.ideas.length) {
          const idea = L.ideas[Math.floor(w.phase) % L.ideas.length];
          return { point: new THREE.Vector3(idea.x + (w.phase % 3) - 1, 0, idea.z + 6), text: w.def.kind === "veille" ? "Exploration" : "Au travail" };
        }
        return { point: new THREE.Vector3(CELL * 3 + CELL / 2, 0, (w.phase % 5) * 3), text: "Exploration" };
      }
      return null;
    };

    const planPath = (w: Walker, dest: THREE.Vector3) => {
      const from = w.obj.position.clone();
      const a = intersections(from);
      const b = intersections(dest);
      w.path = [a, new THREE.Vector3(b.x, 0, a.z), b, dest];
    };

    let raf = 0;
    let last = performance.now();
    const clock = () => performance.now() / 1000;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (lastLayout !== layoutRef.current) {
        lastLayout = layoutRef.current;
        buildCity();
      }
      for (const w of walkers) {
        const t = targetFor(w);
        const working = Boolean(t);
        (w.bubble.element as HTMLElement).textContent = t?.text ?? "";
        w.bubble.visible = working;
        if (!w.path.length) {
          if (t && w.obj.position.distanceTo(t.point) > 1.2) planPath(w, t.point);
          else if (!t && clock() > w.idleUntil) {
            // au repos : retour au QG, petite promenade de temps en temps
            const home = new THREE.Vector3(Math.cos(w.phase) * 6, 0, Math.sin(w.phase) * 6);
            if (w.obj.position.distanceTo(home) > 1.5) planPath(w, home);
            else if (!reduce && Math.random() < 0.3 && layoutRef.current.sites.length) {
              const s = layoutRef.current.sites[Math.floor(Math.random() * layoutRef.current.sites.length)];
              planPath(w, new THREE.Vector3(s.x, 0, s.z + 6));
            }
            w.idleUntil = clock() + 6 + Math.random() * 10;
          }
        }
        if (w.path.length) {
          const next = w.path[0];
          if (reduce) {
            w.obj.position.copy(w.path[w.path.length - 1]);
            w.path = [];
          } else {
            const d = next.clone().sub(w.obj.position);
            const step = (working ? 9 : 5) * dt;
            if (d.length() <= step) {
              w.obj.position.copy(next);
              w.path.shift();
            } else {
              d.normalize();
              w.obj.position.addScaledVector(d, step);
              w.obj.rotation.y = Math.atan2(d.x, d.z);
            }
          }
        }
        const moving = w.path.length > 0;
        if (!reduce) w.obj.children[0].position.y = 0.85 + (moving ? Math.abs(Math.sin(now / 110 + w.phase)) * 0.18 : working ? Math.abs(Math.sin(now / 300 + w.phase)) * 0.08 : 0);
      }
      if (!reduce) ring.rotation.z += dt * (dataRef.current.runs.some((r) => r.status === "en_cours") ? 1.4 : 0.15);
      controls.update();
      renderer.render(scene, camera);
      labels.render(scene, camera);
    };
    loop();

    // Clic : sélection d'un bâtiment, d'un terrain, d'un agent ou du QG
    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // c'était un glisser
      const r = renderer.domElement.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects(clickable, true)[0];
      let o: THREE.Object3D | null = hit?.object ?? null;
      while (o && !o.userData.type) o = o.parent;
      if (o) setSelected({ type: o.userData.type, id: o.userData.id });
    };
    labels.domElement.addEventListener("pointerdown", onDown);
    labels.domElement.addEventListener("pointerup", onUp);

    // le panneau latéral couvre la droite : on décale la vue pour centrer la ville dans l'espace visible
    const frame = () => {
      const shift = W() > 900 ? 380 : 0;
      if (shift) camera.setViewOffset(W() + shift, H(), shift, 0, W(), H());
      else camera.clearViewOffset();
    };
    frame();
    const onResize = () => {
      camera.aspect = W() / H();
      frame();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
      labels.setSize(W(), H());
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      renderer.dispose();
      el.innerHTML = "";
    };
  }, []);

  // ---------- Panneau latéral ----------
  const site = selected?.type === "site" ? data.sites.find((s) => s.id === selected.id) : null;
  const idea = selected?.type === "idea" ? data.ideas.find((i) => i.id === selected.id) : null;
  const agent = selected?.type === "agent" ? AGENTS.find((a) => a.id === selected.id) : null;
  const agentRun = agent ? data.runs.find((r) => r.kind === agent.kind) : null;
  const running = data.runs.filter((r) => r.status === "en_cours");
  const total30 = data.sites.reduce((s, x) => s + x.revenue30, 0);
  const today = data.sites.reduce((s, x) => s + x.revenueToday, 0);

  return (
    <div className="qg">
      <div className="qg-canvas" ref={mount} aria-label="Ville 3D de vos boutiques. Faites glisser pour tourner, molette pour zoomer, cliquez sur un bâtiment ou un agent.">
        {noGL && (
          <div className="qg-nogl">
            <p>La 3D n&apos;est pas disponible sur cet appareil. Voici vos boutiques :</p>
            <ul>
              {data.sites.map((s) => (
                <li key={s.id}>
                  <a href={`/admin/boutiques/${s.id}/apercu`}>{s.name}</a> : {eur(s.revenue30)} sur 30 jours
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="qg-hud">
        <div>
          <span>Aujourd&apos;hui</span>
          <b>{eur(today)}</b>
        </div>
        <div>
          <span>30 jours</span>
          <b>{eur(total30)}</b>
        </div>
        <div>
          <span>Agents au travail</span>
          <b>{running.length}</b>
        </div>
        <div>
          <span>À traiter</span>
          <b>{data.toHandle}</b>
        </div>
      </div>

      <aside className="qg-panel" aria-live="polite">
        {selected?.type === "qg" && (
          <>
            <h2>QG des agents</h2>
            <p className="muted">
              {AGENTS.length} agents. Cliquez sur un bâtiment pour voir une boutique, sur un terrain pour décider d&apos;une idée, sur un personnage pour voir ce
              qu&apos;il fait.
            </p>
            <h3>En ce moment</h3>
            {running.length ? (
              <ul className="qg-list">
                {running.map((r) => (
                  <li key={r.id}>
                    <span className="spinner" aria-hidden="true" /> {r.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Tous les agents sont au repos.</p>
            )}
            <h3>Liens trouvés par la veille</h3>
            {data.ideas.length ? (
              <ul className="qg-list">
                {data.ideas.map((i) => (
                  <li key={i.id}>
                    <button type="button" className="qg-link" onClick={() => setSelected({ type: "idea", id: i.id })}>
                      {i.product}
                    </button>{" "}
                    <span className="faint">{i.score}/100</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Aucune idée en attente.</p>
            )}
            <div className="qg-actions">
              <a className="btn" href="/admin/veille">
                Trier les idées
              </a>
              <form action={launchVeille}>
                <button className="btn quiet" type="submit">
                  Lancer une veille
                </button>
              </form>
            </div>
            <h3>L&apos;équipe</h3>
            <ul className="qg-list">
              {AGENTS.map((a) => (
                <li key={a.id}>
                  <button type="button" className="qg-link" onClick={() => setSelected({ type: "agent", id: a.id })}>
                    <i className="dot" style={{ background: a.color }} /> {a.name}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {site && (
          <>
            <h2 className="cell-site">
              <i className="dot" style={{ background: site.color }} /> {site.name}
            </h2>
            <p className="muted">{site.domain}</p>
            <dl className="kv">
              <div>
                <dt>Chiffre d&apos;affaires 30 jours</dt>
                <dd>
                  <b>{eur(site.revenue30)}</b>
                </dd>
              </div>
              <div>
                <dt>Commandes 30 jours</dt>
                <dd>{site.orders30}</dd>
              </div>
              <div>
                <dt>Aujourd&apos;hui</dt>
                <dd>
                  {eur(site.revenueToday)}, {site.ordersToday} cmd
                </dd>
              </div>
              <div>
                <dt>Produits en ligne</dt>
                <dd>{site.products}</dd>
              </div>
              <div>
                <dt>Guides publiés</dt>
                <dd>{site.guides}</dd>
              </div>
            </dl>
            <div className="qg-actions">
              <a className="btn" href={`/admin/boutiques/${site.id}/apercu`}>
                Analyse complète
              </a>
              <a className="btn quiet" href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer">
                Voir le site
              </a>
              <form action={launchContent}>
                <input type="hidden" name="site_id" value={site.id} />
                <button className="btn quiet" type="submit">
                  Écrire un guide
                </button>
              </form>
            </div>
            <button type="button" className="qg-back" onClick={() => setSelected({ type: "qg", id: "qg" })}>
              ‹ Retour au QG
            </button>
          </>
        )}

        {idea && (
          <>
            <h2>{idea.product}</h2>
            <p className="muted">
              {idea.niche}, score {idea.score}/100
            </p>
            {idea.links.length > 0 && (
              <>
                <h3>Liens trouvés</h3>
                <ul className="qg-list">
                  {idea.links.map((l) => (
                    <li key={l.url}>
                      <a className="link-blue" href={l.url} target="_blank" rel="noopener noreferrer">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="qg-actions">
              <a className="btn" href={`/admin/boutiques/creer?opportunite=${idea.id}`}>
                Construire ici
              </a>
              <form action={setOpportunityStatus}>
                <input type="hidden" name="id" value={idea.id} />
                <input type="hidden" name="status" value="ecartee" />
                <button className="btn quiet" type="submit">
                  Écarter
                </button>
              </form>
            </div>
            <button type="button" className="qg-back" onClick={() => setSelected({ type: "qg", id: "qg" })}>
              ‹ Retour au QG
            </button>
          </>
        )}

        {agent && (
          <>
            <h2 className="cell-site">
              <i className="dot" style={{ background: agent.color }} /> {agent.name}
            </h2>
            <p className="muted">{agent.role}</p>
            <h3>{agentRun ? (agentRun.status === "en_cours" ? "Travaille sur" : "Dernière tâche") : "Pas encore de tâche"}</h3>
            {agentRun && (
              <>
                <p>
                  {agentRun.title}{" "}
                  <span className={`badge ${agentRun.status === "en_cours" ? "info" : agentRun.status === "termine" ? "good" : "bad"}`}>
                    {agentRun.status === "en_cours" ? "En cours" : agentRun.status === "termine" ? "Terminé" : "Échec"}
                  </span>
                </p>
                {agentRun.log.length > 0 && <div className="log">{agentRun.log.join("\n")}</div>}
              </>
            )}
            <div className="qg-actions">
              {agent.kind === "veille" && (
                <form action={launchVeille}>
                  <button className="btn" type="submit">
                    Lancer une veille
                  </button>
                </form>
              )}
              {agent.kind === "contenu" && (
                <form action={launchContent}>
                  <button className="btn" type="submit">
                    Écrire les guides
                  </button>
                </form>
              )}
              {agent.kind === "construction" && (
                <a className="btn" href="/admin/boutiques/creer">
                  Créer une boutique
                </a>
              )}
              <a className="btn quiet" href="/admin/agents">
                Journal
              </a>
            </div>
            <button type="button" className="qg-back" onClick={() => setSelected({ type: "qg", id: "qg" })}>
              ‹ Retour au QG
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
