import type { BufferGeometry, MeshStandardMaterial } from "three";

let cached: Promise<string[]> | undefined;

/** Render actual lit meshes once; the gallery maps these transparent images onto its plates. */
export function renderModuleIcons() {
  return cached ??= renderIcons();
}

async function renderIcons() {
  const T = await import("three");
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(320, 320);
  renderer.setClearColor(0, 0);
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1.9, 1.9, 1.9, -1.9, 0.1, 50);
  camera.position.set(0, 0.6, 7);
  camera.lookAt(0, 0, 0);
  scene.add(new T.AmbientLight(0xfff1dc, 2));
  const key = new T.DirectionalLight(0xffffff, 4);
  key.position.set(-3, 6, 6); scene.add(key);
  const fill = new T.DirectionalLight(0xffd7a6, 2);
  fill.position.set(4, 1, -2); scene.add(fill);
  const materials = ["#fff0da", "#c38a51", "#bc6179", "#7c9c84"].map(color =>
    new T.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.22 }));
  const [cream, gold, rose, sage] = materials;
  const images: string[] = [];
  try {
    for (let index = 0; index < 8; index++) {
      const group = new T.Group();
      const geometries: BufferGeometry[] = [];
      function mesh(geometry: BufferGeometry, material: MeshStandardMaterial, x = 0, y = 0, z = 0) {
        geometries.push(geometry);
        const item = new T.Mesh(geometry, material);
        item.position.set(x, y, z); group.add(item); return item;
      }
      function box(w: number, h: number, depth: number, material: MeshStandardMaterial, x = 0, y = 0, z = 0) {
        const s = new T.Shape(), r = Math.min(w, h) * 0.12;
        s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2);
        s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); s.lineTo(w / 2, h / 2 - r);
        s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); s.lineTo(-w / 2 + r, h / 2);
        s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); s.lineTo(-w / 2, -h / 2 + r);
        s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
        return mesh(new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 3, steps: 1 }), material, x, y, z - depth / 2);
      }
      function ball(radius: number, material: MeshStandardMaterial, x: number, y: number, z = 0) {
        return mesh(new T.SphereGeometry(radius, 32, 24), material, x, y, z);
      }
      if (index === 0) {
        const points = [[-.8, -.95], [-.8, -.4], [.55, -.4], [.75, .12], [.05, .5], [.05, 1.05]];
        mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(([x, y]) => new T.Vector3(x, y, 0))), 64, .12, 16, false), cream);
        ball(.24, rose, -.8, -.95); ball(.24, sage, .75, .12); ball(.27, gold, .05, 1.05);
      } else if (index === 1) {
        box(2.2, 1.5, .45, cream, 0, .2); box(.4, .5, .4, cream, -.65, -.65).rotation.z = -.3;
        [-.6, 0, .6].forEach(x => ball(.13, rose, x, .2, .28));
      } else if (index === 2) {
        ball(.5, cream, 0, .75); ball(.85, gold, 0, -.65).scale.set(1, .82, .65);
      } else if (index === 3) {
        box(2.5, .26, .9, gold, 0, -1); box(2.3, .2, .7, gold, 0, .55);
        [-.8, 0, .8].forEach(x => mesh(new T.CylinderGeometry(.17, .21, 1.4, 24), cream, x, -.2));
        const roof = new T.Shape(); roof.moveTo(-1.3, .65); roof.lineTo(0, 1.4); roof.lineTo(1.3, .65); roof.closePath();
        mesh(new T.ExtrudeGeometry(roof, { depth: .6, bevelEnabled: true, bevelSize: .04, bevelThickness: .04, bevelSegments: 2 }), gold, 0, 0, -.3);
      } else if (index === 4) {
        box(2.1, 2, .4, cream); box(2.12, .5, .45, rose, 0, .72);
        [-.6, .6].forEach(x => box(.14, .48, .2, gold, x, 1, .26));
        [-.6, 0, .6].forEach(x => [-.15, -.65].forEach(y => box(.25, .25, .06, sage, x, y, .24)));
      } else if (index === 5) {
        box(1.1, 1.9, .3, cream, -.59).rotation.y = -.15;
        box(1.1, 1.9, .3, cream, .59).rotation.y = .15;
        box(.13, 2, .4, gold);
        [-.6, .6].forEach(x => [.5, .1, -.3].forEach(y => box(.65, .055, .025, gold, x, y, .25)));
      } else if (index === 6) {
        mesh(new T.TorusGeometry(.64, .18, 20, 64), cream, -.5, -.3).rotation.y = -.3;
        mesh(new T.TorusGeometry(.64, .18, 20, 64), gold, .5, .3, .15).rotation.y = .3;
      } else {
        box(1.9, 1.5, 1.1, cream, 0, -.25); box(2.05, .28, 1.2, gold, 0, .65);
        box(.28, 1.55, .08, rose, 0, -.25, .6);
        [-1, 1].forEach(sign => { const bow = mesh(new T.TorusGeometry(.3, .085, 16, 36), rose, sign * .3, 1); bow.scale.y = .65; bow.rotation.z = sign * .45; });
      }
      scene.add(group);
      renderer.render(scene, camera); images.push(renderer.domElement.toDataURL("image/png"));
      scene.remove(group); geometries.forEach(geometry => geometry.dispose());
    }
    return images;
  } finally {
    materials.forEach(material => material.dispose());
    renderer.dispose(); renderer.forceContextLoss();
  }
}
